#!/usr/bin/env node

import * as yargs from 'yargs';
import { Auth } from './auth';
import { fileOperations } from './fileOperations';
import { sync } from './sync';
import { asset } from './asset';
import { container } from './container';
import { model } from './model';
import { push } from './push';
import { clone } from './clone';
import * as mgmtApi from '@agility/management-sdk';
const FormData = require('form-data');
const cliProgress = require('cli-progress');
const colors = require('ansi-colors');
const inquirer = require('inquirer');
import { createMultibar } from './multibar';
import { modelSync } from './modelSync';
import { FilterData, ModelFilter } from './models/modelFilter';
import { exit } from 'process';

let auth: Auth;
let options: mgmtApi.Options;

yargs.version('0.0.1_beta');

yargs.command({
  command: 'login',
  describe: 'Login to Agility.',
  handler: async function () {
    auth = new Auth();
    const code = await auth.authorize();
  },
});

yargs.command({
  command: 'sync-models',
  describe: 'Sync Models locally.',
  builder: {
    sourceGuid: {
      describe: 'Provide the source guid to pull models from your source instance.',
      demandOption: false,
      type: 'string',
    },
    targetGuid: {
      describe: 'Provide the target guid to push models to your destination instance.',
      demandOption: false,
      type: 'string',
    },
    pull: {
      describe: 'Provide the value as true or false to perform an instance pull to sync models.',
      demandOption: false,
      type: 'boolean',
    },
    folder: {
      describe:
        'Specify the path of the folder where models and template folders are present for model sync. If no value provided, the default folder will be .agility-files.',
      demandOption: false,
      type: 'string',
    },
    dryRun: {
      describe: 'Provide the value as true or false to perform a dry run for model sync.',
      demandOption: false,
      type: 'boolean',
    },
    filter: {
      describe: 'Specify the path of the filter file. Ex: C:\Agility\myFilter.json.',
      demandOption: false,
      type: 'string',
    },
  },
  handler: async function (argv) {
    auth = new Auth();
    const code = new fileOperations();
    const codeFileStatus = code.codeFileExists();
    if (codeFileStatus) {
      const data = JSON.parse(code.readTempFile('code.json'));

      const form = new FormData();
      form.append('cliCode', data.code);
      let guid: string = argv.sourceGuid as string;
      let targetGuid: string = argv.targetGuid as string;
      let instancePull: boolean = argv.pull as boolean;
      let dryRun: boolean = argv.dryRun as boolean;
      let filterSync: string = argv.filter as string;
      let folder: string = argv.folder as string;

      if (guid === undefined && targetGuid === undefined) {
        console.log(
          colors.red('Please provide a source guid or target guid to perform the operation.')
        );
        return;
      }

      let authGuid: string = '';

      if (guid !== undefined) {
        authGuid = guid;
      } else {
        authGuid = targetGuid;
      }

      const token = await auth.cliPoll(form, authGuid);

      let models: mgmtApi.Model[] = [];

      let templates: mgmtApi.PageModel[] = [];

      let multibar = createMultibar({ name: 'Sync Models' });

      options = new mgmtApi.Options();
      options.token = token.access_token;

      if (dryRun === undefined) {
        dryRun = false;
      }
      if (instancePull === undefined) {
        instancePull = false;
      }
      if (filterSync === undefined) {
        filterSync = '';
      }
      if (folder === undefined) {
        folder = '.agility-files';
      }
      const user = await auth.getUser(authGuid, token.access_token);

      if (!instancePull) {
        if (!code.checkBaseFolderExists(folder)) {
          console.log(colors.red(`To proceed with the command the folder ${folder} should exist.`));
          return;
        }
      }

      if (user) {
        if (guid === undefined) {
          guid = '';
        }
        if (targetGuid === undefined) {
          targetGuid = '';
        }
        let sourcePermitted = await auth.checkUserRole(guid, token.access_token);
        let targetPermitted = await auth.checkUserRole(targetGuid, token.access_token);
        if (guid === '') {
          sourcePermitted = true;
        }
        if (targetGuid === '') {
          targetPermitted = true;
        }
        const modelPush = new modelSync(options, multibar);
        if (sourcePermitted && targetPermitted) {
          if (instancePull) {
            if (guid === '') {
              console.log(
                colors.red('Please provide the sourceGuid of the instance for pull operation.')
              );
              return;
            }
            console.log(colors.yellow('Pulling models from your instance. Please wait...'));
            code.cleanup(folder);
            code.createBaseFolder(folder);
            code.createLogFile('logs', 'instancelog', folder);
            const modelPull = new model(options, multibar);

            const templatesPull = new sync(guid, 'syncKey', 'locale', 'channel', options, multibar);

            await modelPull.getModels(guid, folder);
            await templatesPull.getPageTemplates(folder);
            multibar.stop();

            if (targetGuid === '') {
              return;
            }
          }
          if (filterSync) {
            if (!code.checkFileExists(filterSync)) {
              console.log(colors.red(`Please check the filter file is present at ${filterSync}.`));
              return;
            } else {
              const file = code.readFile(`${filterSync}`);
              const jsonData: FilterData = JSON.parse(file);
              const modelFilter = new ModelFilter(jsonData);
              models = await modelPush.validateAndCreateFilterModels(
                modelFilter.filter.Models,
                folder
              );
              templates = await modelPush.validateAndCreateFilterTemplates(
                modelFilter.filter.Templates,
                'locale',
                folder
              );
            }
          }
          if (dryRun) {
            if (targetGuid === '') {
              console.log(
                colors.red(
                  'Please provide the targetGuid parameter a valid instance guid to perform the dry run operation.'
                )
              );
              return;
            }
            console.log(colors.yellow('Running a dry run on models, please wait...'));
            if (code.folderExists('models-sync')) {
              code.cleanup(`${folder}/models-sync`);
            }

            const containerRefs = await modelPush.logContainers(models);
            if (containerRefs) {
              if (containerRefs.length > 0) {
                console.log(
                  colors.yellow(
                    'Please review the content containers in the containerReferenceNames.json file in the logs folder. They should be present in the target instance.'
                  )
                );
              }
            }
            await modelPush.dryRun(guid, 'locale', targetGuid, models, templates, folder);
          } else {
            if (targetGuid === '') {
              console.log(
                colors.red(
                  'Please provide the targetGuid parameter a valid instance guid to perform the model sync operation.'
                )
              );
              return;
            }
            console.log(colors.yellow('Syncing Models from your instance...'));
            multibar = createMultibar({ name: 'Sync Models' });
            const containerRefs = await modelPush.logContainers(models);
            if (containerRefs) {
              if (containerRefs.length > 0) {
                console.log(
                  colors.yellow(
                    'Please review the content containers in the containerReferenceNames.json file in the logs folder. They should be present in the target instance.'
                  )
                );
              }
            }
            await modelPush.syncProcess(targetGuid, 'locale', models, templates, folder);
          }
        } else {
          console.log(
            colors.red(
              'You do not have the required permissions to perform the model sync operation.'
            )
          );
        }
      } else {
        console.log(colors.red('Please authenticate first to perform the sync models operation.'));
      }
    } else {
      console.log(colors.red('Please authenticate first to perform the sync models operation.'));
    }
  },
});

