import inquirer from "inquirer";
import { Auth } from "../../auth";
import { fileOperations } from "../../fileOperations";
import { homePrompt } from "../home";

import * as mgmtApi from "@agility/management-sdk";
import { fetchAPIPrompt } from "../fetch";
const FormData = require("form-data");

let options: mgmtApi.Options;
let instancePermission: mgmtApi.InstancePermission;
// import inquirerPrompt from 'inquirer-select-search';

export async function instancesPrompt(selectedInstance, keys) {
  inquirer.registerPrompt("search-list", require("inquirer-search-list"));
  const choices = [
    new inquirer.Separator(),
    "Fetch API",
    new inquirer.Separator(),
    "Generate .env.local",
    "Generate sitemap.xml",
    new inquirer.Separator(),
    "< Back to Home",
  ];

  const questions = [
    {
      type: "list",
      name: "instanceAction",
      message: "Select an action:",
      choices: choices,
    },
  ];

  const answers = await inquirer.prompt(questions);

  if (answers.instanceAction === "generate_env_local") {
    console.log("Generating .env.local file");
  } else if (answers.instanceAction === "< Back to Home") {
    console.log("Going back to home");
    homePrompt();
  } else if (answers.instanceAction === "Fetch API") {
    await fetchAPIPrompt(selectedInstance, keys);
    
  }
}

export async function getInstance(selectedInstance: any) {
  let auth = new Auth();
  let code = new fileOperations();
  let codeFileStatus = code.codeFileExists();

  if (!codeFileStatus) {
    console.log("Please authenticate first to perform the operation.");
    return;
  }

  let data = JSON.parse(code.readTempFile("code.json"));
  let guid: string = selectedInstance.guid as string;
  let userBaseUrl: string = null;
  // let formData = new FormData();
  const form = new FormData();
  form.append("cliCode", data.code);
  let token = await auth.cliPoll(form, guid);
  options = new mgmtApi.Options();
  options.token = token.access_token;

  let user = await auth.getUser(guid, token.access_token);
  if (!user) {
    console.log("Please authenticate first to perform the operation.");
    return;
  }

  let permitted = await auth.checkUserRole(guid, token.access_token);
  if (!permitted) {
    console.log(
      "You do not have required permissions on the instance to perform the operation."
    );
    return;
  }

  let apiClient = new mgmtApi.ApiClient(options);
  const instance = await apiClient.instanceUserMethods.getUsers(guid);
  let currentWebsite = user.websiteAccess.find(
    (website: any) => website.guid === guid
  );

  const websiteDetails = {
    ...instance,
    ...currentWebsite,
  }


//   console.log(currentWebsite);

  const base = auth.determineBaseUrl(guid);
  let previewKey = await auth.getPreviewKey(
    guid,
    userBaseUrl ? userBaseUrl : base
  );
  let fetchKey = await auth.getFetchKey(guid, userBaseUrl ? userBaseUrl : base);

  return {
    guid,
    previewKey,
    fetchKey,
    websiteDetails,
  };
}
