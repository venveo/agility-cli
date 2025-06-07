import { z } from 'zod';
import * as mgmtApi from '@agility/management-sdk';
import { fileOperations } from '../fileOperations';

export class ZodSchemaGenerator {
  private fileOps: fileOperations;
  private modelsByReferenceName: Map<string, mgmtApi.Model> = new Map();
  private containersByReferenceName: Map<string, mgmtApi.Container> = new Map();

  constructor() {
    this.fileOps = new fileOperations();
  }

  // Common type definitions
  private readonly commonTypes = {
    Image: 'z.object({ url: z.string(), fileName: z.string(), altText: z.string().optional() })',
    File: 'z.object({ url: z.string(), fileName: z.string(), fileSize: z.number().optional() })',
    Link: 'z.object({ href: z.string(), target: z.string().optional(), text: z.string().optional() })',
  };

  // Base Zod schemas for Agility CMS structures
  private readonly ModelFieldBaseSchema = z
    .object({
      name: z.string().nullable().optional(),
      label: z.string().nullable().optional(),
      labelHelpDescription: z.string().nullable().optional(),
      itemOrder: z.number().nullable().optional(),
      designerOnly: z.boolean().nullable().optional(),
      isDataField: z.boolean().nullable().optional(),
      editable: z.boolean().nullable().optional(),
      hiddenField: z.boolean().nullable().optional(),
      fieldID: z.string().nullable().optional(),
      description: z.string().nullable().optional(),
      settings: z.record(z.string()).default({}).optional(),
    })
    .passthrough(); // Allow additional field properties

  // All supported Agility field type schemas
  private readonly TextFieldSchema = this.ModelFieldBaseSchema.extend({
    type: z.literal('Text'),
  });

  private readonly MultiLineTextFieldSchema = this.ModelFieldBaseSchema.extend({
    type: z.literal('MultiLineText'),
  });

  private readonly HTMLFieldSchema = this.ModelFieldBaseSchema.extend({
    type: z.literal('HTML'),
  });

  private readonly DropdownFieldSchema = this.ModelFieldBaseSchema.extend({
    type: z.literal('Dropdown'),
  });

  private readonly URLFieldSchema = this.ModelFieldBaseSchema.extend({
    type: z.literal('URL'),
  });

  private readonly LinkFieldSchema = this.ModelFieldBaseSchema.extend({
    type: z.literal('Link'),
  });

  private readonly NumberFieldSchema = this.ModelFieldBaseSchema.extend({
    type: z.literal('Number'),
  });

  private readonly DecimalFieldSchema = this.ModelFieldBaseSchema.extend({
    type: z.literal('Decimal'),
  });

  private readonly DateTimeFieldSchema = this.ModelFieldBaseSchema.extend({
    type: z.literal('DateTime'),
  });

  private readonly BooleanFieldSchema = this.ModelFieldBaseSchema.extend({
    type: z.literal('Boolean'),
  });

  private readonly ContentFieldSchema = this.ModelFieldBaseSchema.extend({
    type: z.literal('Content'),
    settings: z
      .object({
        ContentDefinition: z.string().optional(),
        ContentView: z.string().optional(),
        LinkeContentDropdownValueField: z.string().optional(),
        SortIDFieldName: z.string().optional(),
        LinkedContentType: z.string().optional(),
        SharedContent: z.string().optional(),
      })
      .passthrough(),
  });

  private readonly HiddenFieldSchema = this.ModelFieldBaseSchema.extend({
    type: z.literal('Hidden'),
  });

  private readonly CustomFieldSchema = this.ModelFieldBaseSchema.extend({
    type: z.literal('Custom'),
  });

  private readonly CustomSectionFieldSchema = this.ModelFieldBaseSchema.extend({
    type: z.literal('CustomSection'),
  });

  private readonly ImageAttachmentFieldSchema = this.ModelFieldBaseSchema.extend({
    type: z.literal('ImageAttachment'),
  });

  private readonly PhotoGalleryFieldSchema = this.ModelFieldBaseSchema.extend({
    type: z.literal('PhotoGallery'),
  });

