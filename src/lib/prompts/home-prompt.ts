import inquirer from "inquirer";
import colors from "ansi-colors";
import { pullFiles } from "./pull-prompt";
import { listInstances } from "../instances/list";
import process from "process";
import { instanceSelector } from "../instances/instance-list";
import { getInstance, instancesPrompt } from "./instance-prompt";
import { forceDevMode, forceLocalMode } from "../..";
import { Auth } from "../../auth";
import { AgilityInstance } from "types/instance";

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
        // "List instances",
        //"Fetch API",
          new inquirer.Separator(),
          "Logout",
        ],
      },
    ])
    .then(async (answers: { option: string }) => {
      switch (answers.option) {
        case "Instances":
            


        const selectedInstance: AgilityInstance = await instanceSelector();
            // const selectedInstance = await instanceSelector();
            const keys = await getInstance(selectedInstance);
            
            const keyClone = {
                ...keys
            }
            delete keyClone['websiteDetails']

            await instancesPrompt(selectedInstance, keys);

            break;
        // case "List instances":
        //   listInstances();
        //   break;
        // case "Fetch API":
        //   fetchAPI();
        //   break;
        case "Logout":
          const auth = new Auth();
          await auth.logout();
          break;
        default:
          console.log(colors.red("Invalid option selected."));
      }
    });
}