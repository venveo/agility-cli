import * as mgmtApi from '@agility/management-sdk';
import { TypeGenerationContext, GeneratedFile } from './types';
import { StringUtils, FieldTypeResolver, CodeGenerationUtils } from './utils';

/**
 * Service responsible for generating content module type definitions and schemas
 */
export class ContentModuleGenerator {
  private fieldTypeResolver: FieldTypeResolver;

  constructor() {
    this.fieldTypeResolver = new FieldTypeResolver(new Map());
  }

  /**
   * Generate content module types and schemas
   */
  generate(context: TypeGenerationContext): GeneratedFile[] {
    if (context.contentModules.length === 0) {
      return [];
    }

    this.fieldTypeResolver = new FieldTypeResolver(context.modelsByReferenceName);

    const files: GeneratedFile[] = [];

    // Generate TypeScript interfaces if requested
    if (context.config.format === 'typescript' || context.config.format === 'both') {
      const moduleTypes = this.generateContentModuleTypes(context.contentModules, context.models);
      files.push({
        path: 'content-modules.ts',
        content: moduleTypes,
        type: 'typescript',
      });
    }

    // Generate Zod schemas if requested
    if (context.config.format === 'zod' || context.config.format === 'both') {
      const moduleSchemas = this.generateContentModuleZodSchemas(
        context.contentModules,
        context.models
      );
      files.push({
        path: 'content-module-schemas.ts',
        content: moduleSchemas,
        type: 'zod',
      });
    }

    return files;
  }

  /**
   * Generate content module type interfaces and mapping
   */
  private generateContentModuleTypes(
    contentModules: mgmtApi.Model[],
    models: mgmtApi.Model[]
  ): string {
    let output = '// Generated content module type definitions for Agility CMS\n';
    output += '// Generated on: ' + new Date().toISOString() + '\n\n';

    // Create lookup map for models by ID
    const modelById = this.createModelByIdMap(models);

    // Collect all referenced content types
    const referencedContentTypes = this.collectReferencedContentTypes(contentModules, modelById);

    // Generate imports
    output += this.generateModuleTypeImports(referencedContentTypes);

    // Generate module interfaces
    output += this.generateModuleInterfaces(contentModules, modelById);

    // Generate content module mapping
    output += this.generateContentModuleMapping(contentModules);

    // Generate helper types and utilities
    output += this.generateModuleHelperTypes(contentModules);

    // Generate module list for easy consumption
    output += this.generateAvailableModulesList(contentModules, modelById);

    return output;
  }

  /**
   * Generate content module Zod schemas
   */
  private generateContentModuleZodSchemas(
    contentModules: mgmtApi.Model[],
    models: mgmtApi.Model[]
  ): string {
    let output = "import { z } from 'zod/v4';\n";

    // Create lookup map for models by ID
    const modelById = this.createModelByIdMap(models);

    // Collect all referenced schema factories
    const referencedSchemaFactories = this.collectReferencedSchemaFactories(
      contentModules,
      modelById
    );

    // Generate imports
    output += this.generateModuleSchemaImports(referencedSchemaFactories);

    output += '// Generated Zod schemas for content modules\n';
    output += '// Generated on: ' + new Date().toISOString() + '\n\n';

    // Generate module schemas
    output += this.generateModuleSchemas(contentModules, modelById);

    return output;
  }

  private createModelByIdMap(models: mgmtApi.Model[]): Map<number, mgmtApi.Model> {
    const map = new Map<number, mgmtApi.Model>();
    for (const model of models) {
      if (model.id) {
        map.set(model.id, model);
      }
    }
    return map;
  }

  private collectReferencedContentTypes(
    contentModules: mgmtApi.Model[],
    modelById: Map<number, mgmtApi.Model>
  ): Set<string> {
    const referencedTypes = new Set<string>();

    for (const module of contentModules) {
      if (!module.referenceName) continue;
      const correspondingModel = modelById.get(module.id || 0);
      if (correspondingModel && correspondingModel.fields) {
        for (const field of correspondingModel.fields) {
          if (field.type === 'Content' && field.settings && field.settings.ContentDefinition) {
            const typeName = StringUtils.pascalCase(field.settings.ContentDefinition) + 'Content';
            referencedTypes.add(typeName);
          }
        }
      }
    }

    return referencedTypes;
  }

