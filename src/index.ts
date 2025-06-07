#!/usr/bin/env node

import * as yargs from 'yargs';
import { LoginCommand } from './commands/LoginCommand';
import { PullCommand } from './commands/PullCommand';
import { PushCommand } from './commands/PushCommand';

yargs.version('0.0.1_beta');

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
    const command = new PullCommand();
    await command.execute({
      guid: argv.guid as string,
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

yargs.parse();
