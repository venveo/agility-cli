import inquirer from 'inquirer';
import { localePrompt } from './locale-prompt';
import { channelPrompt } from './channel-prompt';
import { isPreview } from './isPreview-prompt';
import { baseUrlPrompt, getBaseURLfromGUID } from './base-url-prompt';
import agilitySDK from '@agility/content-fetch'
import process from 'process';

import { fileOperations } from "../fileOperations";
import { exec } from 'child_process';
import { homePrompt } from './home-prompt';
import { instancesPrompt } from './instance-prompt';

export async function fetchCommandsPrompt(selectedInstance: any, keys: any, guid: string, locale: string, channel: string, isPreview: boolean, baseUrl: string, apiKey: string) {      
    
    let files = new fileOperations();
    const api = agilitySDK.getApi({
        guid,
        apiKey,
        isPreview
        // baseUrl: baseUrl ? baseUrl : null
    });
    const choices = [
        'getSitemapFlat',
        'getSitemapNested',
        'getContentList',
        'getContentItem',
        'getPage',
        'getPageByPath',
        new inquirer.Separator(),
        '< Back to Instance',
        new inquirer.Separator()
    ];

    const answer = await inquirer.prompt([
        {
            type: 'list',
            name: 'apiMethod',
            message: 'Select an API method:',
            choices: choices
        }
    ]);

    if(answer.apiMethod === 'getSitemapFlat') {
        console.log('Fetching sitemap...');

        const sitemap = await api.getSitemapFlat({
            channelName: channel,
            languageCode: locale.toLowerCase()
        });

        files.createFile(`.agility-files/${guid}/${locale}/${isPreview ? 'preview':'live'}/sitemapFlat.json`, JSON.stringify(sitemap, null, 2));
        console.log(`Sitemap saved to ${process.cwd()}/.agility-files/${guid}/${locale}/${isPreview ? 'preview':'live'}/sitemapFlat.json`);
        fetchCommandsPrompt(selectedInstance, keys, guid, locale, channel, isPreview, baseUrl, apiKey);

    }
    else if(answer.apiMethod === 'getSitemapNested') {
        console.log('Fetching sitemap...');
        const sitemapNested = await api.getSitemapNested({
            channelName: channel,
            languageCode: locale.toLowerCase()
        });


        files.createFile(`.agility-files/${guid}/${locale}/${isPreview ? 'preview':'live'}/sitemapNested.json`, JSON.stringify(sitemapNested, null, 2));
        console.log(`Sitemap saved to ${process.cwd()}/.agility-files/${guid}/${locale}/${isPreview ? 'preview':'live'}/sitemapNested.json`);
        fetchCommandsPrompt(selectedInstance, keys, guid, locale, channel, isPreview, baseUrl, apiKey);
    }
    else if(answer.apiMethod === 'getContentList') {
        console.log('Fetching content list...');
    }
    else if(answer.apiMethod === 'getContentItem') {
        console.log('Fetching content item...');
    }
    else if(answer.apiMethod === 'getPage') {
        console.log('Fetching page...');
    }
    else if(answer.apiMethod === 'getPageByPath') {
        console.log('Fetching page by path...');
    } else if (answer.apiMethod === '< Back to Instance') {
        await instancesPrompt(selectedInstance, keys);
        
    }

    // return answer;
}
export async function fetchAPIPrompt(selectedInstance: any, keys: any) {
    
    const guid = selectedInstance.guid;
    const locale = await localePrompt();
    const channel = await channelPrompt();
    const preview = await isPreview();
    const baseUrl = await getBaseURLfromGUID(guid);
    const apiKey = preview ? keys.previewKey : keys.fetchKey;

  
    
    const answer = await fetchCommandsPrompt(selectedInstance, keys, guid, locale, channel, preview, baseUrl, apiKey);

    

    // return answer.apiMethod;
}