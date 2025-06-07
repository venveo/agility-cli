import { BaseCommand } from '../base/BaseCommand';
import { push } from '../push';

const colors = require('ansi-colors');

export interface PushCommandArgs {
  guid: string;
  locale: string;
}

export class PushCommand extends BaseCommand {
  async execute(argv: PushCommandArgs): Promise<void> {
    const { guid, locale } = argv;

    const agilityFolder = this.context.fileOps.cliFolderExists();
    if (!agilityFolder) {
      console.log(colors.red('Please pull an instance first to push an instance.'));
      return;
    }

    await this.executeWithAuth(guid, async () => {
      console.log(colors.yellow('Pushing your instance...'));
      const multibar = this.createMultibar('Push');

      const pushSync = new push(this.context.options, multibar);
      await pushSync.pushInstance(guid, locale);
    });
  }
}
