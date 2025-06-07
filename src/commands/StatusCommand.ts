import { BaseCommand } from '../base/BaseCommand';
const colors = require('ansi-colors');

export class StatusCommand extends BaseCommand {
  async execute(): Promise<void> {
    console.log(colors.cyan('📊 Agility CLI Status'));
    console.log(colors.gray('='.repeat(50)));

    // Check authentication status
    const hasAuth = this.context.fileOps.codeFileExists();
    console.log(colors.yellow('🔐 Authentication:'), hasAuth ? colors.green('✅ Logged in') : colors.red('❌ Not logged in'));

    // Check stored instance GUID
    const storedGuid = this.getStoredInstanceGuid();
    console.log(colors.yellow('🏢 Stored Instance:'), storedGuid ? colors.green(`✅ ${storedGuid}`) : colors.gray('❌ None stored'));

    // Check for .agility-files folder
    const hasAgilityFiles = this.context.fileOps.cliFolderExists();
    console.log(colors.yellow('📁 Local Data:'), hasAgilityFiles ? colors.green('✅ .agility-files exists') : colors.gray('❌ No local data'));

    if (hasAgilityFiles) {
      // Check for models
      try {
        const modelFiles = this.context.fileOps.readDirectory('models');
        console.log(colors.yellow('📋 Models:'), colors.green(`✅ ${modelFiles.length} found`));
      } catch {
        console.log(colors.yellow('📋 Models:'), colors.gray('❌ None found'));
      }

      // Check for containers
      try {
        const containerFiles = this.context.fileOps.readDirectory('containers');
        console.log(colors.yellow('📦 Containers:'), colors.green(`✅ ${containerFiles.length} found`));
      } catch {
        console.log(colors.yellow('📦 Containers:'), colors.gray('❌ None found'));
      }

      // Check for assets
      try {
        const assetFiles = this.context.fileOps.readDirectory('assets/json');
        console.log(colors.yellow('🖼️  Assets:'), colors.green(`✅ ${assetFiles.length} found`));
      } catch {
        console.log(colors.yellow('🖼️  Assets:'), colors.gray('❌ None found'));
      }
    }

    console.log(colors.gray('='.repeat(50)));

    // Provide recommendations
    if (!hasAuth) {
      console.log(colors.yellow('💡 Next steps:'));
      console.log(colors.gray('  1. Run `agility login` to authenticate'));
    } else if (!storedGuid) {
      console.log(colors.yellow('💡 Next steps:'));
      console.log(colors.gray('  1. Run `agility login` again to store an instance GUID'));
    } else if (!hasAgilityFiles) {
      console.log(colors.yellow('💡 Next steps:'));
      console.log(colors.gray('  1. Run `agility pull --locale en-us --channel website` to download data'));
      console.log(colors.gray('  2. Run `agility generate-types` to create TypeScript types'));
    } else {
      console.log(colors.green('🎉 Everything looks good!'));
      console.log(colors.yellow('💡 Available commands:'));
      console.log(colors.gray('  • `agility pull --locale en-us --channel website` - Refresh local data'));
      console.log(colors.gray('  • `agility generate-types` - Generate TypeScript types and Zod schemas'));
      console.log(colors.gray('  • `agility push --locale en-us` - Deploy changes to instance'));
    }
  }
}