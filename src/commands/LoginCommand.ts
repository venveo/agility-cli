import { BaseCommand } from '../base/BaseCommand';

export class LoginCommand extends BaseCommand {
  async execute(): Promise<void> {
    const code = await this.context.auth.authorize();
    // Authorization result is handled by the Auth class
  }
}