  private readonly FileAttachmentFieldSchema = this.ModelFieldBaseSchema.extend({
    type: z.literal('FileAttachment'),
  });

  private readonly AttachmentListFieldSchema = this.ModelFieldBaseSchema.extend({
    type: z.literal('AttachmentList'),
  });

  private readonly ModelFieldSchema = z.union([
    this.TextFieldSchema,
    this.MultiLineTextFieldSchema,
    this.HTMLFieldSchema,
    this.DropdownFieldSchema,
    this.URLFieldSchema,
    this.LinkFieldSchema,
    this.NumberFieldSchema,
    this.DecimalFieldSchema,
    this.DateTimeFieldSchema,
    this.BooleanFieldSchema,
    this.ContentFieldSchema,
    this.HiddenFieldSchema,
    this.CustomFieldSchema,
    this.CustomSectionFieldSchema,
    this.ImageAttachmentFieldSchema,
    this.PhotoGalleryFieldSchema,
    this.FileAttachmentFieldSchema,
    this.AttachmentListFieldSchema,
    // Fallback for any other field types
    this.ModelFieldBaseSchema.extend({
      type: z.string().nullable().optional(),
    }),
  ]);

  private readonly ModelSchema = z
    .object({
      id: z.number().nullable().optional(),
      lastModifiedDate: z.string().nullable().optional(),
      displayName: z.string().nullable().optional(),
      referenceName: z.string().nullable().optional(),
      lastModifiedBy: z.string().nullable().optional(),
      fields: z.array(this.ModelFieldSchema).default([]),
      lastModifiedAuthorID: z.number().nullable().optional(),
      description: z.string().nullable().optional(),
      allowTagging: z.boolean().nullable().optional(),
      contentDefinitionTypeName: z.string().nullable().optional(),
      isPublished: z.boolean().nullable().optional(),
      wasUnpublished: z.boolean().nullable().optional(),
    })
    .passthrough(); // Allow additional fields that aren't in the schema

  private readonly ContentViewColumnSchema = z
    .object({
      fieldName: z.string().nullable().optional(),
      label: z.string().nullable().optional(),
      sortOrder: z.number().nullable().optional(),
      isDefaultSort: z.boolean().nullable().optional(),
      sortDirection: z.enum(['ASC', 'DESC']).nullable().optional(),
      typeName: z.string().nullable().optional(),
    })
    .passthrough(); // Allow additional fields

  private readonly ContainerSchema = z
    .object({
      contentViewID: z.number().nullable().optional(),
      contentDefinitionID: z.number().nullable().optional(),
      referenceName: z.string().nullable().optional(),
      contentDefinitionName: z.string().nullable().optional(),
      contentDefinitionType: z.number().nullable().optional(),
      contentDefinitionTypeID: z.number().nullable().optional(),
      columns: z.array(this.ContentViewColumnSchema).default([]).optional(),
      contentViewName: z.string().nullable().optional(),
      title: z.string().nullable().optional(),
      schemaTitle: z.string().nullable().optional(),
      requiresApproval: z.boolean().nullable().optional(),
      isShared: z.boolean().nullable().optional(),
      isDynamicPageList: z.boolean().nullable().optional(),
      disablePublishFromList: z.boolean().nullable().optional(),
      allowClientSideSave: z.boolean().nullable().optional(),
      contentViewCategoryID: z.number().nullable().optional(),
      contentViewCategoryReferenceName: z.string().nullable().optional(),
      contentViewCategoryName: z.string().nullable().optional(),
      numRowsInListing: z.number().nullable().optional(),
      defaultSortColumn: z.string().nullable().optional(),
      defaultSortDirection: z.string().nullable().optional(),
      enableRSSOutput: z.boolean().nullable().optional(),
      enableAPIOutput: z.boolean().nullable().optional(),
      currentUserCanDelete: z.boolean().nullable().optional(),
      currentUserCanEdit: z.boolean().nullable().optional(),
      currentUserCanDesign: z.boolean().nullable().optional(),
      currentUserCanManage: z.boolean().nullable().optional(),
      currentUserCanContribute: z.boolean().nullable().optional(),
      currentUserCanPublish: z.boolean().nullable().optional(),
      defaultPage: z.string().nullable().optional(),
      defaultListingPage: z.string().nullable().optional(),
      defaultDetailsPage: z.string().nullable().optional(),
      defaultDetailsPageQueryString: z.string().nullable().optional(),
      isPublished: z.boolean().nullable().optional(),
      isDeleted: z.boolean().nullable().optional(),
      usageCount: z.number().nullable().optional(),
      lastModifiedDate: z.string().nullable().optional(),
      lastModifiedOn: z.string().nullable().optional(),
      lastModifiedBy: z.string().nullable().optional(),
      fullSyncModDate: z.string().nullable().optional(),
    })
    .passthrough(); // Allow additional fields that aren't in the schema

