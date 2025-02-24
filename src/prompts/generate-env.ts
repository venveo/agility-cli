import { Auth } from "../auth";
import { fileOperations } from "../fileOperations";
import { localePrompt } from "./locale";
import { baseUrlPrompt } from "./base-url";
import { isPreview } from "./isPreview";
import { homePrompt } from "./home";
import { instanceSelector } from "./instances/selector";
import { channelPrompt } from "./channel";
import { getInstance } from "./instances/instance";
const FormData = require("form-data");
const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');

export async function generateEnv() {
    console.log('.env file generated');

    const selectedInstance = await instanceSelector();
    const i = await getInstance(selectedInstance);
    
    const locale = await localePrompt();
    const channel = await channelPrompt();
    
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


    const envContent = `
    AGILITY_GUID=${instance.guid}
    AGILITY_API_FETCH_KEY=${instance.fetchKey}
    AGILITY_API_PREVIEW_KEY=${instance.previewKey}
    AGILITY_LOCALES=${instance.locale}
    AGILITY_SITEMAP=website
    `;

    fs.writeFileSync(path.join(process.cwd(), '.env.local'), envContent.trim());
    console.log(instance)
    console.log('\x1b[32mSuccessfully generated .env file\x1b[0m');

    homePrompt();
}