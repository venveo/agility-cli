import ansiColors from "ansi-colors";
import * as mgmtApi from "@agility/management-sdk";
import { ReferenceMapper } from "../mapper"; // Assuming correct path
import * as fs from 'fs'; // Use synchronous read for simplicity in this example, consider async if needed
import * as path from 'path';
const FormData = require("form-data"); // Ensure FormData is available

// Helper to get base file path (relative to assets folder)
// Handles different URL structures:
// 1. https://cdn.agilitycms.com/guid/assets/folder/file.jpg -> folder/file.jpg
// 2. /instance-name/folder/file.jpg -> folder/file.jpg
// 3. /instance-name/file.jpg -> file.jpg
function getAssetFilePath(originUrl: string): string {
    try {
        if (!originUrl) {
            console.warn('Empty originUrl provided to getAssetFilePath');
            return 'unknown-asset';
        }

        let pathname: string;
        try {
            // Try parsing as a full URL first
            const url = new URL(originUrl);
            pathname = url.pathname;
        } catch (e) {
            // If not a full URL, assume it's a path like /instance-name/folder/file.jpg
             if (typeof originUrl === 'string' && originUrl.startsWith('/')) {
                 pathname = originUrl.split('?')[0]; // Use the path directly, remove query params
             } else {
                 console.error(`Cannot parse originUrl: ${originUrl}`);
                 return 'error-parsing-asset-path';
             }
        }
        
        const assetsMarker = '/assets/';
        const assetsIndex = pathname.indexOf(assetsMarker);

        let relativePath: string;

        if (assetsIndex !== -1) {
            // Case 1: Found "/assets/", extract path after it
            relativePath = pathname.substring(assetsIndex + assetsMarker.length);
        } else if (pathname.startsWith('/')) {
            // Case 2 & 3: Path starts with '/', assume /instance-name/... structure
            const pathParts = pathname.split('/').filter(part => part !== ''); // Split and remove empty parts
            if (pathParts.length > 1) {
                // Remove the first part (instance-name) and join the rest
                relativePath = pathParts.slice(1).join('/'); 
            } else if (pathParts.length === 1) {
                 // Only one part after splitting, likely just the filename at the root level of the implicit container
                 relativePath = pathParts[0];
            } else {
                 console.warn(`Could not determine relative path from pathname: ${pathname}`);
                 relativePath = 'unknown-asset';
            }
        } else {
             console.warn(`Unexpected pathname format: ${pathname}. Using it directly.`);
             relativePath = pathname; // Fallback
        }

        // Decode URI components and remove potential leading/trailing slashes
        return decodeURIComponent(relativePath.replace(/^\/+|\/+$/g, ''));

    } catch (e: any) {
        console.error(`Error parsing originUrl: ${originUrl}`, e);
        return 'error-parsing-asset-path';
    }
}