  /**
   * Load and validate models from .agility-files/models directory
   */
  public loadModels(baseFolder = '.agility-files'): mgmtApi.Model[] {
    try {
      const files = this.fileOps.readDirectory('models', baseFolder);
      const models: mgmtApi.Model[] = [];

      for (const fileContent of files) {
        try {
          const modelData = JSON.parse(fileContent);
          const validatedModel = this.ModelSchema.parse(modelData);
          const model = validatedModel as unknown as mgmtApi.Model;
          models.push(model);

          // Store in lookup map for nested content resolution
          if (model.referenceName) {
            this.modelsByReferenceName.set(model.referenceName, model);
          }
        } catch (error) {
          // Use safeParse to get more details about what failed
          const parseResult = this.ModelSchema.safeParse(JSON.parse(fileContent));
          if (!parseResult.success) {
            console.warn(`⚠️  Skipping invalid model file - validation failed`);
            // Only show details if we're in verbose mode or there are very few errors
            if (parseResult.error.issues.length <= 3) {
              console.warn(
                `   Issues: ${parseResult.error.issues.map(i => `${i.path.join('.')} ${i.message}`).join(', ')}`
              );
            }
          }
        }
      }

      return models;
    } catch (error) {
      console.warn(`No models found in ${baseFolder}/models: ${error.message}`);
      return [];
    }
  }

  /**
   * Load and validate containers from .agility-files/containers directory
   */
  public loadContainers(baseFolder = '.agility-files'): mgmtApi.Container[] {
    try {
      const files = this.fileOps.readDirectory('containers', baseFolder);
      const containers: mgmtApi.Container[] = [];

      for (const fileContent of files) {
        try {
          const containerData = JSON.parse(fileContent);
          const validatedContainer = this.ContainerSchema.parse(containerData);
          const container = validatedContainer as unknown as mgmtApi.Container;
          containers.push(container);

          // Store in lookup map for container-to-content-type mapping
          if (container.referenceName) {
            this.containersByReferenceName.set(container.referenceName, container);
          }
        } catch (error) {
          // Use safeParse to get more details about what failed
          const parseResult = this.ContainerSchema.safeParse(JSON.parse(fileContent));
          if (!parseResult.success) {
            console.warn(`⚠️  Skipping invalid container file - validation failed`);
            // Only show details if we're in verbose mode or there are very few errors
            if (parseResult.error.issues.length <= 3) {
              console.warn(
                `   Issues: ${parseResult.error.issues.map(i => `${i.path.join('.')} ${i.message}`).join(', ')}`
              );
            }
          }
        }
      }

      return containers;
    } catch (error) {
      console.warn(`No containers found in ${baseFolder}/containers: ${error.message}`);
      return [];
    }
  }

