import { BaseCommand } from '../base/BaseCommand';
import { TypeGenerationService, GenerationConfig } from '../services/type-generation';
import colors from 'ansi-colors';
import inquirer from 'inquirer';

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
      const config: GenerationConfig = {
        format,
        outputDir,
        sourceFolder,
        includeDepthAware: true,
        includeContentModules: true,
      };

      const typeGenerationService = new TypeGenerationService(this.context.fileOps);

      // Generate types using the new service
      console.log(colors.yellow('📋 Starting type generation...'));
      const result = await typeGenerationService.generateTypes(config);

      if (!result.success) {
        // Handle failure cases
        if (result.summary.modelsCount === 0) {
          console.log(colors.red('❌ No models found in the specified folder.'));
          console.log(colors.yellow('💡 To get started:'));
          console.log(colors.gray('  1. Run `agility login` to authenticate'));
          console.log(
            colors.gray(
              '  2. Run `agility pull --locale en-us --channel website` to download your instance data'
            )
          );
          console.log(colors.gray('  3. Then run `agility generate-types` again'));

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
              colors.gray(
                '  agility pull --locale en-us --channel website --guid your-instance-guid'
              )
            );
            console.log(
              colors.gray("\n💡 If you've already logged in, the GUID will be used automatically.")
            );
          }

          return;
        }

        // Show errors
        console.log(colors.red(`❌ Type generation failed:`));
        result.errors.forEach(error => {
          console.log(colors.red(`  • ${error}`));
        });
        return;
      }

      // Show summary statistics
      console.log(colors.gray(`Found ${result.summary.modelsCount} models`));
      console.log(colors.gray(`Found ${result.summary.containersCount} containers`));
      console.log(colors.gray(`Found ${result.summary.contentModulesCount} content modules`));

      // Show warnings if any
      if (result.warnings.length > 0) {
        console.log(colors.yellow(`⚠️  ${result.warnings.length} warnings found:`));
        if (result.warnings.length <= 5) {
          result.warnings.forEach(warning => {
            console.log(colors.yellow(`  • ${warning}`));
          });
        } else {
          result.warnings.slice(0, 3).forEach(warning => {
            console.log(colors.yellow(`  • ${warning}`));
          });
          console.log(colors.gray(`  ... and ${result.warnings.length - 3} more`));
        }
      }

      // Show validation status
      if (!result.summary.validationResult.valid) {
        console.log(
          colors.red(`❌ ${result.summary.validationResult.errors.length} validation errors found:`)
        );
        result.summary.validationResult.errors.forEach(error => {
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
      } else if (result.warnings.length === 0) {
        console.log(colors.green('✅ All relationships validated successfully!'));
      } else {
        console.log(colors.green('✅ Validation passed (with warnings for system fields)'));
      }

      // Show generated files
      console.log(colors.green('🎉 Type generation completed successfully!'));
      console.log(colors.cyan('📁 Generated files:'));
      result.filesGenerated.forEach(filePath => {
        console.log(colors.green(`  ✅ ${filePath}`));
      });

      console.log(colors.cyan('💡 Next steps:'));
      console.log(colors.gray(`  • Import the generated types in your application`));
      console.log(colors.gray(`  • Use the Zod schemas for runtime validation`));
      console.log(colors.gray(`  • Use the container mapping for type-safe queries`));
      if (result.summary.contentModulesCount > 0) {
        console.log(colors.gray(`  • Use content module types for page components`));
      }
      console.log(colors.gray(`  • Check the summary report for detailed information`));
    } catch (error) {
      console.log(colors.red('❌ Type generation failed:'), error.message);
    }
  }
}
