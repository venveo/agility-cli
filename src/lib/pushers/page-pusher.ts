import * as mgmtApi from "@agility/management-sdk";
import ansiColors from "ansi-colors";
import { ReferenceMapper } from "../mapper"; // Assuming correct path

// Helper function (copied from push_new.ts)
function wrapLines(str: string, width: number = 80): string {
    try {
    return str
      ?.split('\n')
      ?.map(line => {
        const result = [];
        while (line.length > width) {
          let sliceAt = line.lastIndexOf(' ', width);
          if (sliceAt === -1) sliceAt = width;
          result.push(line.slice(0, sliceAt));
          line = line.slice(sliceAt).trimStart();
        }
        result.push(line);
        return result.join('\n');
      })
      ?.join('\n');
    } catch (error) {
        console.warn("Error wrapping lines:", error);
        return str || ''; // Return original string or empty string if null/undefined
    }
  }

// Internal helper function to process a single page
async function processPage(
    page: mgmtApi.PageItem, 
    targetGuid: string, 
    locale: string, 
    isChildPage: boolean,
    apiClient: mgmtApi.ApiClient, 
    referenceMapper: ReferenceMapper
): Promise<boolean> { // Returns true on success, false on failure
    
    let existingPage: mgmtApi.PageItem | null = null;
    let correctPageID = -1;
    let channelID = -1;

    try {
        // Find the template mapping
        let templateRef = referenceMapper.getMappingByKey<mgmtApi.PageModel>('template', 'pageTemplateName', page.templateName);
        if (!templateRef?.target) {
            console.error(`✗ Template ${page.templateName} not found or processed for page: ${page.name}`);
            return false;
        }
        const targetTemplate = templateRef.target;

        // Get the sitemap to find existing page ID and channel ID
        const sitemap = await apiClient.pageMethods.getSitemap(targetGuid, locale);
        const websiteChannel = sitemap?.find(channel => channel.digitalChannelTypeName === 'Website');
        if (websiteChannel) {
            channelID = websiteChannel.digitalChannelID;
            const pageInSitemap = websiteChannel.pages.find(p => p.pageName === page.name && p.parentPageID === page.parentPageID); // Match name and parent
            if (pageInSitemap) {
                correctPageID = pageInSitemap.pageID;
                // Attempt to fetch the full existing page data
                try {
                    existingPage = await apiClient.pageMethods.getPage(correctPageID, targetGuid, locale);
                } catch (fetchError: any) {
                     if (!(fetchError.response && fetchError.response.status === 404)) {
                         console.warn(`Warning: Could not fetch existing page ${correctPageID} for ${page.name}: ${fetchError.message}`);
                     }
                     // If fetch fails (e.g., 404), existingPage remains null, proceed to create
                }
            }
        }

        // Map Content IDs in Zones
        let mappedZones = { ...page.zones }; // Clone zones
        let mappingSuccessful = true;
        for (const [zoneName, zoneContent] of Object.entries(mappedZones)) {
            const newZoneContent = [];
            for (const module of zoneContent) {
                let newModule = { ...module }; // Clone module
                if (newModule.item && typeof newModule.item === 'object' && 'contentId' in newModule.item) {
                    const sourceContentId = newModule.item.contentId;
                    const contentRef = referenceMapper.getContentMappingById<mgmtApi.ContentItem>(sourceContentId);
                    if (contentRef?.target) {
                        newModule.item = {
                            contentId: contentRef.target.contentID,
                             referenceName: contentRef.target.properties.referenceName // Include referenceName from target
                        };
                    } else {
                        console.error(`✗ Content ${sourceContentId} not found in reference mapper for page ${page.name}, module ${module.module}`);
                        mappingSuccessful = false;
                        // Decide whether to skip the module or the whole page
                        // For now, we'll mark the page as failed if any mapping fails
                        // break; // Stop processing modules in this zone if one fails
                    }
                }
                newZoneContent.push(newModule);
            }
             if (!mappingSuccessful) break; // Stop processing zones if a module failed
            mappedZones[zoneName] = newZoneContent;
        }
        
         if (!mappingSuccessful) {
            console.error(`✗ Failed to map content for page ${page.name}. Aborting page save.`);
            return false; // Page fails if content mapping fails
        }

        // Prepare payload
        const payload = {
            ...page,
            pageID: existingPage ? existingPage.pageID : -1,
            pageTemplateID: targetTemplate.pageTemplateID,
            channelID: channelID > 0 ? channelID : (existingPage ? existingPage.channelID : -1), // Use found channel ID or existing
            zones: mappedZones
        };

        const parentIDArg = payload.parentPageID || -1;
        const placeBeforeIDArg = payload.placeBeforePageItemID || -1;

        // Save the page
        const savePageResponse = await apiClient.pageMethods.savePage(payload, targetGuid, locale, parentIDArg, placeBeforeIDArg);

        // Process the response
         if (Array.isArray(savePageResponse) && savePageResponse.length > 0 && savePageResponse[0] > 0) {
            const newPageID = savePageResponse[0];
            const createdPageData = { 
                ...payload, // Use the payload data which has mapped zones
                pageID: newPageID 
            } as mgmtApi.PageItem;
            referenceMapper.addRecord('page', page, createdPageData); // Use original page for source key
            console.log(`✓ ${isChildPage ? 'Child ' : ''}Page ${ansiColors.underline(page.name)} ${existingPage ? 'Updated' : 'Created'} - Target ID: ${newPageID}`);
            return true; // Success
        } else if (savePageResponse && typeof savePageResponse === 'object' && 'errorData' in savePageResponse) {
            // Handle API error response object
            console.error(`✗ Failed to ${existingPage ? 'update' : 'create'} page ${page.name}`);
            const wrapped = wrapLines(savePageResponse.errorData, 80);
            console.error(ansiColors.red(`API Error: ${wrapped}`));
            // console.error('Payload:', JSON.stringify(payload, null, 2)); // Optional: Log failing payload
            return false; // Failure
        } else {
             // Handle unexpected response format
             console.error(`✗ Unexpected response when saving page ${page.name}:`, savePageResponse);
             return false; // Failure
        }

    } catch (error: any) {
        console.error(`✗ Error processing page ${page.name}:`, error.message);
        if (error.response?.data) {
            console.error('API Response Data:', error.response.data);
        }
        return false; // Failure
    }
}