  /**
   * Generate TypeScript interfaces for content items based on models
   */
  public generateContentTypeInterfaces(models: mgmtApi.Model[]): string {
    let output = '// Generated TypeScript interfaces for Agility CMS content\n';
    output += '// Generated on: ' + new Date().toISOString() + '\n\n';

    // Add common type definitions
    output += '// Common Agility CMS types\n';
    output += 'export interface AgilityImage {\n';
    output += '  url: string;\n';
    output += '  fileName: string;\n';
    output += '  altText?: string;\n';
    output += '}\n\n';

    output += 'export interface AgilityFile {\n';
    output += '  url: string;\n';
    output += '  fileName: string;\n';
    output += '  fileSize?: number;\n';
    output += '}\n\n';

    output += 'export interface AgilityLink {\n';
    output += '  href: string;\n';
    output += '  target?: string;\n';
    output += '  text?: string;\n';
    output += '}\n\n';

    for (const model of models) {
      if (!model.referenceName || !model.fields) continue;

      const interfaceName = this.pascalCase(model.referenceName);
      output += `// Model: ${model.displayName || model.referenceName}\n`;
      output += `export interface ${interfaceName}Content {\n`;

      for (const field of model.fields) {
        if (!field.name || !field.isDataField) continue;

        const fieldName = this.camelize(field.name);
        const fieldType = this.getTypeScriptType(field);
        const description = field.description || field.label || '';

        if (description) {
          output += `  /** ${description} */\n`;
        }
        output += `  ${fieldName}: ${fieldType};\n`;
      }

      output += '}\n\n';
    }

    return output;
  }

  /**
   * Generate Zod schemas for content items based on models
   */
  public generateContentZodSchemas(models: mgmtApi.Model[]): string {
    let output = "import { z } from 'zod';\n\n";
    output += '// Generated Zod schemas for Agility CMS content\n';
    output += '// Generated on: ' + new Date().toISOString() + '\n\n';

    // Add common schema definitions
    output += '// Common Agility CMS schemas\n';
    output += 'export const AgilityImageSchema = z.object({\n';
    output += '  url: z.string(),\n';
    output += '  fileName: z.string(),\n';
    output += '  altText: z.string().optional(),\n';
    output += '});\n\n';

    output += 'export const AgilityFileSchema = z.object({\n';
    output += '  url: z.string(),\n';
    output += '  fileName: z.string(),\n';
    output += '  fileSize: z.number().optional(),\n';
    output += '});\n\n';

    output += 'export const AgilityLinkSchema = z.object({\n';
    output += '  href: z.string(),\n';
    output += '  target: z.string().optional(),\n';
    output += '  text: z.string().optional(),\n';
    output += '});\n\n';

    // Export the inferred types from schemas
    output += 'export type AgilityImage = z.infer<typeof AgilityImageSchema>;\n';
    output += 'export type AgilityFile = z.infer<typeof AgilityFileSchema>;\n';
    output += 'export type AgilityLink = z.infer<typeof AgilityLinkSchema>;\n\n';

    // Generate content schemas with proper forward declarations
    for (const model of models) {
      if (!model.referenceName || !model.fields) continue;

      const schemaName = this.pascalCase(model.referenceName) + 'ContentSchema';

      output += `// Model: ${model.displayName || model.referenceName}\n`;
      output += `export const ${schemaName} = z.object({\n`;

      for (const field of model.fields) {
        if (!field.name || !field.isDataField) continue;

        const fieldName = this.camelize(field.name);
        const zodType = this.getZodType(field);
        const description = field.description || field.label || '';

        if (description) {
          output += `  /** ${description} */\n`;
        }
        output += `  ${fieldName}: ${zodType},\n`;
      }

      output += '});\n\n';
      output += `export type ${this.pascalCase(model.referenceName)}Content = z.infer<typeof ${schemaName}>;\n\n`;
    }

    return output;
  }

  /**
   * Validate model-container relationships
   */
  public validateModelContainerRelationships(
    models: mgmtApi.Model[],
    containers: mgmtApi.Container[]
  ): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const modelIds = new Set(models.map(m => m.id).filter(id => id !== null));

    // Common system fields that Agility CMS adds automatically
    const systemFields = new Set([
      'state',
      'createdDate',
      'userName',
      'modifiedDate',
      'modifiedBy',
      'contentID',
      'languageCode',
      'versionID',
      'releaseDate',
      'pullDate',
    ]);

