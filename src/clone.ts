import * as mgmtApi from '@agility/management-sdk';
import { fileOperations } from './fileOperations';
import * as fs from 'fs';
const FormData = require('form-data');
import { Auth } from './auth';
import { sync } from './sync';
import { asset } from './asset';
import { container } from './container';
import { model } from './model';
import { push } from './push';
import { createMultibar } from './multibar';

export class clone {
  auth: Auth;
  options: mgmtApi.Options;
  sourceGuid: string;
  targetGuid: string;
  locale: string;
  channel: string;

  constructor(_sourceGuid: string, _targetGuid: string, _locale: string, _channel: string) {
    this.sourceGuid = _sourceGuid;
    this.targetGuid = _targetGuid;
    this.locale = _locale;
    this.channel = _channel;
  }

  async pull() {
    const code = new fileOperations();
    this.auth = new Auth();
    const data = JSON.parse(code.readTempFile('code.json'));
    const form = new FormData();
    form.append('cliCode', data.code);

    const token = await this.auth.cliPoll(form, this.sourceGuid);

    this.options = new mgmtApi.Options();
    this.options.token = token.access_token;

    const multibar = createMultibar({ name: 'Instance' });

    const syncKey = await this.auth.getPreviewKey(this.sourceGuid);
    const contentPageSync = new sync(
      this.sourceGuid,
      syncKey,
      this.locale,
      this.channel,
      this.options,
      multibar
    );

    await contentPageSync.sync();

    const assetsSync = new asset(this.options, multibar);

    await assetsSync.getAssets(this.sourceGuid);

    const containerSync = new container(this.options, multibar);

    await containerSync.getContainers(this.sourceGuid);

    const modelSync = new model(this.options, multibar);

    await modelSync.getModels(this.sourceGuid);
  }

  async push() {
    const code = new fileOperations();
    this.auth = new Auth();
    const data = JSON.parse(code.readTempFile('code.json'));
    const multibar = createMultibar({ name: 'Instance' });

    const form = new FormData();
    form.append('cliCode', data.code);

    const token = await this.auth.cliPoll(form, this.targetGuid);

    this.options = new mgmtApi.Options();
    this.options.token = token.access_token;

    const modelSync = new model(this.options, multibar);
    const pushSync = new push(this.options, multibar);

    const containerSync = new container(this.options, multibar);

    await pushSync.pushInstance(this.targetGuid, this.locale);
  }
}