  private collectReferencedSchemaFactories(
    contentModules: mgmtApi.Model[],
    modelById: Map<number, mgmtApi.Model>
  ): Set<string> {
    const referencedFactories = new Set<string>();

    for (const module of contentModules) {
      if (!module.referenceName) continue;
      const correspondingModel = modelById.get(module.id || 0);
      if (correspondingModel && correspondingModel.fields) {
        for (const field of correspondingModel.fields) {
          if (field.type === 'Content' && field.settings && field.settings.ContentDefinition) {
            const factoryName =
              StringUtils.pascalCase(field.settings.ContentDefinition) + 'ContentSchemaFactory';
            referencedFactories.add(factoryName);
          }
        }
      }
    }

    return referencedFactories;
  }

  private generateModuleTypeImports(referencedContentTypes: Set<string>): string {
    let output = 'import type {\n';
    output += '  AgilityContentItem,\n';
    output += '  AgilityImage,\n';
    output += '  AgilityFile,\n';
    output += '  AgilityLink,\n';
    output += '  AgilityGallery,\n';
    output += '  AgilityContentReference,\n';
    output += '  ContentLinkDepth,\n';
    output += '  ContentFieldAtDepth,\n';
    output += '  ContentArrayFieldAtDepth';

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
    return output;
  }

  private generateModuleSchemaImports(referencedSchemaFactories: Set<string>): string {
    let output = 'import {\n';
    output += '  AgilityImageSchema,\n';
    output += '  AgilityFileSchema,\n';
    output += '  AgilityLinkSchema,\n';
    output += '  AgilityGallerySchema,\n';
    output += '  AgilityContentReferenceSchema,\n';
    output += '  createContentFieldSchema,\n';
    output += '  createContentArrayFieldSchema,\n';
    output += '  ContentLinkDepth';

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
    return output;
  }

