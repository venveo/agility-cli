import * as mgmtApi from '@agility/management-sdk';
import { ReferenceMapper } from './mapper';

export class ContainerMapper {
    private referenceMapper: ReferenceMapper;

    constructor(referenceMapper: ReferenceMapper) {
        this.referenceMapper = referenceMapper;
    }

    async mapModels(container: mgmtApi.Container): Promise<mgmtApi.Container | null> {
        const modelRef = this.referenceMapper.getMapping<mgmtApi.Model>('model', 'id', container.contentDefinitionID);
        if (modelRef?.target) {
            // Update the container's contentDefinitionID to match the target model's ID
            container.contentDefinitionID = modelRef.target.id;
            container.contentDefinitionType = 1;
            container.contentDefinitionTypeID = 1;

            // contentDefinitionType: (mappedSourceContainer as any).contentDefinitionTypeID,
            // contentDefinitionTypeID: (mappedSourceContainer as any).contentDefinitionTypeID
            return container;
        }
        return null;
    }

   
}
