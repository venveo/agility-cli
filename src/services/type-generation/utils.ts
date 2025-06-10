import * as mgmtApi from '@agility/management-sdk';
import { FieldTypeInfo, COMMON_TYPES, COMMON_ZOD_TYPES } from './types';

/**
 * Utility functions for type generation
 */

export class StringUtils {
  static camelize(str: string): string {
    return str
      .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
        return index === 0 ? word.toLowerCase() : word.toUpperCase();
      })
      .replace(/\s+/g, '');
  }

  static pascalCase(str: string): string {
    return str.replace(/(?:^\w|[A-Z]|\b\w)/g, word => word.toUpperCase()).replace(/\s+/g, '');
  }

  /**
   * Escape quotes and other special characters in descriptions for use in JSDoc comments
   */
  static escapeDescription(description: string): string {
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
}

export class FieldTypeResolver {
  constructor(private modelsByReferenceName: Map<string, mgmtApi.Model>) {}

  /**
   * Resolve field type information including content references
   */
  resolveFieldType(field: mgmtApi.ModelField): FieldTypeInfo {
    const baseTypeInfo = this.getBaseFieldType(field);

    if (field.type === 'Content') {
      return this.resolveContentFieldType(field);
    }

    return baseTypeInfo;
  }

  private getBaseFieldType(field: mgmtApi.ModelField): FieldTypeInfo {
    switch (field.type) {
      case 'Text':
      case 'MultiLineText':
      case 'HTML':
      case 'URL':
        return {
          baseType: 'string',
          zodType: 'z.string()',
          isArray: false,
          isContentReference: false,
        };
      case 'Dropdown':
        return {
          baseType: 'string',
          zodType: 'z.string()',
          isArray: false,
          isContentReference: false,
        };
      case 'Link':
        return {
          baseType: COMMON_TYPES.Link,
          zodType: COMMON_ZOD_TYPES.Link,
          isArray: false,
          isContentReference: false,
        };
      case 'Number':
      case 'Decimal':
        return {
          baseType: 'number',
          zodType: 'z.number()',
          isArray: false,
          isContentReference: false,
        };
      case 'DateTime':
        return {
          baseType: 'string',
          zodType: 'z.string()',
          isArray: false,
          isContentReference: false,
        };
      case 'Boolean':
        return {
          baseType: 'boolean',
          zodType: 'z.boolean()',
          isArray: false,
          isContentReference: false,
        };
      case 'ImageAttachment':
        return {
          baseType: COMMON_TYPES.Image,
          zodType: COMMON_ZOD_TYPES.Image,
          isArray: false,
          isContentReference: false,
        };
      case 'FileAttachment':
        return {
          baseType: COMMON_TYPES.File,
          zodType: COMMON_ZOD_TYPES.File,
          isArray: false,
          isContentReference: false,
        };
      case 'AttachmentList':
        return {
          baseType: `${COMMON_TYPES.File}[]`,
          zodType: `z.array(${COMMON_ZOD_TYPES.File})`,
          isArray: true,
          isContentReference: false,
        };
      case 'PhotoGallery':
        return {
          baseType: COMMON_TYPES.Gallery,
          zodType: COMMON_ZOD_TYPES.Gallery,
          isArray: false,
          isContentReference: false,
        };
      case 'Hidden':
      case 'Custom':
      case 'CustomSection':
      default:
        return {
          baseType: 'any',
          zodType: 'z.any()',
          isArray: false,
          isContentReference: false,
        };
    }
  }

  private resolveContentFieldType(field: mgmtApi.ModelField): FieldTypeInfo {
    const settings = field.settings;
    if (settings && settings.ContentDefinition) {
      const referencedModel = this.modelsByReferenceName.get(settings.ContentDefinition);
      if (referencedModel) {
        const typeName = StringUtils.pascalCase(referencedModel.referenceName!) + 'Content';
        const isArray = this.isArrayContentField(field);

        return {
          baseType: isArray ? `${typeName}[]` : typeName,
          zodType: isArray ? `z.array(${typeName}Schema)` : `${typeName}Schema`,
          isArray,
          isContentReference: true,
          referencedModel: referencedModel.referenceName!,
        };
      }
    }

    // Fallback for unknown content types
    const isArray = this.isArrayContentField(field);
    return {
      baseType: isArray ? `${COMMON_TYPES.ContentReference}[]` : COMMON_TYPES.ContentReference,
      zodType: isArray
        ? `z.array(${COMMON_ZOD_TYPES.ContentReference})`
        : COMMON_ZOD_TYPES.ContentReference,
      isArray,
      isContentReference: true,
    };
  }

  private isArrayContentField(field: mgmtApi.ModelField): boolean {
    const settings = field.settings;
    if (!settings) return false;

    // Check various indicators that suggest this is an array field
    return (
      settings.LinkedContentType === 'list' ||
      !!settings.Sort ||
      !!settings.SortIDFieldName ||
      settings.RenderAs === 'grid' ||
      settings.RenderAs === 'searchlistbox' ||
      settings.LinkedContentNestedTypeID === '1' ||
      settings.SharedContent === 'true' ||
      field.name?.toLowerCase().includes('list') ||
      field.name?.toLowerCase().includes('items') ||
      field.name?.toLowerCase().includes('products')
    );
  }
}

export class CodeGenerationUtils {
  /**
   * Generate common type definitions header
   */
  static generateTypeHeader(includeImports = true): string {
    let output = '// Generated TypeScript interfaces for Agility CMS content\n';
    output += '// Generated on: ' + new Date().toISOString() + '\n\n';

    if (includeImports) {
      output += '// Common Agility CMS types\n';
    }

    return output;
  }

  /**
   * Generate common schema definitions header
   */
  static generateSchemaHeader(): string {
    let output = "import { z } from 'zod/v4';\n\n";
    output += '// Generated Zod schemas for Agility CMS content\n';
    output += '// Generated on: ' + new Date().toISOString() + '\n\n';
    return output;
  }

  /**
   * Generate JSDoc comment for a field
   */
  static generateFieldComment(field: mgmtApi.ModelField): string {
    const description = field.description || field.label || '';
    if (description) {
      return `  /** ${StringUtils.escapeDescription(description)} */\n`;
    }
    return '';
  }
}
