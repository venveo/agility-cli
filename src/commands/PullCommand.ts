import { BaseCommand } from '../base/BaseCommand';
import { sync } from '../sync';
import { asset } from '../asset';
import { container } from '../container';
import { model } from '../model';

const colors = require('ansi-colors');

export interface PullCommandArgs {
  guid: string;
  locale: string;
  channel: string;
  baseUrl?: string;
}

export class PullCommand extends BaseCommand {
  async execute(argv: PullCommandArgs): Promise<void> {
    const { guid, locale, channel, baseUrl } = argv;

    await this.executeWithAuth(guid, async (token: string) => {
      this.context.fileOps.cleanup(this.context.config.getBaseFolder());

      const syncKey = await this.context.auth.getPreviewKey(guid, baseUrl);
      if (!syncKey) {
        console.log(
          colors.red(
            'Either the preview key is not present in your instance or you need to specify the baseUrl parameter. Please refer the docs for the Base URL.'
          )
        );
        return;
      }

      console.log(colors.yellow('Pulling your instance...'));
      const multibar = this.createMultibar('Pull');

      const contentPageSync = new sync(
        guid,
        syncKey,
        locale,
        channel,
        this.context.options,
        multibar
      );
      await contentPageSync.sync();

      const assetsSync = new asset(this.context.options, multibar);
      await assetsSync.getAssets(guid);

      const containerSync = new container(this.context.options, multibar);
      await containerSync.getContainers(guid);

      const modelSync = new model(this.context.options, multibar);
      await modelSync.getModels(guid);
    });
  }
}
