import { Auth } from "../../auth";
import { fileOperations } from "../../fileOperations";
import { localePrompt } from "../locale-prompt";
import { baseUrlPrompt } from "../base-url-prompt";
import { isPreviewPrompt } from "../isPreview-prompt";
import { homePrompt } from "../home-prompt";
import { instanceSelector } from "../instances/instance-list";
import { channelPrompt } from "../channel-prompt";
import { getInstance } from "../instance-prompt";
import fileSystemPrompt from "../file-system-prompt";
import { AgilityInstance } from "../../types/instance";
const FormData = require("form-data");
const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');

export async function generateEnv(selectedInstance?: AgilityInstance) {

    let selected = selectedInstance;
    if(!selectedInstance){
        selected = await instanceSelector();
    }

    const i = await getInstance(selected);
    
    const locale = await localePrompt(selected);
    const channel = await channelPrompt();
    

    const filesPath = await fileSystemPrompt();
    
    let instance = {
        guid: i.guid,
        previewKey: i.previewKey,
        fetchKey: i.fetchKey,
        locale: locale,
        channel: channel
    }

    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
        const { overwrite } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'overwrite',
                message: '.env.local file already exists. Do you want to overwrite it?',
                default: false
            }
        ]);

        if (!overwrite) {
            console.log('Operation cancelled by the user.');
            return;
        }
    }


    const envContent = `AGILITY_GUID=${instance.guid}\nAGILITY_API_FETCH_KEY=${instance.fetchKey}\nAGILITY_API_PREVIEW_KEY=${instance.previewKey}\nAGILITY_LOCALES=${instance.locale}\nAGILITY_SITEMAP=${instance.channel}`;

    fs.writeFileSync(path.join(filesPath, '.env.local'), envContent.trim());
    console.log('\x1b[32mSuccessfully generated .env.local file\x1b[0m');
    return true;
}