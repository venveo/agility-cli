import inquirer from "inquirer";
import colors from "ansi-colors";
import { instanceSelector } from "../instances/instance-list";
import { Auth } from "../services/auth";
import { createMultibar } from "../services/multibar";
import * as mgmtApi from "@agility/management-sdk";
import { fileOperations } from "../services/fileOperations";
import { localePrompt } from "./locale-prompt";
import { isPreviewPrompt } from "./isPreview-prompt";
import { AgilityInstance } from "../../types/instance";
import { blessedUIEnabled } from "../../index";
import { elementsPrompt } from "./elements-prompt";
import { push } from "../services/push";
inquirer.registerPrompt("fuzzypath", require("inquirer-fuzzy-path"));

const FormData = require("form-data");

let auth: Auth;
let options: mgmtApi.Options;

export async function pushFiles(instance: any) {
  const { guid } = instance;

  const selectedInstance: AgilityInstance = await instanceSelector();
  const locale = await localePrompt(selectedInstance);
  const preview = await isPreviewPrompt();
  const elements:any = await elementsPrompt('push');

  let code = new fileOperations();
  auth = new Auth();

  let agilityFolder = code.cliFolderExists();
  if (agilityFolder) {
    let multibar = createMultibar({ name: "Push" });

    // Initialize options with token
    options = new mgmtApi.Options();
    let token = await auth.getToken();
    options.token = token;
    options.baseUrl = auth.determineBaseUrl(guid);

    const rootPath = 'agility-files';
    const legacyFolders = false;

    console.log(colors.yellow("Pushing your instance..."));
    let pushOperation = new push(options, multibar, guid, selectedInstance.guid, locale, preview, blessedUIEnabled, elements, rootPath, legacyFolders);
    await pushOperation.initialize();
    await pushOperation.pushInstance();
  } else {
    console.log(colors.red("Please pull an instance first to push an instance."));
  }
}