export async function pushPages(
    pages: mgmtApi.PageItem[], 
    targetGuid: string, 
    locale: string, 
    apiClient: mgmtApi.ApiClient, 
    referenceMapper: ReferenceMapper, 
    onProgress?: (processed: number, total: number, status?: 'success' | 'error') => void
): Promise<{ status: 'success' | 'error', successfulPages: number, failedPages: number }> {
    
    if (!pages || pages.length === 0) {
        console.log('No pages found to process.');
        return { status: 'success', successfulPages: 0, failedPages: 0 };
    }
    
    let totalPages = pages.length;
    let processedPagesCount = 0; 
    let successfulPages = 0;
    let failedPages = 0;
    let overallStatus: 'success' | 'error' = 'success';

    // First process all parent pages (pages without parentPageID or parentPageID = -1)
    const parentPages = pages.filter(p => !p.parentPageID || p.parentPageID === -1);
    for (let page of parentPages) {
        const success = await processPage(page, targetGuid, locale, false, apiClient, referenceMapper);
        if (success) {
            successfulPages++;
        } else {
            failedPages++;
            overallStatus = 'error';
        }
        processedPagesCount++;
        if (onProgress) {
            onProgress(processedPagesCount, totalPages, overallStatus);
        }
    }

    // Then process all child pages
    const childPages = pages.filter(p => p.parentPageID && p.parentPageID !== -1);
    for (let page of childPages) {
        let parentProcessed = false;
        let currentStatus: 'success' | 'error' = 'success';

        // Get the target parent page ID from the mapper
        let parentRef = referenceMapper.getMappingByKey<mgmtApi.PageItem>('page', 'pageID', page.parentPageID);
        
        if (!parentRef?.target) {
            console.error(`✗ Parent page (Source ID: ${page.parentPageID}) not found or processed for child page: ${page.name}`);
            failedPages++;
            currentStatus = 'error';
            overallStatus = 'error';
        } else {
            const targetParentID = parentRef.target.pageID;
            // Create a temporary page object with the *target* parent ID for processing
            const pageWithTargetParent = { ...page, parentPageID: targetParentID };
            
            const success = await processPage(pageWithTargetParent, targetGuid, locale, true, apiClient, referenceMapper);
             if (success) {
                successfulPages++;
            } else {
                failedPages++;
                currentStatus = 'error';
                overallStatus = 'error';
            }
        }
        
        processedPagesCount++;
        if (onProgress) {
            onProgress(processedPagesCount, totalPages, overallStatus);
        }
    }

    console.log(ansiColors.yellow(`Processed ${successfulPages}/${totalPages} pages (${failedPages} failed)`));
    return { status: overallStatus, successfulPages, failedPages };
}
