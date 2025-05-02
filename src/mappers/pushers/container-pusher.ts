import * as mgmtApi from "@agility/management-sdk";
import { ReferenceMapper } from "../mapper";
import { findContainerInTargetInstance } from "../finders/container-finder";
import { ContainerMapper } from "../container-mapper";
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

  async pushContainers(containers: mgmtApi.Container[]): Promise<void> {
    let totalContainers = containers.length;
    let processedContainers = 0;
    let failedContainers = 0;

    for (const container of containers) {
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
          `✓ Container ${ansiColors.underline(container.referenceName)} ${ansiColors.bold.gray('exists')} - ${ansiColors.green("Source")}: ${container.contentViewID} ${ansiColors.green(this.targetGuid)}: ${existingTargetContainer.contentViewID}`
        );
        this.referenceMapper.addRecord("container", container, existingTargetContainer);
        processedContainers++;
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
          this.targetGuid
        );

        this.referenceMapper.addRecord("container", container, savedContainer);
        console.log(
          `✓ Container created - ${container.referenceName} - ${ansiColors.green("Source")}: ${
            container.referenceName
          } (ID: ${container.contentViewID}), ${ansiColors.green("Target")}: ${savedContainer.referenceName} (ID: ${
            savedContainer.contentViewID
          })`
        );
        processedContainers++;
      } catch (error) {
        console.error(`Error creating container ${container.referenceName}:`);
        if (error.response) {
          console.error("API Response:", error.response.data);
        }
        failedContainers++;
      }
    }

    console.log(
      ansiColors.yellow(`✓ Processed ${processedContainers}/${totalContainers} containers (${failedContainers} failed)`)
    );
  }
}
