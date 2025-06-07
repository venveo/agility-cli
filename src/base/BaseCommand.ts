import * as mgmtApi from '@agility/management-sdk';
import { Auth } from '../auth';
import { fileOperations } from '../fileOperations';
import { createMultibar } from '../multibar';
import { ConfigService } from '../config';
import { cliToken } from '../models/cliToken';

const FormData = require('form-data');
const colors = require('ansi-colors');

export interface CommandContext {
  auth: Auth;
  fileOps: fileOperations;
  options: mgmtApi.Options;
  multibar: any;
  config: ConfigService;
}

export abstract class BaseCommand {
  protected context: CommandContext;

  constructor() {
    this.context = {
      auth: new Auth(),
      fileOps: new fileOperations(),
      options: new mgmtApi.Options(),
      multibar: null,
      config: ConfigService.getInstance(),
    };
  }

  protected async authenticate(guid: string): Promise<cliToken | null> {
    const codeFileStatus = this.context.fileOps.codeFileExists();
    if (!codeFileStatus) {
      console.log(colors.red('Please authenticate first to perform this operation.'));
      return null;
    }

    const data = JSON.parse(this.context.fileOps.readTempFile('code.json'));
    const form = new FormData();
    form.append('cliCode', data.code);

    return await this.context.auth.cliPoll(form, guid);
  }

  protected async validateUserPermissions(guid: string, token: string): Promise<boolean> {
    const user = await this.context.auth.getUser(guid, token);
    if (!user) {
      console.log(colors.red('Please authenticate first to perform this operation.'));
      return false;
    }

    const permitted = await this.context.auth.checkUserRole(guid, token);
    if (!permitted) {
      console.log(
        colors.red(
          'You do not have required permissions on the instance to perform this operation.'
        )
      );
      return false;
    }

    return true;
  }

  protected setupOptions(token: string): void {
    this.context.options.token = token;
  }

  protected createMultibar(name: string): any {
    this.context.multibar = createMultibar({ name });
    return this.context.multibar;
  }

  protected async executeWithAuth(
    guid: string,
    operation: (token: string) => Promise<void>
  ): Promise<void> {
    try {
      const token = await this.authenticate(guid);
      if (!token) return;

      const hasPermission = await this.validateUserPermissions(guid, token.access_token);
      if (!hasPermission) return;

      this.setupOptions(token.access_token);
      await operation(token.access_token);
    } catch (error) {
      console.log(colors.red(`Operation failed: ${error.message}`));
    }
  }

  protected async executeWithDualAuth(
    sourceGuid: string,
    targetGuid: string,
    operation: (token: string) => Promise<void>
  ): Promise<void> {
    try {
      const token = await this.authenticate(sourceGuid);
      if (!token) return;

      const sourcePermitted = await this.context.auth.checkUserRole(sourceGuid, token.access_token);
      const targetPermitted = await this.context.auth.checkUserRole(targetGuid, token.access_token);

      if (!sourcePermitted || !targetPermitted) {
        console.log(
          colors.red('You do not have the required permissions to perform this operation.')
        );
        return;
      }

      this.setupOptions(token.access_token);
      await operation(token.access_token);
    } catch (error) {
      console.log(colors.red(`Operation failed: ${error.message}`));
    }
  }

  abstract execute(argv: any): Promise<void>;
}
