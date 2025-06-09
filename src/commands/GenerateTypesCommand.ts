import { BaseCommand } from '../base/BaseCommand';
import { ZodSchemaGenerator } from '../services/ZodSchemaGenerator';
import * as path from 'path';
import colors from 'ansi-colors';

interface GenerateTypesArgv {
  folder?: string;
  output?: string;
  format?: 'zod' | 'typescript' | 'both';
}

export class GenerateTypesCommand extends BaseCommand {
  async execute(argv: GenerateTypesArgv): Promise<void> {
    const sourceFolder = argv.folder || '.agility-files';
    const outputDir = argv.output || './generated-types';
    const format = argv.format || 'both'; // 'zod', 'typescript', or 'both'

    console.log(colors.cyan('🔧 Generating type definitions...'));
    console.log(colors.gray(`📁 Source folder: ${sourceFolder}`));
    console.log(colors.gray(`📂 Output directory: ${outputDir}`));

    try {
      const generator = new ZodSchemaGenerator();

      // Load models, containers, and content modules
      console.log(colors.yellow('📋 Loading models...'));
      const models = generator.loadModels(sourceFolder);
      console.log(colors.gray(`Found ${models.length} models`));

      console.log(colors.yellow('📦 Loading containers...'));
      const containers = generator.loadContainers(sourceFolder);
      console.log(colors.gray(`Found ${containers.length} containers`));

      console.log(colors.yellow('🧩 Loading content modules...'));
      const contentModules = generator.loadContentModules(sourceFolder);
      console.log(colors.gray(`Found ${contentModules.length} content modules`));

      if (models.length === 0) {
        console.log(colors.red('❌ No models found in the specified folder.'));
        console.log(colors.yellow('💡 To get started:'));
        console.log(colors.gray('  1. Run `agility login` to authenticate'));
        console.log(
          colors.gray(
            '  2. Run `agility pull --locale en-us --channel website` to download your instance data'
          )
        );
        console.log(colors.gray('  3. Then run `agility generate-types` again'));

        const inquirer = require('inquirer');
        const helpAnswer = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'showPullHelp',
            message: 'Would you like to see the pull command options?',
            default: true,
          },
        ]);

        if (helpAnswer.showPullHelp) {
          console.log(colors.cyan('\n📖 Pull Command Usage:'));
          console.log(
            colors.gray('  agility pull --locale <locale> --channel <channel> [--guid <guid>]')
          );
          console.log(colors.gray('\n📋 Common Examples:'));
          console.log(colors.gray('  agility pull --locale en-us --channel website'));
          console.log(
            colors.gray('  agility pull --locale en-us --channel website --guid your-instance-guid')
          );
          console.log(
            colors.gray("\n💡 If you've already logged in, the GUID will be used automatically.")
          );
        }

