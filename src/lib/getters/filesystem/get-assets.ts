import * as mgmtApi from '@agility/management-sdk';
import { ReferenceMapper } from '../../mapper';
import { fileOperations } from '../../services/fileOperations';

export function getAssetsFromFileSystem(
    guid: string,
    locale: string,
    isPreview: boolean,
    referenceMapper: ReferenceMapper,
    rootPath?: string,
    legacyFolders?: boolean
): mgmtApi.AssetMediaList[] | null {
    let fileOperation = new fileOperations(rootPath, guid, locale, isPreview);
  
    try{

        const baseFolder = rootPath || 'agility-files';
        let dirPath = `${baseFolder}/${guid}/${locale}/${isPreview ? 'preview':'live'}/assets/json`;
        if(legacyFolders){
            dirPath = `${baseFolder}/assets`;
        }

        let files = fileOperation.readDirectory(dirPath);

        let assets: mgmtApi.AssetMediaList[] = [];

        for(let i = 0; i < files.length; i++){
            let file = JSON.parse(files[i]) as mgmtApi.AssetMediaList;
            // Add each media item individually to the reference mapper
            for (const media of file.assetMedias) {
                referenceMapper.addRecord('asset', media, null);
            }
            assets.push(file);
        }
        return assets;
    } catch (e){
        console.error(`Error in getAssetsFromFileSystem: ${e.message}`);
        fileOperation.appendLogFile(`\n No Assets were found in the source Instance to process.`);
        return null;
    }
}
