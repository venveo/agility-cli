import * as mgmtApi from '@agility/management-sdk';
import ansiColors from 'ansi-colors';
import { ReferenceMapper } from '../mapper'; // Corrected path
import _ from 'lodash'; // Import lodash for deep comparison

type ProgressCallback = (processed: number, total: number, status?: 'success' | 'error') => void;

// Helper function to check if a model is linked (based on push_new.ts logic)
function isLinkedModel(model: mgmtApi.Model): boolean {
    return model.fields.some(field => field.type === 'Content' && field.settings['ContentDefinition']);
}

// Helper function to compare two models, ignoring ID and field order
function areModelsDifferent(sourceModel: mgmtApi.Model, targetModel: mgmtApi.Model): boolean {
    // Create copies to avoid modifying originals
    const sourceCopy = _.cloneDeep(sourceModel);
    const targetCopy = _.cloneDeep(targetModel);

    // Ignore IDs
    delete sourceCopy.id;
    delete targetCopy.id;
    delete sourceCopy.lastModifiedDate; // Ignore modification date
    delete targetCopy.lastModifiedDate;

    // Sort fields by name for consistent comparison
    sourceCopy.fields.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    targetCopy.fields.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    // Ignore field IDs and itemOrder within each field object
    sourceCopy.fields.forEach(field => {
        delete field.fieldID;
        delete field.itemOrder; // Also ignore itemOrder
    });
    targetCopy.fields.forEach(field => {
        delete field.fieldID;
        delete field.itemOrder; // Also ignore itemOrder
    });

    // Perform a deep comparison
    return !_.isEqual(sourceCopy, targetCopy);
}