yargs.command({
  command: 'model-pull',
  describe: 'Pull models locally.',
  builder: {
    sourceGuid: {
      describe: 'Provide the source guid to pull models from your source instance.',
      demandOption: true,
      type: 'string',
    },
    folder: {
      describe:
        'Specify the path of the folder where models and template folders are present for model pull.',
      demandOption: false,
      type: 'string',
    },
  },
  handler: async function (argv) {
    auth = new Auth();
    const code = new fileOperations();
    const codeFileStatus = code.codeFileExists();
    if (codeFileStatus) {
      const data = JSON.parse(code.readTempFile('code.json'));

      const form = new FormData();
      form.append('cliCode', data.code);
      const guid: string = argv.sourceGuid as string;
      let folder: string = argv.folder as string;
      const token = await auth.cliPoll(form, guid);
      const multibar = createMultibar({ name: 'Model Pull' });

      options = new mgmtApi.Options();
      options.token = token.access_token;

      if (folder === undefined) {
        folder = '.agility-files';
      }

      const user = await auth.getUser(guid, token.access_token);

      if (user) {
        const sourcePermitted = await auth.checkUserRole(guid, token.access_token);

        if (sourcePermitted) {
          code.cleanup(folder);
          code.createBaseFolder(folder);
          code.createLogFile('logs', 'instancelog', folder);
          console.log(colors.yellow('Pulling Models from your instance...'));
          const modelPull = new model(options, multibar);

          const templatesPull = new sync(guid, 'syncKey', 'locale', 'channel', options, multibar);

          await modelPull.getModels(guid, folder);
          await templatesPull.getPageTemplates(folder);
          multibar.stop();
        } else {
          console.log(
            colors.red(
              'You do not have the required permissions to perform the model pull operation.'
            )
          );
        }
      } else {
        console.log(colors.red('Please authenticate first to perform the pull operation.'));
      }
    } else {
      console.log(colors.red('Please authenticate first to perform the pull operation.'));
    }
  },
});

