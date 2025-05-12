import * as mgmtApi from '@agility/management-sdk';
import { ReferenceMapper } from '../../mapper'; // Assuming ReferenceMapper is here
import { fileOperations } from '../../services/fileOperations'; // Assuming fileOperations is here

export function getGalleriesFromFileSystem(
    guid: string,
    locale: string,
    isPreview: boolean,
    referenceMapper: ReferenceMapper,
    rootPath?: string,
    legacyFolders?: boolean // Added legacyFolders, not used yet
): mgmtApi.assetGalleries[] | null {
    let fileOperation = new fileOperations(rootPath, guid, locale, isPreview); 
    const baseFolder = rootPath || 'agility-files';
    let dirPath: string;

    if (legacyFolders) {
        // Assuming legacy path for galleries is <basefolder>/assets/galleries
        // based on assets/json becoming <basefolder>/assets
        dirPath = `${baseFolder}/assets/galleries`; 
    } else {
        dirPath = `${baseFolder}/${guid}/${locale}/${isPreview ? 'preview':'live'}/assets/galleries`;
    }

    try{
        let files = fileOperation.readDirectory(dirPath); // Pass full path

        let assetGalleries: mgmtApi.assetGalleries[] = [];

        for(let i = 0; i < files.length; i++){
            let assetGallery = JSON.parse(files[i]) as mgmtApi.assetGalleries;
            // Add source gallery to reference mapper immediately
            referenceMapper.addRecord('gallery', assetGallery, null);
            assetGalleries.push(assetGallery);
        }
        return assetGalleries;
    } catch (e) {
        // Log the error or handle it as appropriate for the getter function
        // For now, let's assume appendLogFile is a method on fileOperations or a global utility
        // If it's on fileOperations and you instantiate it here, you can call it.
        // If it's a global utility, ensure it's imported.
        // Consider how error logging should work in these separated functions.
        // For now, re-throwing or returning null might be simpler.
        console.error(`Error in getGalleriesFromFileSystem reading ${dirPath}: ${e.message}`); 
        fileOperation.appendLogFile(`\n No Galleries were found in ${dirPath} to process.`);
        return null;
    }
}
