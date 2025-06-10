import * as mgmtApi from '@agility/management-sdk';
import { TypeGenerationContext, GeneratedFile } from './types';
import { StringUtils, FieldTypeResolver, CodeGenerationUtils } from './utils';

/**
 * Service responsible for generating TypeScript interface definitions
 */
export class TypeScriptInterfaceGenerator {
  private fieldTypeResolver: FieldTypeResolver;

  constructor() {
    this.fieldTypeResolver = new FieldTypeResolver(new Map());
  }

  /**
   * Generate TypeScript interfaces for all models
   */
  generate(context: TypeGenerationContext): GeneratedFile[] {
    this.fieldTypeResolver = new FieldTypeResolver(context.modelsByReferenceName);

    const files: GeneratedFile[] = [];

    // Generate main content types file
    const contentTypes = this.generateContentTypeInterfaces(context.models);
    files.push({
      path: 'content-types.ts',
      content: contentTypes,
      type: 'typescript',
    });

    return files;
  }

  /**
   * Generate TypeScript interfaces for content items based on models
   */
  private generateContentTypeInterfaces(models: mgmtApi.Model[]): string {
    let output = CodeGenerationUtils.generateTypeHeader();

    // Add common type definitions
    output += this.generateCommonTypes();

    // Add depth-aware utility types
    output += this.generateDepthUtilityTypes();

    // Generate base content interfaces (without depth parameter)
    output += this.generateBaseInterfaces(models);

    // Generate depth-aware content interfaces
    output += this.generateDepthAwareInterfaces(models);

    return output;
  }

  private generateCommonTypes(): string {
    let output = '// Common Agility CMS types\n';

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

    return output;
  }

  private generateDepthUtilityTypes(): string {
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

  private generateBaseInterfaces(models: mgmtApi.Model[]): string {
    let output = '// Base content interfaces (without depth parameter)\n';

    for (const model of models) {
      if (!model.referenceName || !model.fields) continue;

      const interfaceName = StringUtils.pascalCase(model.referenceName);
      output += `// Model: ${model.displayName || model.referenceName} (Base interface)\n`;
      output += `export interface ${interfaceName}ContentBase {\n`;

      for (const field of model.fields) {
        if (!field.name || !field.isDataField) continue;

        const fieldName = StringUtils.camelize(field.name);
        const fieldType = this.getBaseTypeScriptType(field);

        output += CodeGenerationUtils.generateFieldComment(field);
        output += `  ${fieldName}: ${fieldType};\n`;
      }

      output += '}\n\n';
    }

    return output;
  }

  private generateDepthAwareInterfaces(models: mgmtApi.Model[]): string {
    let output = '// Depth-aware content interfaces\n';

    for (const model of models) {
      if (!model.referenceName || !model.fields) continue;

      const interfaceName = StringUtils.pascalCase(model.referenceName);
      output += `// Model: ${model.displayName || model.referenceName} (Depth-aware interface)\n`;
      output += `export interface ${interfaceName}Content<D extends ContentLinkDepth = 1> {\n`;

      for (const field of model.fields) {
        if (!field.name || !field.isDataField) continue;

        const fieldName = StringUtils.camelize(field.name);
        const fieldType = this.getDepthAwareTypeScriptType(field);

        output += CodeGenerationUtils.generateFieldComment(field);
        output += `  ${fieldName}: ${fieldType};\n`;
      }

      output += '}\n\n';
    }

    return output;
  }

  private getBaseTypeScriptType(field: mgmtApi.ModelField): string {
    const typeInfo = this.fieldTypeResolver.resolveFieldType(field);

    if (typeInfo.isContentReference) {
      // For base types, always use AgilityContentReference
      return typeInfo.isArray ? 'AgilityContentReference[]' : 'AgilityContentReference';
    }

    return typeInfo.baseType;
  }

  private getDepthAwareTypeScriptType(field: mgmtApi.ModelField): string {
    const typeInfo = this.fieldTypeResolver.resolveFieldType(field);

    if (typeInfo.isContentReference && typeInfo.referencedModel) {
      const typeName = StringUtils.pascalCase(typeInfo.referencedModel) + 'Content<D>';

      if (typeInfo.isArray) {
        return `ContentArrayFieldAtDepth<${typeName}, D>`;
      } else {
        return `ContentFieldAtDepth<${typeName}, D>`;
      }
    }

    return typeInfo.baseType;
  }
}
