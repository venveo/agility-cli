import inquirer from "inquirer";
import { Auth } from "../auth";
import { homePrompt } from "./home-prompt";
import { fetchAPIPrompt, fetchCommandsPrompt } from "./fetch-prompt";
import { pullFiles } from "./pull-prompt";
import generateTypes from "./utilities/generate-typescript-models";
import { pushFiles } from "./push-prompt";
import Clean from "./instances/clean";
import { localePrompt } from "./locale-prompt";
import { generateEnv } from "./utilities/generate-env";
import { generateSitemap } from "./utilities/generate-sitemap";
import generateReactComponents from "./utilities/generate-components";
import { AgilityInstance } from "../types/instance";
const FormData = require("form-data");

inquirer.registerPrompt("search-list", require("inquirer-search-list"));

export async function instancesPrompt(selectedInstance: AgilityInstance, keys) {
  const choices = [
    new inquirer.Separator(),
    { name: "Download assets, models & content from an instance", value: "pull" },
    { name: "Push local assets, models & content to an instance", value: "push" },
    { name: "Sync models to an instance", value: "syncModels" },
    new inquirer.Separator(),
    { name: "Fetch API", value: "fetch" },
    new inquirer.Separator(),
    { name: "Generate .env.local", value: "env" },
    { name: "Generate sitemap.xml", value: "sitemap" },
    { name: "Generate TypeScript interfaces (beta)", value: "types" },
    { name: "Generate React Components (beta)", value: "reactcomponents" },
    new inquirer.Separator(),
    { name: "Clean instance (warning: data loss)", value: "clean" },
    new inquirer.Separator(),
    { name: "< Back to Home", value: "home" },
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

  switch (answers.instanceAction) {
    case "pull":
      const pullResult = await pullFiles(selectedInstance);
      if (pullResult) {
        homePrompt();
      }
      break;
    case "push":
      pushFiles(selectedInstance);
      break;
    case "syncModels":


    console.log('not sure what to do here yet')
      // const syncModels = await syncModelsPrompt(selectedInstance);
      // if (syncModels) {
        // homePrompt();
      // }
      break;

    case "fetch":
      const fetch = await fetchAPIPrompt(selectedInstance, keys);
      if (fetch) {
        homePrompt();
      }
      break;
    case "env":
      const generatedEnv = await generateEnv(keys);
      if (generatedEnv) {
        homePrompt();
      }
      break;
    case "sitemap":
      const generatedSitemap = await generateSitemap(selectedInstance, keys);
      if (generatedSitemap) {
        homePrompt();
      }
      break;
    case "types":
      await generateTypes(selectedInstance);
      break;
    case "reactcomponents":
      const generatedComponents = await generateReactComponents(selectedInstance);
      if (generatedComponents) {
        homePrompt();
      }
      break;
    case "clean":
      const locale = await localePrompt(selectedInstance);
      const clean = new Clean(selectedInstance, locale);
      const cleaned = await clean.cleanAll();
      if (cleaned) {
        homePrompt();
      }
      break;
    case "home":
      homePrompt();
      break;
    default:
      console.log("Invalid action selected.");
  }
}

export async function getInstance(selectedInstance: AgilityInstance) {
  const auth = new Auth();

  let guid: string = selectedInstance.guid as string;

  let user = await auth.getUser(guid);
  if (!user) {
    console.log("Please authenticate first to perform the operation.");
    return;
  }

  let permitted = await auth.checkUserRole(guid);

  if (!permitted) {
    console.log("You do not have required permissions on the instance to perform the operation.");
    return;
  }

  try {
    let currentWebsite = user.websiteAccess.find((website: any) => website.guid === guid);

    let previewKey = await auth.getPreviewKey(guid);
    let fetchKey = await auth.getFetchKey(guid);

    return {
      guid,
      previewKey,
      fetchKey,
      currentWebsite,
    };
    
  } catch (error) {
    // Handle error
    return null;
  }
}
