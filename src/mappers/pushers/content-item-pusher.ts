import { ReferenceMapper } from "../mapper";
import * as mgmtApi from '@agility/management-sdk';
import { findContentInTargetInstance } from "../finders/content-item-finder";
import { mapContentItem } from "../content-item-mapper";
import ansiColors from "ansi-colors";

export class ContentPusher {
    private apiClient: mgmtApi.ApiClient;
    private referenceMapper: ReferenceMapper;
    private targetGuid: string;
    private locale: string;

    constructor(apiClient: mgmtApi.ApiClient, referenceMapper: ReferenceMapper, targetGuid: string, locale: string) {
        this.apiClient = apiClient;
        this.referenceMapper = referenceMapper;
        this.targetGuid = targetGuid;
        this.locale = locale;
    }

    async pushContentItems(contentItems: mgmtApi.ContentItem[]) {
        // First, process content items without nested content references
        const normalContentItems = contentItems.filter(item => {
            const definitionName = item.properties.definitionName; // Get definition name
            // Check if any field contains a nested content reference, EXCLUDING known list refs
            const isNested = Object.entries(item.fields).some(([key, field]) => {
                // Rule out PostsListing.posts field
                if (definitionName === 'PostsListing' && key === 'posts') {
                    // console.log(`Skipping ${key} for ${definitionName} classification`);
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
                
                // console.log('contentIdArray', saveContentItemResponse);
                
                // Check for API error data primarily
                if (Array.isArray(saveContentItemResponse)) { 
    
                //  if(contentItem.contentID === 13 || contentItem.contentID === 23) { // Added check for item 23 too
                //     console.log(ansiColors.yellow('--- DEBUG: Response for PostsListing Item ---'));
                //     console.log('Raw Response:', JSON.stringify(saveContentItemResponse, null, 2));
                //     console.log('Existing Item ID:', existingContentItem?.contentID);
                //  }
    
                    // Determine the target ID from the batch response itemID or existing item
                    let targetContentId: number | undefined | null = null;
                    if (saveContentItemResponse && saveContentItemResponse.length > 0) { // Use itemID
                        targetContentId = saveContentItemResponse[0]; // Use itemID
                        // if(contentItem.contentID === 13 || contentItem.contentID === 23) console.log(ansiColors.yellow('Target ID from items[0].itemID:'), targetContentId);
                    } else {
                        // Fallback for updates or unexpected response structure
                        targetContentId = existingContentItem?.contentID;
                        //  if(contentItem.contentID === 13 || contentItem.contentID === 23) console.log(ansiColors.yellow('Target ID from fallback existingContentItem?.contentID:'), targetContentId);
                    }
    
                    if (targetContentId) { // Ensure we have a target ID
                        // Construct the target item for the mapper
                        const newContentItem: mgmtApi.ContentItem = {
                            ...payload, // Use the payload we sent
                            contentID: targetContentId // Update with the target ID
                        };
                        this.referenceMapper.addRecord('content', contentItem, newContentItem); // Use addRecord
                        // const action = existingContentItem ? 'updated':'created';
                        console.log(`✓ Content item ${contentItem.properties.referenceName} created ${ansiColors.green('Source:')} ${contentItem.contentID} ${ansiColors.green('Target:')} ${targetContentId}`);
                    } else {
                        // This case might happen if creating failed silently or response is unexpected
                         console.log(`✗ Content item save reported success by API, but no target ID found.`,ansiColors.red('Source:'), contentItem.properties.referenceName , '(ID:', contentItem.contentID, ')');
                        //  console.log('Payload:', JSON.stringify(payload, null, 2)); 
                        //  console.log('API Response:', saveContentItemResponse); 
                    }
                } else {
                    // console.log(payload)
                    console.log(`✗ Failed to ${existingContentItem ? 'update':'create'} content item (API Error)`,ansiColors.red('Source:'), contentItem.properties.referenceName , '(ID:', contentItem.contentID, ')');
                    // console.log('Payload:', JSON.stringify(payload, null, 2)); // Log full payload
            

                    if (saveContentItemResponse.errorData) {
                        const formattedErrorData = saveContentItemResponse.errorData.replace(/(.{250})/g, '$1\n');
                        saveContentItemResponse.errorData = formattedErrorData;
                    }
                   const wrapped = this.wrapLines(saveContentItemResponse.errorData, 80);
                   console.log(ansiColors.red(`API Error: ${wrapped}`)); // Log errorDataa
                // Log statusMessage
                }
            } catch (error) {
                 console.error(`✗ Error during processing/saving normal content item ${contentItem?.properties?.referenceName} (ID: ${contentItem?.contentID}):`, error);
                 // Optionally log payload if available
                 if (payload) console.error('Payload at time of error:', JSON.stringify(payload, null, 2));
            }
            
        }

        // console.log(ansiColors.cyan('--------------------------------'));

        // Then process nested content items
        for (const contentItem of nestedContentItems) {
            let existingContentItem = null;
            let mappedContentItem = null;
            let payload = null;
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
                        console.log(`✓ Nested Content item ${contentItem.properties.referenceName} created ${ansiColors.green('Source:')} ${contentItem.contentID} ${ansiColors.green('Target:')} ${targetContentId}`);
                    } else {
                        // This case might happen if creating failed silently or response is unexpected
                         console.log(`✗ Nested content item save reported success by API, but no target ID found.`,ansiColors.red('Source:'), contentItem.properties.referenceName , '(ID:', contentItem.contentID, ')');
                        //  console.log('Payload:', JSON.stringify(payload, null, 2)); 
                        //  console.log('API Response:', saveContentItemResponse); 
                    }
                } else {
                    console.log(`✗ Failed to ${existingContentItem ? 'update':'create'} nested content item (API Error)`,ansiColors.red('Source:'), contentItem.properties.referenceName , '(ID:', contentItem.contentID, ')');
                    // console.log('Payload:', JSON.stringify(payload, null, 2)); // Log full payload
                    console.log('API Error Data:', saveContentItemResponse.errorData); // Log errorData
                    console.log('API Status Message:', saveContentItemResponse.statusMessage); // Log statusMessage
                }
            } catch (error) {
                console.error(`✗ Error during processing/saving nested content item ${contentItem?.properties?.referenceName} (ID: ${contentItem?.contentID}):`, error);
                 // Optionally log payload if available
                 if (payload) console.error('Payload at time of error:', JSON.stringify(payload, null, 2));
            }
        }
        // console.log(ansiColors.cyan('--------------------------------'));

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
    async pushContentItem(contentItem: mgmtApi.ContentItem) {
        // const existingContentItem = await this.apiClient.contentMethods.getContentItem(contentItem.contentID.toString(),  this.targetGuid, this.locale);
        // if (existingContentItem) {
            // console.log(`Content item ${contentItem.contentID} already exists in target instance`);
        // }
    }
    

//     async pushNormalContentItems(contentItems: mgmtApi.ContentItem[], guid: string) {
//         let totalContent = contentItems.length;
//         let processedContent = 0;
//         let failedContent = 0;

//         for (const contentItem of contentItems) {
//             let apiClient = new mgmtApi.ApiClient(this._options);
//             try {
//                 const referenceName = contentItem.properties.referenceName;
                
//                 // Get the processed container using the reference mapper
//                 let refMap = this._referenceMapper.getMapping<mgmtApi.Container>('container', 'referenceName', referenceName);
                
//                 if (!refMap) {
//                     console.log(`✗ Container not found in reference mapper for: ${referenceName}`);
//                     failedContent++;
//                     continue;
//                 }

//                 const { target:targetContainer } = refMap;

//                 // Update asset URLs in content fields
//                 let processedContentItem = this.updateAssetUrls(contentItem);

//                 // console.log('processedContentItem', processedContentItem);
//                 // First try to get the content item from the target instance
//                 let existingContentItem;

//                 try {
//                     existingContentItem = await apiClient.contentMethods.getContentItem(contentItem.contentID, this._targetGuid, this._locale);
//                     // processedContentItem = existingContentItem;
//                     // processedContentItem.contentID = existingContentItem.contentID;
//                 } catch (error) {
//                     // Content item doesn't exist, we'll create it
//                 }

//                 // Create or update content item
//                 let contentPayload;
//                 try {
//                     // Ensure we're using the processed content item with updated URLs
//                     contentPayload = {
//                         ...existingContentItem ? processedContentItem : processedContentItem,
//                         contentID: existingContentItem ? existingContentItem.contentID : -1,
//                         properties: {
//                             ...existingContentItem ? existingContentItem.properties : processedContentItem.properties,
//                             referenceName: existingContentItem ? existingContentItem.properties.referenceName : targetContainer.referenceName
//                         }
//                     };



//                     // console.log('contentPayload', contentPayload);


//                     const contentIdArray = await apiClient.contentMethods.saveContentItem(contentPayload, guid, this._locale);
                    
                    
//                     if (contentIdArray && contentIdArray[0] > 0) {

//                         const newContentItem = {
//                             ...contentPayload,
//                             contentID: contentIdArray[0]
//                         } as mgmtApi.ContentItem;
//                         // Update both base and specialized reference mappings
//                         this._referenceMapper.addRecord('content', contentItem, newContentItem);
//                         console.log(`✓ Normal Content Item ${existingContentItem ? 'Updated' : 'Created'} ${ansiColors.green('Source:')} ${contentItem.properties.referenceName} (ID: ${contentItem.contentID}) ${ansiColors.green('Target:')} ${newContentItem.properties.referenceName} (ID: ${contentIdArray[0]})`);
//                         processedContent++;
//                     } else {
//                         console.log(`✗ Failed to ${existingContentItem ? 'update' : 'create'} normal content item ${contentItem.properties.referenceName}`);
//                         failedContent++;
//                     }
//                 } catch (error) {
//                     console.log(`✗ Error ${existingContentItem ? 'updating' : 'creating'} normal content item ${contentItem.properties.referenceName}:`, error);
//                     if (error.response) {
//                         console.log('API Response:', error.response.data);
//                     }
//                     failedContent++;
//                 }
//             } catch (error) {
//                 console.log(`✗ Error processing normal content item ${contentItem.properties.referenceName}:`, error);
//                 if (error.response) {
//                     console.log('API Response:', error.response.data);
//                 }
//                 failedContent++;
//             }
//         }
//         console.log(ansiColors.yellow(`✓ Processed ${processedContent}/${totalContent} normal content items (${failedContent} failed)`));
//     }

//     async pushLinkedContentItems(contentItems: mgmtApi.ContentItem[], guid: string) {
//         let totalContent = contentItems.length;
//         let processedContent = 0;
//         let failedContent = 0;
//         let fileOperation = new fileOperations();

//         for (let contentItem of contentItems) {

//             const mappedContentItem = await mapContentItem(contentItem, this._referenceMapper);
//             console.log('mappedContentItem', mappedContentItem);

//             let apiClient = new mgmtApi.ApiClient(this._options);
//             try {
//                 const referenceName = contentItem.properties.referenceName;
                
//                 // Get the processed container using the reference mapper
//                 let containerRef = this._referenceMapper.getMapping<mgmtApi.Container>('container', 'referenceName', referenceName);
                
//                 if (!containerRef) {
//                     console.log(`✗ Container not found in reference mapper for: ${referenceName}`);
//                     failedContent++;
//                     continue;
//                 }

//                 const { source, target:targetContainer } = containerRef;
//                 // contentItem.contentID = targetContainer.contentDefinitionID;

//                 // Process content item URLs and fetch any missing assets
//                 contentItem = this.updateAssetUrls(contentItem);

//                 // Get the model to process linked content fields
//                 let model;
//                 try {
//                     model = await apiClient.modelMethods.getContentModel(targetContainer.contentDefinitionID, this._targetGuid);
//                 } catch (error) {
//                     console.log(`✗ Error getting model for content item ${referenceName}:`, error);
//                     failedContent++;
//                     continue;
//                 }

//                 // Process linked content fields
//                 for (const field of model.fields) {
//                     const fieldName = this.camelize(field.name);
//                     const fieldVal = contentItem.fields[fieldName];
                    
//                     if (fieldVal && field.type === 'Content') {
//                         const settings = field.settings || {};

//                         // Handle LinkeContentDropdownValueField
//                         if (settings['LinkeContentDropdownValueField'] && settings['LinkeContentDropdownValueField'] !== 'CREATENEW') {
//                             const linkedField = this.camelize(settings['LinkeContentDropdownValueField']);
//                             const linkedContentIds = contentItem.fields[linkedField];
//                             let newLinkedContentIds = '';

//                             if (linkedContentIds) {
//                                 const splitIds = linkedContentIds.split(',');
//                                 for (const id of splitIds) {
//                                     if (this.skippedContentItems[id]) {
//                                         this.skippedContentItems[contentItem.contentID] = contentItem.properties.referenceName;
//                                         fileOperation.appendLogFile(`\n Unable to process content item for referenceName ${contentItem.properties.referenceName} with contentId ${contentItem.contentID}.`);
//                                         continue;
//                                     }
//                                     if (this.processedContentIds[id]) {
//                                         const newSortId = this.processedContentIds[id].toString();
//                                         newLinkedContentIds = newLinkedContentIds ? `${newLinkedContentIds},${newSortId}` : newSortId;
//                                     } else {
//                                         try {
//                                             const file = fileOperation.readFile(`agility-files/${this._locale}/item/${id}.json`);
//                                             contentItem = null;
//                                             break;
//                                         } catch {
//                                             this.skippedContentItems[contentItem.contentID] = contentItem.properties.referenceName;
//                                             this.skippedContentItems[id] = 'OrphanRef';
//                                             fileOperation.appendLogFile(`\n Unable to process content item for referenceName ${contentItem.properties.referenceName} with contentId ${contentItem.contentID} as the content is orphan. Orphan ID ${id}.`);
//                                             continue;
//                                         }
//                                     }
//                                 }
//                                 if (newLinkedContentIds) {
//                                     contentItem.fields[linkedField] = newLinkedContentIds;
//                                 }
//                             }
//                         }

//                         // Handle SortIDFieldName
//                         if (settings['SortIDFieldName'] && settings['SortIDFieldName'] !== 'CREATENEW') {
//                             const sortField = this.camelize(settings['SortIDFieldName']);
//                             const sortContentIds = contentItem.fields[sortField];
//                             let newSortContentIds = '';

//                             if (sortContentIds) {
//                                 const splitIds = sortContentIds.split(',');
//                                 for (const id of splitIds) {
//                                     if (this.skippedContentItems[id]) {
//                                         this.skippedContentItems[contentItem.contentID] = contentItem.properties.referenceName;
//                                         fileOperation.appendLogFile(`\n Unable to process content item for referenceName ${contentItem.properties.referenceName} with contentId ${contentItem.contentID}.`);
//                                         continue;
//                                     }
//                                     if (this.processedContentIds[id]) {
//                                         const newSortId = this.processedContentIds[id].toString();
//                                         newSortContentIds = newSortContentIds ? `${newSortContentIds},${newSortId}` : newSortId;
//                                     } else {
//                                         try {
//                                             const file = fileOperation.readFile(`agility-files/${this._locale}/item/${id}.json`);
//                                             contentItem = null;
//                                             break;
//                                         } catch {
//                                             this.skippedContentItems[contentItem.contentID] = contentItem.properties.referenceName;
//                                             this.skippedContentItems[id] = 'OrphanRef';
//                                             fileOperation.appendLogFile(`\n Unable to process content item for referenceName ${contentItem.properties.referenceName} with contentId ${contentItem.contentID} as the content is orphan. Orphan ID ${id}.`);
//                                             continue;
//                                         }
//                                     }
//                                 }
//                                 if (newSortContentIds) {
//                                     contentItem.fields[sortField] = newSortContentIds;
//                                 }
//                             }
//                         }

//                         // Handle contentid and referencename
//                         if (typeof fieldVal === 'object') {
//                             if ('contentid' in fieldVal) {
//                                 const linkedContentId = fieldVal.contentid;
//                                 if (this.skippedContentItems[linkedContentId]) {
//                                     this.skippedContentItems[contentItem.contentID] = contentItem.properties.referenceName;
//                                     fileOperation.appendLogFile(`\n Unable to process content item for referenceName ${contentItem.properties.referenceName} with contentId ${contentItem.contentID}.`);
//                                     continue;
//                                 }
//                                 if (this.processedContentIds[linkedContentId]) {
//                                     try {
//                                         const file = fileOperation.readFile(`agility-files/${this._locale}/item/${linkedContentId}.json`);
//                                         const extractedContent = JSON.parse(file) as mgmtApi.ContentItem;
//                                         contentItem.fields[fieldName] = extractedContent.properties.referenceName;
//                                     } catch {
//                                         contentItem = null;
//                                         break;
//                                     }
//                                 }
//                             }
//                             if ('referencename' in fieldVal) {
//                                 const refName = fieldVal.referencename;
//                                 try {
//                                     const container = await apiClient.containerMethods.getContainerByReferenceName(refName, this._targetGuid);
//                                     if (!container) {
//                                         this.skippedContentItems[contentItem.contentID] = contentItem.properties.referenceName;
//                                         fileOperation.appendLogFile(`\n Unable to find a container for content item referenceName ${contentItem.properties.referenceName} with contentId ${contentItem.contentID}.`);
//                                         continue;
//                                     }
//                                     if ('sortids' in fieldVal) {
//                                         contentItem.fields[fieldName].referencename = fieldVal.referencename;
//                                     } else {
//                                         contentItem.fields[fieldName] = fieldVal.referencename;
//                                     }
//                                 } catch {
//                                     this.skippedContentItems[contentItem.contentID] = contentItem.properties.referenceName;
//                                     fileOperation.appendLogFile(`\n Unable to process content item for referenceName ${contentItem.properties.referenceName} with contentId ${contentItem.contentID}.`);
//                                     continue;
//                                 }
//                             }
//                         }
//                     }
//                 }

//                 if (!contentItem) {
//                     continue;
//                 }




//                 // console.log('Content Item:',contentItem)
//                 // Create or update content item
//                 let contentPayload;



// /// this won't ever work because the contentID is not the same as the contentID in the payload
// // what we need to do is lookup the container this is going into, and get a list of the contentIDs


//                 // const existingContentItem = await this._apiClient.contentMethods.getContentItem(contentItem.contentID, this._targetGuid, this._locale);
//                 // console.log('existingContentItem:',existingContentItem)


//                 try {
//                     // Update asset URLs in content fields
//                     const processedContentItem = this.updateAssetUrls(contentItem);


//                     // console.log('Processed Content Item:',processedContentItem)
//                     contentPayload = {
//                         ...processedContentItem,
//                         // contentID: existingContentItem ? existingContentItem.contentID : -1,
//                         properties: {
//                             ...processedContentItem.properties,
//                             referenceName: targetContainer.referenceName
//                         }
//                     };

//                     // Update any remaining URLs in the payload
//                     contentPayload = this.updateAssetUrls(contentPayload);


//                     // theres a couple issues I see in the payload, which is in fields > category > contentid
//                     // this needs to be mapped back to what the new contentID
//                     // for example 110 is actually  453 of the normal content items

//                     // there is also a categoryID, which is another normal content item, but as a string
//                     // 109 is actually 471

//                     console.log('Content Payload:',contentPayload)

//                     const contentIdArray = await apiClient.contentMethods.saveContentItem(contentPayload, this._targetGuid, this._locale);
//                     console.log('Content ID Array:',contentIdArray)
//                     if (contentIdArray && contentIdArray[0] > 0) {
//                         const newContentItem = {
//                             ...contentPayload,
//                             contentID: contentIdArray[0]
//                         } as mgmtApi.ContentItem;
//                         // Update both base and specialized reference mappings
//                         this._referenceMapper.addRecord('content', contentItem, newContentItem);
//                         console.log(`✓ Linked content item created - Source: ${contentItem.properties.referenceName} (ID: ${contentItem.contentID}), Target: ${newContentItem.properties.referenceName} (ID: ${newContentItem.contentID})`);
//                         processedContent++;
//                     } else {
//                         console.log(`✗ Failed to create linked content item ${contentItem.properties.referenceName}`);
//                         failedContent++;
//                     }
//                 } catch (error) {
//                     console.log(`✗ Error creating/updating linked content item ${contentItem.properties.referenceName}:`, error);
//                     if (error.response) {
//                         console.log('API Response:', error.response.data);
//                     }
//                     failedContent++;
//                 }
//             } catch (error) {
//                 console.log(`✗ Error processing linked content item ${contentItem.properties.referenceName}:`, error);
//                 if (error.response) {
//                     console.log('API Response:', error.response.data);
//                 }
//                 failedContent++;
//             }
//         }
//         console.log(ansiColors.yellow(`✓ Processed ${processedContent}/${totalContent} linked content items (${failedContent} failed)`));
//     }
    

    
}