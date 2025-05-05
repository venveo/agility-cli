import * as mgmtApi from "@agility/management-sdk";
import { ReferenceMapper } from "../mapper";
import { findContainerInTargetInstance } from "../finders/container-finder";
import { ContainerMapper } from "../mappers/container-mapper";
import ansiColors from "ansi-colors";

export class ContainerPusher {
  private apiClient: mgmtApi.ApiClient;
  private referenceMapper: ReferenceMapper;
  private containerMapper: ContainerMapper;
  private targetGuid: string;

  constructor(
    apiClient: mgmtApi.ApiClient,
    referenceMapper: ReferenceMapper,
    targetGuid: string,
  ) {
    this.apiClient = apiClient;
    this.referenceMapper = referenceMapper;
    this.containerMapper = new ContainerMapper(referenceMapper);
    this.targetGuid = targetGuid;
  }

  async pushContainers(containers: mgmtApi.Container[], onProgress?: (processed: number, total: number, status?: 'success' | 'error') => void): Promise<void> {
    let totalContainers = containers.length;
    let processedCount = 0;
    let failedContainers = 0;

    for (const container of containers) {
      let containerProcessedSuccessfully = false;
      // First check if container exists in target using findContainerInTargetInstance
      let existingTargetContainer: mgmtApi.Container | null = null;
      let mappedSourceContainer: mgmtApi.Container | null = null;

      existingTargetContainer = await findContainerInTargetInstance(
        container,
        this.apiClient,
        this.targetGuid,
        this.referenceMapper
      );

      if (existingTargetContainer && existingTargetContainer.contentViewID !== -1) {
        console.log(
          `✓ Container ${ansiColors.underline(container.referenceName)} ${ansiColors.bold.gray('exists')} - ${ansiColors.green("Source")}: ${container.contentViewID} ${ansiColors.green(this.targetGuid)}: referenceName:${existingTargetContainer.referenceName} contentViewID:${existingTargetContainer.contentViewID}`
        );
        this.referenceMapper.addRecord("container", container, existingTargetContainer);
        containerProcessedSuccessfully = true;
        continue;
      } 

      // if we don't find a mapping for the target container

      mappedSourceContainer = await this.containerMapper.mapModels(container);
      if (!mappedSourceContainer) {
        console.log(
          `✗ No processed model found for container ${container.referenceName} (looking for model ID ${container.contentDefinitionID})`
        );
        failedContainers++;
        continue;
      }

    //   console.log('mapped version', mappedSourceContainer);

    //   const payload = this.containerMapper.mapContainerProperties(container, mappedSourceContainer, existingTargetContainer);

      const payload = {
        ...(existingTargetContainer ? existingTargetContainer : mappedSourceContainer),
        contentViewID: existingTargetContainer ? existingTargetContainer.contentViewID : -1,
      };

    //   console.log('payload', payload);
      // Create new container
      try {
        const savedContainer = await this.apiClient.containerMethods.saveContainer(
          payload as mgmtApi.Container,
          this.targetGuid,
          true
          // true // force the reference name to maintain the original name
        );

        this.referenceMapper.addRecord("container", container, savedContainer);
        console.log(
          `✓ Container ${ansiColors.underline(container.referenceName)} ${ansiColors.bold.cyan('created')} - ${ansiColors.green("Source")}: ${container.contentViewID} ${ansiColors.green("Target")} referenceName: ${
            savedContainer.referenceName
          } contentViewID: ${
            savedContainer.contentViewID
          }`
        );
        containerProcessedSuccessfully = true;
      } catch (error) {
        console.error(`Error creating container ${container.referenceName}:`);
        if (error.response) {
          console.error("API Response:", error.response.data);
        }
        failedContainers++;
      }

      // Increment processed count and call callback regardless of success/fail
      processedCount++;
      if (onProgress) {
        onProgress(processedCount, totalContainers, containerProcessedSuccessfully ? 'success' : 'error');
      }
    }
  }
}
