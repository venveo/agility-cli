import * as mgmtApi from '@agility/management-sdk';
import { ValidationResult, SYSTEM_FIELDS } from './types';

/**
 * Service responsible for validating relationships between models and containers
 */
export class ValidationService {
  /**
   * Validate model-container relationships
   */
  validateModelContainerRelationships(
    models: mgmtApi.Model[],
    containers: mgmtApi.Container[]
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Create lookup maps for efficient validation
    const modelIds = new Set(models.map(m => m.id).filter(id => id !== null && id !== undefined));
    const modelFieldsByModelId = this.createModelFieldsMap(models);

    // Validate each container
    for (const container of containers) {
      this.validateContainer(container, modelIds, modelFieldsByModelId, errors, warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate content field references in models
   */
  validateContentReferences(
    models: mgmtApi.Model[],
    modelsByReferenceName: Map<string, mgmtApi.Model>
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const model of models) {
      if (!model.fields || !model.referenceName) continue;

      for (const field of model.fields) {
        if (field.type === 'Content' && field.settings?.ContentDefinition) {
          const referencedModel = modelsByReferenceName.get(field.settings.ContentDefinition);
          if (!referencedModel) {
            errors.push(
              `Model "${model.referenceName}" field "${field.name}" references non-existent content type: ${field.settings.ContentDefinition}`
            );
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate that all required data is present for generation
   */
  validateGenerationRequirements(
    models: mgmtApi.Model[],
    containers: mgmtApi.Container[],
    _contentModules: mgmtApi.Model[]
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for models without reference names
    const modelsWithoutRef = models.filter(m => !m.referenceName);
    if (modelsWithoutRef.length > 0) {
      warnings.push(`${modelsWithoutRef.length} models without reference names will be skipped`);
    }

    // Check for containers without reference names
    const containersWithoutRef = containers.filter(c => !c.referenceName);
    if (containersWithoutRef.length > 0) {
      warnings.push(
        `${containersWithoutRef.length} containers without reference names will be skipped`
      );
    }

    // Check for models without fields
    const modelsWithoutFields = models.filter(m => !m.fields || m.fields.length === 0);
    if (modelsWithoutFields.length > 0) {
      warnings.push(`${modelsWithoutFields.length} models have no fields`);
    }

    // Check for duplicate reference names
    const modelRefs = models.map(m => m.referenceName).filter(Boolean);
    const duplicateRefs = this.findDuplicates(modelRefs);
    if (duplicateRefs.length > 0) {
      errors.push(`Duplicate model reference names found: ${duplicateRefs.join(', ')}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateContainer(
    container: mgmtApi.Container,
    modelIds: Set<number>,
    modelFieldsByModelId: Map<number, Set<string>>,
    errors: string[],
    warnings: string[]
  ): void {
    // Check if container references a valid model
    if (container.contentDefinitionID && !modelIds.has(container.contentDefinitionID)) {
      errors.push(
        `Container "${container.referenceName}" references non-existent model ID: ${container.contentDefinitionID}`
      );
      return; // Skip field validation if model doesn't exist
    }

    // Validate container columns reference valid model fields
    if (container.contentDefinitionID && container.columns) {
      const modelFields = modelFieldsByModelId.get(container.contentDefinitionID);
      if (modelFields) {
        for (const column of container.columns) {
          if (column.fieldName) {
            this.validateColumnField(
              column.fieldName,
              container.referenceName!,
              modelFields,
              errors,
              warnings
            );
          }
        }
      }
    }
  }

  private validateColumnField(
    fieldName: string,
    containerRef: string,
    modelFields: Set<string>,
    errors: string[],
    warnings: string[]
  ): void {
    if (!modelFields.has(fieldName)) {
      // Check if it's a system field
      if (SYSTEM_FIELDS.has(fieldName)) {
        warnings.push(`Container "${containerRef}" uses system field: ${fieldName}`);
      } else {
        errors.push(
          `Container "${containerRef}" column references non-existent field: ${fieldName}`
        );
      }
    }
  }

  private createModelFieldsMap(models: mgmtApi.Model[]): Map<number, Set<string>> {
    const map = new Map<number, Set<string>>();

    for (const model of models) {
      if (model.id && model.fields) {
        const fieldNames = new Set(
          model.fields
            .map(f => f.name)
            .filter((name): name is string => name !== null && name !== undefined)
        );
        map.set(model.id, fieldNames);
      }
    }

    return map;
  }

  private findDuplicates(arr: (string | null | undefined)[]): string[] {
    const seen = new Set<string>();
    const duplicates = new Set<string>();

    for (const item of arr) {
      if (item) {
        if (seen.has(item)) {
          duplicates.add(item);
        } else {
          seen.add(item);
        }
      }
    }

    return Array.from(duplicates);
  }
}
