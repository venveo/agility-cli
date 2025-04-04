import inquirer from "inquirer";
import { Auth } from "../auth";
import { fileOperations } from "../fileOperations";
import { homePrompt } from "./home-prompt";

import * as mgmtApi from "@agility/management-sdk";
import { fetchAPIPrompt } from "./fetch-prompt";
import { pullFiles } from "./pull-prompt";
import generateTypes from "./utilities/generate-typescript-models";
import { pushFiles, syncFiles } from "./push-prompt";
import Clean from "./instances/clean";
import { localePrompt } from "./locale-prompt";
import ansiColors from "ansi-colors";
import { generateEnv } from "./utilities/generate-env";
import { generateSitemap } from "./utilities/generate-sitemap";
const FormData = require("form-data");

let options: mgmtApi.Options;
let instancePermission: mgmtApi.InstancePermission;
// import inquirerPrompt from 'inquirer-select-search';

export async function instancesPrompt(selectedInstance, keys) {
  inquirer.registerPrompt("search-list", require("inquirer-search-list"));
  const choices = [
    new inquirer.Separator(),
    "Download assets, models & content from an instance",
    "Push local assets, models & content to an instance",
    // "Sync to another instance",
    new inquirer.Separator(),
    "Clean instance (warning)",
    // "Clone this instance to another instance",
    // "Fetch API", // in development
    new inquirer.Separator(),
    "Generate .env.local",
    "Generate sitemap.xml", // in development
    "Generate TypeScript interfaces (beta)",
    "Generate React Components (beta)",
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

  if (answers.instanceAction === "Download assets, models & content from an instance") {
    console.log("Downloading assets, models & content from the instance");
    pullFiles(selectedInstance);
    // Add your logic here
  } else if (answers.instanceAction === "Push local assets, models & content to an instance") {
    console.log("Pushing local assets, models & content to the instance");
    pushFiles(selectedInstance);
  
  } else if(answers.instanceAction === "Sync to another instance") {
    console.log("Syncing to another instance");
    // Add
    syncFiles(selectedInstance);

  } else if(answers.instanceAction === "Clean instance (warning)") {

    const locale = await localePrompt();

    const clean = new Clean(selectedInstance, locale);
    const cleaned = await clean.cleanAll();

    if(cleaned){
      setTimeout(() => {
        console.log('\n')
        console.log(ansiColors.green("🗑️ Instance cleaned successfully"));
        console.log('\n') 
        homePrompt();
      }, 1000);
    }

   
    // Add your logic here
  } else if (answers.instanceAction === "Clone this instance to another instance") {
    console.log("Cloning this instance to another instance");
    // Add your logic here
  } else if (answers.instanceAction === "Fetch API") {
    await fetchAPIPrompt(selectedInstance, keys);
  } else if (answers.instanceAction === "Generate .env.local") {
    console.log("Generating .env.local file");
    await generateEnv(keys);
    // Add your logic here
  } else if (answers.instanceAction === "Generate sitemap.xml") {
    console.log("Generating sitemap.xml");
    await generateSitemap(selectedInstance, keys);
    // Add your logic here
  } else if (answers.instanceAction === "Generate TypeScript interfaces") {
    console.log("Generating TypeScript interfaces");

    await generateTypes(selectedInstance);
    // Add your logic here
  } else if (answers.instanceAction === "< Back to Home") {
    console.log("Going back to home");
    homePrompt();
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