export async function pushAssets(
    assets: mgmtApi.AssetMediaList[], 
    allGalleriesInput: mgmtApi.assetGalleries[], // Added galleries list for mapping context
    sourceGuid: string, // Need source GUID for file path
    targetGuid: string, 
    locale: string, // Need locale for file path
    isPreview: boolean, // Need isPreview for file path
    apiClient: mgmtApi.ApiClient, // Added apiClient
    referenceMapper: ReferenceMapper, // Added referenceMapper
    onProgress?: (processed: number, total: number, status?: 'success' | 'error') => void
): Promise<{ status: 'success' | 'error', successfulAssets: number, failedAssets: number }> { // Added return type
    
    if (!assets || assets.length === 0) {
        console.log('No assets found to process.');
        return { status: 'success', successfulAssets: 0, failedAssets: 0 };
    }

    let defaultContainer: mgmtApi.assetContainer | null = null;
    try {
         // Use passed apiClient
        defaultContainer = await apiClient.assetMethods.getDefaultContainer(targetGuid);
    } catch (err: any) {
        console.error("✗ Error fetching default asset container:", err.message);
        // Decide how to handle - maybe return error or try to continue without default URL
        return { status: 'error', successfulAssets: 0, failedAssets: 0 }; 
    }
    
    let totalAssets = 0;
    let successfulAssets = 0;
    let failedAssets = 0;
    let processedAssetsCount = 0;
    let overallStatus: 'success' | 'error' = 'success';
    
    // First calculate total assets
    for (const assetList of assets) {
        totalAssets += assetList.assetMedias.length;
    }

    const basePath = path.join(process.cwd(), 'agility-files', sourceGuid, locale, isPreview ? 'preview' : 'live', 'assets');

    for (const assetList of assets) {
        try {
            for (const media of assetList.assetMedias) {
                 let currentStatus: 'success' | 'error' = 'success';
                try {
                    // Construct proper file path and target origin URL
                    const relativeFilePath = getAssetFilePath(media.originUrl).replace(/%20/g, " ");
                    const absoluteLocalFilePath = path.join(basePath, relativeFilePath);
                    const folderPath = path.dirname(relativeFilePath) === '.' ? '/' : path.dirname(relativeFilePath); // Use / for root
                    const targetOriginUrl = defaultContainer ? `${defaultContainer.originUrl}/${relativeFilePath}` : 'unknown-origin-url';

                    // Check if asset exists by URL using the reference mapper's checkExistingAsset method
                    // Pass targetGuid and apiClient to the check method
                    const existingMedia = await referenceMapper.checkExistingAsset(targetOriginUrl, apiClient, targetGuid);

                    if (existingMedia) {
                        referenceMapper.addRecord('asset', media, existingMedia); // Use passed referenceMapper
                        const sourceFileName = media.originUrl.split('/').pop()?.split('?')[0];
                        const targetFileName = existingMedia.originUrl.split('/').pop()?.split('?')[0];
                        console.log(`✓ Asset ${ansiColors.underline(sourceFileName || 'unknown')} ${ansiColors.bold.grey('exists')} - ${ansiColors.green('Target')}: mediaID:${existingMedia.mediaID} (${targetFileName})`);
                        successfulAssets++; // Count existing as success for progress
                        // continue; // Don't continue, need to update progress
                    } else {
                         // Handle gallery if present
                         let targetMediaGroupingID = -1;
                         if (media.mediaGroupingID > 0 && media.mediaGroupingName) {
                             try {
                                // Check mapper first
                                // Assuming the type is assetMediaGrouping (singular)
                                const galleryMapping = referenceMapper.getMappingByKey<mgmtApi.assetMediaGrouping>('gallery', 'name', media.mediaGroupingName);
                                if (galleryMapping && galleryMapping.target) {
                                     targetMediaGroupingID = galleryMapping.target.mediaGroupingID;
                                } else {
                                     // Fallback: Check API directly if not in mapper
                                     const gallery = await apiClient.assetMethods.getGalleryByName(targetGuid, media.mediaGroupingName);
                                     if (gallery) {
                                         targetMediaGroupingID = gallery.mediaGroupingID;
                                         // Add mapping if found via API
                                         // Find the source gallery grouping from the passed galleries list
                                         const sourceGalleryGrouping = allGalleriesInput // Use the passed galleries list
                                            ?.flatMap(g => g.assetMediaGroupings)
                                            .find(mg => mg.name === media.mediaGroupingName);
                                         
                                         if (sourceGalleryGrouping) {
                                             referenceMapper.addRecord('gallery', sourceGalleryGrouping, gallery);
                                         } else {
                                             console.warn(`Could not find source gallery grouping named ${media.mediaGroupingName} in the input list.`);
                                         }
                                     }
                                }
                             } catch (error: any) {
                                if (!(error.response && error.response.status === 404)) {
                                    console.warn(`Warning: Could not find or map gallery ${media.mediaGroupingName} for asset ${media.fileName}: ${error.message}`);
                                }
                                 // Gallery not found, will upload without gallery
                             }
                         }

                        // Upload the asset
                        const form = new FormData();
                        if (!fs.existsSync(absoluteLocalFilePath)) {
                            throw new Error(`Local asset file not found: ${absoluteLocalFilePath}`);
                        }
                        const fileBuffer = fs.readFileSync(absoluteLocalFilePath);
                        form.append('files', fileBuffer, media.fileName);
                        
                        // Use passed apiClient
                        const uploadedMediaArray = await apiClient.assetMethods.upload(form, folderPath, targetGuid, targetMediaGroupingID);
                        
                        if (!uploadedMediaArray || uploadedMediaArray.length === 0) {
                            throw new Error(`API did not return uploaded media details for ${media.fileName}`);
                        }
                        const uploadedMedia = uploadedMediaArray[0]; // Assuming the first item corresponds to our upload
                        
                        referenceMapper.addRecord('asset', media, uploadedMedia); // Use passed referenceMapper
                        console.log(`✓ Asset uploaded: ${media.fileName} to ${folderPath} - ${ansiColors.green('Source')}: ${media.mediaID} ${ansiColors.green('Target')}: ${uploadedMedia.mediaID}`);
                        successfulAssets++;
                    }
                } catch (error: any) {
                    console.error(`✗ Error processing asset ${media.fileName || media.originUrl}:`, error.message);
                    failedAssets++;
                    currentStatus = 'error';
                    overallStatus = 'error';
                } finally {
                    // Increment and call progress in finally block for each media item
                    processedAssetsCount++;
                    if (onProgress) {
                        onProgress(processedAssetsCount, totalAssets, overallStatus);
                    }
                }
            }
        } catch (error: any) {
            console.error(`✗ Error processing asset list:`, error.message);
            overallStatus = 'error';
             // Adjust counts if the whole list fails
             const remainingInList = (assetList.assetMedias?.length || 0) - processedAssetsCount % (assetList.assetMedias?.length || 1); 
             failedAssets += remainingInList;
             processedAssetsCount += remainingInList;
             if (onProgress) {
                 onProgress(processedAssetsCount, totalAssets, overallStatus);
             }
        }
    }
    console.log(ansiColors.yellow(`Processed ${successfulAssets}/${totalAssets} assets (${failedAssets} failed)`));
    return { status: overallStatus, successfulAssets, failedAssets }; // Return status object
}