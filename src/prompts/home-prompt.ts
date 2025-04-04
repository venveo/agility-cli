import inquirer from "inquirer";
import colors from "ansi-colors";
import { pullFiles } from "./pull-prompt";
import { listInstances } from "./instances/list";
import { logout } from "./logout";
import process from "process";
import { generateEnv } from "./utilities/generate-env";
import { instanceSelector } from "./instances/selector";
import { getInstance, instancesPrompt } from "./instance-prompt";

export async function homePrompt(prompt?: any) {
    await inquirer
    .prompt([
      {
        type: "list",
        name: "option",
        message: prompt ?? "What would you like to do today?:",
        choices: [

          new inquirer.Separator(),
          "Instances",
          "List instances",
        //"Fetch API",
          new inquirer.Separator(),
          "Logout",
        ],
      },
    ])
    .then(async (answers: { option: string }) => {
      switch (answers.option) {
        case "Instances":
            
            const selectedInstance = await instanceSelector();
            console.log('Fetching instance...')
            const keys = await getInstance(selectedInstance);
            
            console.log(keys)
            console.log(`FetchAPI \x1b[33mhttps://api.aglty.io/swagger/index.html\x1b[0m`);

            console.log(`App Manager \x1b[33mhttps://app.agilitycms.com/instance/${selectedInstance.guid}\x1b[0m`);
            console.log(`Classic \x1b[33mhttps://manager.agilitycms.com/instance/${selectedInstance.guid}\x1b[0m`);
            await instancesPrompt(selectedInstance, keys);

            break;
        case "List instances":
          listInstances();
          break;
        // case "Generate .env file":
        //   generateEnv();
        // break;
        // case "Fetch API":
        //   fetchAPI();
        //   break;
        case "Logout":
          logout();
          break;
        default:
          console.log(colors.red("Invalid option selected."));
      }
    });
}