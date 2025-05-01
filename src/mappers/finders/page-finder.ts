import * as mgmtApi from '@agility/management-sdk';

export async function findPageInTargetInstance(page: mgmtApi.PageItem, apiClient: mgmtApi.ApiClient, guid: string): Promise<mgmtApi.PageItem | null> {
    try {


        // first check the reference mapper for page 

        

        
        return null;
    } catch (error) {
        if (error.response && error.response.status === 404) {
            return null;
        }
        throw error;
    }
}
