import * as mgmtApi  from '@agility/management-sdk';
import { fileOperations } from './fileOperations';
import * as cliProgress from 'cli-progress';
import ansiColors from 'ansi-colors';
import path from 'path';


export class containers {
    _options : mgmtApi.Options;
    _multibar: cliProgress.MultiBar;
    _rootPath: string;
    _legacyFolders: boolean;
    private _progressCallback?: (processed: number, total: number, status?: 'success' | 'error' | 'progress') => void;

    constructor(
        options: mgmtApi.Options,
        multibar: cliProgress.MultiBar,
        rootPath: string, 
        legacyFolders: boolean,
        progressCallback?: (processed: number, total: number, status?: 'success' | 'error' | 'progress') => void
        ){
        this._options = options;
        this._multibar = multibar;
        this._rootPath = rootPath;
        this._legacyFolders = legacyFolders;
        this._progressCallback = progressCallback;
    }

    async getContainers(guid: string, locale: string, isPreview: boolean = true){
        let apiClient = new mgmtApi.ApiClient(this._options);
        let successfullyDownloadedCount = 0;
        let totalContainers = 0;

        try{
            const containersList = await apiClient.containerMethods.getContainerList(guid);
            totalContainers = containersList.length;
            
            if (this._progressCallback) {
                this._progressCallback(0, totalContainers, 'progress');
            } else if (totalContainers > 0 && this._multibar && !this._legacyFolders) {
            } 
    
            let fileExport = new fileOperations(this._rootPath, guid, locale, isPreview);
            let containersDestPath: string;

            if (this._legacyFolders) {
                // Legacy mode: exportFiles constructs path like agility-files/guid/locale/mode/containers from relative parts
                // No specific containersDestPath needed here as exportFiles builds it.
            } else {
                // Non-legacy mode: this._rootPath is already agility-files/guid/locale/mode
                // containersDestPath is this._rootPath joined with 'containers'
                containersDestPath = path.join(this._rootPath, 'containers');
                // fs.mkdirSync in exportFiles will handle creating containersDestPath if it doesn't exist.
                // No need for: if (!this._legacyFolders) fileExport.createFolder(containersDestPath); 
            }

            for(let i = 0; i < containersList.length; i++){
                try {
                    const containerDetails = await apiClient.containerMethods.getContainerByID(containersList[i].contentViewID, guid);
                    const referenceName = containerDetails.referenceName.replace(/[^a-zA-Z0-9_ ]/g, "");
                    
                    if (this._legacyFolders) {
                        fileExport.exportFiles(`${guid}/${locale}/${isPreview ? "preview":"live"}/containers`, referenceName, containerDetails, this._rootPath);
                    } else {
                        // In non-legacy, containersDestPath is already set correctly above.
                        fileExport.exportFiles("", referenceName, containerDetails, containersDestPath!);
                    }
                    console.log('✓ Downloaded container', ansiColors.cyan(referenceName));
                    successfullyDownloadedCount++;
                } catch (error: any) {
                    console.error(ansiColors.red(`✗ Error processing container ${containersList[i]?.contentViewID || containersList[i]?.referenceName || 'unknown'}: ${error.message}`));
                }
                
                if (this._progressCallback) {
                    this._progressCallback(successfullyDownloadedCount, totalContainers, 'progress');
                } 
            }

            const errorCount = totalContainers - successfullyDownloadedCount;
            const summaryMessage = `Downloaded ${successfullyDownloadedCount} containers (${successfullyDownloadedCount}/${totalContainers} containers, ${errorCount} errors)`;
            
            if (this._progressCallback) {
                this._progressCallback(successfullyDownloadedCount, totalContainers, errorCount === 0 ? 'success' : 'error');
                if (errorCount > 0) console.log(ansiColors.yellow(summaryMessage));
                else console.log(ansiColors.yellow(summaryMessage));
            } else {
                console.log(ansiColors.yellow(summaryMessage));
            }
            
        } catch (mainError: any) {
            console.error(ansiColors.red(`An error occurred during container processing: ${mainError.message}`));
            const errorCount = totalContainers - successfullyDownloadedCount; 
            const summaryMessage = `Downloaded ${successfullyDownloadedCount} containers (${successfullyDownloadedCount}/${totalContainers} containers, ${errorCount} errors)`;
            if (this._progressCallback) {
                this._progressCallback(successfullyDownloadedCount, totalContainers, 'error');
                console.log(ansiColors.yellow(summaryMessage));
            } else {
                console.log(ansiColors.yellow(summaryMessage));
            }
        }
       
    }

    async validateContainers(guid: string,locale: string, isPreview: boolean = true){
        try{
            let apiClient = new mgmtApi.ApiClient(this._options);
            const basePath = this._legacyFolders ? this._rootPath : path.join(this._rootPath, guid, locale, isPreview ? "preview" : "live");
            const containersReadPath = path.join(basePath, 'containers');

            let fileOperation = new fileOperations(this._rootPath, guid, locale, isPreview);
            let files = fileOperation.readDirectory(this._legacyFolders ? `${guid}/${locale}/${isPreview ? "preview":"live"}/containers` : containersReadPath);
    
            let containerStr: string[] = [];
            for(let i = 0; i < files.length; i++){
                let container = JSON.parse(files[i]) as mgmtApi.Container;
                let existingContainer = await apiClient.containerMethods.getContainerByReferenceName(container.referenceName, guid);
    
                if(existingContainer.referenceName){
                    containerStr.push(existingContainer.referenceName);
                }
               
            }
            return containerStr;
        } catch{

        }
        
    }

    deleteContainerFiles(containersToDelete: string[], guid: string, locale:string, isPreview:boolean = true){
        let file = new fileOperations(this._rootPath, guid, locale, isPreview);
        const basePath = this._legacyFolders ? this._rootPath : path.join(this._rootPath, guid, locale, isPreview ? "preview" : "live");
        const containersBasePath = path.join(basePath, 'containers');

        for(let i = 0; i < containersToDelete.length; i++){
            let fileName = `${containersToDelete[i]}.json`;
            const fullPathToDelete = this._legacyFolders 
                ? `agility-files/${guid}/${locale}/${isPreview ? "preview":"live"}/containers/${fileName}` 
                : path.join(containersBasePath, fileName);
            file.deleteFile(fullPathToDelete);
        }
    }
}