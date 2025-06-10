import * as mgmtApi from '@agility/management-sdk';
import { TypeGenerationContext, GeneratedFile } from './types';
import { StringUtils, FieldTypeResolver, CodeGenerationUtils } from './utils';

/**
 * Service responsible for generating Zod schema definitions
 */
export class ZodSchemaGenerator {
  private fieldTypeResolver: FieldTypeResolver;

  constructor() {
    this.fieldTypeResolver = new FieldTypeResolver(new Map());
  }

  /**
   * Generate Zod schemas for all models
   */
  generate(context: TypeGenerationContext): GeneratedFile[] {
    this.fieldTypeResolver = new FieldTypeResolver(context.modelsByReferenceName);

    const files: GeneratedFile[] = [];

    // Generate main content schemas file
    const contentSchemas = this.generateContentZodSchemas(context.models);
    files.push({
      path: 'content-schemas.ts',
      content: contentSchemas,
      type: 'zod',
    });

    return files;
  }

  /**
   * Generate Zod schemas for content items based on models
   */
  private generateContentZodSchemas(models: mgmtApi.Model[]): string {
    let output = CodeGenerationUtils.generateSchemaHeader();

    // Add common schema definitions
    output += this.generateCommonSchemas();

    // Add depth-aware utility types
    output += this.generateZodDepthUtilityTypes();

    // Generate base content schemas (without depth parameter)
    output += this.generateBaseSchemas(models);

    // Generate depth-aware content schema factories
    output += this.generateDepthAwareSchemas(models);

    return output;
  }

  private generateCommonSchemas(): string {
    let output = '// Common Agility CMS schemas\n';

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

    return output;
  }

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

  private generateBaseSchemas(models: mgmtApi.Model[]): string {
    let output = '// Base content schemas (without depth parameter)\n';

    for (const model of models) {
      if (!model.referenceName || !model.fields) continue;

      const schemaName = StringUtils.pascalCase(model.referenceName) + 'ContentBaseSchema';

      output += `// Model: ${model.displayName || model.referenceName} (Base schema)\n`;
      output += `export const ${schemaName} = z.object({\n`;

      for (const field of model.fields) {
        if (!field.name || !field.isDataField) continue;

        const fieldName = StringUtils.camelize(field.name);
        const zodType = this.getBaseZodType(field);

        output += CodeGenerationUtils.generateFieldComment(field);
        output += `  ${fieldName}: ${zodType},\n`;
      }

      output += '});\n\n';
    }

    return output;
  }

  private generateDepthAwareSchemas(models: mgmtApi.Model[]): string {
    let output = '// Depth-aware content schema factories\n';

    for (const model of models) {
      if (!model.referenceName || !model.fields) continue;

      const factoryName = StringUtils.pascalCase(model.referenceName) + 'ContentSchemaFactory';
      const interfaceName = StringUtils.pascalCase(model.referenceName) + 'Content';

      output += `// Model: ${model.displayName || model.referenceName} (Depth-aware schema factory)\n`;
      output += `export const ${factoryName} = <D extends z.ZodTypeAny>(depthType: D) => z.object({\n`;

      for (const field of model.fields) {
        if (!field.name || !field.isDataField) continue;

        const fieldName = StringUtils.camelize(field.name);
        const zodType = this.getDepthAwareZodType(field);

        output += CodeGenerationUtils.generateFieldComment(field);
        output += `  ${fieldName}: ${zodType},\n`;
      }

      output += '});\n\n';

      // Generate convenience schemas for common depths
      output += `// Convenience schemas for ${interfaceName} at specific depths\n`;
      output += `export const ${StringUtils.pascalCase(model.referenceName)}ContentSchema = ${factoryName}(z.literal(1));\n`;
      output += `export const ${StringUtils.pascalCase(model.referenceName)}ContentDepth0Schema = ${factoryName}(z.literal(0));\n`;
      output += `export const ${StringUtils.pascalCase(model.referenceName)}ContentDepth2Schema = ${factoryName}(z.literal(2));\n\n`;

      // Export inferred types with generic depth parameter
      output += `export type ${interfaceName}<D extends ContentLinkDepth = 1> = z.infer<ReturnType<typeof ${factoryName}<z.ZodLiteral<D>>>>;\n`;
      output += `export type ${interfaceName}Depth0 = z.infer<typeof ${StringUtils.pascalCase(model.referenceName)}ContentDepth0Schema>;\n`;
      output += `export type ${interfaceName}Depth2 = z.infer<typeof ${StringUtils.pascalCase(model.referenceName)}ContentDepth2Schema>;\n\n`;
    }

    return output;
  }

  private getBaseZodType(field: mgmtApi.ModelField): string {
    const typeInfo = this.fieldTypeResolver.resolveFieldType(field);

    if (typeInfo.isContentReference) {
      // For base schemas, always use AgilityContentReference
      return typeInfo.isArray
        ? 'z.union([z.array(AgilityContentReferenceSchema)])'
        : 'z.union([AgilityContentReferenceSchema])';
    }

    return typeInfo.zodType;
  }

  private getDepthAwareZodType(field: mgmtApi.ModelField): string {
    const typeInfo = this.fieldTypeResolver.resolveFieldType(field);

    if (typeInfo.isContentReference && typeInfo.referencedModel) {
      const schemaName =
        StringUtils.pascalCase(typeInfo.referencedModel) + 'ContentSchemaFactory(depthType)';

      if (typeInfo.isArray) {
        return `createContentArrayFieldSchema(${schemaName})`;
      } else {
        return `createContentFieldSchema(${schemaName})`;
      }
    }

    return typeInfo.zodType;
  }
}