yargs.command({
  command: 'pull',
  describe: 'Pull your Instance',
  builder: {
    guid: {
      describe: 'Provide guid to pull your instance.',
      demandOption: true,
      type: 'string',
    },
    locale: {
      describe: 'Provide the locale to pull your instance.',
      demandOption: true,
      type: 'string',
    },
    channel: {
      describe: 'Provide the channel to pull your instance.',
      demandOption: true,
      type: 'string',
    },
    baseUrl: {
      describe: 'Specify the base url of your instance.',
      demandOption: false,
      type: 'string',
    },
  },
  handler: async function (argv) {
    auth = new Auth();
    const code = new fileOperations();
    const codeFileStatus = code.codeFileExists();
    if (codeFileStatus) {
      code.cleanup('.agility-files');

      const data = JSON.parse(code.readTempFile('code.json'));

      const form = new FormData();
      form.append('cliCode', data.code);
      const guid: string = argv.guid as string;
      const locale: string = argv.locale as string;
      const channel: string = argv.channel as string;
      const userBaseUrl: string = argv.baseUrl as string;

      const token = await auth.cliPoll(form, guid);

      const multibar = createMultibar({ name: 'Pull' });

      options = new mgmtApi.Options();
      options.token = token.access_token;

      const user = await auth.getUser(guid, token.access_token);

      if (user) {
        const permitted = await auth.checkUserRole(guid, token.access_token);
        if (permitted) {
          const syncKey = await auth.getPreviewKey(guid, userBaseUrl);
          if (syncKey) {
            console.log(colors.yellow('Pulling your instance...'));
            const contentPageSync = new sync(guid, syncKey, locale, channel, options, multibar);

            await contentPageSync.sync();

            const assetsSync = new asset(options, multibar);

            await assetsSync.getAssets(guid);

            const containerSync = new container(options, multibar);

            await containerSync.getContainers(guid);

            const modelSync = new model(options, multibar);

            await modelSync.getModels(guid);
          } else {
            console.log(
              colors.red(
                'Either the preview key is not present in your instance or you need to specify the baseUrl parameter as an input based on the location. Please refer the docs for the Base Url.'
              )
            );
          }
        } else {
          console.log(
            colors.red(
              'You do not have required permissions on the instance to perform the pull operation.'
            )
          );
        }
      } else {
        console.log(colors.red('Please authenticate first to perform the pull operation.'));
      }
    } else {
      console.log(colors.red('Please authenticate first to perform the pull operation.'));
    }
  },
});

yargs.command({
  command: 'push',
  describe: 'Push your Instance.',
  builder: {
    guid: {
      describe: 'Provide the target guid to push your instance.',
      demandOption: true,
      type: 'string',
    },
    locale: {
      describe: 'Provide the locale to push your instance.',
      demandOption: true,
      type: 'string',
    },
  },
  handler: async function (argv) {
    const guid: string = argv.guid as string;
    const locale: string = argv.locale as string;
    const update: boolean = argv.update as boolean;
    const code = new fileOperations();
    auth = new Auth();
    const codeFileStatus = code.codeFileExists();

    if (codeFileStatus) {
      const agilityFolder = code.cliFolderExists();
      if (agilityFolder) {
        const data = JSON.parse(code.readTempFile('code.json'));

        const multibar = createMultibar({ name: 'Push' });

        const form = new FormData();
        form.append('cliCode', data.code);

        const token = await auth.cliPoll(form, guid);

        options = new mgmtApi.Options();
        options.token = token.access_token;

        const user = await auth.getUser(guid, token.access_token);
        if (user) {
          const permitted = await auth.checkUserRole(guid, token.access_token);
          if (permitted) {
            console.log(colors.yellow('Pushing your instance...'));
            const pushSync = new push(options, multibar);
            await pushSync.pushInstance(guid, locale);
          } else {
            console.log(
              colors.red(
                'You do not have required permissions on the instance to perform the push operation.'
              )
            );
          }
        } else {
          console.log(colors.red('Please authenticate first to perform the push operation.'));
        }
      } else {
        console.log(colors.red('Please pull an instance first to push an instance.'));
      }
    } else {
      console.log(colors.red('Please authenticate first to perform the push operation.'));
    }
  },
});