  private generateModuleInterfaces(
    contentModules: mgmtApi.Model[],
    modelById: Map<number, mgmtApi.Model>
  ): string {
    let output = '// Content Module Types\n';

    for (const module of contentModules) {
      if (!module.referenceName) continue;

      const moduleTypeName = StringUtils.pascalCase(module.referenceName);
      const correspondingModel = modelById.get(module.id || 0);

      output += `/** ${module.displayName || module.referenceName} */\n`;

      if (correspondingModel && correspondingModel.fields && correspondingModel.fields.length > 0) {
        // Module has fields - generate props interface
        output += `export interface ${moduleTypeName}Props {\n`;

        for (const field of correspondingModel.fields) {
          if (!field.name || !field.isDataField) continue;

          const fieldName = StringUtils.camelize(field.name);
          const fieldType = this.getBaseTypeScriptType(field);

          output += CodeGenerationUtils.generateFieldComment(field);
          output += `  ${fieldName}: ${fieldType};\n`;
        }

        output += '}\n\n';

        // Generate depth-aware version
        output += `export interface ${moduleTypeName}PropsDepthAware<D extends ContentLinkDepth = 1> {\n`;

        for (const field of correspondingModel.fields) {
          if (!field.name || !field.isDataField) continue;

          const fieldName = StringUtils.camelize(field.name);
          const fieldType = this.getDepthAwareTypeScriptType(field);

          output += CodeGenerationUtils.generateFieldComment(field);
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

    return output;
  }

  private generateModuleSchemas(
    contentModules: mgmtApi.Model[],
    modelById: Map<number, mgmtApi.Model>
  ): string {
    let output = '';

    for (const module of contentModules) {
      if (!module.referenceName) continue;

      const moduleTypeName = StringUtils.pascalCase(module.referenceName);
      const correspondingModel = modelById.get(module.id || 0);

      output += `// Schema for ${module.displayName || module.referenceName}\n`;

      if (correspondingModel && correspondingModel.fields && correspondingModel.fields.length > 0) {
        // Module has fields - generate props schema
        output += `export const ${moduleTypeName}PropsSchema = z.object({\n`;

        for (const field of correspondingModel.fields) {
          if (!field.name || !field.isDataField) continue;

          const fieldName = StringUtils.camelize(field.name);
          const zodType = this.getBaseZodType(field);

          output += CodeGenerationUtils.generateFieldComment(field);
          output += `  ${fieldName}: ${zodType},\n`;
        }

        output += '});\n\n';

        // Generate depth-aware schema factory
        output += `export const ${moduleTypeName}PropsSchemaFactory = <D extends z.ZodTypeAny>(depthType: D) => z.object({\n`;

        for (const field of correspondingModel.fields) {
          if (!field.name || !field.isDataField) continue;

          const fieldName = StringUtils.camelize(field.name);
          const zodType = this.getDepthAwareZodType(field);

          output += CodeGenerationUtils.generateFieldComment(field);
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

  private generateContentModuleMapping(contentModules: mgmtApi.Model[]): string {
    let output = '// Content Module Mapping\n';
    output += 'export const ContentModuleMapping = {\n';

    for (const module of contentModules) {
      if (!module.referenceName) continue;

      const moduleTypeName = StringUtils.pascalCase(module.referenceName);
      output += `  "${module.referenceName}": "${moduleTypeName}Props",\n`;
    }

    output += '} as const;\n\n';

    return output;
  }

  private generateModuleHelperTypes(contentModules: mgmtApi.Model[]): string {
    let output = 'export type ContentModuleName = keyof typeof ContentModuleMapping;\n\n';

    // Generate a union type of all props interfaces
    output += 'export type AllContentModuleProps = ';
    const moduleTypeNames: string[] = [];
    for (const module of contentModules) {
      if (module.referenceName) {
        const typeName = StringUtils.pascalCase(module.referenceName) + 'Props';
        moduleTypeNames.push(typeName);
      }
    }
    output += moduleTypeNames.join(' | ') + ';\n\n';

    // Helper function for getting props type by module name
    output += '/**\n';
    output += ' * Helper function to get the props type for a specific content module\n';
    output += ' * Usage: Use the ContentModuleMapping to determine the correct props type\n';
    output += ' */\n';
    output += 'export type GetContentModuleProps<T extends ContentModuleName> = \n';

    // Generate the conditional type mapping
    const validModules = contentModules.filter(m => m.referenceName);
    for (let i = 0; i < validModules.length; i++) {
      const module = validModules[i];
      const moduleTypeName = StringUtils.pascalCase(module.referenceName!) + 'Props';

      output += `  T extends "${module.referenceName}" ? ${moduleTypeName} :`;

      if (i === validModules.length - 1) {
        output += '\n  never;\n\n';
      } else {
        output += '\n';
      }
    }

    // Helper function for getting depth-aware props type by module name
    output += '/**\n';
    output += ' * Helper function to get the depth-aware props type for a specific content module\n';
    output += ' * Usage: When using contentLinkDepth > 1, this provides properly typed expanded content links\n';
    output += ' */\n';
    output += 'export type GetContentModulePropsDepthAware<T extends ContentModuleName, D extends ContentLinkDepth = 1> = \n';

    // Generate the conditional type mapping for depth-aware types
    for (let i = 0; i < validModules.length; i++) {
      const module = validModules[i];
      const moduleTypeName = StringUtils.pascalCase(module.referenceName!) + 'PropsDepthAware<D>';

      output += `  T extends "${module.referenceName}" ? ${moduleTypeName} :`;

      if (i === validModules.length - 1) {
        output += '\n  never;\n\n';
      } else {
        output += '\n';
      }
    }

    return output;
  }

  private generateAvailableModulesList(
    contentModules: mgmtApi.Model[],
    modelById: Map<number, mgmtApi.Model>
  ): string {
    let output = '// Available Content Modules\n';
    output += 'export const AvailableContentModules = [\n';

    for (const module of contentModules) {
      if (module.referenceName) {
        output += `  {\n`;
        output += `    referenceName: "${module.referenceName}",\n`;
        output += `    displayName: "${StringUtils.escapeDescription(module.displayName || module.referenceName)}",\n`;
        output += `    description: "${StringUtils.escapeDescription(module.description || '')}",\n`;
        output += `    hasFields: ${modelById.get(module.id || 0)?.fields?.length ? 'true' : 'false'},\n`;
        output += `  },\n`;
      }
    }

    output += '] as const;\n\n';

    return output;
  }

  private getBaseTypeScriptType(field: mgmtApi.ModelField): string {
    const typeInfo = this.fieldTypeResolver.resolveFieldType(field);

    if (typeInfo.isContentReference) {
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

  private getBaseZodType(field: mgmtApi.ModelField): string {
    const typeInfo = this.fieldTypeResolver.resolveFieldType(field);

    if (typeInfo.isContentReference) {
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