        return;
      }

      // Validate relationships
      console.log(colors.yellow('🔍 Validating model-container relationships...'));
      const validation = generator.validateModelContainerRelationships(models, containers);

      // Show warnings if any
      if (validation.warnings.length > 0) {
        console.log(
          colors.yellow(`⚠️  ${validation.warnings.length} warnings found (system fields):`)
        );
        if (validation.warnings.length <= 5) {
          validation.warnings.forEach(warning => {
            console.log(colors.yellow(`  • ${warning}`));
          });
        } else {
          validation.warnings.slice(0, 3).forEach(warning => {
            console.log(colors.yellow(`  • ${warning}`));
          });
          console.log(colors.gray(`  ... and ${validation.warnings.length - 3} more`));
        }
      }

      if (!validation.valid) {
        console.log(colors.red(`❌ ${validation.errors.length} validation errors found:`));
        validation.errors.forEach(error => {
          console.log(colors.red(`  • ${error}`));
        });

        const inquirer = require('inquirer');
        const continueAnswer = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'continue',
            message: 'Continue with type generation despite validation errors?',
            default: false,
          },
        ]);

        if (!continueAnswer.continue) {
          console.log(colors.yellow('🚫 Type generation cancelled.'));
          return;
        }
      } else if (validation.warnings.length === 0) {
        console.log(colors.green('✅ All relationships validated successfully!'));
      } else {
        console.log(colors.green('✅ Validation passed (with warnings for system fields)'));
      }

      // Create output directory
      this.context.fileOps.createBaseFolder(outputDir);

      // Generate TypeScript interfaces
      if (format === 'typescript' || format === 'both') {
        console.log(colors.yellow('📝 Generating TypeScript interfaces...'));
        const typeInterfaces = generator.generateContentTypeInterfaces(models);
        const typesPath = path.join(outputDir, 'content-types.ts');
        this.context.fileOps.createFile(typesPath, typeInterfaces);
        console.log(colors.green(`✅ TypeScript interfaces written to: ${typesPath}`));
      }

      // Generate Zod schemas
      if (format === 'zod' || format === 'both') {
        console.log(colors.yellow('🛡️  Generating Zod schemas...'));
        const zodSchemas = generator.generateContentZodSchemas(models);
        const schemasPath = path.join(outputDir, 'content-schemas.ts');
        this.context.fileOps.createFile(schemasPath, zodSchemas);
        console.log(colors.green(`✅ Zod schemas written to: ${schemasPath}`));
      }

      // Generate container-to-content-type mapping
      console.log(colors.yellow('🗺️  Generating container type mapping...'));
      const containerMapping = generator.generateContainerTypeMapping(models, containers);
      const mappingPath = path.join(outputDir, 'container-mapping.ts');
      this.context.fileOps.createFile(mappingPath, containerMapping);
      console.log(colors.green(`✅ Container mapping written to: ${mappingPath}`));

      // Generate content module types
      if (contentModules.length > 0) {
        if (format === 'typescript' || format === 'both') {
          console.log(colors.yellow('🧩 Generating content module TypeScript interfaces...'));
          const moduleTypes = generator.generateContentModuleTypes(contentModules, models);
          const moduleTypesPath = path.join(outputDir, 'content-modules.ts');
          this.context.fileOps.createFile(moduleTypesPath, moduleTypes);
          console.log(colors.green(`✅ Content module types written to: ${moduleTypesPath}`));
        }

        if (format === 'zod' || format === 'both') {
          console.log(colors.yellow('🛡️  Generating content module Zod schemas...'));
          const moduleSchemas = generator.generateContentModuleZodSchemas(contentModules, models);
          const moduleSchemasPath = path.join(outputDir, 'content-module-schemas.ts');
          this.context.fileOps.createFile(moduleSchemasPath, moduleSchemas);
          console.log(colors.green(`✅ Content module schemas written to: ${moduleSchemasPath}`));
        }
      } else {
        console.log(colors.gray('⏭️  Skipping content module generation (no modules found)'));
      }

      // Generate summary report
      console.log(colors.yellow('📊 Generating summary report...'));
      const summaryReport = this.generateSummaryReport(
        models,
        containers,
        contentModules,
        validation
      );
      const reportPath = path.join(outputDir, 'generation-report.md');
      this.context.fileOps.createFile(reportPath, summaryReport);
      console.log(colors.green(`✅ Summary report written to: ${reportPath}`));

      console.log(colors.green('🎉 Type generation completed successfully!'));
      console.log(colors.cyan('💡 Next steps:'));
      console.log(colors.gray(`  • Import the generated types in your application`));
      console.log(colors.gray(`  • Use the Zod schemas for runtime validation`));
      console.log(colors.gray(`  • Use the container mapping for type-safe queries`));
      if (contentModules.length > 0) {
        console.log(colors.gray(`  • Use content module types for page components`));
      }
      console.log(colors.gray(`  • Check the summary report for detailed information`));
    } catch (error) {
      console.log(colors.red('❌ Type generation failed:'), error.message);
    }
  }

  private generateSummaryReport(
    models: any[],
    containers: any[],
    contentModules: any[],
    validation: any
  ): string {
    const report = `# Agility CMS Type Generation Report

Generated on: ${new Date().toISOString()}

## Summary

- **Models**: ${models.length}
- **Containers**: ${containers.length}
- **Content Modules**: ${contentModules.length}
- **Validation Status**: ${validation.valid ? '✅ Valid' : '❌ Errors Found'}
- **Warnings**: ${validation.warnings?.length || 0} (system fields)
- **Errors**: ${validation.errors?.length || 0}

## Models

${models
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

${containers
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

${contentModules
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
  validation.valid
    ? '✅ All model-container relationships are valid.'
    : `❌ Validation errors found:\n\n${validation.errors.map(error => `- ${error}`).join('\n')}`
}

${
  validation.warnings?.length > 0
    ? `⚠️ Warnings (System Fields):\n\n${validation.warnings.map(warning => `- ${warning}`).join('\n')}\n\n*Note: These warnings indicate container columns that reference Agility CMS system fields (like state, createdDate, userName) which are automatically available on all content items.*`
    : ''
}

## Generated Files

- \`content-types.ts\` - TypeScript interface definitions for content models
- \`content-schemas.ts\` - Zod schema definitions for content models
- \`content-modules.ts\` - TypeScript interface definitions for content modules
- \`content-module-schemas.ts\` - Zod schema definitions for content modules
- \`container-mapping.ts\` - Container-to-content-type mapping
- \`generation-report.md\` - This report

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
import { ContainerTypeMapping, getContainerContentType } from './container-mapping';

// Get the content type for a specific container
const contentType = getContainerContentType('BlogPosts'); // Returns "BlogPostContent"

// Use in API queries with type safety
async function getContainerData<T extends keyof typeof ContainerTypeMapping>(
  containerRef: T
): Promise<ContainerContentType<T>[]> {
  // Your API call here - the return type is automatically inferred
  const response = await fetch(\`/api/containers/\${containerRef}\`);
  return response.json();
}

// Usage
const blogPosts = await getContainerData('BlogPosts'); // Type: BlogPostContent[]
\`\`\`

### Content Module Types

\`\`\`typescript
import { SectionOurProductsProps, HeroHomepageProps } from './content-modules';

// Use content module props for component props
interface PageComponent<T> {
  module: string;
  props: T;
}

const heroComponent: PageComponent<HeroHomepageProps> = {
  module: 'HeroHomepage',
  props: {
    // TypeScript will provide autocomplete for available fields
  }
};
\`\`\`

### Content Module Schemas

\`\`\`typescript
import { SectionOurProductsPropsSchema } from './content-module-schemas';

// Runtime validation of module props
const validatedProps = SectionOurProductsPropsSchema.parse(incomingModuleData);
\`\`\`
`;

    return report;
  }
}
