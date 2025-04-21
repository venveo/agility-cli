import * as mgmtApi from "@agility/management-sdk";
import { fileOperations } from "./fileOperations";
import * as cliProgress from "cli-progress";

export class assetNew {
  _options: mgmtApi.Options;
  _multibar: cliProgress.MultiBar;
  unProcessedAssets: { [key: number]: string };

  constructor(options: mgmtApi.Options, multibar: cliProgress.MultiBar) {
    this._options = options;
    this._multibar = multibar;
    this.unProcessedAssets = {};
  }

  async getGalleries(guid: string, locale: string, isPreview: boolean = true) {
    let apiClient = new mgmtApi.ApiClient(this._options);
    let fileExport = new fileOperations();

    let pageSize = 250;
    let rowIndex = 0;

    let multiExport = false;

    let index = 1;

    let initialRecords = await apiClient.assetMethods.getGalleries(
      guid,
      "",
      pageSize,
      rowIndex
    );

    let totalRecords = initialRecords.totalCount;

    fileExport.createFolder(
      `${guid}/${locale}/${isPreview ? "preview" : "live"}/assets/galleries`
    );
    fileExport.exportFiles(
      `${guid}/${locale}/${isPreview ? "preview" : "live"}/assets/galleries`,
      index,
      initialRecords
    );

    let iterations = Math.round(totalRecords / pageSize);

    if (totalRecords > pageSize) {
      multiExport = true;
    }

    if (iterations === 0) {
      iterations = 1;
    }

    const progressBar1 = this._multibar.create(iterations, 0);

    if (multiExport) {
      progressBar1.update(0, { name: "Galleries" });

      for (let i = 0; i < iterations; i++) {
        rowIndex += pageSize;
        if (index === 1) {
          progressBar1.update(1);
        } else {
          progressBar1.update(index);
        }
        index += 1;
        let galleries = await apiClient.assetMethods.getGalleries(
          guid,
          "",
          pageSize,
          rowIndex
        );

        fileExport.exportFiles(
          `${guid}/${locale}/${
            isPreview ? "preview" : "live"
          }/assets/galleries`,
          index,
          galleries
        );
      }
    } else {
      progressBar1.update(1, { name: "Galleries" });
    }

    // progressBar1.stop();
  }

  getFilePath(originUrl: string): string {
    let url = new URL(originUrl);
    let pathName = url.pathname;
    let extractedStr = pathName.split("/")[1];
    let removedStr = pathName.replace(`/${extractedStr}/`, "");

    return removedStr;
  }

