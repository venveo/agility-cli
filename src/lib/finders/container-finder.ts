import * as mgmtApi from '@agility/management-sdk';
import { ReferenceMapper } from '../mapper';

export async function findContainerInTargetInstance(
    container: mgmtApi.Container, 
    apiClient: mgmtApi.ApiClient, 
    guid: string,
    referenceMapper: ReferenceMapper
): Promise<mgmtApi.Container | null> {
    try {
        // first check the reference mapper for a container with the same reference name
        const { target:targetMapping } = referenceMapper.getMapping('container', 'referenceName', container.referenceName);
       
        if (targetMapping) {
            return targetMapping as mgmtApi.Container;
        }

        // First try to find container by reference name
        const {referenceName} = container;


        try {
        let targetContainer:mgmtApi.Container | null = await apiClient.containerMethods.getContainerByReferenceName(referenceName, guid);
        
        if (targetContainer) {
            return targetContainer;
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
