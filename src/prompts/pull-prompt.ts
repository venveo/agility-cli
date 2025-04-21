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
import { syncNew } from "../sync_new";
import { containerNew } from "../container_new";
import { assetNew } from "../asset_new";
import { modelNew } from "../model_new";
import { AgilityInstance } from "../types/instance";
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';

inquirer.registerPrompt('fuzzypath', require('inquirer-fuzzy-path'))

const FormData = require("form-data");

let auth: Auth;
let options: mgmtApi.Options;


export async function pullFiles(selectedInstance: AgilityInstance) {
    const code = new fileOperations();
    const { guid } = selectedInstance;
    const baseUrl = await getBaseURLfromGUID(guid);

    const locale = await localePrompt(selectedInstance);
    const channel = await channelPrompt();
    const preview = await isPreviewPrompt();
    const elements:any = await elementsPrompt();

  
    return downloadFiles(guid, locale, channel, baseUrl, preview, elements);
}


async function downloadFiles(guid: string, locale: any, channel: any, baseUrl: any | null, isPreview: any, elements: any) {
    auth = new Auth();
    let code = new fileOperations();
        
        let userBaseUrl: string = baseUrl as string;
        let multibar = createMultibar({name: 'Pull'});

        options = new mgmtApi.Options();
        options.token = await auth.getToken();
        options.baseUrl = auth.determineBaseUrl(guid);

        let user = await auth.getUser(guid);

        const fullPath = `agility-files/${guid}/${locale}/${isPreview ? 'preview' : 'live'}`;
        
        try {
            if (!fs.existsSync('agility-files')) {
                await fsPromises.mkdir('agility-files');
            }
            
            await fsPromises.mkdir(fullPath, { recursive: true });
            
        } catch (error) {
            console.error('Error creating directories:', error);
            throw error;
        }
        
        if(user){
            let permitted = await auth.checkUserRole(guid);
            if(permitted){

                const base = auth.determineBaseUrl(guid);

                let previewKey = await auth.getPreviewKey(guid, userBaseUrl ? userBaseUrl : base);
                let fetchKey = await auth.getFetchKey(guid, userBaseUrl ? userBaseUrl : base)
                let syncKey = isPreview ? previewKey : fetchKey;


                if(syncKey){
                    console.log(colors.yellow(`\n Downloading your instance to ${process.cwd()}/agility-files/${guid}/${locale}/${isPreview ? 'preview' : 'live'}`));

                    let contentPageSync = new syncNew(guid, syncKey, locale, channel, options, multibar, isPreview);
                    let assetsSync = new assetNew(options, multibar);
                    let containerSync = new containerNew(options, multibar);
                    let modelSync = new modelNew(options, multibar);

                    const syncTasks = [];

                    if(elements.includes('Pages')){
                        syncTasks.push(contentPageSync.sync(guid, locale, isPreview));
                    }

                    if(elements.includes('Models')){
                        syncTasks.push(modelSync.getModels(guid, locale, isPreview));
                    }

                    if(elements.includes('Content Lists')){
                        syncTasks.push(containerSync.getContainers(guid, locale, isPreview));
                    }

                    if(elements.includes('Assets')){
                        syncTasks.push(assetsSync.getAssets(guid, locale, isPreview));
                    }

                    if(elements.includes('Galleries')){
                        syncTasks.push(assetsSync.getGalleries(guid, locale, isPreview));
                    }


                    await Promise.all(syncTasks);
                    
                    multibar.stop()
                    // await new Promise(resolve => setTimeout(resolve, 500));
                    console.log(colors.green('\n✅ Download complete!\n'));
                    
                    return true;


                }
                else{
                    console.log(colors.red('Either the preview key is not present in your instance or you need to specify the baseUrl parameter as an input based on the location. Please refer the docs for the Base Url.'));
                }

            }
            else{
                console.log(colors.red('You do not have required permissions on the instance to perform the pull operation.'));
            }

        }
        else{
            console.log(colors.red('Please authenticate first to perform the pull operation.'));
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
