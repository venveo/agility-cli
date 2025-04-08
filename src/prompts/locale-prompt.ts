import inquirer from 'inquirer';
import { Auth } from '../auth';
import { fileOperations } from '../fileOperations';
import { AgilityInstance } from '../types/instance';
import * as mgmtApi  from '@agility/management-sdk';
const FormData = require("form-data");

let auth: Auth;
export async function localePrompt(selectedInstance:AgilityInstance) {

    auth = new Auth();
    const code = new fileOperations();
    let data = JSON.parse(code.readTempFile("code.json"));
    const form = new FormData();

    form.append("cliCode", data.code);
  
    let guid: string = selectedInstance.guid;
    let token = await auth.cliPoll(form, guid);

    let options = new mgmtApi.Options();
    options.token = token.access_token;

    let apiClient = new mgmtApi.ApiClient(options);

    let localesArr = await apiClient.instanceMethods.getLocales(guid);
  
    let locales = localesArr.map((locale: mgmtApi.Locales) => { 
        return locale['localeCode'];   
    });

    const questions = [
        {
          type: "search-list",
          name: "locales",
          message: "Select a locale:",
          choices: locales,
          default: locales[0], // Default value
        },
      ];
    

    const answers = await inquirer.prompt(questions);

    return answers.locales;
}