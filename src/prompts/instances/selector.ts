import inquirer from "inquirer";
import { Auth } from "../../auth";
import { fileOperations } from "../../fileOperations";

import colors from "ansi-colors";
const FormData = require("form-data");

export async function instanceSelector() {
  let auth = new Auth();
  let code = new fileOperations();
  let data = JSON.parse(code.readTempFile("code.json"));

  const form = new FormData();
  form.append("cliCode", data.code);

  let token = await auth.cliPoll(form, null);
  let user = await auth.getUser(null, token.access_token);
  let instances = user.websiteAccess;

  const instanceChoices = instances.map((instance: any) => ({
    name: `${instance.websiteName} (${instance.guid})`,
    value: instance.guid,
    ...instance,
  }));

  const instanceAnswer = await inquirer.prompt([
    {
      type: "search-list",
      name: "selectedInstance",
      message: "Select an instance:",
      choices: instanceChoices,
    },
  ]);

//   return instanceAnswer

  const website = instances.find(
    (instance: any) => instance.guid === instanceAnswer.selectedInstance
  );


  const { guid, websiteName } = website;
  console.log('------------------------------------------------');
  console.log(colors.green('●'), colors.green(` (${guid})`), colors.white(websiteName));
  console.log('------------------------------------------------');

  return website;
  return instanceAnswer.selectedInstance;
}