export async function pushModels(
    models: mgmtApi.Model[],
    apiOptions: mgmtApi.Options,
    targetGuid: string,
    referenceMapper: ReferenceMapper,
    onProgress?: ProgressCallback // Optional progress callback
): Promise<{ successfulModels: number; failedModels: number; status: 'success' | 'error' }> {
    let successfulModels = 0;
    let failedModels = 0;
    let status: 'success' | 'error' = 'success';

    if (!models || models.length === 0) {
        console.log('No models found to push');
        return { successfulModels, failedModels, status };
    }

    const totalModels = models.length;
    const linkedModels = models.filter(model => isLinkedModel(model));
    const normalModels = models.filter(model => !isLinkedModel(model));
    const apiClient = new mgmtApi.ApiClient(apiOptions);

    const processModel = async (model: mgmtApi.Model, isNormal: boolean): Promise<boolean> => {
        let existingModel: mgmtApi.Model | null = null;
        const modelType = isNormal ? 'Normal' : 'Nested';

        try {
            existingModel = await apiClient.modelMethods.getModelByReferenceName(model.referenceName, targetGuid);
            if (existingModel) {
                referenceMapper.addRecord('model', model, existingModel);

                if (areModelsDifferent(model, existingModel)) {
                    // Models are different, update the target model
                    try {
                        const modelPayload = {
                            ...model, // Start with source model data
                            id: existingModel.id // Use the target model's ID for update
                        };
                        const updatedModel = await apiClient.modelMethods.saveModel(modelPayload, targetGuid);
                        // Update the mapping with the potentially updated model info (though ID should remain the same)
                        referenceMapper.addRecord('model', model, updatedModel);
                        console.log(`✓ ${modelType} Model updated - ${model.referenceName} - ${ansiColors.green('Source')}: ${model.id?.toString() || 'N/A'} ${ansiColors.green('Target')}: ${updatedModel.id?.toString() || 'N/A'}`);
                        return true; // Success (updated)
                    } catch (updateError: any) {
                        console.error(`[Model] ✗ Error updating ${modelType.toLowerCase()} model ${model.referenceName}: ${updateError.message}`);
                        return false; // Failure (update error)
                    }
                } else {
                    // Models are the same, skip update
                    console.log(`✓ ${modelType} Model ${ansiColors.underline(model.referenceName)} ${ansiColors.bold.gray('exists and is identical')} - Skipping update.`);
                    return true; // Success (skipped)
                }
            }
            // If existingModel is null, the code will proceed to the creation logic below

        } catch (error: any) {
            if (error.response && error.response.status !== 404) {
                console.error(`[Model] ✗ Error checking for existing ${modelType.toLowerCase()} model ${model.referenceName}: ${error.message}`);
                return false; // Failure (check error)
            }
            // 404 means model doesn't exist, which is fine - we'll create it
        }

        // If nested, check referenced models first
        if (!isNormal) {
             for (const field of model.fields) {
                 if (field.type === 'Content' && field.settings['ContentDefinition']) {
                     const linkedModelRef = field.settings['ContentDefinition'];
                     let referencedModelExistsInTarget = false;
                     try {
                         // 1. Check if the referenced model is already mapped
                         const mapping = referenceMapper.getMappingByKey<mgmtApi.Model>('model', 'referenceName', linkedModelRef);
                         if (mapping && mapping.target) {
                             referencedModelExistsInTarget = true; // Found in mapper
                         } else {
                            // 2. If not mapped, check the API directly
                             try {
                                 const targetModel = await apiClient.modelMethods.getModelByReferenceName(linkedModelRef, targetGuid);
                                 if (targetModel) {
                                     referencedModelExistsInTarget = true;
                                     // Optional: Add mapping if found via API but not yet mapped
                                     const sourceModel = models.find(m => m.referenceName === linkedModelRef);
                                     if (sourceModel && !mapping) { // Add only if not already mapped
                                         referenceMapper.addRecord('model', sourceModel, targetModel);
                                     }
                                 }
                             } catch (apiError: any) {
                                 if (!(apiError.response && apiError.response.status === 404)) {
                                      // Log errors other than 404 (Not Found)
                                      console.error(`[Model] ✗ Error checking referenced model ${linkedModelRef} via API for ${model.referenceName}: ${apiError.message}`);
                                     // Decide if this error should prevent model creation (return false) or just be logged
                                     // For now, we'll let it proceed but log the error
                                 }
                                 // If 404 or other error, referencedModelExistsInTarget remains false
                             }
                         }

                         if (!referencedModelExistsInTarget) {
                             console.error(`[Model] ✗ Referenced model ${linkedModelRef} not found in target for nested model ${model.referenceName}. Cannot create.`);
                             return false; // Failure (missing dependency)
                         }

                     } catch (error: any) {
                         // Catch potential errors from getMappingByKey or other unexpected issues
                         console.error(`[Model] ✗ Unexpected error checking referenced model ${linkedModelRef} for ${model.referenceName}: ${error.message}`);
                         return false; // Failure (error checking dependency)
                     }
                 }
             }
        }

        // Model doesn't exist in target OR update was skipped, try to create it (this block only runs if existingModel was null initially)
        // If existingModel was found but identical, we returned true above and won't reach here.
        // If existingModel was found and update failed, we returned false above and won't reach here.
        try {
            const modelPayload = {
                ...model,
                id: 0 // Always set ID to 0 for creation
            };
            const savedModel = await apiClient.modelMethods.saveModel(modelPayload, targetGuid);
            referenceMapper.addRecord('model', model, savedModel);
            console.log(`✓ ${modelType} Model created - ${model.referenceName} - ${ansiColors.green('Source')}: ${model.id?.toString() || 'N/A'} ${ansiColors.green('Target')}: ${savedModel.id?.toString() || 'N/A'}`);
            return true; // Success (created)
        } catch (error: any) {
            console.error(`[Model] ✗ Error creating new ${modelType.toLowerCase()} model ${model.referenceName}: ${error.message}`);
            if (error.response && error.response.status === 409) {
                // Conflict - model might have been created by another process, try to get it again
                try {
                    const conflictingModel = await apiClient.modelMethods.getModelByReferenceName(model.referenceName, targetGuid);
                    if (conflictingModel) {
                        referenceMapper.addRecord('model', model, conflictingModel);
                        console.log(`✓ ${modelType} Model (conflict resolved) - ${model.referenceName} - ${ansiColors.green('Source')}: ${model.referenceName}, ${ansiColors.green('Target')}: ${conflictingModel.referenceName}`);
                        return true; // Success (conflict resolved)
                    }
                } catch (getError: any) {
                    console.error(`[Model] Failed to get conflicting model after 409: ${getError.message}`);
                }
            }
            return false; // Failure (create error or unresolved conflict)
        }
    };

    // Process normal models first
    for (const model of normalModels) {
        const success = await processModel(model, true);
        if (success) {
            successfulModels++;
        } else {
            failedModels++;
        }
        if (onProgress) {
            const percentage = Math.round(((successfulModels + failedModels) / totalModels) * 100);
            onProgress(successfulModels + failedModels, totalModels, failedModels > 0 ? 'error' : 'success');
        }
    }

    // Then process linked models
    for (const model of linkedModels) {
        const success = await processModel(model, false);
         if (success) {
            successfulModels++;
        } else {
            failedModels++;
        }
        if (onProgress) {
            const percentage = Math.round(((successfulModels + failedModels) / totalModels) * 100);
            onProgress(successfulModels + failedModels, totalModels, failedModels > 0 ? 'error' : 'success');
        }
    }

    status = failedModels > 0 ? 'error' : 'success';
    console.log(ansiColors.yellow(`Processed ${successfulModels}/${totalModels} models (${failedModels} failed)`));

    // Final progress update
    if (onProgress) {
        onProgress(totalModels, totalModels, status);
    }


    return { successfulModels, failedModels, status };
}
