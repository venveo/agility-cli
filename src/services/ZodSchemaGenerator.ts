import { z } from 'zod/v4';
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
      settings: z.record(z.string(), z.string()).default({}).optional(),
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
   * Load and validate content modules from .agility-files/contentModules directory
   */
  public loadContentModules(baseFolder = '.agility-files'): mgmtApi.Model[] {
    try {
      const files = this.fileOps.readDirectory('contentModules', baseFolder);
      const contentModules: mgmtApi.Model[] = [];

      for (const fileContent of files) {
        try {
          const moduleData = JSON.parse(fileContent);
          // Content modules are validated with the same schema as models
          const validatedModule = this.ModelSchema.parse(moduleData);
          const module = validatedModule as unknown as mgmtApi.Model;

          // Only include modules (not pages)
          if (module.contentDefinitionTypeName === 'Module') {
            contentModules.push(module);

            // Store in lookup map for cross-referencing
            if (module.referenceName) {
              this.modelsByReferenceName.set(module.referenceName, module);
            }
          }
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
          console.warn(`⚠️  Skipping invalid content module file - validation failed`);
        }
      }

      return contentModules;
    } catch (error) {
      console.warn(`No content modules found in ${baseFolder}/contentModules: ${error.message}`);
      return [];
    }
  }

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
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
          console.warn(`⚠️  Skipping invalid model file - validation failed`);
          // Try to parse JSON first to see if it's a JSON parsing error or validation error
          try {
            const modelData = JSON.parse(fileContent);
            // If JSON parsing succeeds, it's a validation error
            const parseResult = this.ModelSchema.safeParse(modelData);
            if (!parseResult.success && parseResult.error.issues.length <= 3) {
              console.warn(
                `   Issues: ${parseResult.error.issues.map(i => `${i.path.join('.')} ${i.message}`).join(', ')}`
              );
            }
          } catch {
            // JSON parsing failed
            console.warn(`   JSON parsing error`);
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
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
          console.warn(`⚠️  Skipping invalid container file - validation failed`);
          // Try to parse JSON first to see if it's a JSON parsing error or validation error
          try {
            const containerData = JSON.parse(fileContent);
            // If JSON parsing succeeds, it's a validation error
            const parseResult = this.ContainerSchema.safeParse(containerData);
            if (!parseResult.success && parseResult.error.issues.length <= 3) {
              console.warn(
                `   Issues: ${parseResult.error.issues.map(i => `${i.path.join('.')} ${i.message}`).join(', ')}`
              );
            }
          } catch {
            // JSON parsing failed
            console.warn(`   JSON parsing error`);
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
    output += '  label: string | null;\n';
    output += '  url: string;\n';
    output += '  target?: string | null;\n';
    output += '  filesize?: number;\n';
    output += '  pixelHeight?: string;\n';
    output += '  pixelWidth?: string;\n';
    output += '  height?: number;\n';
    output += '  width?: number;\n';
    output += '  // Legacy/alternative field names for backward compatibility\n';
    output += '  fileName?: string;\n';
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

    output += 'export interface AgilityGallery {\n';
    output += '  galleryID: number;\n';
    output += '  name: string;\n';
    output += '  description?: string;\n';
    output += '  media: AgilityImage[];\n';
    output += '  count: number;\n';
    output += '}\n\n';

    output += 'export interface AgilityContentReference {\n';
    output += '  referencename: string;\n';
    output += '  fulllist?: boolean;\n';
    output += '}\n\n';

    output += 'export interface AgilityContentItem<TFields = any> {\n';
    output += '  contentID: number;\n';
    output += '  properties: {\n';
    output += '    state: number;\n';
    output += '    modified: string;\n';
    output += '    versionID: number;\n';
    output += '    referenceName: string;\n';
    output += '    definitionName: string;\n';
    output += '    itemOrder: number;\n';
    output += '  };\n';
    output += '  fields: TFields;\n';
    output += '  seo: any;\n';
    output += '}\n\n';

    // Add depth-aware utility types
    output += this.generateContentDepthUtilityTypes();

    // Generate base content interfaces (without depth parameter)
    for (const model of models) {
      if (!model.referenceName || !model.fields) continue;

      const interfaceName = this.pascalCase(model.referenceName);
      output += `// Model: ${model.displayName || model.referenceName} (Base interface)\n`;
      output += `export interface ${interfaceName}ContentBase {\n`;

      for (const field of model.fields) {
        if (!field.name || !field.isDataField) continue;

        const fieldName = this.camelize(field.name);
        const fieldType = this.getBaseTypeScriptType(field);
        const description = field.description || field.label || '';

        if (description) {
          output += `  /** ${this.escapeDescription(description)} */\n`;
        }
        output += `  ${fieldName}: ${fieldType};\n`;
      }

      output += '}\n\n';
    }

    // Generate depth-aware content interfaces
    for (const model of models) {
      if (!model.referenceName || !model.fields) continue;

      const interfaceName = this.pascalCase(model.referenceName);
      output += `// Model: ${model.displayName || model.referenceName} (Depth-aware interface)\n`;
      output += `export interface ${interfaceName}Content<D extends ContentLinkDepth = 1> {\n`;

      for (const field of model.fields) {
        if (!field.name || !field.isDataField) continue;

        const fieldName = this.camelize(field.name);
        const fieldType = this.getDepthAwareTypeScriptType(field);
        const description = field.description || field.label || '';

        if (description) {
          output += `  /** ${this.escapeDescription(description)} */\n`;
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
    let output = "import { z } from 'zod/v4';\n\n";
    output += '// Generated Zod schemas for Agility CMS content\n';
    output += '// Generated on: ' + new Date().toISOString() + '\n\n';

    // Add common schema definitions
    output += '// Common Agility CMS schemas\n';
    output += 'export const AgilityImageSchema = z.object({\n';
    output += '  label: z.string().nullable().optional(),\n';
    output += '  url: z.string(),\n';
    output += '  target: z.string().nullable().optional(),\n';
    output += '  filesize: z.number().optional(),\n';
    output += '  pixelHeight: z.string().optional(),\n';
    output += '  pixelWidth: z.string().optional(),\n';
    output += '  height: z.number().optional(),\n';
    output += '  width: z.number().optional(),\n';
    output += '  // Legacy/alternative field names for backward compatibility\n';
    output += '  fileName: z.string().optional(),\n';
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

    output += 'export const AgilityGallerySchema = z.object({\n';
    output += '  galleryID: z.number(),\n';
    output += '  name: z.string(),\n';
    output += '  description: z.string().optional(),\n';
    output += '  media: z.array(AgilityImageSchema),\n';
    output += '  count: z.number(),\n';
    output += '});\n\n';

    output += 'export const AgilityContentReferenceSchema = z.object({\n';
    output += '  referencename: z.string(),\n';
    output += '  fulllist: z.boolean().optional(),\n';
    output += '});\n\n';

    output +=
      'export const AgilityContentItemSchema = <T extends z.ZodTypeAny>(fieldsSchema: T) => z.object({\n';
    output += '  contentID: z.number(),\n';
    output += '  properties: z.object({\n';
    output += '    state: z.number(),\n';
    output += '    modified: z.string(),\n';
    output += '    versionID: z.number(),\n';
    output += '    referenceName: z.string(),\n';
    output += '    definitionName: z.string(),\n';
    output += '    itemOrder: z.number(),\n';
    output += '  }),\n';
    output += '  fields: fieldsSchema,\n';
    output += '  seo: z.any(),\n';
    output += '});\n\n';

    // Export the inferred types from schemas
    output += 'export type AgilityImage = z.infer<typeof AgilityImageSchema>;\n';
    output += 'export type AgilityFile = z.infer<typeof AgilityFileSchema>;\n';
    output += 'export type AgilityLink = z.infer<typeof AgilityLinkSchema>;\n';
    output += 'export type AgilityGallery = z.infer<typeof AgilityGallerySchema>;\n';
    output +=
      'export type AgilityContentReference = z.infer<typeof AgilityContentReferenceSchema>;\n';
    output += 'export type AgilityContentItem<TFields = any> = {\n';
    output += '  contentID: number;\n';
    output += '  properties: {\n';
    output += '    state: number;\n';
    output += '    modified: string;\n';
    output += '    versionID: number;\n';
    output += '    referenceName: string;\n';
    output += '    definitionName: string;\n';
    output += '    itemOrder: number;\n';
    output += '  };\n';
    output += '  fields: TFields;\n';
    output += '  seo: any;\n';
    output += '};\n\n';

    // Add depth-aware schema utility types
    output += this.generateZodDepthUtilityTypes();

    // Generate base content schemas (without depth parameter)
    for (const model of models) {
      if (!model.referenceName || !model.fields) continue;

      const schemaName = this.pascalCase(model.referenceName) + 'ContentBaseSchema';

      output += `// Model: ${model.displayName || model.referenceName} (Base schema)\n`;
      output += `export const ${schemaName} = z.object({\n`;

      for (const field of model.fields) {
        if (!field.name || !field.isDataField) continue;

        const fieldName = this.camelize(field.name);
        const zodType = this.getBaseZodType(field);
        const description = field.description || field.label || '';

        if (description) {
          output += `  /** ${this.escapeDescription(description)} */\n`;
        }
        output += `  ${fieldName}: ${zodType},\n`;
      }

      output += '});\n\n';
    }

    // Generate depth-aware content schema factories
    for (const model of models) {
      if (!model.referenceName || !model.fields) continue;

      const factoryName = this.pascalCase(model.referenceName) + 'ContentSchemaFactory';
      const interfaceName = this.pascalCase(model.referenceName) + 'Content';

      output += `// Model: ${model.displayName || model.referenceName} (Depth-aware schema factory)\n`;
      output += `export const ${factoryName} = <D extends z.ZodTypeAny>(depthType: D) => z.object({\n`;

      for (const field of model.fields) {
        if (!field.name || !field.isDataField) continue;

        const fieldName = this.camelize(field.name);
        const zodType = this.getDepthAwareZodType(field);
        const description = field.description || field.label || '';

        if (description) {
          output += `  /** ${this.escapeDescription(description)} */\n`;
        }
        output += `  ${fieldName}: ${zodType},\n`;
      }

      output += '});\n\n';

      // Generate convenience schemas for common depths
      output += `// Convenience schemas for ${interfaceName} at specific depths\n`;
      output += `export const ${this.pascalCase(model.referenceName)}ContentSchema = ${factoryName}(z.literal(1));\n`;
      output += `export const ${this.pascalCase(model.referenceName)}ContentDepth0Schema = ${factoryName}(z.literal(0));\n`;
      output += `export const ${this.pascalCase(model.referenceName)}ContentDepth2Schema = ${factoryName}(z.literal(2));\n\n`;

      // Export inferred types with generic depth parameter
      output += `export type ${interfaceName}<D extends ContentLinkDepth = 1> = z.infer<ReturnType<typeof ${factoryName}<z.ZodLiteral<D>>>>;\n`;
      output += `export type ${interfaceName}Depth0 = z.infer<typeof ${this.pascalCase(model.referenceName)}ContentDepth0Schema>;\n`;
      output += `export type ${interfaceName}Depth2 = z.infer<typeof ${this.pascalCase(model.referenceName)}ContentDepth2Schema>;\n\n`;
    }

    return output;
  }

  /**
   * Generate content module type interfaces and mapping
   */
  public generateContentModuleTypes(
    contentModules: mgmtApi.Model[],
    models: mgmtApi.Model[]
  ): string {
    let output = '// Generated content module type definitions for Agility CMS\n';
    output += '// Generated on: ' + new Date().toISOString() + '\n\n';

    // Create lookup map for models by ID
    const modelById = new Map<number, mgmtApi.Model>();
    for (const model of models) {
      if (model.id) {
        modelById.set(model.id, model);
      }
    }

    // Collect all referenced content types
    const referencedContentTypes = new Set<string>();
    for (const module of contentModules) {
      if (!module.referenceName) continue;
      const correspondingModel = modelById.get(module.id || 0);
      if (correspondingModel && correspondingModel.fields) {
        for (const field of correspondingModel.fields) {
          if (field.type === 'Content' && field.settings && field.settings.ContentDefinition) {
            const referencedModel = this.modelsByReferenceName.get(
              field.settings.ContentDefinition
            );
            if (referencedModel) {
              const typeName = this.pascalCase(referencedModel.referenceName) + 'Content';
              referencedContentTypes.add(typeName);
            }
          }
        }
      }
    }

    // Import base types and referenced content types
    output += 'import type {\n';
    output += '  AgilityContentItem,\n';
    output += '  AgilityImage,\n';
    output += '  AgilityFile,\n';
    output += '  AgilityLink,\n';
    output += '  AgilityGallery,\n';
    output += '  AgilityContentReference,\n';
    output += '  ContentLinkDepth,\n';
    output += '  ContentFieldAtDepth,\n';
    output += '  ContentArrayFieldAtDepth';

    // Add referenced content types to imports if any exist
    if (referencedContentTypes.size > 0) {
      output += ',\n';
      const sortedTypes = Array.from(referencedContentTypes).sort();
      for (let i = 0; i < sortedTypes.length; i++) {
        output += `  ${sortedTypes[i]}`;
        if (i < sortedTypes.length - 1) {
          output += ',\n';
        } else {
          output += '\n';
        }
      }
    } else {
      output += '\n';
    }

    output += "} from './content-types';\n\n";

    // Generate module interfaces
    output += '// Content Module Types\n';
    for (const module of contentModules) {
      if (!module.referenceName) continue;

      const moduleTypeName = this.pascalCase(module.referenceName);
      const correspondingModel = modelById.get(module.id || 0);

      output += `/** ${module.displayName || module.referenceName} */\n`;

      if (correspondingModel && correspondingModel.fields && correspondingModel.fields.length > 0) {
        // Module has fields - generate props interface
        output += `export interface ${moduleTypeName}Props {\n`;

        for (const field of correspondingModel.fields) {
          if (!field.name || !field.isDataField) continue;

          const fieldName = this.camelize(field.name);
          const fieldType = this.getBaseTypeScriptType(field);
          const description = field.description || field.label || '';

          if (description) {
            output += `  /** ${this.escapeDescription(description)} */\n`;
          }
          output += `  ${fieldName}: ${fieldType};\n`;
        }

        output += '}\n\n';

        // Generate depth-aware version
        output += `export interface ${moduleTypeName}PropsDepthAware<D extends ContentLinkDepth = 1> {\n`;

        for (const field of correspondingModel.fields) {
          if (!field.name || !field.isDataField) continue;

          const fieldName = this.camelize(field.name);
          const fieldType = this.getDepthAwareTypeScriptType(field);
          const description = field.description || field.label || '';

          if (description) {
            output += `  /** ${this.escapeDescription(description)} */\n`;
          }
          output += `  ${fieldName}: ${fieldType};\n`;
        }

        output += '}\n\n';
      } else {
        // Module has no fields - generate empty props interface
        output += `export interface ${moduleTypeName}Props {\n`;
        output += '  // This module has no configurable fields\n';
        output += '}\n\n';
      }
    }

    // Generate content module mapping
    output += '// Content Module Mapping\n';
    output += 'export const ContentModuleMapping = {\n';

    for (const module of contentModules) {
      if (!module.referenceName) continue;

      const moduleTypeName = this.pascalCase(module.referenceName);
      output += `  "${module.referenceName}": "${moduleTypeName}Props",\n`;
    }

    output += '} as const;\n\n';

    // Generate helper types
    output += 'export type ContentModuleName = keyof typeof ContentModuleMapping;\n\n';

    // Generate a union type of all props interfaces
    output += 'export type AllContentModuleProps = ';
    const moduleTypeNames: string[] = [];
    for (const module of contentModules) {
      if (module.referenceName) {
        const typeName = this.pascalCase(module.referenceName) + 'Props';
        moduleTypeNames.push(typeName);
      }
    }
    output += moduleTypeNames.join(' | ') + ';\n\n';

    // Simple helper function for getting props type by module name
    output += '/**\n';
    output += ' * Helper function to get the props type for a specific content module\n';
    output += ' * Usage: Use the ContentModuleMapping to determine the correct props type\n';
    output += ' */\n';
    output += 'export type GetContentModuleProps<T extends ContentModuleName> = \n';

    // Generate the conditional type mapping
    const validModules = contentModules.filter(m => m.referenceName);
    for (let i = 0; i < validModules.length; i++) {
      const module = validModules[i];
      const moduleTypeName = this.pascalCase(module.referenceName!) + 'Props';

      output += `  T extends "${module.referenceName}" ? ${moduleTypeName} :`;

      if (i === validModules.length - 1) {
        output += '\n  never;\n\n';
      } else {
        output += '\n';
      }
    }

    // Generate module list for easy consumption
    output += '// Available Content Modules\n';
    output += 'export const AvailableContentModules = [\n';
    for (const module of contentModules) {
      if (module.referenceName) {
        output += `  {\n`;
        output += `    referenceName: "${module.referenceName}",\n`;
        output += `    displayName: "${this.escapeDescription(module.displayName || module.referenceName)}",\n`;
        output += `    description: "${this.escapeDescription(module.description || '')}",\n`;
        output += `    hasFields: ${modelById.get(module.id || 0)?.fields?.length ? 'true' : 'false'},\n`;
        output += `  },\n`;
      }
    }
    output += '] as const;\n\n';

    return output;
  }

  /**
   * Generate content module Zod schemas
   */
  public generateContentModuleZodSchemas(
    contentModules: mgmtApi.Model[],
    models: mgmtApi.Model[]
  ): string {
    let output = "import { z } from 'zod/v4';\n";

    // Create lookup map for models by ID
    const modelById = new Map<number, mgmtApi.Model>();
    for (const model of models) {
      if (model.id) {
        modelById.set(model.id, model);
      }
    }

    // Collect all referenced content schema factories
    const referencedSchemaFactories = new Set<string>();
    for (const module of contentModules) {
      if (!module.referenceName) continue;
      const correspondingModel = modelById.get(module.id || 0);
      if (correspondingModel && correspondingModel.fields) {
        for (const field of correspondingModel.fields) {
          if (field.type === 'Content' && field.settings && field.settings.ContentDefinition) {
            const referencedModel = this.modelsByReferenceName.get(
              field.settings.ContentDefinition
            );
            if (referencedModel) {
              const schemaFactoryName =
                this.pascalCase(referencedModel.referenceName) + 'ContentSchemaFactory';
              referencedSchemaFactories.add(schemaFactoryName);
            }
          }
        }
      }
    }

    output += 'import {\n';
    output += '  AgilityImageSchema,\n';
    output += '  AgilityFileSchema,\n';
    output += '  AgilityLinkSchema,\n';
    output += '  AgilityGallerySchema,\n';
    output += '  AgilityContentReferenceSchema,\n';
    output += '  createContentFieldSchema,\n';
    output += '  createContentArrayFieldSchema,\n';
    output += '  ContentLinkDepth';

    // Add referenced schema factories to imports if any exist
    if (referencedSchemaFactories.size > 0) {
      output += ',\n';
      const sortedFactories = Array.from(referencedSchemaFactories).sort();
      for (let i = 0; i < sortedFactories.length; i++) {
        output += `  ${sortedFactories[i]}`;
        if (i < sortedFactories.length - 1) {
          output += ',\n';
        } else {
          output += '\n';
        }
      }
    } else {
      output += '\n';
    }

    output += "} from './content-schemas';\n\n";
    output += '// Generated Zod schemas for content modules\n';
    output += '// Generated on: ' + new Date().toISOString() + '\n\n';

    // Generate module schemas
    for (const module of contentModules) {
      if (!module.referenceName) continue;

      const moduleTypeName = this.pascalCase(module.referenceName);
      const correspondingModel = modelById.get(module.id || 0);

      output += `// Schema for ${module.displayName || module.referenceName}\n`;

      if (correspondingModel && correspondingModel.fields && correspondingModel.fields.length > 0) {
        // Module has fields - generate props schema
        output += `export const ${moduleTypeName}PropsSchema = z.object({\n`;

        for (const field of correspondingModel.fields) {
          if (!field.name || !field.isDataField) continue;

          const fieldName = this.camelize(field.name);
          const zodType = this.getBaseZodType(field);
          const description = field.description || field.label || '';

          if (description) {
            output += `  /** ${this.escapeDescription(description)} */\n`;
          }
          output += `  ${fieldName}: ${zodType},\n`;
        }

        output += '});\n\n';

        // Generate depth-aware schema factory
        output += `export const ${moduleTypeName}PropsSchemaFactory = <D extends z.ZodTypeAny>(depthType: D) => z.object({\n`;

        for (const field of correspondingModel.fields) {
          if (!field.name || !field.isDataField) continue;

          const fieldName = this.camelize(field.name);
          const zodType = this.getDepthAwareZodType(field);
          const description = field.description || field.label || '';

          if (description) {
            output += `  /** ${this.escapeDescription(description)} */\n`;
          }
          output += `  ${fieldName}: ${zodType},\n`;
        }

        output += '});\n\n';
      } else {
        // Module has no fields - generate empty schema
        output += `export const ${moduleTypeName}PropsSchema = z.object({});\n`;
        output += `export const ${moduleTypeName}PropsSchemaFactory = <D extends z.ZodTypeAny>(depthType: D) => z.object({});\n\n`;
      }

      // Generate inferred types
      output += `export type ${moduleTypeName}Props = z.infer<typeof ${moduleTypeName}PropsSchema>;\n`;
      output += `export type ${moduleTypeName}PropsDepthAware<D extends ContentLinkDepth = 1> = z.infer<ReturnType<typeof ${moduleTypeName}PropsSchemaFactory<z.ZodLiteral<D>>>>;\n\n`;
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

  /**
   * Escape quotes and other special characters in descriptions for use in JSDoc comments
   */
  private escapeDescription(description: string): string {
    if (!description) return '';
    return description
      .replace(/\\/g, '\\\\') // Escape backslashes first
      .replace(/\*\//g, '*\\/') // Escape JSDoc end sequences
      .replace(/"/g, '\\"') // Escape double quotes
      .replace(/'/g, "\\'") // Escape single quotes
      .replace(/\r\n/g, ' ') // Replace CRLF with space
      .replace(/\n/g, ' ') // Replace LF with space
      .replace(/\r/g, ' ') // Replace CR with space
      .replace(/\t/g, ' ') // Replace tabs with space
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .trim(); // Remove leading/trailing whitespace
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
        return 'AgilityGallery';
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
        return 'AgilityGallerySchema';
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
        const fullType = isArray ? `${typeName}[]` : typeName;
        const refType = isArray ? 'AgilityContentReference[]' : 'AgilityContentReference';
        // Return union type that handles both shallow and deep references
        return `${fullType} | ${refType}`;
      }
    }
    // Fallback to generic content reference
    return 'AgilityContentReference | AgilityContentReference[]';
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

        if (isArray) {
          // For arrays: union of full content array or reference array
          return `z.union([z.array(${lazySchema}), z.array(AgilityContentReferenceSchema)])`;
        } else {
          // For single items: union of full content or reference
          return `z.union([${lazySchema}, AgilityContentReferenceSchema])`;
        }
      }
    }
    // Fallback to generic content reference
    return 'z.union([AgilityContentReferenceSchema, z.array(AgilityContentReferenceSchema)])';
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
        return 'AgilityGallerySchema';
      default:
        return 'z.any()';
    }
  }

  /**
   * Generate container-to-content-type mapping with depth-aware types
   */
  public generateContainerTypeMapping(
    models: mgmtApi.Model[],
    containers: mgmtApi.Container[]
  ): string {
    let output = '// Generated container-to-content-type mapping for Agility CMS\n';
    output += '// Generated on: ' + new Date().toISOString() + '\n\n';

    // Create mapping of model ID to model reference name
    const modelIdToReference = new Map<number, string>();
    const referencedTypes = new Set<string>();
    for (const model of models) {
      if (model.id && model.referenceName) {
        modelIdToReference.set(model.id, model.referenceName);
      }
    }

    // Collect all referenced content types for imports
    for (const container of containers) {
      if (container.referenceName && container.contentDefinitionID) {
        const modelReference = modelIdToReference.get(container.contentDefinitionID);
        if (modelReference) {
          const typeName = this.pascalCase(modelReference) + 'Content';
          referencedTypes.add(typeName);
        }
      }
    }

    // Generate imports for referenced content types
    if (referencedTypes.size > 0) {
      const sortedTypes = Array.from(referencedTypes).sort();
      output += `// Import generated content types\n`;
      output += `import type {\n`;
      output += `  AgilityContentReference,\n`;
      for (const typeName of sortedTypes) {
        output += `  ${typeName},\n`;
      }
      output += `} from './content-schemas';\n\n`;
    }

    // Generate depth-aware utility types first
    output += this.generateDepthAwareUtilityTypes();

    // Generate base container mapping with lowercase keys for API compatibility
    output += 'export const ContainerTypeMapping = {\n';

    for (const container of containers) {
      if (!container.referenceName || !container.contentDefinitionID) continue;

      const modelReference = modelIdToReference.get(container.contentDefinitionID);
      if (modelReference) {
        const typeName = this.pascalCase(modelReference) + 'Content';
        // Ensure lowercase key for API compatibility
        const lowercaseKey = container.referenceName.toLowerCase();
        output += `  "${lowercaseKey}": "${typeName}",\n`;
      }
    }

    output += '} as const;\n\n';

    // Generate depth-aware container mapping
    output += this.generateDepthAwareContainerMapping(models, containers);

    // Generate helper type for container queries
    output += 'export type ContainerContentType<T extends keyof typeof ContainerTypeMapping> = {\n';
    output += '  [K in T]: typeof ContainerTypeMapping[K] extends infer U\n';
    output += '    ? U extends string\n';
    output += '      ? U\n';
    output += '      : never\n';
    output += '    : never\n';
    output += '}[T];\n\n';

    // Generate depth-aware lookup function
    output += this.generateDepthAwareLookupFunctions();

    return output;
  }

  /**
   * Generate content depth utility types for modeling ContentLinkDepth behavior in content interfaces
   */
  private generateContentDepthUtilityTypes(): string {
    let output = '// Content depth utility types for modeling ContentLinkDepth behavior\n';

    output += 'export type ContentLinkDepth = 0 | 1 | 2 | 3 | 4 | 5;\n\n';

    output += '/**\n';
    output += ' * Models how content fields behave at different depths\n';
    output += ' * - Depth 0: Always returns AgilityContentReference\n';
    output += ' * - Depth 1+: Returns full content objects when ExpandAllContentLinks=true\n';
    output += ' */\n';
    output += 'export type ContentFieldAtDepth<TContent, D extends ContentLinkDepth> = \n';
    output += '  D extends 0 ? AgilityContentReference : \n';
    output += '  (AgilityContentItem<TContent> | AgilityContentReference);\n\n';

    output += 'export type ContentArrayFieldAtDepth<TContent, D extends ContentLinkDepth> = \n';
    output += '  D extends 0 ? AgilityContentReference[] : \n';
    output += '  D extends 1 ? (AgilityContentItem<TContent>[] | AgilityContentReference[]) : \n';
    output += '  AgilityContentItem<TContent>[]; // At depth 2+, content is fully expanded\n\n';

    return output;
  }

  /**
   * Get base TypeScript type without depth awareness (for backward compatibility)
   */
  private getBaseTypeScriptType(field: mgmtApi.ModelField): string {
    switch (field.type) {
      case 'Text':
      case 'MultiLineText':
      case 'HTML':
      case 'URL':
        return 'string';
      case 'Dropdown':
        return 'string';
      case 'Link':
        return 'AgilityLink';
      case 'Number':
      case 'Decimal':
        return 'number';
      case 'DateTime':
        return 'string';
      case 'Boolean':
        return 'boolean';
      case 'Content':
        return 'AgilityContentReference | AgilityContentReference[]';
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
        return 'AgilityGallery';
      default:
        return 'any';
    }
  }

  /**
   * Get depth-aware TypeScript type for content fields
   */
  private getDepthAwareTypeScriptType(field: mgmtApi.ModelField): string {
    switch (field.type) {
      case 'Text':
      case 'MultiLineText':
      case 'HTML':
      case 'URL':
        return 'string';
      case 'Dropdown':
        return 'string';
      case 'Link':
        return 'AgilityLink';
      case 'Number':
      case 'Decimal':
        return 'number';
      case 'DateTime':
        return 'string';
      case 'Boolean':
        return 'boolean';
      case 'Content':
        return this.resolveDepthAwareContentFieldType(field);
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

  /**
   * Resolve depth-aware Content field type
   */
  private resolveDepthAwareContentFieldType(field: mgmtApi.ModelField): string {
    const settings = field.settings;
    if (settings && settings.ContentDefinition) {
      const referencedModel = this.modelsByReferenceName.get(settings.ContentDefinition);
      if (referencedModel) {
        const typeName = this.pascalCase(referencedModel.referenceName) + 'Content<D>';

        // More comprehensive array detection
        const isArray =
          settings.LinkedContentType === 'list' ||
          settings.Sort ||
          settings.SortIDFieldName || // Has sorting = multiple items
          settings.RenderAs === 'grid' || // Grid rendering = multiple items
          settings.RenderAs === 'searchlistbox' || // Search list box = multiple items
          settings.LinkedContentNestedTypeID === '1' || // Nested content type 1 = array
          settings.SharedContent === 'true' ||
          field.name?.toLowerCase().includes('list') ||
          field.name?.toLowerCase().includes('items') ||
          field.name?.toLowerCase().includes('products');

        if (isArray) {
          return `ContentArrayFieldAtDepth<${typeName}, D>`;
        } else {
          return `ContentFieldAtDepth<${typeName}, D>`;
        }
      }
    }
    // Fallback - assume array if field name suggests it
    const fieldName = field.name?.toLowerCase() || '';
    if (
      fieldName.includes('list') ||
      fieldName.includes('items') ||
      fieldName.includes('products')
    ) {
      return 'ContentArrayFieldAtDepth<any, D>';
    }
    return 'ContentFieldAtDepth<any, D>';
  }

  /**
   * Generate Zod depth utility types
   */
  private generateZodDepthUtilityTypes(): string {
    let output = '// Zod depth utility types for schema validation\n';

    output +=
      'export const ContentLinkDepthSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);\n';
    output += 'export type ContentLinkDepth = z.infer<typeof ContentLinkDepthSchema>;\n\n';

    output += '// Helper function to create depth-aware content field schemas\n';
    output +=
      'export const createContentFieldSchema = <T extends z.ZodTypeAny>(contentSchema: T) => \n';
    output += '  z.union([contentSchema, AgilityContentReferenceSchema]);\n\n';

    output +=
      'export const createContentArrayFieldSchema = <T extends z.ZodTypeAny>(contentSchema: T) => \n';
    output += '  z.union([z.array(contentSchema), z.array(AgilityContentReferenceSchema)]);\n\n';

    return output;
  }

  /**
   * Get base Zod type without depth awareness (for backward compatibility)
   */
  private getBaseZodType(field: mgmtApi.ModelField): string {
    switch (field.type) {
      case 'Text':
      case 'MultiLineText':
      case 'HTML':
      case 'URL':
        return 'z.string()';
      case 'Dropdown':
        return 'z.string()';
      case 'Link':
        return 'AgilityLinkSchema';
      case 'Number':
      case 'Decimal':
        return 'z.number()';
      case 'DateTime':
        return 'z.string()';
      case 'Boolean':
        return 'z.boolean()';
      case 'Content':
        return 'z.union([AgilityContentReferenceSchema, z.array(AgilityContentReferenceSchema)])';
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
        return 'AgilityGallerySchema';
      default:
        return 'z.any()';
    }
  }

  /**
   * Get depth-aware Zod type for content fields
   */
  private getDepthAwareZodType(field: mgmtApi.ModelField): string {
    switch (field.type) {
      case 'Text':
      case 'MultiLineText':
      case 'HTML':
      case 'URL':
        return 'z.string()';
      case 'Dropdown':
        return 'z.string()';
      case 'Link':
        return 'AgilityLinkSchema';
      case 'Number':
      case 'Decimal':
        return 'z.number()';
      case 'DateTime':
        return 'z.string()';
      case 'Boolean':
        return 'z.boolean()';
      case 'Content':
        return this.resolveDepthAwareZodContentFieldType(field);
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
        return 'AgilityGallerySchema';
      default:
        return 'z.any()';
    }
  }

  /**
   * Resolve depth-aware Zod Content field type
   */
  private resolveDepthAwareZodContentFieldType(field: mgmtApi.ModelField): string {
    const settings = field.settings;
    if (settings && settings.ContentDefinition) {
      const referencedModel = this.modelsByReferenceName.get(settings.ContentDefinition);
      if (referencedModel) {
        const schemaName =
          this.pascalCase(referencedModel.referenceName) + 'ContentSchemaFactory(depthType)';
        const isArray = settings.LinkedContentType === 'list' || settings.Sort;

        if (isArray) {
          return `createContentArrayFieldSchema(${schemaName})`;
        } else {
          return `createContentFieldSchema(${schemaName})`;
        }
      }
    }
    // Fallback for unknown content types
    return 'z.union([z.any(), AgilityContentReferenceSchema])';
  }

  /**
   * Generate depth-aware utility types for modeling ContentLinkDepth behavior
   */
  private generateDepthAwareUtilityTypes(): string {
    let output = '// Depth-aware utility types for ContentLinkDepth modeling\n';

    output += 'export type ContentLinkDepth = 0 | 1 | 2 | 3 | 4 | 5;\n\n';

    output += '/**\n';
    output +=
      ' * Models content field behavior based on ContentLinkDepth and ExpandAllContentLinks\n';
    output += ' * - Depth 0 / ExpandAllContentLinks=false: Returns AgilityContentReference\n';
    output += ' * - Depth 1+ / ExpandAllContentLinks=true: Returns full content objects\n';
    output += ' */\n';
    output += 'export type ContentAtDepth<T, D extends ContentLinkDepth> = \n';
    output += '  D extends 0 ? AgilityContentReference :\n';
    output += '  T;\n\n';

    output += 'export type ContentArrayAtDepth<T, D extends ContentLinkDepth> = \n';
    output += '  D extends 0 ? AgilityContentReference[] :\n';
    output += '  T[];\n\n';

    return output;
  }

  /**
   * Generate depth-aware container mapping that models different depth levels
   */
  private generateDepthAwareContainerMapping(
    models: mgmtApi.Model[],
    containers: mgmtApi.Container[]
  ): string {
    let output = '// Depth-aware container type mapping\n';
    output += 'export interface DepthAwareContainerMapping {\n';

    // Create mapping of model ID to model reference name
    const modelIdToReference = new Map<number, string>();
    for (const model of models) {
      if (model.id && model.referenceName) {
        modelIdToReference.set(model.id, model.referenceName);
      }
    }

    for (const container of containers) {
      if (!container.referenceName || !container.contentDefinitionID) continue;

      const modelReference = modelIdToReference.get(container.contentDefinitionID);
      if (modelReference) {
        const typeName = this.pascalCase(modelReference) + 'Content';
        const lowercaseKey = container.referenceName.toLowerCase();

        // Generate depth-specific entries
        output += `  "${lowercaseKey}": {\n`;
        output += `    depth0: ContentAtDepth<${typeName}, 0>;\n`;
        output += `    depth1: ContentAtDepth<${typeName}, 1>;\n`;
        output += `    depth2: ContentAtDepth<${typeName}, 2>;\n`;
        output += `    depth3: ContentAtDepth<${typeName}, 3>;\n`;
        output += `    depth4: ContentAtDepth<${typeName}, 4>;\n`;
        output += `    depth5: ContentAtDepth<${typeName}, 5>;\n`;
        output += `  };\n`;
      }
    }

    output += '}\n\n';

    output += 'export type KnownContainerNames = keyof DepthAwareContainerMapping;\n\n';

    return output;
  }

  /**
   * Generate depth-aware lookup functions to replace manual type mapping
   */
  private generateDepthAwareLookupFunctions(): string {
    let output = '/**\n';
    output += ' * Get content type for container at specific depth\n';
    output += ' * Replaces manual ContentListTypeMapping with generated types\n';
    output += ' */\n';
    output += 'export function getContainerContentTypeAtDepth<\n';
    output += '  K extends KnownContainerNames,\n';
    output += '  D extends ContentLinkDepth\n';
    output += '>(\n';
    output += '  containerRef: K,\n';
    output += '  depth: D\n';
    output += '): DepthAwareContainerMapping[K][`depth${D}`] {\n';
    output += '  // Runtime implementation would return appropriate type\n';
    output += '  // This is primarily for compile-time type inference\n';
    output += '  return null as any;\n';
    output += '}\n\n';

    output += '/**\n';
    output += ' * Enhanced getContentListItems with automatic depth-aware type inference\n';
    output += ' * Replaces the manual overload approach with generated types\n';
    output += ' */\n';
    output += 'export interface GetContentListItemsOptions {\n';
    output += '  contentLinkDepth?: ContentLinkDepth;\n';
    output += '  expandAllContentLinks?: boolean;\n';
    output += '}\n\n';

    output += 'export type GetContentListItemsResult<\n';
    output += '  K extends KnownContainerNames,\n';
    output += '  D extends ContentLinkDepth\n';
    output += '> = Array<{\n';
    output += '  contentID: number;\n';
    output += '  fields: DepthAwareContainerMapping[K][`depth${D}`];\n';
    output += '}>;\n\n';

    return output;
  }
}
