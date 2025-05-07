import { ReferenceMapper } from "../mapper";
import * as mgmtApi from '@agility/management-sdk';
import { findContentInTargetInstance } from "../finders/content-item-finder";
import { mapContentItem } from "../mappers/content-item-mapper";
import ansiColors from "ansi-colors";

export class pushContentItems {
    private apiClient: mgmtApi.ApiClient;
    private referenceMapper: ReferenceMapper;
    private targetGuid: string;
    private locale: string;
    private successfulItems: number = 0;
    private failedItems: number = 0;

    constructor(apiClient: mgmtApi.ApiClient, referenceMapper: ReferenceMapper, targetGuid: string, locale: string) {
        this.apiClient = apiClient;
        this.referenceMapper = referenceMapper;
        this.targetGuid = targetGuid;
        this.locale = locale;
        this.successfulItems = 0;
        this.failedItems = 0;
    }

    async pushContentItems(contentItems: mgmtApi.ContentItem[], onProgress?: (processed: number, total: number, status?: 'success' | 'error') => void): Promise<{ successfulItems: number, failedItems: number }> {
        const totalItemCount = contentItems.length;
        let processedItemCount = 0;
        let lastItemStatus: 'success' | 'error' = 'success'; // Track status of the *last* item attempt

        // First, process content items without nested content references
        const normalContentItems = contentItems.filter(item => {
            const definitionName = item.properties.definitionName; // Get definition name
            // Check if any field contains a nested content reference, EXCLUDING known list refs
            const isNested = Object.entries(item.fields).some(([key, field]) => {
                // Rule out PostsListing.posts field
                if (definitionName === 'PostsListing' && key === 'posts') {
                    return false;
                }
                // Add rules for other known list reference fields here if needed
                // Example: if (definitionName === 'MyListModule' && key === 'myListField') return false;

                if (typeof field === 'object' && field !== null) {
                    // A simple check for a nested content item structure
                    return 'contentid' in field || 'contentID' in field;
                }
                return false;
            });
            return !isNested;
        });

        // Then process content items with nested content references
        const nestedContentItems = contentItems.filter(item => !normalContentItems.includes(item));

     

        // Process normal content items first
        for (const contentItem of normalContentItems) {
            let existingContentItem = null;
            let mappedContentItem = null;
            let payload = null;
            lastItemStatus = 'success'; // Assume success initially
            try {
                 existingContentItem = await findContentInTargetInstance(contentItem, this.apiClient, this.targetGuid, this.locale, this.referenceMapper);

                // *** Map the content item JUST BEFORE saving ***
                 mappedContentItem = mapContentItem(contentItem, this.referenceMapper);

                // Define default SEO and Scripts
                const defaultSeo: mgmtApi.SeoProperties = { metaDescription: null, metaKeywords: null, metaHTML: null, menuVisible: null, sitemapVisible: null };
                const defaultScripts: mgmtApi.ContentScripts = { top: null, bottom: null };

                 payload = {
                    ...mappedContentItem, // Spread the mapped item first
                    contentID: -1, // ALWAYS set to -1 for create/update
                    properties: {
                        ...mappedContentItem.properties,
                        // Ensure definitionName and referenceName are present
                        definitionName: mappedContentItem.properties.definitionName || contentItem.properties.definitionName,
                        referenceName: mappedContentItem.properties.referenceName || contentItem.properties.referenceName,
                        itemOrder: existingContentItem ? existingContentItem.properties.itemOrder : mappedContentItem.properties.itemOrder
                    },
                    fields: mappedContentItem.fields,
                    seo: mappedContentItem.seo ?? defaultSeo, // Ensure seo exists
                    scripts: mappedContentItem.scripts ?? defaultScripts // Ensure scripts exists
                }

                // Restore 4th argument to true
                const saveContentItemResponse:any = await this.apiClient.contentMethods.saveContentItem(payload, this.targetGuid, this.locale);
                
                
                // Check for API error data primarily
                if (Array.isArray(saveContentItemResponse)) { 
    
            
                    // Determine the target ID from the batch response itemID or existing item
                    let targetContentId: number | undefined | null = null;
                    if (saveContentItemResponse && saveContentItemResponse.length > 0) { // Use itemID
                        targetContentId = saveContentItemResponse[0]; // Use itemID
                    } else {
                        // Fallback for updates or unexpected response structure
                        targetContentId = existingContentItem?.contentID;
                    }
    
                    if (targetContentId) { // Ensure we have a target ID
                        // Construct the target item for the mapper
                        const newContentItem: mgmtApi.ContentItem = {
                            ...payload, // Use the payload we sent
                            contentID: targetContentId // Update with the target ID
                        };
                        this.referenceMapper.addRecord('content', contentItem, newContentItem); // Use addRecord
                        // const action = existingContentItem ? 'updated':'created';
                        console.log(`✓ Content item ${ansiColors.underline(contentItem.properties.referenceName)} ${ansiColors.bold.cyan('created')} ${ansiColors.green('Source:')} ${contentItem.contentID} ${ansiColors.green(this.targetGuid)}: contentID:${targetContentId}`);
                        this.successfulItems++;
                    } else {
                        // This case might happen if creating failed silently or response is unexpected
                         console.log(`✗ Content item save reported success by API, but no target ID found.`,ansiColors.red('Source:'), contentItem.properties.referenceName , '(ID:', contentItem.contentID, ')');
                        this.failedItems++;
                        lastItemStatus = 'error'; // Mark as error
                    }
                } else {
                    console.log(`✗ Failed to ${existingContentItem ? 'update':'create'} content item (API Error)`,ansiColors.red('Source:'), contentItem.properties.referenceName , '(ID:', contentItem.contentID, ')');
                   
                    this.failedItems++;
                    lastItemStatus = 'error'; 
                   const wrapped = this.wrapLines(saveContentItemResponse.errorData, 80);
                   console.log(ansiColors.red(`API Error: ${wrapped}`)); // Log errorDataa
                   console.log('payload', JSON.stringify(payload, null, 2));
                // Log statusMessage
                }
            } catch (error) {
                 console.error(`✗ Error during processing/saving normal content item ${contentItem?.properties?.referenceName} (ID: ${contentItem?.contentID}):`, error);
                 // Optionally log payload if available
                 if (payload) console.error('Payload at time of error:', JSON.stringify(payload, null, 2));
                 this.failedItems++;
                 lastItemStatus = 'error'; // Mark as error
            }
             // Increment count and call callback after each item attempt
             processedItemCount++;
             if (onProgress) {
                 onProgress(processedItemCount, totalItemCount, lastItemStatus);
             }
        }

      
        // Then process nested content items
        for (const contentItem of nestedContentItems) {
            let existingContentItem = null;
            let mappedContentItem = null;
            let payload = null;
             lastItemStatus = 'success'; // Assume success initially
             try {
                 existingContentItem = await findContentInTargetInstance(contentItem, this.apiClient, this.targetGuid, this.locale, this.referenceMapper);

                // *** Map the content item JUST BEFORE saving ***
                 mappedContentItem = mapContentItem(contentItem, this.referenceMapper);

                // Define default SEO and Scripts
                const defaultSeo: mgmtApi.SeoProperties = { metaDescription: null, metaKeywords: null, metaHTML: null, menuVisible: null, sitemapVisible: null };
                const defaultScripts: mgmtApi.ContentScripts = { top: null, bottom: null };
                
                 payload = {
                    ...mappedContentItem, // Spread the mapped item first
                    contentID: -1, // ALWAYS set to -1 for create/update
                    properties: {
                        ...mappedContentItem.properties,
                        // Ensure definitionName and referenceName are present
                        definitionName: mappedContentItem.properties.definitionName || contentItem.properties.definitionName,
                        referenceName: mappedContentItem.properties.referenceName || contentItem.properties.referenceName,
                        itemOrder: existingContentItem ? existingContentItem.properties.itemOrder : mappedContentItem.properties.itemOrder
                    },
                    fields: mappedContentItem.fields,
                    seo: mappedContentItem.seo ?? defaultSeo, // Ensure seo exists
                    scripts: mappedContentItem.scripts ?? defaultScripts // Ensure scripts exists
                }

                // Use 4 args for detailed response
                const saveContentItemResponse: any = await this.apiClient.contentMethods.saveContentItem(payload, this.targetGuid, this.locale);

                // Check for API error data primarily
                if (Array.isArray(saveContentItemResponse)) {
    
                    // if(contentItem.properties.definitionName === 'FeaturedPost') { // Added check FeaturedPost items
                    //     console.log(ansiColors.yellow('--- DEBUG: Response for FeaturedPost Item ---'));
                    //     console.log('Raw Response:', JSON.stringify(saveContentItemResponse, null, 2));
                    //     console.log('Existing Item ID:', existingContentItem?.contentID);
                    // }
    
                    // Determine the target ID from the batch response itemID or existing item
                    let targetContentId: number | undefined | null = null;
                     if (saveContentItemResponse && saveContentItemResponse.length > 0) { // Use itemID
                        targetContentId = saveContentItemResponse[0]; // Use itemID
                        // if(contentItem.properties.definitionName === 'FeaturedPost') console.log(ansiColors.yellow('Target ID from items[0].itemID:'), targetContentId);
                    } else {
                        // Fallback for updates or unexpected response structure
                        targetContentId = existingContentItem?.contentID;
                        // if(contentItem.properties.definitionName === 'FeaturedPost') console.log(ansiColors.yellow('Target ID from fallback existingContentItem?.contentID:'), targetContentId);
                    }
    
                    if (targetContentId) { // Ensure we have a target ID
                        // Construct the target item for the mapper
                        const newContentItem: mgmtApi.ContentItem = {
                            ...payload, // Use the payload we sent
                            contentID: targetContentId // Update with the target ID
                        };
                        this.referenceMapper.addRecord('content', contentItem, newContentItem); // Use addRecord
                        // const action = existingContentItem ? 'updated':'created';
                        console.log(`✓ Nested Content item ${ansiColors.underline(contentItem.properties.referenceName)} ${ansiColors.bold.cyan('created')} ${ansiColors.green('Source:')} ${contentItem.contentID} ${ansiColors.green(this.targetGuid)} contentID:${targetContentId}`);
                        this.successfulItems++;
                    } else {
                        // This case might happen if creating failed silently or response is unexpected
                         console.log(`✗ Nested content item save reported success by API, but no target ID found.`,ansiColors.red('Source:'), contentItem.properties.referenceName , '(ID:', contentItem.contentID, ')');
                        this.failedItems++;
                        lastItemStatus = 'error'; // Mark as error
                    }
                } else {
                    console.log(`✗ Failed to ${existingContentItem ? 'update':'create'} nested content item (API Error)`,ansiColors.red('Source:'), contentItem.properties.referenceName , '(ID:', contentItem.contentID, ')');
                    console.log('API Error Data:', saveContentItemResponse.errorData); // Log errorData
                    console.log('API Status Message:', saveContentItemResponse.statusMessage); // Log statusMessage
                    this.failedItems++;
                    lastItemStatus = 'error'; // Mark as error
                }
            } catch (error) {
                console.error(`✗ Error during processing/saving nested content item ${contentItem?.properties?.referenceName} (ID: ${contentItem?.contentID}):`, error);
                 // Optionally log payload if available
                 if (payload) console.error('Payload at time of error:', JSON.stringify(payload, null, 2));
                 this.failedItems++;
                 lastItemStatus = 'error'; // Mark as error
            }
             // Increment count and call callback after each item attempt
             processedItemCount++;
             if (onProgress) {
                 onProgress(processedItemCount, totalItemCount, lastItemStatus);
             }
        }
     
        return { successfulItems: this.successfulItems, failedItems: this.failedItems };
    }

 
    private wrapLines(str, width = 80) {
        return str
          .split('\n')
          .map(line => {
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
          .join('\n');
      }
}