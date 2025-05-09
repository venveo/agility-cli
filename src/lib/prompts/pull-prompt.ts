import inquirer from "inquirer";    
import colors from "ansi-colors";
import { Auth } from "../services/auth";
import { createMultibar } from "../services/multibar";

import * as mgmtApi from "@agility/management-sdk";
import { fileOperations } from "../services/fileOperations";
import { localePrompt } from "./locale-prompt";
import { channelPrompt } from "./channel-prompt";
import { getBaseURLfromGUID } from "./base-url-prompt";
import { isPreviewPrompt } from "./isPreview-prompt";
import { elementsPrompt } from "./elements-prompt";
import { AgilityInstance } from "../../types/instance";
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import { Pull } from "../services/pull";
import * as path from 'path';
import rootPathPrompt from "./root-path-prompt";

inquirer.registerPrompt('fuzzypath', require('inquirer-fuzzy-path'))

const FormData = require("form-data");

let auth: Auth;
let options: mgmtApi.Options;


export async function pullFiles(selectedInstance: AgilityInstance, useBlessedUI: boolean) {
    const { guid } = selectedInstance;
    const baseUrl = await getBaseURLfromGUID(guid);
    const locale = await localePrompt(selectedInstance);
    const channel = await channelPrompt();
    const preview = await isPreviewPrompt();
    const rootPath = await rootPathPrompt();
    const elements:any = await elementsPrompt();

    return await downloadFiles(guid, locale, channel, baseUrl, preview, elements, rootPath, useBlessedUI);
}


async function downloadFiles(guid: string, locale: any, channel: any, baseUrl: any | null, isPreview: any, elements: any, rootPath: string, useBlessedUI: boolean) {
    auth = new Auth();
    let userBaseUrl: string = baseUrl as string;
    
    let multibar = null; // createMultibar({name: 'Pull'});

    options = new mgmtApi.Options();
    options.token = await auth.getToken();
    // options.baseUrl = auth.determineBaseUrl(guid); // Pull service might determine this based on flags/env

    let user = await auth.getUser(guid);

    const instanceFilesParentPath = '.'; // Relative to CWD
    const fullPath = path.join(instanceFilesParentPath, rootPath, guid, locale, isPreview ? 'preview':'live');
        
    try {
        const rootDir = path.join(instanceFilesParentPath, rootPath);
        if (!fs.existsSync(rootDir)) {
            await fsPromises.mkdir(rootDir);
            console.log(`Created directory: ${rootDir}`);
        }
        await fsPromises.mkdir(fullPath, { recursive: true });
            
    } catch (error) {
        console.error('Error creating directories:', error);
        throw error;
    }
        
    if(user){
        const apiBaseUrl = userBaseUrl || auth.determineBaseUrl(guid);
        let previewKey = await auth.getPreviewKey(guid, apiBaseUrl);
        let fetchKey = await auth.getFetchKey(guid, apiBaseUrl);
        let apiKeyForPull = isPreview ? previewKey : fetchKey;

        if(apiKeyForPull){
            // Message handled by Pull service now based on mode
            // console.log(colors.yellow(`\nDownloading your instance to ${process.cwd()}/${fullPath}`));

            const pullOperation = new Pull(
                guid,
                apiKeyForPull,
                locale,
                channel,
                isPreview,
                options,
                multibar, // Pass null, Pull service uses flags
                elements,
                rootPath, // Pass the root path name itself (e.g., agility-files)
                false, // Assuming legacyFolders is false unless specified elsewhere
                useBlessedUI, // Pass the flag determining blessed UI use
                false, // Assuming headless is false unless specified (comes from index.ts)
                false // Assuming verbose is false unless specified (comes from index.ts)
                // If pullFiles needs to respect headless/verbose, those flags need to be passed down too.
            );

            try {
                await pullOperation.pullInstance();
                return true;
            } catch (pullError) {
                // Pull service now logs errors based on mode
                // console.error(colors.red('\n❌ Download failed during pull operation:'), pullError);
                return false;
            }

        } else {
            console.log(colors.red('Either the preview key is not present in your instance or you need to specify the baseUrl parameter as an input based on the location. Please refer the docs for the Base Url.'));
            return false;
        }
    } else {
        console.log(colors.red('Please authenticate first to perform the pull operation.'));
        return false;
    }
}

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
