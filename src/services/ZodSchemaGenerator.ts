import { z } from 'zod';
import * as mgmtApi from '@agility/management-sdk';
import { fileOperations } from '../fileOperations';

export class ZodSchemaGenerator {
  private fileOps: fileOperations;

  constructor() {
    this.fileOps = new fileOperations();
  }

  // Base Zod schemas for Agility CMS structures
  private readonly ModelFieldBaseSchema = z.object({
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
  }).passthrough(); // Allow additional field properties

  private readonly ContentFieldSchema = this.ModelFieldBaseSchema.extend({
    type: z.literal('Content'),
    settings: z.object({
      ContentDefinition: z.string().optional(),
      ContentView: z.string().optional(),
      LinkeContentDropdownValueField: z.string().optional(),
      SortIDFieldName: z.string().optional(),
    }).passthrough(),
  });

  private readonly TextFieldSchema = this.ModelFieldBaseSchema.extend({
    type: z.literal('Text'),
  });

  private readonly NumberFieldSchema = this.ModelFieldBaseSchema.extend({
    type: z.literal('Number'),
  });

  private readonly ImageAttachmentFieldSchema = this.ModelFieldBaseSchema.extend({
    type: z.literal('ImageAttachment'),
  });

  private readonly FileAttachmentFieldSchema = this.ModelFieldBaseSchema.extend({
    type: z.literal('FileAttachment'),
  });

  private readonly AttachmentListFieldSchema = this.ModelFieldBaseSchema.extend({
    type: z.literal('AttachmentList'),
  });

  private readonly PhotoGalleryFieldSchema = this.ModelFieldBaseSchema.extend({
    type: z.literal('PhotoGallery'),
  });

  private readonly ModelFieldSchema = z.union([
    this.ContentFieldSchema,
    this.TextFieldSchema,
    this.NumberFieldSchema,
    this.ImageAttachmentFieldSchema,
    this.FileAttachmentFieldSchema,
    this.AttachmentListFieldSchema,
    this.PhotoGalleryFieldSchema,
    // Fallback for any other field types
    this.ModelFieldBaseSchema.extend({
      type: z.string().nullable().optional(),
    }),
  ]);

  private readonly ModelSchema = z.object({
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
  }).passthrough(); // Allow additional fields that aren't in the schema

  private readonly ContentViewColumnSchema = z.object({
    fieldName: z.string().nullable().optional(),
    label: z.string().nullable().optional(),
    sortOrder: z.number().nullable().optional(),
    isDefaultSort: z.boolean().nullable().optional(),
    sortDirection: z.enum(['ASC', 'DESC']).nullable().optional(),
    typeName: z.string().nullable().optional(),
  }).passthrough(); // Allow additional fields

  private readonly ContainerSchema = z.object({
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
  }).passthrough(); // Allow additional fields that aren't in the schema

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
          models.push(validatedModel as unknown as mgmtApi.Model);
        } catch (error) {
          // Use safeParse to get more details about what failed
          const parseResult = this.ModelSchema.safeParse(JSON.parse(fileContent));
          if (!parseResult.success) {
            console.warn(`⚠️  Skipping invalid model file - validation failed`);
            // Only show details if we're in verbose mode or there are very few errors
            if (parseResult.error.issues.length <= 3) {
              console.warn(`   Issues: ${parseResult.error.issues.map(i => `${i.path.join('.')} ${i.message}`).join(', ')}`);
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
          containers.push(validatedContainer as unknown as mgmtApi.Container);
        } catch (error) {
          // Use safeParse to get more details about what failed
          const parseResult = this.ContainerSchema.safeParse(JSON.parse(fileContent));
          if (!parseResult.success) {
            console.warn(`⚠️  Skipping invalid container file - validation failed`);
            // Only show details if we're in verbose mode or there are very few errors
            if (parseResult.error.issues.length <= 3) {
              console.warn(`   Issues: ${parseResult.error.issues.map(i => `${i.path.join('.')} ${i.message}`).join(', ')}`);
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
  public validateModelContainerRelationships(models: mgmtApi.Model[], containers: mgmtApi.Container[]): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const modelIds = new Set(models.map(m => m.id).filter(id => id !== null));

    // Common system fields that Agility CMS adds automatically
    const systemFields = new Set([
      'state', 'createdDate', 'userName', 'modifiedDate', 'modifiedBy',
      'contentID', 'languageCode', 'versionID', 'releaseDate', 'pullDate'
    ]);

    // Check that all containers reference valid models
    for (const container of containers) {
      if (container.contentDefinitionID && !modelIds.has(container.contentDefinitionID)) {
        errors.push(`Container "${container.referenceName}" references non-existent model ID: ${container.contentDefinitionID}`);
      }

      // Validate container columns reference valid model fields
      if (container.contentDefinitionID) {
        const model = models.find(m => m.id === container.contentDefinitionID);
        if (model && model.fields) {
          const modelFieldNames = new Set(model.fields.map(f => f.name).filter(name => name !== null));
          
          for (const column of container.columns || []) {
            if (column.fieldName && !modelFieldNames.has(column.fieldName)) {
              // Check if it's a system field
              if (systemFields.has(column.fieldName)) {
                warnings.push(`Container "${container.referenceName}" uses system field: ${column.fieldName}`);
              } else {
                errors.push(`Container "${container.referenceName}" column references non-existent field: ${column.fieldName}`);
              }
            }
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
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
    return str
      .replace(/(?:^\\w|[A-Z]|\\b\\w)/g, word => word.toUpperCase())
      .replace(/\\s+/g, '');
  }

  private getTypeScriptType(field: mgmtApi.ModelField): string {
    switch (field.type) {
      case 'Text':
        return 'string';
      case 'Number':
        return 'number';
      case 'Content':
        return 'string | string[]'; // Can be single reference or array
      case 'ImageAttachment':
      case 'FileAttachment':
        return '{ url: string; fileName: string; }';
      case 'AttachmentList':
        return '{ url: string; fileName: string; }[]';
      case 'PhotoGallery':
        return 'string'; // Gallery ID
      default:
        return 'any';
    }
  }

  private getZodType(field: mgmtApi.ModelField): string {
    switch (field.type) {
      case 'Text':
        return 'z.string()';
      case 'Number':
        return 'z.number()';
      case 'Content':
        return 'z.union([z.string(), z.array(z.string())])'; // Single or array
      case 'ImageAttachment':
      case 'FileAttachment':
        return 'z.object({ url: z.string(), fileName: z.string() })';
      case 'AttachmentList':
        return 'z.array(z.object({ url: z.string(), fileName: z.string() }))';
      case 'PhotoGallery':
        return 'z.string()'; // Gallery ID
      default:
        return 'z.any()';
    }
  }
}