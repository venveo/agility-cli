import * as mgmtApi from '@agility/management-sdk';
import { fileOperations } from '../../services/fileOperations';
// import { ReferenceMapper } from '../../mapper'; // Not used in this function directly but was in the class context

export async function getTemplatesFromFileSystem(
    guid: string,
    locale: string,
    isPreview: boolean,
    // referenceMapper: ReferenceMapper, // Pass if needed for consistency or future use
    rootPath?: string, // Renamed from baseFolderParam for consistency
    legacyFolders?: boolean // Added legacyFolders, not used yet
): Promise<mgmtApi.PageModel[] | null> {
    
    let fileOperation = new fileOperations();
    const baseFolder = rootPath || 'agility-files';
    let dirPath: string;

    if (legacyFolders) {
        dirPath = `${baseFolder}/templates`;
    } else {
        dirPath = `${baseFolder}/${guid}/${locale}/${isPreview ? 'preview':'live'}/templates`;
    }

    try{
        let files = fileOperation.readDirectory(dirPath); // Pass full path

        let pageModels : mgmtApi.PageModel[] = [];

        for(let i = 0; i < files.length; i++){
            let pageModel = JSON.parse(files[i]) as mgmtApi.PageModel;
            // The original code had this commented out, maintaining that for now.
            // referenceMapper.addRecord('template', pageModel, null);
            pageModels.push(pageModel);
        }
        return pageModels;
    } catch (e){
        console.error(`Error in getTemplatesFromFileSystem reading ${dirPath}: ${e.message}`);
        fileOperation.appendLogFile(`\n No Page Templates were found in ${dirPath} to process.`);
        return null;
    }
}