  async getAssets(guid: string, locale: string, isPreview: boolean = true) {
    let apiClient = new mgmtApi.ApiClient(this._options);
    let fileExport = new fileOperations();

    let pageSize = 250;
    let recordOffset = 0;
    let index = 1;
    let multiExport = false;

    let initialRecords = await apiClient.assetMethods.getMediaList(
      pageSize,
      recordOffset,
      guid
    );

    let totalRecords = initialRecords.totalCount;
    
    // Create the base directory structure
    const basePath = `${guid}/${locale}/${isPreview ? "preview" : "live"}`;
    
    // Create the deepest directory we need - this will create all parent directories
    fileExport.createFolder(`${basePath}/assets/galleries`);
    
    fileExport.exportFiles(
      `${basePath}/assets/json`,
      index,
      initialRecords
    );

    let iterations = Math.round(totalRecords / pageSize);

    if (totalRecords > pageSize) {
      multiExport = true;
    }

    if (iterations === 0) {
      iterations = 1;
    }

    const progressBar2 = this._multibar.create(totalRecords, 0);

    progressBar2.update(0, { name: "Assets" });

    for (let i = 0; i < initialRecords.assetMedias.length; i++) {
      const originUrl = initialRecords.assetMedias[i].originUrl;
      const assetMediaID = initialRecords.assetMedias[i].mediaID;
      const filePath = this.getFilePath(originUrl);
      const folderPath = filePath.split("/").slice(0, -1).join("/");
      const fileName = `${initialRecords.assetMedias[i].fileName}`;

      if (this.isUrlProperlyEncoded(originUrl)) {
        this.unProcessedAssets[assetMediaID] = fileName;
        progressBar2.update(i + 1);
        continue;
      }

      if (folderPath) {
        const fullFolderPath = `${guid}/${locale}/${isPreview ? "preview" : "live"}/assets/${folderPath}`;
        fileExport.createFolder(fullFolderPath);
        try {
          await fileExport.downloadFile(
            originUrl,
            `agility-files/${fullFolderPath}/${fileName}`
          );
        } catch {
          console.log('Failed to download file', originUrl);
          this.unProcessedAssets[assetMediaID] = fileName;
        }
      } else {
        try {
          await fileExport.downloadFile(
            originUrl,
            `agility-files/${guid}/${locale}/${isPreview ? "preview" : "live"}/assets/${fileName}`
          );
        } catch {
          console.log('Failed to download file', originUrl);
          this.unProcessedAssets[assetMediaID] = fileName;
        }
      }
      progressBar2.update(i + 1);
    }

    if (multiExport) {
      for (let i = 0; i < iterations; i++) {
        recordOffset += pageSize;

        let assets = await apiClient.assetMethods.getMediaList(
          pageSize,
          recordOffset,
          guid
        );
        fileExport.exportFiles(
          `${guid}/${locale}/${isPreview ? "preview" : "live"}/assets/json`,
          i + 1,
          assets
        );

        for (let j = 0; j < assets.assetMedias.length; j++) {
          const originUrl = assets.assetMedias[j].originUrl;
          const mediaID = assets.assetMedias[j].mediaID;

          const filePath = this.getFilePath(originUrl);
          const folderPath = filePath.split("/").slice(0, -1).join("/");
          const fileName = `${assets.assetMedias[j].fileName}`;

          if (this.isUrlProperlyEncoded(originUrl)) {
            this.unProcessedAssets[mediaID] = fileName;
            progressBar2.update(recordOffset + j + 1);
            continue;
          }
          if (folderPath) {
            fileExport.createFolder(
              `${guid}/${locale}/${
                isPreview ? "preview" : "live"
              }/assets/${folderPath}`
            );
            try {
              await fileExport.downloadFile(
                originUrl,
                `agility-files/${guid}/${locale}/${
                  isPreview ? "preview" : "live"
                }/assets/${folderPath}/${fileName}`
              );
            } catch {
              this.unProcessedAssets[mediaID] = fileName;
            }
          } else {
            try {
              await fileExport.downloadFile(
                originUrl,
                `agility-files/${guid}/${locale}/${
                  isPreview ? "preview" : "live"
                }/assets/${fileName}`
              );
            } catch {
              this.unProcessedAssets[mediaID] = fileName;
            }
          }
          progressBar2.update(recordOffset + j + 1);
        }
      }
    }

    fileExport.exportFiles(
      `${guid}/${locale}/${isPreview ? "preview" : "live"}/assets/failedAssets`,
      "unProcessedAssets",
      this.unProcessedAssets
    );
    // await this.getGalleries(guid, locale, isPreview);
  }

async deleteAllGalleries(guid:string, locale: string, isPreview: boolean = true){

    //  TODO: delete all galleries
    let apiClient = new mgmtApi.ApiClient(this._options);
    const galleries = await apiClient.assetMethods.getGalleries(guid, null, 250, 0);

    

}

  async deleteAllAssets(
    guid: string,
    locale: string,
    isPreview: boolean = true
  ) {
    let apiClient = new mgmtApi.ApiClient(this._options);

    let pageSize = 250;
    let recordOffset = 0;
    let index = 1;
    let multiExport = false;

    let initialRecords = await apiClient.assetMethods.getMediaList(
      pageSize,
      recordOffset,
      guid
    );

    let totalRecords = initialRecords.totalCount;
    let allRecords = initialRecords.assetMedias;

    let iterations = Math.round(totalRecords / pageSize);

    if (totalRecords > pageSize) {
      multiExport = true;
    }

    if (iterations === 0) {
      iterations = 1;
    }

    const progressBar = this._multibar.create(totalRecords, 0);
    progressBar.update(0, { name: "Deleting Assets" });

    for (let i = 0; i < iterations; i++) {
      let assets = await apiClient.assetMethods.getMediaList(
        pageSize,
        recordOffset,
        guid
      );

      allRecords = allRecords.concat(assets.assetMedias);
      assets.assetMedias.forEach(async (mediaItem) => {
      
        if(mediaItem.isFolder) {
            const d = await apiClient.assetMethods.deleteFolder(mediaItem.originKey, guid, mediaItem.mediaID);
            console.log('Deleted', d);
        } else {
            await apiClient.assetMethods.deleteFile(mediaItem.mediaID, guid);
        }

        progressBar.increment();

      });
      recordOffset += pageSize;
    }
    
    return allRecords;
  }

  isUrlProperlyEncoded(url: string) {
    try {
      // Decode and re-encode the URL to compare with the original
      const decoded = decodeURIComponent(url);
      const reEncoded = encodeURIComponent(decoded);

      // Check if the encoded version matches the input
      return url === reEncoded;
    } catch (e) {
      // If decoding throws an error, the URL is not properly encoded
      return false;
    }
  }
}
