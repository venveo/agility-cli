import inquirer from "inquirer";
import colors from "ansi-colors";
import { instanceSelector } from "../instances/instance-list";
import { Auth } from "../../auth";
import { createMultibar } from "../../multibar";
import * as mgmtApi from "@agility/management-sdk";
import { fileOperations } from "../../fileOperations";
import { localePrompt } from "./locale-prompt";
import { isPreviewPrompt } from "./isPreview-prompt";
import { pushNew } from "../../push_new";
import { AgilityInstance } from "../../types/instance";
import { blessedUIEnabled } from "../../index";
import { elementsPrompt } from "./elements-prompt";

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

    console.log(colors.yellow("Pushing your instance..."));
    let push = new pushNew(options, multibar, guid, selectedInstance.guid, locale, preview, blessedUIEnabled, elements);
    await push.initialize();
    push.pushInstance();
  } else {
    console.log(colors.red("Please pull an instance first to push an instance."));
  }
}