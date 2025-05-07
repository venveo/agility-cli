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

inquirer.registerPrompt('fuzzypath', require('inquirer-fuzzy-path'))

const FormData = require("form-data");

let auth: Auth;
let options: mgmtApi.Options;


export async function pullFiles(selectedInstance: AgilityInstance) {
    const { guid } = selectedInstance;
    const baseUrl = await getBaseURLfromGUID(guid);
    const locale = await localePrompt(selectedInstance);
    const channel = await channelPrompt();
    const preview = await isPreviewPrompt();
    const elements:any = await elementsPrompt();

    return await downloadFiles(guid, locale, channel, baseUrl, preview, elements);
}


async function downloadFiles(guid: string, locale: any, channel: any, baseUrl: any | null, isPreview: any, elements: any) {
    auth = new Auth();
    let userBaseUrl: string = baseUrl as string;
    let multibar = createMultibar({name: 'Pull'});

    options = new mgmtApi.Options();
    options.token = await auth.getToken();
    options.baseUrl = auth.determineBaseUrl(guid);

    let user = await auth.getUser(guid);

    const instanceFilesParentPath = '.';
    const fullPath = path.join(instanceFilesParentPath, `agility-files/${guid}/${locale}/${isPreview ? 'preview' : 'live'}`);
        
    try {
        if (!fs.existsSync(path.join(instanceFilesParentPath, 'agility-files'))) {
            await fsPromises.mkdir(path.join(instanceFilesParentPath, 'agility-files'));
        }
        await fsPromises.mkdir(fullPath, { recursive: true });
            
    } catch (error) {
        console.error('Error creating directories:', error);
        throw error;
    }
        
    if(user){
        const base = auth.determineBaseUrl(guid);
        let previewKey = await auth.getPreviewKey(guid, userBaseUrl ? userBaseUrl : base);
        let fetchKey = await auth.getFetchKey(guid, userBaseUrl ? userBaseUrl : base)
        let apiKeyForPull = isPreview ? previewKey : fetchKey;

        if(apiKeyForPull){
            console.log(colors.yellow(`\nDownloading your instance to ${process.cwd()}/${fullPath}`));

            const pullOperation = new Pull(
                guid,
                apiKeyForPull,
                locale,
                channel,
                isPreview,
                options,
                multibar,
                elements,
                "agility-files"
            );

            try {
                await pullOperation.pullInstance();
                console.log(colors.green('\n✅ Download complete!\n'));
                return true;
            } catch (pullError) {
                console.error(colors.red('\n❌ Download failed during pull operation:'), pullError);
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
