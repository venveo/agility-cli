import * as mgmtApi from "@agility/management-sdk";
import ansiColors from "ansi-colors";
import { ReferenceMapper } from "../mapper"; // Assuming correct path

export async function pushGalleries(
    galleries: mgmtApi.assetGalleries[], 
    targetGuid: string, 
    apiClient: mgmtApi.ApiClient, // Added apiClient
    referenceMapper: ReferenceMapper, // Added referenceMapper
    onProgress?: (processed: number, total: number, status?: 'success' | 'error') => void
): Promise<{ status: 'success' | 'error', successfulGroupings: number, failedGroupings: number }> { // Added return type
 
    if (!galleries || galleries.length === 0) {
        console.log('No galleries found to process.');
        return { status: 'success', successfulGroupings: 0, failedGroupings: 0 }; // Return status
    }

    let totalGroupings = 0;
    // Calculate total groupings first
    for (const gallery of galleries) {
        totalGroupings += gallery.assetMediaGroupings.length;
    }
    let successfulGroupings = 0;
    let failedGroupings = 0;
    let processedCount = 0;
    let overallStatus: 'success' | 'error' = 'success'; // Track overall status

    for (const gallery of galleries) {
        try {
            for (const mediaGrouping of gallery.assetMediaGroupings) {
                let groupingProcessedSuccessfully = false;
                let currentStatus: 'success' | 'error' = 'success';
                try {
                    // Use passed apiClient
                    const existingGallery = await apiClient.assetMethods.getGalleryByName(targetGuid, mediaGrouping.name);
                    if (existingGallery) {
                        referenceMapper.addRecord('gallery', mediaGrouping, existingGallery); // Use passed referenceMapper
                        console.log(`✓ Gallery ${ansiColors.underline(mediaGrouping.name)} ${ansiColors.bold.gray('exists')} - ${ansiColors.green('Target')}: ${existingGallery.mediaGroupingID}`);
                        successfulGroupings++;
                        groupingProcessedSuccessfully = true;
                        // Don't continue, need to call progress callback
                    }
                    if (!groupingProcessedSuccessfully) { // Only try to save if it doesn't exist
                        const payload = { ...mediaGrouping, mediaGroupingID: 0 };
                        // Use passed apiClient
                        const savedGallery = await apiClient.assetMethods.saveGallery(targetGuid, payload);
                        referenceMapper.addRecord('gallery', mediaGrouping, savedGallery); // Use passed referenceMapper
                        console.log(`✓ Gallery created: ${mediaGrouping.name} - ${ansiColors.green('Source')}: ${mediaGrouping.mediaGroupingID} ${ansiColors.green('Target')}: ${savedGallery.mediaGroupingID}`);
                        successfulGroupings++;
                        groupingProcessedSuccessfully = true;
                    }
                } catch (error: any) {
                     if (error.response && error.response.status === 409) { // Conflict
                         try {
                            const conflictingGallery = await apiClient.assetMethods.getGalleryByName(targetGuid, mediaGrouping.name);
                            if (conflictingGallery) {
                                referenceMapper.addRecord('gallery', mediaGrouping, conflictingGallery);
                                console.log(`✓ Gallery ${ansiColors.underline(mediaGrouping.name)} ${ansiColors.bold.gray('exists (conflict resolved)')} - ${ansiColors.green('Target')}: ${conflictingGallery.mediaGroupingID}`);
                                successfulGroupings++;
                                groupingProcessedSuccessfully = true;
                            }
                         } catch (getError) {
                              console.error(`✗ Error getting conflicting gallery ${mediaGrouping.name}:`, getError);
                              failedGroupings++;
                              currentStatus = 'error';
                              overallStatus = 'error'; // Mark overall as error
                         }
                    } else {
                        console.error(`✗ Error processing gallery grouping ${mediaGrouping.name}:`, error.message);
                        failedGroupings++;
                        currentStatus = 'error';
                        overallStatus = 'error'; // Mark overall as error
                    }
                }
                // Call progress after attempt
                processedCount++;
                if(onProgress) {
                     // Report error status if this specific item failed or if overall process failed
                    onProgress(processedCount, totalGroupings, overallStatus);
                }
            }
        } catch (error: any) {
            console.error(`✗ Unexpected error processing gallery file:`, error.message);
             overallStatus = 'error'; // Mark overall as error
        }
    }
    console.log(ansiColors.yellow(`Processed ${successfulGroupings}/${totalGroupings} gallery groupings (${failedGroupings} failed)`));
    return { status: overallStatus, successfulGroupings, failedGroupings }; // Return status object
}