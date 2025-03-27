import inquirer from "inquirer";
import fuzzy from "fuzzy";
import colors from "ansi-colors";
import { instanceSelector } from "./instances/selector";
import { homePrompt } from "./home";
import { Auth } from "../auth";
import { model } from "../model";
import { sync } from "../sync";
import { asset } from "../asset";
import { container } from "../container";
import { createMultibar } from "../multibar";

import * as mgmtApi from "@agility/management-sdk";
import { fileOperations } from "../fileOperations";
import { get } from "http";
import { localePrompt } from "./locale";
import { channelPrompt } from "./channel";
import { baseUrlPrompt, getBaseURLfromGUID } from "./base-url";
import { isPreview } from "./isPreview";
import { elementsPrompt } from "./elements";
import { push } from "../push";

inquirer.registerPrompt("fuzzypath", require("inquirer-fuzzy-path"));

const FormData = require("form-data");

let auth: Auth;
let options: mgmtApi.Options;

export async function pushFiles(instance: any) {
  const { guid, websiteName } = instance;

  const targetInstance = await instanceSelector();
  const locale = await localePrompt();
  const channel = await channelPrompt();
  const preview = await isPreview();

  let code = new fileOperations();
  auth = new Auth();
  let codeFileStatus = code.codeFileExists();

  if (codeFileStatus) {
    let agilityFolder = code.cliFolderExists();
    if (agilityFolder) {
      let data = JSON.parse(code.readTempFile("code.json"));

      let multibar = createMultibar({ name: "Push" });

      const form = new FormData();
      form.append("cliCode", data.code);

      let token = await auth.cliPoll(form, guid);

      options = new mgmtApi.Options();
      options.token = token.access_token;

      let user = await auth.getUser(guid, token.access_token);
      if (user) {
        let permitted = await auth.checkUserRole(guid, token.access_token);
        if (permitted) {
          console.log(colors.yellow("Pushing your instance..."));
          let pushSync = new push(options, multibar);
        

          pushSync.pushInstance(guid, targetInstance.guid, locale, preview);
        
        
        } else {
          console.log(
            colors.red(
              "You do not have required permissions on the instance to perform the push operation."
            )
          );
        }
      } else {
        console.log(
          colors.red("Please authenticate first to perform the push operation.")
        );
      }
    } else {
      console.log(
        colors.red("Please pull an instance first to push an instance.")
      );
    }
  } else {
    console.log(
      colors.red("Please authenticate first to perform the push operation.")
    );
  }
}


export async function syncFiles(instance: any) {
    const { guid, websiteName } = instance;
  
    const targetInstance = await instanceSelector();
    const locale = await localePrompt();
    const channel = await channelPrompt();
    const preview = await isPreview();
  
    let code = new fileOperations();
    auth = new Auth();
    let codeFileStatus = code.codeFileExists();
  
    if (codeFileStatus) {
      let agilityFolder = code.cliFolderExists();
      if (agilityFolder) {
        let data = JSON.parse(code.readTempFile("code.json"));
  
        let multibar = createMultibar({ name: "Push" });
  
        const form = new FormData();
        form.append("cliCode", data.code);
  
        let token = await auth.cliPoll(form, guid);
  
        options = new mgmtApi.Options();
        options.token = token.access_token;
  
        let user = await auth.getUser(guid, token.access_token);
        if (user) {
          let permitted = await auth.checkUserRole(guid, token.access_token);
          if (permitted) {
            console.log(colors.yellow("Pushing your instance..."));
            let pushSync = new push(options, multibar);
          
            pushSync.syncInstance(guid, targetInstance.guid, locale, preview);
          
          
          } else {
            console.log(
              colors.red(
                "You do not have required permissions on the instance to perform the push operation."
              )
            );
          }
        } else {
          console.log(
            colors.red("Please authenticate first to perform the push operation.")
          );
        }
      } else {
        console.log(
          colors.red("Please pull an instance first to push an instance.")
        );
      }
    } else {
      console.log(
        colors.red("Please authenticate first to perform the push operation.")
      );
    }
  }

async function pullPrompt(guid: string) {
  const instanceOptions = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "What would you like to do with this instance?",
      choices: [
        "Download",
        "Push to another instance",
        new inquirer.Separator(),
        "< Back to Home",
      ],
    },
  ]);

  return instanceOptions.action;
}