yargs.command({
  command: 'updatecontent',
  describe: 'Update a specific content ID or list of content IDs.',
  builder: {
    guid: {
      describe: 'Provide the target guid to update your instance.',
      demandOption: true,
      type: 'string',
    },
    locale: {
      describe: 'Provide the locale to update your instance.',
      demandOption: true,
      type: 'string',
    },
    contentItems: {
      describe: 'What content items to update',
      demandOption: false,
      type: 'string',
      default: 'all',
    },
  },
  handler: async function (argv) {
    const guid: string = argv.guid as string;
    const locale: string = argv.locale as string;
    const contentItems: string = argv.contentItems as string;

    const code = new fileOperations();
    auth = new Auth();
    const codeFileStatus = code.codeFileExists();

    if (codeFileStatus) {
      const agilityFolder = code.cliFolderExists();
      if (agilityFolder) {
        const data = JSON.parse(code.readTempFile('code.json'));

        const multibar = createMultibar({ name: 'Push' });

        const form = new FormData();
        form.append('cliCode', data.code);

        const token = await auth.cliPoll(form, guid);

        options = new mgmtApi.Options();
        options.token = token.access_token;

        const user = await auth.getUser(guid, token.access_token);
        if (user) {
          const permitted = await auth.checkUserRole(guid, token.access_token);
          if (permitted) {
            console.log('-----------------------------------------------');
            console.log(colors.yellow('Updating your content items...'));
            console.log(
              'Content items will be in preview state and changes will need to be published.'
            );
            console.log('-----------------------------------------------');

            const pushSync = new push(options, multibar);
            const action = await pushSync.updateContentItems(guid, locale, contentItems);
            multibar.stop();

            const total = contentItems.split(',').length;
            const successful = action.successfulItems.length;

            if (successful < total) {
              console.log(
                colors.yellow(
                  `${successful} out of ${total} content items were successfully updated.`
                )
              );
              if (action.notOnDestination.length > 0) {
                console.log(
                  colors.yellow('Not found on destination instance'),
                  action.notOnDestination
                );
              }

              if (action.notOnSource.length > 0) {
                console.log(colors.yellow('Not found in local files'), action.notOnSource);
              }

              if (action.modelMismatch.length > 0) {
                console.log(
                  colors.yellow('Model mismatch on destination instance'),
                  action.modelMismatch
                );
              }
            } else {
              console.log(
                colors.green(
                  `${successful} out of ${total} content items were successfully updated.`
                )
              );
            }
          } else {
            console.log(
              colors.red(
                'You do not have required permissions on the instance to perform the push operation.'
              )
            );
          }
        } else {
          console.log(colors.red('Please authenticate first to perform the push operation.'));
        }
      } else {
        console.log(colors.red('Please pull an instance first to push an instance.'));
      }
    } else {
      console.log(colors.red('Please authenticate first to perform the push operation.'));
    }
  },
});

