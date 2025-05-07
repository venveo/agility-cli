import * as mgmtApi from "@agility/management-sdk";
import * as cliProgress from "cli-progress";
import * as agilitySync from "@agility/content-sync";
import * as path from "path";
import * as fs from 'fs';
const storeInterfaceFileSystem = require("./store-interface-filesystem"); // Path relative to services folder
import { downloadAllGalleries, 
    downloadAllAssets, 
    downloadAllModels, 
    downloadAllContainers, 
    downloadAllContent, 
    downloadAllTemplates, 
    downloadAllPages
} from "../downloaders/index";

export class Pull {
  private _guid: string;
  private _apiKey: string;
  private _locale: string;
  private _channel: string;
  private _isPreview: boolean;
  private _options: mgmtApi.Options;
  private _multibar: cliProgress.MultiBar;
  private _elements: any;
  private _rootPath: string;
  private _legacyFolders: boolean;

  constructor(
    guid: string,
    apiKey: string,
    locale: string,
    channel: string,
    isPreview: boolean,
    options: mgmtApi.Options,
    multibar: cliProgress.MultiBar,
    elements: any,
    rootPath: string = "agility-files",
    legacyFolders: boolean = false
  ) {
    this._guid = guid;
    this._apiKey = apiKey;
    this._locale = locale;
    this._channel = channel;
    this._isPreview = isPreview;
    this._options = options;
    this._multibar = multibar;
    this._elements = elements;
    this._rootPath = rootPath;
    this._legacyFolders = legacyFolders;
  }

  async pullInstance(): Promise<void> {
    let basePath = path.join(this._rootPath, this._guid, this._locale, this._isPreview ? "preview" : "live");

    if(this._legacyFolders){
        basePath = path.join(this._rootPath);
    }
 
    try {
        if (!fs.existsSync(basePath)) {
            fs.mkdirSync(basePath, { recursive: true });
        }
    } catch (dirError) {
        console.error("\nError creating directories for pull:", dirError);
        this._multibar.log("Error creating directories. Aborting pull.\n");
        return;
    }

   const syncClient = agilitySync.getSyncClient({
      guid: this._guid,
      apiKey: this._apiKey,
      languages: [`${this._locale}`],
      channels: [`${this._channel}`],
      isPreview: this._isPreview,
      store: {
        interface: storeInterfaceFileSystem,
        options: {
          rootPath: basePath,
          logPath: path.join(this._rootPath, ".agility-logs")
        },
      },
    });


    try {
      // we should consider doing something else for this
      // potentially re-writing it to run locally
      await syncClient.runSync();
    } catch (error) {
      console.error("\nError during base content synchronization:", error);
      this._multibar.log("Error during base content synchronization. Aborting further downloads.\n");
      return;
    }

    if(this._elements.includes("Templates")){   
        await downloadAllTemplates(this._guid, this._locale, this._isPreview, this._options, this._multibar, basePath);
    }
    if(this._elements.includes("Pages")){
        await downloadAllPages(this._guid, this._locale, this._isPreview, this._options, this._multibar, basePath);
    }
    if(this._elements.includes("Galleries")){
        await downloadAllGalleries(this._guid, this._locale, this._isPreview, this._options, this._multibar, basePath);
    }
    if(this._elements.includes("Assets")){
        await downloadAllAssets(this._guid, this._locale, this._isPreview, this._options, this._multibar, basePath);
    }
    if(this._elements.includes("Containers")){
        await downloadAllContainers(this._guid, this._locale, this._isPreview, this._options, this._multibar, basePath);
    }
    if(this._elements.includes("Content")){
        await downloadAllContent(this._guid, this._locale, this._isPreview, this._options, this._multibar, basePath);
    }
    if(this._elements.includes("Models")){
        await downloadAllModels(this._guid, this._locale, this._isPreview, this._options, this._multibar, basePath);
    }
    
  }
}
