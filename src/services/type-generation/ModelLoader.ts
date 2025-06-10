import { z } from 'zod/v4';
import * as mgmtApi from '@agility/management-sdk';
import { fileOperations } from '../../fileOperations';

export interface LoadResult<T> {
  items: T[];
  errors: string[];
  warnings: string[];
}

/**
 * Service responsible for loading and validating models, containers, and content modules from files
 */
export class ModelLoader {
  private fileOps: fileOperations;

  constructor(fileOps?: fileOperations) {
    this.fileOps = fileOps || new fileOperations();
  }

  /**
   * Load all data needed for type generation
   */
  async loadAll(baseFolder = '.agility-files'): Promise<{
    models: LoadResult<mgmtApi.Model>;
    containers: LoadResult<mgmtApi.Container>;
    contentModules: LoadResult<mgmtApi.Model>;
  }> {
    const [models, containers, contentModules] = await Promise.all([
      this.loadModels(baseFolder),
      this.loadContainers(baseFolder),
      this.loadContentModules(baseFolder),
    ]);

    return { models, containers, contentModules };
  }

  /**
   * Load and validate models from .agility-files/models directory
   */
  async loadModels(baseFolder = '.agility-files'): Promise<LoadResult<mgmtApi.Model>> {
    const result = await this.loadAndValidateItems(
      'models',
      baseFolder,
      this.getModelSchema(),
      'model'
    );
    return {
      ...result,
      items: result.items as unknown as mgmtApi.Model[],
    };
  }

  /**
   * Load and validate containers from .agility-files/containers directory
   */
  async loadContainers(baseFolder = '.agility-files'): Promise<LoadResult<mgmtApi.Container>> {
    const result = await this.loadAndValidateItems(
      'containers',
      baseFolder,
      this.getContainerSchema(),
      'container'
    );
    return {
      ...result,
      items: result.items as unknown as mgmtApi.Container[],
    };
  }

  /**
   * Load and validate content modules from .agility-files/contentModules directory
   */
  async loadContentModules(baseFolder = '.agility-files'): Promise<LoadResult<mgmtApi.Model>> {
    const result = await this.loadAndValidateItems(
      'contentModules',
      baseFolder,
      this.getModelSchema(),
      'content module'
    );

    // Filter to only include modules (not pages)
    const modules = result.items.filter(
      item => item.contentDefinitionTypeName === 'Module'
    ) as unknown as mgmtApi.Model[];

    return {
      items: modules,
      errors: result.errors,
      warnings: result.warnings,
    };
  }

  private async loadAndValidateItems<T>(
    directory: string,
    baseFolder: string,
    schema: z.ZodSchema<T>,
    itemType: string
  ): Promise<LoadResult<T>> {
    const items: T[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const files = this.fileOps.readDirectory(directory, baseFolder);

      for (const fileContent of files) {
        try {
          const data = JSON.parse(fileContent);
          const validatedItem = schema.parse(data);
          items.push(validatedItem);
        } catch (error) {
          if (error instanceof z.ZodError) {
            errors.push(`Invalid ${itemType}: ${this.formatZodError(error)}`);
          } else if (error instanceof SyntaxError) {
            errors.push(`Invalid JSON in ${itemType} file: ${error.message}`);
          } else {
            errors.push(`Failed to load ${itemType}: ${error.message}`);
          }
        }
      }
    } catch (error) {
      warnings.push(`No ${itemType}s found in ${baseFolder}/${directory}: ${error.message}`);
    }

    return { items, errors, warnings };
  }

  private formatZodError(error: z.ZodError): string {
    if (error.issues.length <= 3) {
      return error.issues.map(i => `${i.path.join('.')} ${i.message}`).join(', ');
    }
    return `${error.issues.length} validation issues`;
  }

  private getModelSchema() {
    const ModelFieldBaseSchema = z
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
      .passthrough();

    const FieldTypeSchema = z.enum([
      'Text',
      'MultiLineText',
      'HTML',
      'Html',
      'Dropdown',
      'DropdownList',
      'URL',
      'Link',
      'Number',
      'Integer',
      'Decimal',
      'DateTime',
      'Boolean',
      'Content',
      'Hidden',
      'Custom',
      'CustomField',
      'CustomSection',
      'Tab',
      'LongText',
      'ImageAttachment',
      'PhotoGallery',
      'FileAttachment',
      'AttachmentList',
    ]);

    const ModelFieldSchema = ModelFieldBaseSchema.extend({
      type: FieldTypeSchema.nullable().optional(),
    });

    return z
      .object({
        id: z.number().optional(),
        lastModifiedDate: z.string().nullable().optional(),
        displayName: z.string().nullable().optional(),
        referenceName: z.string().nullable().optional(),
        lastModifiedBy: z.string().nullable().optional(),
        fields: z.array(ModelFieldSchema).default([]),
        lastModifiedAuthorID: z.number().nullable().optional(),
        description: z.string().nullable().optional(),
        allowTagging: z.boolean().nullable().optional(),
        contentDefinitionTypeName: z.string().nullable().optional(),
        isPublished: z.boolean().nullable().optional(),
        wasUnpublished: z.boolean().nullable().optional(),
      })
      .passthrough();
  }

  private getContainerSchema() {
    const ContentViewColumnSchema = z
      .object({
        fieldName: z.string().nullable().optional(),
        label: z.string().nullable().optional(),
        sortOrder: z.number().nullable().optional(),
        isDefaultSort: z.boolean().nullable().optional(),
        sortDirection: z.enum(['ASC', 'DESC']).nullable().optional(),
        typeName: z.string().nullable().optional(),
      })
      .passthrough();

    return z
      .object({
        contentViewID: z.number().nullable().optional(),
        contentDefinitionID: z.number().nullable().optional(),
        referenceName: z.string().nullable().optional(),
        contentDefinitionName: z.string().nullable().optional(),
        contentDefinitionType: z.number().nullable().optional(),
        contentDefinitionTypeID: z.number().nullable().optional(),
        columns: z.array(ContentViewColumnSchema).default([]).optional(),
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
      .passthrough();
  }
}
