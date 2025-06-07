import { BaseCommand } from '../base/BaseCommand';
const colors = require('ansi-colors');
const FormData = require('form-data');

export class LoginCommand extends BaseCommand {
  async execute(): Promise<void> {
    console.log(colors.cyan('🔐 Starting Agility CLI authentication...'));

    try {
      const code = await this.context.auth.authorize();
      console.log(colors.yellow('✨ Browser opened for authentication.'));
      console.log(colors.yellow('📋 Your verification code is:'), colors.bold(code));
      console.log(colors.gray('⏳ Waiting for authentication...'));

      // Poll for authentication result with longer intervals
      let attempts = 0;
      const maxAttempts = 30; // 5 minutes max wait (30 * 10 seconds)
      let token = null;

      while (attempts < maxAttempts && !token) {
        try {
          console.log(colors.gray(`Checking authentication status... (attempt ${attempts + 1})`));

          // Create fresh FormData for each request to avoid memory leaks
          const form = new FormData();
          form.append('cliCode', code);

          token = await this.context.auth.cliPoll(form, 'blank-d');
          if (token && token.access_token) {
            console.log(colors.gray(`✅ Authentication successful!`));
            break;
          } else {
            console.log(colors.gray(`Authentication still pending...`));
          }
        } catch (error) {
          if (error.message.includes('timeout')) {
            console.log(colors.gray(`Request timed out, retrying...`));
          } else {
            console.log(colors.gray(`Authentication not ready: ${error.message}`));
          }
        }

        if (attempts >= maxAttempts - 1) break;

        console.log(colors.gray(`Waiting 10 seconds before next check...`));
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds between attempts
        attempts++;
      }

      if (!token || !token.access_token) {
        console.log(colors.red('❌ Authentication timed out. Please try again.'));
        console.log(colors.yellow('💡 Make sure you completed the login process in your browser.'));
        return;
      }

      console.log(colors.green('✅ Successfully authenticated!'));
      console.log(colors.gray('🔑 Token stored for future CLI operations.'));

      // Ask for instance GUID to validate and store
      const inquirer = require('inquirer');
      const guidAnswer = await inquirer.prompt([
        {
          type: 'input',
          name: 'guid',
          message: 'Enter your Agility instance GUID to validate access:',
          validate: (input: string) => {
            if (!input || input.trim().length === 0) {
              return 'Please enter a valid GUID';
            }
            return true;
          },
        },
      ]);

      const instanceGuid = guidAnswer.guid.trim();

      try {
        // Verify user permissions on the instance
        const hasPermission = await this.context.auth.checkUserRole(
          instanceGuid,
          token.access_token
        );
        if (!hasPermission) {
          console.log(colors.red('❌ You do not have required permissions on this instance.'));
          console.log(colors.yellow('💡 Make sure you have Manager or Administrator role.'));
          return;
        }

        // Get user details for this instance
        const user = await this.context.auth.getUser(instanceGuid, token.access_token);
        if (user) {
          console.log(colors.green('🎉 Instance access validated!'));
          console.log(
            colors.cyan('👤 Logged in as:'),
            colors.bold(`${user.firstName} ${user.lastName}`)
          );
          console.log(colors.cyan('📧 Email:'), user.emailAddress);
          console.log(colors.cyan('🏢 Instance:'), colors.bold(instanceGuid));

          // Store the instance GUID for future use
          this.context.fileOps.createTempFile(
            'instance.json',
            JSON.stringify({ guid: instanceGuid })
          );
          console.log(colors.gray('💾 Instance GUID stored for future CLI operations.'));
        } else {
          console.log(colors.yellow('⚠️  Access validated but unable to fetch user details.'));
          console.log(colors.cyan('🏢 Instance:'), colors.bold(instanceGuid));
          this.context.fileOps.createTempFile(
            'instance.json',
            JSON.stringify({ guid: instanceGuid })
          );
          console.log(colors.gray('💾 Instance GUID stored for future CLI operations.'));
        }
      } catch (error) {
        console.log(colors.red('❌ Failed to validate instance access:'), error.message);
        console.log(colors.yellow('💡 Please check your GUID and try again.'));
      }
    } catch (error) {
      console.log(colors.red('❌ Authentication failed:'), error.message);
    }
  }
}
