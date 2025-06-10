import * as mgmtApi from '@agility/management-sdk';
import * as path from 'path';
import {
  GenerationConfig,
  TypeGenerationContext,
  GenerationResult,
  ValidationResult,
  GeneratedFile,
} from './types';
import { ModelLoader } from './ModelLoader';
import { ValidationService } from './ValidationService';
import { TypeScriptInterfaceGenerator } from './TypeScriptInterfaceGenerator';
import { ZodSchemaGenerator } from './ZodSchemaGenerator';
import { ContentModuleGenerator } from './ContentModuleGenerator';
import { ContainerMappingGenerator } from './ContainerMappingGenerator';
import { fileOperations } from '../../fileOperations';

/**
 * Main orchestrator service for type generation
 * Coordinates all the individual generators and handles the overall process
 */
export class TypeGenerationService {
  private modelLoader: ModelLoader;
  private validationService: ValidationService;
  private typeScriptGenerator: TypeScriptInterfaceGenerator;
  private zodGenerator: ZodSchemaGenerator;
  private contentModuleGenerator: ContentModuleGenerator;
  private containerMappingGenerator: ContainerMappingGenerator;
  private fileOps: fileOperations;

  constructor(fileOps?: fileOperations) {
    this.fileOps = fileOps || new fileOperations();

    this.modelLoader = new ModelLoader(this.fileOps);
    this.validationService = new ValidationService();
    this.typeScriptGenerator = new TypeScriptInterfaceGenerator();
    this.zodGenerator = new ZodSchemaGenerator();
    this.contentModuleGenerator = new ContentModuleGenerator();
    this.containerMappingGenerator = new ContainerMappingGenerator();
  }

