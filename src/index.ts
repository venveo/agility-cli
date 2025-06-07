#!/usr/bin/env node

import * as yargs from 'yargs';
import { LoginCommand } from './commands/LoginCommand';
import { PullCommand } from './commands/PullCommand';
import { PushCommand } from './commands/PushCommand';
import { GenerateTypesCommand } from './commands/GenerateTypesCommand';
import { StatusCommand } from './commands/StatusCommand';

yargs.version('0.0.1_beta');

// Status command
yargs.command({
  command: 'status',
  describe: 'Show CLI authentication and data status.',
  handler: async function () {
    const command = new StatusCommand();
    await command.execute();
  },
});

// Login command
yargs.command({
  command: 'login',
  describe: 'Login to Agility.',
  handler: async function () {
    const command = new LoginCommand();
    await command.execute();
  },
});

// Pull command
yargs.command({
  command: 'pull',
  describe: 'Pull your Instance',
  builder: {
    guid: {
      describe: 'Provide guid to pull your instance (uses stored instance if omitted).',
      demandOption: false,
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
    const command = new PullCommand();
    await command.execute({
      guid: argv.guid as string | undefined,
      locale: argv.locale as string,
      channel: argv.channel as string,
      baseUrl: argv.baseUrl as string,
    });
  },
});

// Push command
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
    const command = new PushCommand();
    await command.execute({
      guid: argv.guid as string,
      locale: argv.locale as string,
    });
  },
});

// Generate types command
yargs.command({
  command: 'generate-types',
  describe: 'Generate TypeScript types and Zod schemas from Agility models and containers.',
  builder: {
    folder: {
      describe: 'Specify the source folder containing models and containers.',
      demandOption: false,
      type: 'string',
      default: '.agility-files',
    },
    output: {
      describe: 'Specify the output directory for generated types.',
      demandOption: false,
      type: 'string',
      default: './generated-types',
    },
    format: {
      describe: 'Specify the output format.',
      demandOption: false,
      type: 'string',
      choices: ['typescript', 'zod', 'both'],
      default: 'both',
    },
  },
  handler: async function (argv) {
    const command = new GenerateTypesCommand();
    await command.execute({
      folder: argv.folder as string,
      output: argv.output as string,
      format: argv.format as string,
    });
  },
});

yargs.parse();