yargs.command({
  command: 'publishcontent',
  describe: 'Publish a specific content ID or list of content IDs.',
  builder: {
    guid: {
      describe: 'Provide the target guid to update your instance.',
      demandOption: true,
      type: 'string',
    },
    locale: {
      describe: 'Provide the locale to update your instance.',
      demandOption: true,
      type: 'string',
    },
    contentItems: {
      describe: 'What content items to update',
      demandOption: false,
      type: 'string',
      default: '',
    },
  },
  handler: async function (argv) {
    const guid: string = argv.guid as string;
    const locale: string = argv.locale as string;
    const contentItems: number[] = (argv.contentItems as string).split(',').map(Number);

    const code = new fileOperations();
    auth = new Auth();
    const codeFileStatus = code.codeFileExists();

    if (codeFileStatus) {
      const agilityFolder = code.cliFolderExists();
      if (agilityFolder) {
        const data = JSON.parse(code.readTempFile('code.json'));

        const multibar = createMultibar({ name: 'Publish' });
        const bar = await multibar.create(contentItems.length, 0, { name: 'Publishing' });

        const form = new FormData();
        form.append('cliCode', data.code);

        const token = await auth.cliPoll(form, guid);

        options = new mgmtApi.Options();
        options.token = token.access_token;

        const user = await auth.getUser(guid, token.access_token);
        if (user) {
          const permitted = await auth.checkUserRole(guid, token.access_token);
          if (permitted) {
            console.log('-----------------------------------------------');
            console.log(colors.yellow('Publishing your content items...'));
            console.log('-----------------------------------------------');
            const apiClient = new mgmtApi.ApiClient(options);

            for (const contentItem of contentItems) {
              try {
                await apiClient.contentMethods.publishContent(contentItem, guid, locale);
                await bar.increment();
              } catch (error) {
                console.error(`Failed to publish content item ${contentItem}:`, error);
              }
            }

            await bar.update(contentItems.length, { name: 'Published!' });

            await bar.stop();

            setTimeout(() => {
              console.log(colors.green('Content items have been published.'));
              exit(1);
            }, 1000);
          } else {
            console.log(
              colors.red(
                'You do not have required permissions on the instance to perform the push operation.'
              )
            );
            exit(1);
          }
        } else {
          console.log(colors.red('Please authenticate first to perform the push operation.'));
          exit(1);
        }
      } else {
        console.log(colors.red('Please pull an instance first to push an instance.'));
        exit(1);
      }
    } else {
      console.log(colors.red('Please authenticate first to perform the push operation.'));
      exit(1);
    }
  },
});

yargs.command({
  command: 'clone',
  describe: 'Clone your Instance.',
  builder: {
    sourceGuid: {
      describe: 'Provide the source guid to clone your instance.',
      demandOption: true,
      type: 'string',
    },
    targetGuid: {
      describe: 'Provide the target guid to clone your instance.',
      demandOption: true,
      type: 'string',
    },
    locale: {
      describe: 'Provide the locale to clone your instance.',
      demandOption: true,
      type: 'string',
    },
    channel: {
      describe: 'Provide the channel to pull your instance.',
      demandOption: true,
      type: 'string',
    },
  },
  handler: async function (argv) {
    const sourceGuid: string = argv.sourceGuid as string;
    const targetGuid: string = argv.targetGuid as string;
    const locale: string = argv.locale as string;
    const channel: string = argv.channel as string;
    const code = new fileOperations();
    auth = new Auth();
    const codeFileStatus = code.codeFileExists();
    if (codeFileStatus) {
      code.cleanup('.agility-files');
      const data = JSON.parse(code.readTempFile('code.json'));
      const form = new FormData();
      form.append('cliCode', data.code);

      const token = await auth.cliPoll(form, sourceGuid);

      const user = await auth.getUser(sourceGuid, token.access_token);

      if (user) {
        const sourcePermitted = await auth.checkUserRole(sourceGuid, token.access_token);
        const targetPermitted = await auth.checkUserRole(targetGuid, token.access_token);

        if (sourcePermitted && targetPermitted) {
          console.log(colors.yellow('Cloning your instance...'));
          const cloneSync = new clone(sourceGuid, targetGuid, locale, channel);

          console.log(colors.yellow('Pulling your instance...'));
          await cloneSync.pull();

          const agilityFolder = code.cliFolderExists();
          if (agilityFolder) {
            console.log(colors.yellow('Pushing your instance...'));
            await cloneSync.push();
          } else {
            console.log(colors.red('Please pull an instance first to push an instance.'));
          }
        } else {
          console.log(
            colors.red('You do not have the required permissions to perform the clone operation.')
          );
        }
      } else {
        console.log(colors.red('Please authenticate first to perform the clone operation.'));
      }
    } else {
      console.log(colors.red('Please authenticate first to perform the clone operation.'));
    }
  },
});

yargs.parse();
