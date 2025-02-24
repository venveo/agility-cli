import * as agilitySync from '@agility/content-sync';
import * as mgmtApi  from '@agility/management-sdk';
import { fileOperations } from './fileOperations';
import * as cliProgress from 'cli-progress';
const fs = require('fs');
const path = require('path');


export class sync{
     _guid: string;
     _apiKey: string;
     _locale: string;
     _channel: string;
     _options : mgmtApi.Options;
     _multibar: cliProgress.MultiBar;
     _isPreview: boolean;

     constructor(guid: string, apiKey: string, locale: string, channel: string, options: mgmtApi.Options, multibar: cliProgress.MultiBar, isPreview: boolean){
        this._guid = guid;
        this._apiKey = apiKey;
        this._locale = locale;
        this._channel = channel;
        this._options = options;
        this._multibar = multibar;
        this._isPreview = isPreview;
     }

   async sync(guid: string, locale: string, isPreview: boolean = true){
      
      this._guid = guid;
      this._isPreview = isPreview;
      this._locale = locale;

      let syncClient = agilitySync.getSyncClient({
        guid: this._guid,
        apiKey: this._apiKey,
        languages: [`${this._locale}`],
        channels: [`${this._channel}`],
        isPreview: this._isPreview
      })

      await syncClient.runSync();

      // we need to move these files to the correct location
      const sourceDir = path.join('.agility-files', this._locale);
      const destDir = path.join('.agility-files', this._guid);

      if (!fs.existsSync(destDir)) {
         fs.mkdirSync(destDir, { recursive: true });
      }

      // move the sync files to the correct location
      fs.readdirSync(sourceDir).forEach(file => {
         const sourceFile = path.join(sourceDir, file);
         const destFile = path.join(destDir, file);
         if (fs.lstatSync(sourceFile).isDirectory()) {
         fs.mkdirSync(destFile, { recursive: true });
         fs.readdirSync(sourceFile).forEach(subFile => {
            fs.renameSync(path.join(sourceFile, subFile), path.join(destFile, subFile));
         });
         } else {
         fs.renameSync(sourceFile, destFile);
         }
      });

      // remove the .agility-files/{locale} folder
      await fs.rmSync(sourceDir, { recursive: true, force: true });


      await this.getPageTemplates();

      await this.getPages();
   }

     async getPageTemplates(baseFolder?: string){
      if(baseFolder === undefined || baseFolder === ''){
         baseFolder = `.agility-files/${this._guid}/${this._locale}/${this._isPreview ? 'preview' : 'live'}`;
      }
      let apiClient = new mgmtApi.ApiClient(this._options);
      try{
         let pageTemplates = await apiClient.pageMethods.getPageTemplates(this._guid, this._locale, true);

         const progressBar0 = this._multibar.create(pageTemplates.length, 0);
         progressBar0.update(0, {name : 'Templates'});
         let index = 1;

         let fileExport = new fileOperations();

         for(let i = 0; i < pageTemplates.length; i++){
            let template = pageTemplates[i];
            progressBar0.update(index);
            index += 1;
            fileExport.exportFiles(`templates`, template.pageTemplateID, template, baseFolder);
         }
      } catch{

      }
      
     }

     async getPages(){
      let apiClient = new mgmtApi.ApiClient(this._options);

      let fileOperation = new fileOperations();
      if(fileOperation.folderExists(`${this._guid}/${this._locale}/${this._isPreview ? 'preview':'live'}/page`)){
         let files = fileOperation.readDirectory(`${this._guid}/${this._locale}/${this._isPreview ? 'preview':'live'}/page`);

         const progressBar01 = this._multibar.create(files.length, 0);
         progressBar01.update(0, {name : 'Modifying Page Object'});
         let index = 1;

         for(let i = 0; i < files.length; i++){
            let pageItem = JSON.parse(files[i]) as mgmtApi.PageItem;

            progressBar01.update(index);
            index += 1;

            try{
               let page = await apiClient.pageMethods.getPage(pageItem.pageID, this._guid, this._locale);

               fileOperation.exportFiles(`${this._guid}/${this._locale}/${this._isPreview ? 'preview':'live'}/pages`, page.pageID, page);
            } catch{

            }
         }
      }
      
     }
}
