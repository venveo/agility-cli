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

inquirer.registerPrompt('fuzzypath', require('inquirer-fuzzy-path'))

const FormData = require("form-data");

let auth: Auth;
let options: mgmtApi.Options;


export async function pullFiles(instance: any) {
    
    const { guid, websiteName } = instance;

    const locale = await localePrompt();
    const channel = await channelPrompt();
    const preview = await isPreview();
    const baseUrl = await getBaseURLfromGUID(guid);
    const elements:any = await elementsPrompt();
    const action:any = await pullPrompt(guid);
    
    // now handle the actions
    switch (action) {
      case "Download":
        downloadFiles(guid, locale, channel, baseUrl, preview, elements);
        break;
      case "Push to another instance":
        let pushToInstance = await instanceSelector();
        console.log('🚀 ','Pushing ', guid, 'to ➡️', pushToInstance.guid);
        break;
      case "< Back to Home":
        homePrompt();
        break;
      default:
        break;
    }
}


async function downloadFiles(guid: string, locale: any, channel: any, baseUrl: any | null, isPreview: any, elements: any) {
    auth = new Auth();
    let code = new fileOperations();
    let codeFileStatus = code.codeFileExists();

    if(codeFileStatus){
        code.cleanup(`.agility-files/${guid}/${isPreview ? "preview" : "live"}`); 

        let data = JSON.parse(code.readTempFile('code.json'));

        const form = new FormData();
        form.append('cliCode', data.code);
        
        // let guid: string = guid as string;
        let userBaseUrl: string = baseUrl as string;
        let token = await auth.cliPoll(form, guid);
        let multibar = createMultibar({name: 'Pull'});

        options = new mgmtApi.Options();
        options.token = token.access_token;

        let user = await auth.getUser(guid, token.access_token);

        if(user){
            let permitted = await auth.checkUserRole(guid, token.access_token);
            if(permitted){

                const base = auth.determineBaseUrl(guid);
                let previewKey = await auth.getPreviewKey(guid, userBaseUrl ? userBaseUrl : base);
                let fetchKey = await auth.getFetchKey(guid, userBaseUrl ? userBaseUrl : base)
                let syncKey = isPreview ? previewKey : fetchKey;


                // we need to make sure the base folder exists for this pull request
                code.createFolder(`/${guid}/${locale}/${isPreview ? 'preview' : 'live'}`);
      
                if(syncKey){
                    console.log(colors.yellow(`Downloading your instance to ${process.cwd()}/.agility-files/${guid}/${locale}/${isPreview ? 'preview' : 'live'}`));

                    let contentPageSync = new sync(guid, syncKey, locale, channel, options, multibar, isPreview);
                    let assetsSync = new asset(options, multibar);
                    let containerSync = new container(options, multibar);
                    let modelSync = new model(options, multibar);

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
                    console.log(colors.green('✅ Download complete!'));
                    homePrompt();


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
