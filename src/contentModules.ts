import * as mgmtApi from '@agility/management-sdk';
import { fileOperations } from './fileOperations';
import * as cliProgress from 'cli-progress';

export class contentModules {
  _options: mgmtApi.Options;
  _multibar: cliProgress.MultiBar;

  constructor(options: mgmtApi.Options, multibar: cliProgress.MultiBar) {
    this._options = options;
    this._multibar = multibar;
  }

  async getContentModules(guid: string) {
    const apiClient = new mgmtApi.ApiClient(this._options);
    try {
      const contentModules = await apiClient.modelMethods.getContentModules(false, guid, true);
      const onlyModules = contentModules.filter(
        module => module.contentDefinitionTypeName === 'Module'
      );

      console.log(`Found ${onlyModules.length} content modules.`);

      const progressBar3 = this._multibar.create(contentModules.length, 0);
      progressBar3.update(0, { name: 'Content Modules' });

      const fileExport = new fileOperations();

      for (let i = 0; i < contentModules.length; i++) {
        const module = contentModules[i];
        const fileName = module.referenceName;
        fileExport.exportFiles('contentModules', fileName, module);
        progressBar3.update(i + 1, { name: 'Content Modules' });
      }

      // let index = 1;
      // for (let i = 0; i < contentModules.length; i++) {
      //   const container = await apiClient.containerMethods.getContainerByID(
      //     contentModules[i].id,
      //     guid
      //   );
      //   const referenceName = container.referenceName.replace(/[^a-zA-Z0-9_ ]/g, '');
      //   fileExport.exportFiles('contentModules', referenceName, container);
      //   // const progressCount = i + 1;
      //   if (index === 1) {
      //     progressBar3.update(1);
      //   } else {
      //     progressBar3.update(index);
      //   }
      //   index += 1;
      // }
    } catch {}
  }

  deleteContentModuleFiles(modules: string[]) {
    const file = new fileOperations();
    for (let i = 0; i < modules.length; i++) {
      const fileName = `${modules[i]}.json`;
      file.deleteFile(`.agility-files/contentModules/${fileName}`);
    }
  }
}