    // Check that all containers reference valid models
    for (const container of containers) {
      if (container.contentDefinitionID && !modelIds.has(container.contentDefinitionID)) {
        errors.push(
          `Container "${container.referenceName}" references non-existent model ID: ${container.contentDefinitionID}`
        );
      }

      // Validate container columns reference valid model fields
      if (container.contentDefinitionID) {
        const model = models.find(m => m.id === container.contentDefinitionID);
        if (model && model.fields) {
          const modelFieldNames = new Set(
            model.fields.map(f => f.name).filter(name => name !== null)
          );

          for (const column of container.columns || []) {
            if (column.fieldName && !modelFieldNames.has(column.fieldName)) {
              // Check if it's a system field
              if (systemFields.has(column.fieldName)) {
                warnings.push(
                  `Container "${container.referenceName}" uses system field: ${column.fieldName}`
                );
              } else {
                errors.push(
                  `Container "${container.referenceName}" column references non-existent field: ${column.fieldName}`
                );
              }
            }
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

  private camelize(str: string): string {
    return str
      .replace(/(?:^\\w|[A-Z]|\\b\\w)/g, (word, index) => {
        return index === 0 ? word.toLowerCase() : word.toUpperCase();
      })
      .replace(/\\s+/g, '');
  }

  private pascalCase(str: string): string {
    return str.replace(/(?:^\\w|[A-Z]|\\b\\w)/g, word => word.toUpperCase()).replace(/\\s+/g, '');
  }

  private getTypeScriptType(field: mgmtApi.ModelField): string {
    switch (field.type) {
      case 'Text':
      case 'MultiLineText':
      case 'HTML':
      case 'URL':
        return 'string';
      case 'Dropdown':
        return 'string'; // Could be enhanced to use union types based on settings
      case 'Link':
        return 'AgilityLink';
      case 'Number':
      case 'Decimal':
        return 'number';
      case 'DateTime':
        return 'string'; // ISO string
      case 'Boolean':
        return 'boolean';
      case 'Content':
        // Improved: Try to resolve the actual content type
        return this.resolveContentFieldType(field);
      case 'Hidden':
      case 'Custom':
      case 'CustomSection':
        return 'any';
      case 'ImageAttachment':
        return 'AgilityImage';
      case 'FileAttachment':
        return 'AgilityFile';
      case 'AttachmentList':
        return 'AgilityFile[]';
      case 'PhotoGallery':
        return 'AgilityImage[]';
      default:
        return 'any';
    }
  }

  private getZodType(field: mgmtApi.ModelField): string {
    switch (field.type) {
      case 'Text':
      case 'MultiLineText':
      case 'HTML':
      case 'URL':
        return 'z.string()';
      case 'Dropdown':
        return 'z.string()'; // Could be enhanced to use enum based on settings
      case 'Link':
        return 'AgilityLinkSchema';
      case 'Number':
      case 'Decimal':
        return 'z.number()';
      case 'DateTime':
        return 'z.string()'; // ISO string
      case 'Boolean':
        return 'z.boolean()';
      case 'Content':
        // Improved: Try to resolve the actual content type
        return this.resolveContentFieldZodType(field);
      case 'Hidden':
      case 'Custom':
      case 'CustomSection':
        return 'z.any()';
      case 'ImageAttachment':
        return 'AgilityImageSchema';
      case 'FileAttachment':
        return 'AgilityFileSchema';
      case 'AttachmentList':
        return 'z.array(AgilityFileSchema)';
      case 'PhotoGallery':
        return 'z.array(AgilityImageSchema)';
      default:
        return 'z.any()';
    }
  }

  /**
   * Resolve Content field type to specific content type if possible
   */
  private resolveContentFieldType(field: mgmtApi.ModelField): string {
    const settings = field.settings;
    if (settings && settings.ContentDefinition) {
      const referencedModel = this.modelsByReferenceName.get(settings.ContentDefinition);
      if (referencedModel) {
        const typeName = this.pascalCase(referencedModel.referenceName) + 'Content';
        // Check if it's a single or array based on settings
        const isArray = settings.LinkedContentType === 'list' || settings.Sort;
        return isArray ? `${typeName}[]` : typeName;
      }
    }
    // Fallback to generic content reference
    return 'string | string[]';
  }

  /**
   * Resolve Content field Zod type to specific content schema if possible
   */
  private resolveContentFieldZodType(field: mgmtApi.ModelField): string {
    const settings = field.settings;
    if (settings && settings.ContentDefinition) {
      const referencedModel = this.modelsByReferenceName.get(settings.ContentDefinition);
      if (referencedModel) {
        const schemaName = this.pascalCase(referencedModel.referenceName) + 'ContentSchema';
        // Use z.lazy() for forward references to avoid circular dependency issues
        const lazySchema = `z.lazy(() => ${schemaName})`;
        // Check if it's a single or array based on settings
        const isArray = settings.LinkedContentType === 'list' || settings.Sort;
        return isArray ? `z.array(${lazySchema})` : lazySchema;
      }
    }
    // Fallback to generic content reference
    return 'z.union([z.string(), z.array(z.string())])';
  }

  /**
   * Get Zod type for lazy evaluation (inside z.lazy())
   */
  private getZodTypeForLazy(field: mgmtApi.ModelField): string {
    switch (field.type) {
      case 'Text':
      case 'MultiLineText':
      case 'HTML':
      case 'URL':
        return 'z.string()';
      case 'Dropdown':
        return 'z.string()'; // Could be enhanced to use enum based on settings
      case 'Link':
        return 'AgilityLinkSchema';
      case 'Number':
      case 'Decimal':
        return 'z.number()';
      case 'DateTime':
        return 'z.string()'; // ISO string
      case 'Boolean':
        return 'z.boolean()';
      case 'Content':
        // For lazy evaluation, use the schema directly since all schemas are available
        return this.resolveContentFieldZodType(field);
      case 'Hidden':
      case 'Custom':
      case 'CustomSection':
        return 'z.any()';
      case 'ImageAttachment':
        return 'AgilityImageSchema';
      case 'FileAttachment':
        return 'AgilityFileSchema';
      case 'AttachmentList':
        return 'z.array(AgilityFileSchema)';
      case 'PhotoGallery':
        return 'z.array(AgilityImageSchema)';
      default:
        return 'z.any()';
    }
  }

  /**
   * Generate container-to-content-type mapping
   */
  public generateContainerTypeMapping(
    models: mgmtApi.Model[],
    containers: mgmtApi.Container[]
  ): string {
    let output = '// Generated container-to-content-type mapping for Agility CMS\n';
    output += '// Generated on: ' + new Date().toISOString() + '\n\n';

    // Create mapping of model ID to model reference name
    const modelIdToReference = new Map<number, string>();
    for (const model of models) {
      if (model.id && model.referenceName) {
        modelIdToReference.set(model.id, model.referenceName);
      }
    }

    output += 'export const ContainerTypeMapping = {\n';

    for (const container of containers) {
      if (!container.referenceName || !container.contentDefinitionID) continue;

      const modelReference = modelIdToReference.get(container.contentDefinitionID);
      if (modelReference) {
        const typeName = this.pascalCase(modelReference) + 'Content';
        output += `  "${container.referenceName}": "${typeName}",\n`;
      }
    }

    output += '} as const;\n\n';

    // Generate helper type for container queries
    output += 'export type ContainerContentType<T extends keyof typeof ContainerTypeMapping> = {\n';
    output += '  [K in T]: typeof ContainerTypeMapping[K] extends infer U\n';
    output += '    ? U extends string\n';
    output += '      ? U\n';
    output += '      : never\n';
    output += '    : never\n';
    output += '}[T];\n\n';

    // Generate lookup function
    output += '/**\n';
    output += ' * Get the content type for a given container reference name\n';
    output += ' */\n';
    output +=
      'export function getContainerContentType<T extends keyof typeof ContainerTypeMapping>(\n';
    output += '  containerRef: T\n';
    output += '): ContainerContentType<T> {\n';
    output += '  return ContainerTypeMapping[containerRef] as ContainerContentType<T>;\n';
    output += '}\n\n';

    return output;
  }
}
