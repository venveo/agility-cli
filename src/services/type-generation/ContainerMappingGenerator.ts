import * as mgmtApi from '@agility/management-sdk';
import { TypeGenerationContext, GeneratedFile } from './types';
import { StringUtils } from './utils';

/**
 * Service responsible for generating container-to-content-type mapping
 */
export class ContainerMappingGenerator {
  /**
   * Generate container type mapping
   */
  generate(context: TypeGenerationContext): GeneratedFile[] {
    const files: GeneratedFile[] = [];

    const containerMapping = this.generateContainerTypeMapping(context.models, context.containers);
    files.push({
      path: 'container-mapping.ts',
      content: containerMapping,
      type: 'mapping',
    });

    return files;
  }

  /**
   * Generate container-to-content-type mapping with depth-aware types
   */
  private generateContainerTypeMapping(
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
          const typeName = StringUtils.pascalCase(modelReference) + 'Content';
          referencedTypes.add(typeName);
        }
      }
    }

    // Generate imports for referenced content types
    if (referencedTypes.size > 0) {
      output += this.generateImports(referencedTypes);
    }

    // Generate depth-aware utility types
    output += this.generateDepthAwareUtilityTypes();

    // Generate base container mapping
    output += this.generateBaseContainerMapping(containers, modelIdToReference);

    // Generate depth-aware container mapping
    output += this.generateDepthAwareContainerMapping(containers, modelIdToReference);

    // Generate helper types and functions
    output += this.generateHelperTypes();
    output += this.generateDepthAwareLookupFunctions();

    return output;
  }

  private generateImports(referencedTypes: Set<string>): string {
    const sortedTypes = Array.from(referencedTypes).sort();
    let output = `// Import generated content types\n`;
    output += `import type {\n`;
    output += `  AgilityContentReference,\n`;
    for (const typeName of sortedTypes) {
      output += `  ${typeName},\n`;
    }
    output += `} from './content-schemas';\n\n`;
    return output;
  }

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

  private generateBaseContainerMapping(
    containers: mgmtApi.Container[],
    modelIdToReference: Map<number, string>
  ): string {
    let output = 'export const ContainerTypeMapping = {\n';

    for (const container of containers) {
      if (!container.referenceName || !container.contentDefinitionID) continue;

      const modelReference = modelIdToReference.get(container.contentDefinitionID);
      if (modelReference) {
        const typeName = StringUtils.pascalCase(modelReference) + 'Content';
        // Ensure lowercase key for API compatibility
        const lowercaseKey = container.referenceName.toLowerCase();
        output += `  "${lowercaseKey}": "${typeName}",\n`;
      }
    }

    output += '} as const;\n\n';
    return output;
  }

  private generateDepthAwareContainerMapping(
    containers: mgmtApi.Container[],
    modelIdToReference: Map<number, string>
  ): string {
    let output = '// Depth-aware container type mapping\n';
    output += 'export interface DepthAwareContainerMapping {\n';

    for (const container of containers) {
      if (!container.referenceName || !container.contentDefinitionID) continue;

      const modelReference = modelIdToReference.get(container.contentDefinitionID);
      if (modelReference) {
        const typeName = StringUtils.pascalCase(modelReference) + 'Content';
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
    return output;
  }

  private generateHelperTypes(): string {
    let output = 'export type KnownContainerNames = keyof DepthAwareContainerMapping;\n\n';

    output += 'export type ContainerContentType<T extends keyof typeof ContainerTypeMapping> = {\n';
    output += '  [K in T]: typeof ContainerTypeMapping[K] extends infer U\n';
    output += '    ? U extends string\n';
    output += '      ? U\n';
    output += '      : never\n';
    output += '    : never\n';
    output += '}[T];\n\n';

    return output;
  }

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
