import * as mgmtApi from '@agility/management-sdk';
import { ReferenceMapper } from '../mapper';

export async function findContentInTargetInstance(
    contentItem: mgmtApi.ContentItem, 
    apiClient: mgmtApi.ApiClient, 
    guid: string, 
    locale: string,
    referenceMapper: ReferenceMapper
): Promise<mgmtApi.ContentItem | null> {
    try {
        // first check the reference mapper for content item with the same reference name
        const { target:targetMapping } = referenceMapper.getMapping('content', 'contentID', contentItem.contentID);

        if (targetMapping) {
            return targetMapping as mgmtApi.ContentItem;
        }

        // now lets check the API
        try {
            const targetContentItem = await apiClient.contentMethods.getContentItem(contentItem.contentID, guid, locale);
            if (targetContentItem) {
                return targetContentItem as mgmtApi.ContentItem;
            }
        } catch {
            return null;
        }
        
    } catch (error) {
        if (error.response && error.response.status === 404) {
            return null;
        }
        throw error;
    }
}