  /**
   * Generate types based on the provided configuration
   */
  async generateTypes(config: GenerationConfig): Promise<GenerationResult> {
    try {
      // Load all required data
      const loadResult = await this.modelLoader.loadAll(config.sourceFolder);

      // Check if we have any models to work with
      if (loadResult.models.items.length === 0) {
        return this.createEmptyResult(loadResult, config);
      }

      // Create lookup maps for efficient processing
      const context = this.createGenerationContext(loadResult, config);

      // Validate data integrity
      const validationResult = this.performValidation(context);

      // Generate all requested file types
      const generatedFiles = await this.generateAllFiles(context);

      // Write files to disk
      const writtenFiles = await this.writeFilesToDisk(generatedFiles, config.outputDir);

      // Generate summary report
      const summaryFile = this.generateSummaryReport(context, validationResult, generatedFiles);
      await this.writeFileToDisk(summaryFile, config.outputDir);
      writtenFiles.push(summaryFile.path);

      // Create result
      return {
        success: true,
        filesGenerated: writtenFiles,
        errors: [
          ...loadResult.models.errors,
          ...loadResult.containers.errors,
          ...loadResult.contentModules.errors,
        ],
        warnings: [
          ...loadResult.models.warnings,
          ...loadResult.containers.warnings,
          ...loadResult.contentModules.warnings,
          ...validationResult.warnings,
        ],
        summary: {
          modelsCount: loadResult.models.items.length,
          containersCount: loadResult.containers.items.length,
          contentModulesCount: loadResult.contentModules.items.length,
          validationResult,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        filesGenerated: [],
        errors: [`Type generation failed: ${error.message}`],
        warnings: [],
        summary: {
          modelsCount: 0,
          containersCount: 0,
          contentModulesCount: 0,
          validationResult: { valid: false, errors: [error.message], warnings: [] },
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  private createEmptyResult(loadResult: any, _config: GenerationConfig): GenerationResult {
    return {
      success: false,
      filesGenerated: [],
      errors: ['No models found in the specified folder'],
      warnings: [
        ...loadResult.models.warnings,
        ...loadResult.containers.warnings,
        ...loadResult.contentModules.warnings,
      ],
      summary: {
        modelsCount: 0,
        containersCount: loadResult.containers.items.length,
        contentModulesCount: loadResult.contentModules.items.length,
        validationResult: { valid: false, errors: ['No models found'], warnings: [] },
        timestamp: new Date().toISOString(),
      },
    };
  }

  private createGenerationContext(
    loadResult: any,
    config: GenerationConfig
  ): TypeGenerationContext {
    // Create lookup maps for efficient processing
    const modelsByReferenceName = new Map<string, mgmtApi.Model>();
    const containersByReferenceName = new Map<string, mgmtApi.Container>();

    for (const model of loadResult.models.items) {
      if (model.referenceName) {
        modelsByReferenceName.set(model.referenceName, model);
      }
    }

    for (const container of loadResult.containers.items) {
      if (container.referenceName) {
        containersByReferenceName.set(container.referenceName, container);
      }
    }

    return {
      models: loadResult.models.items,
      containers: loadResult.containers.items,
      contentModules: loadResult.contentModules.items,
      config,
      modelsByReferenceName,
      containersByReferenceName,
    };
  }

  private performValidation(context: TypeGenerationContext): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate model-container relationships
    const relationshipValidation = this.validationService.validateModelContainerRelationships(
      context.models,
      context.containers
    );
    errors.push(...relationshipValidation.errors);
    warnings.push(...relationshipValidation.warnings);

    // Validate content references
    const referenceValidation = this.validationService.validateContentReferences(
      context.models,
      context.modelsByReferenceName
    );
    errors.push(...referenceValidation.errors);
    warnings.push(...referenceValidation.warnings);

    // Validate generation requirements
    const requirementValidation = this.validationService.validateGenerationRequirements(
      context.models,
      context.containers,
      context.contentModules
    );
    errors.push(...requirementValidation.errors);
    warnings.push(...requirementValidation.warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private async generateAllFiles(context: TypeGenerationContext): Promise<GeneratedFile[]> {
    const allFiles: GeneratedFile[] = [];

    // Generate TypeScript interfaces
    if (context.config.format === 'typescript' || context.config.format === 'both') {
      const tsFiles = this.typeScriptGenerator.generate(context);
      allFiles.push(...tsFiles);
    }

    // Generate Zod schemas
    if (context.config.format === 'zod' || context.config.format === 'both') {
      const zodFiles = this.zodGenerator.generate(context);
      allFiles.push(...zodFiles);
    }

    // Generate content module types and schemas
    if (context.config.includeContentModules && context.contentModules.length > 0) {
      const moduleFiles = this.contentModuleGenerator.generate(context);
      allFiles.push(...moduleFiles);
    }

    // Generate container mapping (always generated)
    const mappingFiles = this.containerMappingGenerator.generate(context);
    allFiles.push(...mappingFiles);


    return allFiles;
  }

  private async writeFilesToDisk(files: GeneratedFile[], outputDir: string): Promise<string[]> {
    // Ensure output directory exists
    this.fileOps.createBaseFolder(outputDir);

    const writtenFiles: string[] = [];

    for (const file of files) {
      const fullPath = await this.writeFileToDisk(file, outputDir);
      writtenFiles.push(fullPath);
    }

    return writtenFiles;
  }

  private async writeFileToDisk(file: GeneratedFile, outputDir: string): Promise<string> {
    const fullPath = path.join(outputDir, file.path);
    this.fileOps.createFile(fullPath, file.content);
    return fullPath;
  }

  private generateSummaryReport(
    context: TypeGenerationContext,
    validationResult: ValidationResult,
    generatedFiles: GeneratedFile[]
  ): GeneratedFile {
    const report = `# Agility CMS Type Generation Report

Generated on: ${new Date().toISOString()}

## Summary

- **Models**: ${context.models.length}
- **Containers**: ${context.containers.length}
- **Content Modules**: ${context.contentModules.length}
- **Validation Status**: ${validationResult.valid ? '✅ Valid' : '❌ Errors Found'}
- **Warnings**: ${validationResult.warnings?.length || 0} (system fields)
- **Errors**: ${validationResult.errors?.length || 0}
- **Files Generated**: ${generatedFiles.length}

## Models

${context.models
  .map(
    model => `### ${model.displayName || model.referenceName}

- **Reference Name**: \`${model.referenceName}\`
- **Fields**: ${model.fields?.length || 0}
- **Published**: ${model.isPublished ? 'Yes' : 'No'}
- **Description**: ${model.description || 'No description'}

**Fields:**
${model.fields?.map(field => `- \`${field.name}\` (${field.type}) - ${field.label || 'No label'}`).join('\n') || 'No fields'}
`
  )
  .join('\n')}

## Containers

${context.containers
  .map(
    container => `### ${container.title || container.referenceName}

- **Reference Name**: \`${container.referenceName}\`
- **Model ID**: ${container.contentDefinitionID}
- **Published**: ${container.isPublished ? 'Yes' : 'No'}
- **Columns**: ${container.columns?.length || 0}
`
  )
  .join('\n')}

## Content Modules

${context.contentModules
  .map(
    module => `### ${module.displayName || module.referenceName}

- **Reference Name**: \`${module.referenceName}\`
- **Description**: ${module.description || 'No description'}
- **Last Modified**: ${module.lastModifiedDate || 'Unknown'}
- **Module Type**: Page Component

**Purpose:** This module can be used as a component on pages within the Agility CMS.
`
  )
  .join('\n')}

## Validation Results

${
  validationResult.valid
    ? '✅ All model-container relationships are valid.'
    : `❌ Validation errors found:\n\n${validationResult.errors.map(error => `- ${error}`).join('\n')}`
}

${
  validationResult.warnings?.length > 0
    ? `⚠️ Warnings (System Fields):\n\n${validationResult.warnings.map(warning => `- ${warning}`).join('\n')}\n\n*Note: These warnings indicate container columns that reference Agility CMS system fields (like state, createdDate, userName) which are automatically available on all content items.*`
    : ''
}

## Generated Files

${generatedFiles.map(file => `- \`${file.path}\` - ${this.getFileDescription(file)}`).join('\n')}

## Usage Examples

### TypeScript Interfaces

\`\`\`typescript
import { BlogPostContent } from './content-types';

const post: BlogPostContent = {
  title: "My Blog Post",
  body: "Content here...",
  // ... other fields
};
\`\`\`

### Zod Schemas

\`\`\`typescript
import { BlogPostContentSchema } from './content-schemas';

// Runtime validation
const validatedPost = BlogPostContentSchema.parse(incomingData);

// Type-safe parsing
const result = BlogPostContentSchema.safeParse(incomingData);
if (result.success) {
  // result.data is typed as BlogPostContent
  console.log(result.data.title);
}
\`\`\`

### Container Type Mapping

\`\`\`typescript
import { ContainerTypeMapping, getContainerContentTypeAtDepth } from './container-mapping';

// Get the content type for a specific container
const contentType = getContainerContentTypeAtDepth('blogposts', 1);

// Use in API queries with type safety
async function getContainerData<T extends keyof typeof ContainerTypeMapping>(
  containerRef: T
): Promise<Array<{ contentID: number; fields: any }>> {
  // Your API call here - the return type is automatically inferred
  const response = await fetch(\`/api/containers/\${containerRef}\`);
  return response.json();
}

// Usage
const blogPosts = await getContainerData('blogposts'); // Type-safe
\`\`\`

`;

    return {
      path: 'generation-report.md',
      content: report,
      type: 'report',
    };
  }

  private getFileDescription(file: GeneratedFile): string {
    switch (file.type) {
      case 'typescript':
        return 'TypeScript interface definitions';
      case 'zod':
        return 'Zod schema definitions';
      case 'mapping':
        return 'Container-to-content-type mapping';
      case 'component':
        return 'NextJS component prop interfaces and utilities';
      case 'report':
        return 'Generation report';
      default:
        return 'Generated file';
    }
  }
}
