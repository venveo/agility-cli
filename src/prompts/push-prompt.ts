import inquirer from "inquirer";
import fuzzy from "fuzzy";
import colors from "ansi-colors";
import { instanceSelector } from "./instances/instance-list";
import { homePrompt } from "./home-prompt";
import { Auth } from "../auth";
import { model } from "../model";
import { sync } from "../sync";
import { asset } from "../asset";
import { container } from "../container";
import { createMultibar } from "../multibar";

import * as mgmtApi from "@agility/management-sdk";
import { fileOperations } from "../fileOperations";
import { get } from "http";
import { localePrompt } from "./locale-prompt";
import { channelPrompt } from "./channel-prompt";
import { baseUrlPrompt, getBaseURLfromGUID } from "./base-url-prompt";
import { isPreviewPrompt } from "./isPreview-prompt";
import { elementsPrompt } from "./elements-prompt";
import { push } from "../push";
import { pushNew } from "../push_new";
import { AgilityInstance } from "../types/instance";
import { forceDevMode, forceLocalMode } from "../index";

inquirer.registerPrompt("fuzzypath", require("inquirer-fuzzy-path"));

const FormData = require("form-data");

let auth: Auth;
let options: mgmtApi.Options;

export async function pushFiles(instance: any) {
  const { guid, websiteName } = instance;


  const selectedInstance: AgilityInstance = forceLocalMode || forceDevMode ? {
    guid: '95dc2671-d', 
    previewKey: '', 
    fetchKey: '',
    websiteDetails: {
      orgCode: null,
      orgName: null,
      websiteName: null,
      websiteNameStripped: null,
      displayName: null,
      guid: '95dc2671-d',
      websiteID: null,
      isCurrent: null,
      managerUrl: null,
      version: null,
      isOwner: null,
      isDormant: null,
      isRestoring: null
    }
  } : await instanceSelector();
  (forceLocalMode || forceDevMode) ?? console.log('Auto-selected target instance: ', selectedInstance.guid);
  // selectedInstance: AgilityInstance = await instanceSelector();
  const locale = await localePrompt(selectedInstance);
  const preview = await isPreviewPrompt();

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
    let push = new pushNew(options, multibar, guid, selectedInstance.guid, locale, preview);
    await push.initialize();
    push.pushInstance();
  } else {
    console.log(colors.red("Please pull an instance first to push an instance."));
  }
}

// export async function syncFiles(instance: any) {
//     const { guid, websiteName } = instance;

//     const selectedInstance:AgilityInstance = await instanceSelector();
//     const locale = await localePrompt(selectedInstance);
//     const channel = await channelPrompt();
//     const preview = await isPreviewPrompt();

//     let code = new fileOperations();
//     auth = new Auth();
//     let codeFileStatus = code.codeFileExists();

//     if (codeFileStatus) {
//       let agilityFolder = code.cliFolderExists();
//       if (agilityFolder) {
//         let data = JSON.parse(code.readTempFile("code.json"));

//         let multibar = createMultibar({ name: "Push" });

//         const form = new FormData();
//         form.append("cliCode", data.code);

//         let token = await auth.cliPoll(form, guid);

//         options = new mgmtApi.Options();
//         options.token = token.access_token;

//         let user = await auth.getUser(guid);
//         if (user) {
//           let permitted = await auth.checkUserRole(guid);
//           if (permitted) {
//             console.log(colors.yellow("Pushing your instance..."));
//             let pushSync = new pushNew(options, multibar, guid, selectedInstance.guid, locale, preview);

//             // pushSync.syncInstance();

//           } else {
//             console.log(
//               colors.red(
//                 "You do not have required permissions on the instance to perform the push operation."
//               )
//             );
//           }
//         } else {
//           console.log(
//             colors.red("Please authenticate first to perform the push operation.")
//           );
//         }
//       } else {
//         console.log(
//           colors.red("Please pull an instance first to push an instance.")
//         );
//       }
//     } else {
//       console.log(
//         colors.red("Please authenticate first to perform the push operation.")
//       );
//     }
//   }

async function pullPrompt(guid: string) {
  const instanceOptions = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "What would you like to do with this instance?",
      choices: ["Download", "Push to another instance", new inquirer.Separator(), "< Back to Home"],
    },
  ]);

  return instanceOptions.action;
}
