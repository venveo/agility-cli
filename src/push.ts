import * as mgmtApi from "@agility/management-sdk";
import { fileOperations } from "./fileOperations";
import * as fs from "fs";
const FormData = require("form-data");
import * as cliProgress from "cli-progress";
import { isPreview } from "./prompts/isPreview";
import { homePrompt } from "./prompts/home";
import { elementsPrompt } from "./prompts/elements";
import { create } from "domain";
import { createDecipheriv } from "crypto";
import { instancesPrompt } from "./prompts/instances/instance";
const ansiColors = require("ansi-colors");

export class push {
  _options: mgmtApi.Options;
  _multibar: cliProgress.MultiBar;
  _guid: string;
  _targetGuid: string;
  _locale: string;
  _isPreview: boolean;
  processedModels: { [key: string]: number };
  processedContainers: { [key: number]: string }; // format Key -> ContainerId, Value ReferenceName
  processedContentIds: { [key: number]: number }; //format Key -> Old ContentId, Value New ContentId.
  skippedContentItems: { [key: number]: string }; //format Key -> ContentId, Value ReferenceName of the content.
  processedGalleries: { [key: number]: number };
  processedTemplates: { [key: string]: number }; //format Key -> pageTemplateName, Value pageTemplateID.
  processedPages: { [key: number]: number }; //format Key -> old page id, Value new page id.

  // new concept for how we assemble and deliver everything
  // models, containers and contentItems are stored by reference name

  localModels: mgmtApi.Model[]; // stores local models with updated target instance values
  localLinkedModels: mgmtApi.Model[]; // stores local models with updated target instance values
  localNormalModels: mgmtApi.Model[]; // stores local models with updated target instance values
  localPageModels: mgmtApi.PageModel[]; // stores local page models with updated target instance values
  localContainers: mgmtApi.Container[]; // stores local containers with updated target instance values
  localContentItems: mgmtApi.ContentItem[]; // stores local content items with updated target instance values
  localLinkedContentItems: mgmtApi.ContentItem[]; // stores local linked content items with updated target instance values
  localNormalContentItems: mgmtApi.ContentItem[]; // stores local normal content items with updated target instance values
  // local pages are stored by pageID
  localPages: mgmtApi.PageItem[]; // stores local pages with updated target instance values

  constructor(
    options: mgmtApi.Options,
    multibar: cliProgress.MultiBar,
    guid?: string,
    targetGuid?: string,
    locale?: string,
    isPreview?: boolean
  ) {
    this._options = options;
    this._multibar = multibar;
    this._guid = guid || "";
    this._targetGuid = targetGuid || "";
    this._locale = locale || "";
    this._isPreview = isPreview || false;
    this.processedModels = {};
    this.processedContentIds = {};
    this.processedGalleries = {};
    this.skippedContentItems = {};
    this.processedTemplates = {};
    this.processedPages = {};
    this.localModels = [];
    this.localLinkedModels = [];
    this.localNormalModels = [];
    this.localContainers = [];
    this.localPageModels = [];
    this.localPages = [];
    this.localContentItems = [];
    this.localLinkedContentItems = [];
  }

  /////////////////////////////START: METHODS FOR DEBUG ONLY/////////////////////////////////////////////////////////////////
  createAllContent() {
    let fileOperation = new fileOperations();
    try {
      let files = fileOperation.readFile(".agility-files/all/all.json");
      let contentItems = JSON.parse(files) as mgmtApi.ContentItem[];

      return contentItems;
    } catch (err) {
      console.log(err);
    }
  }

  createLinkedContent() {
    let fileOperation = new fileOperations();
    try {
      let files = fileOperation.readFile(".agility-files/linked/linked.json");
      let contentItems = JSON.parse(files) as mgmtApi.ContentItem[];

      return contentItems;
    } catch (err) {
      console.log(err);
    }
  }

  createNonLinkedContent() {
    let fileOperation = new fileOperations();
    try {
      let files = fileOperation.readFile(".agility-files/nonlinked/nonlinked.json");
      let contentItems = JSON.parse(files) as mgmtApi.ContentItem[];

      return contentItems;
    } catch (err) {
      console.log(err);
    }
  }
  /////////////////////////////END: METHODS FOR DEBUG ONLY/////////////////////////////////////////////////////////////////
  async getModelsFromLocalStore() {
    let fileOperation = new fileOperations();

    let files = fileOperation.readDirectory(
      `${this._guid}/${this._locale}/${this._isPreview ? "preview" : "live"}/models`
    );

    let models: mgmtApi.Model[] = [];

    for (const file of files) {
      let model = JSON.parse(file) as mgmtApi.Model;
      this.localModels.push(model);
      models.push(model);
    }

    let linkedModels = await this.getLinkedModels();
    let normalModels = await this.getNormalModels();
    let pageModels = await this.getPageModelsFromLocalStore();

    return {
      models,
      linkedModels,
      normalModels,
      pageModels,
    };
  }

  createBaseModels(baseFolder?: string, guid?: string, locale?: string, isPreview?: boolean) {
    if (baseFolder === undefined || baseFolder === "" || !baseFolder) {
      baseFolder = `.agility-files/${guid}/${locale}/${isPreview ? "preview" : "live"}`;
    }

    // console.log('createBaseModels', baseFolder);
    let fileOperation = new fileOperations();
    try {
      let files = fileOperation.readDirectory("models", baseFolder);

      let models: mgmtApi.Model[] = [];

      for (let i = 0; i < files.length; i++) {
        let model = JSON.parse(files[i]) as mgmtApi.Model;
        models.push(model);
      }
      return models;
    } catch {
      fileOperation.appendLogFile(`\n No Models were found in the source Instance to process.`);
      return null;
    }
  }

  createBaseAssets() {
    let fileOperation = new fileOperations();
    try {
      let files = fileOperation.readDirectory(`${this._guid}/${this._locale}/${this._isPreview ? 'preview':'live'}/assets/json`);

      let assets: mgmtApi.AssetMediaList[] = [];

      for (let i = 0; i < files.length; i++) {
        let file = JSON.parse(files[i]) as mgmtApi.AssetMediaList;
        assets.push(file);
      }
      return assets;
    } catch {
      fileOperation.appendLogFile(`\n No Assets were found in the source Instance to process.`);
      return null;
    }
  }

  createBaseGalleries() {
    let fileOperation = new fileOperations();
    try {
      let files = fileOperation.readDirectory(`${this._guid}/${this._locale}/${this._isPreview ? 'preview':'live'}/assets/galleries`);

      let assetGalleries: mgmtApi.assetGalleries[] = [];

      for (let i = 0; i < files.length; i++) {
        let assetGallery = JSON.parse(files[i]) as mgmtApi.assetGalleries;
        assetGalleries.push(assetGallery);
      }
      return assetGalleries;
    } catch {
      fileOperation.appendLogFile(`\n No Galleries were found in the source Instance to process.`);
      return null;
    }
  }

  async getContainersFromLocalStore() {
    let fileOperation = new fileOperations();
    let containers: mgmtApi.Container[] = [];

    try {
      let files = fileOperation.readDirectory(
        `${this._guid}/${this._locale}/${this._isPreview ? "preview" : "live"}/containers`
      );

      for (const file of files) {
        let container = JSON.parse(file) as mgmtApi.Container;
        containers.push(container);
        this.localContainers[container.referenceName] = container;
      }
    } catch (err) {
      fileOperation.appendLogFile(`\n No Content Lists were found in the source`);
    }

    this.localContainers = containers;
    return containers;
  }
  createBaseContainers(guid?: string, locale?: string, isPreview?: boolean) {
    let fileOperation = new fileOperations();
    try {
      let files = fileOperation.readDirectory(`${guid}/${locale}/${isPreview ? "preview" : "live"}/containers`);

      let containers: mgmtApi.Container[] = [];

      for (let i = 0; i < files.length; i++) {
        let container = JSON.parse(files[i]) as mgmtApi.Container;
        containers.push(container);
      }
      return containers;
    } catch {
      fileOperation.appendLogFile(`\n No Containers were found in the source Instance to process.`);
      return null;
    }
  }

  async getPageModelsFromLocalStore(guid?: string, locale?: string, isPreview?: boolean) {
    let pageTemplates: mgmtApi.PageModel[] = [];
    let fileOperation = new fileOperations();
    const baseFolder = `.agility-files/${guid}/${locale}/${isPreview ? "preview" : "live"}`;

    try {
      let files = fileOperation.readDirectory("templates", baseFolder);
      for (const file of files) {
        let pageTemplate = JSON.parse(file) as mgmtApi.PageModel;
        this.localPageModels.push(pageTemplate);
        // this.localPageModels[pageTemplate.pageTemplateID] = pageTemplate;
        pageTemplates.push(pageTemplate);
      }
    } catch {
      fileOperation.appendLogFile(`\n No Page Models were found in ${baseFolder}/templates.`);
    }

    return pageTemplates;
  }

  async createBaseTemplates(baseFolder?: string, guid?: string, locale?: string, isPreview?: boolean) {
    if (baseFolder === undefined || baseFolder === "" || !baseFolder) {
      baseFolder = `${guid}/${locale}/${isPreview ? "preview" : "live"}`;
    }
    let fileOperation = new fileOperations();
    try {
      let files = fileOperation.readDirectory("templates", baseFolder);

      let pageModels: mgmtApi.PageModel[] = [];

      for (let i = 0; i < files.length; i++) {
        let pageModel = JSON.parse(files[i]) as mgmtApi.PageModel;
        pageModels.push(pageModel);
      }
      return pageModels;
    } catch {
      fileOperation.appendLogFile(`\n No Page Templates were found in the source Instance to process.`);
      return null;
    }
  }

  async getPagesFromLocalStore() {
    let fileOperation = new fileOperations();

    let files = fileOperation.readDirectory(
      `${this._guid}/${this._locale}/${this._isPreview ? "preview" : "live"}/pages`
    );

    let pages: mgmtApi.PageItem[] = [];

    for (const file of files) {
      let page = JSON.parse(file) as mgmtApi.PageItem;
      if (page && page !== undefined) {
        this.localPages.push(page);
        pages.push(page);
      }
    }

    return pages;
  }

  async createBasePages(guid?: string, locale?: string, isPreview?: boolean) {
    let fileOperation = new fileOperations();
    try {
      let files = fileOperation.readDirectory(
        `.agility-files/${guid}/${locale}/${isPreview ? "preview" : "live"}/pages`
      );

      let pages: mgmtApi.PageItem[] = [];

      for (let i = 0; i < files.length; i++) {
        let page = JSON.parse(files[i]) as mgmtApi.PageItem;
        pages.push(page);
      }
      return pages;
    } catch {
      fileOperation.appendLogFile(`\n No Pages were found in the source Instance to process.`);
      return null;
    }
  }

  async getContentItemsFromLocalStore() {
    let fileOperation = new fileOperations();
    try {
      // console.log("getContentItemsFromLocalStore - isPreview:", this._isPreview, this._guid, this._locale);
      let files = fileOperation.readDirectory(
        `${this._guid}/${this._locale}/${this._isPreview ? "preview" : "live"}/item`
      );

      let contentItems: mgmtApi.ContentItem[] = [];

      for (const file of files) {
        let contentItem = JSON.parse(file) as mgmtApi.ContentItem;
        // this.localContentItems[contentItem.contentID] = contentItem;
        this.localContentItems.push(contentItem);
        contentItems.push(contentItem);
      }

      // these set this.localNormalContentItems and this.localLinkedContentItems
      await this.getLinkedContentFromLocalStore();
      await this.getNormalContentFromLocalStore();

      return contentItems;
    } catch {
      fileOperation.appendLogFile(`\n No Content Items were found in the source Instance to process.`);
      return null;
    }
  }

  async createContentItems(
    contentItems: mgmtApi.ContentItem[],
    guid: string,
    locale: string,
    isPreview: boolean,
    targetGuid?: string
  ) {
    let apiClient = new mgmtApi.ApiClient(this._options);

    contentItems.forEach(async (contentItem) => {
      let container = new mgmtApi.Container();

      // at this point, the container should already exists

      // I think we need to pass in the containers we have on file as well

      try {
        // check to see if the container exists on the target instance
        container = await apiClient.containerMethods.getContainerByReferenceName(
          contentItem.properties.referenceName,
          targetGuid
        );
      } catch {
        // this is wrong
        this.skippedContentItems[contentItem.contentID] = contentItem.properties.referenceName;
        return;
      }
    });
  }

  async createBaseContentItems(guid: string, locale: string, isPreview: boolean, targetGuid?: string) {
    let apiClient = new mgmtApi.ApiClient(this._options);
    let fileOperation = new fileOperations();

    console.log("getBaseContenntItems - isPreview:", isPreview);
    if (fileOperation.folderExists(`${guid}/${locale}/${isPreview ? "preview" : "live"}/item`)) {
      let files = fileOperation.readDirectory(`${guid}/${locale}/${isPreview ? "preview" : "live"}/item`);

      const validBar1 = this._multibar.create(files.length, 0);
      validBar1.update(0, { name: "Content Items: Validation" });

      let index = 1;

      let contentItems: mgmtApi.ContentItem[] = [];

      for (let i = 0; i < files.length; i++) {
        let contentItem = JSON.parse(files[i]) as mgmtApi.ContentItem;
       
        validBar1.update(index);
        index += 1;
        try {
          // this doesn't even really make sense to have this here

          // so it looks like the container doesn't exist on the targetInstance
          // why not?
          let container = await apiClient.containerMethods.getContainerByReferenceName(
            contentItem.properties.referenceName,
            targetGuid
          );
          // if(contentItem.contentID === 122){
          // console.log('container', container)
          // }
          if (container) {
            contentItems.push(contentItem);
          }
        } catch (err) {
            console.log("error getting container container by referenceName", contentItem.properties.referenceName);
      
          this.skippedContentItems[contentItem.contentID] = contentItem.properties.referenceName;
          fileOperation.appendLogFile(
            `\n Unable to find a container for content item referenceName ${contentItem.properties.referenceName}`
          );
          continue;
        }
      }
      return contentItems;
    } else {
      fileOperation.appendLogFile(`\n No Content Items were found in the source Instance to process.`);
    }
  }

  async getLinkedContentFromLocalStore() {
    let linkedContentItems: mgmtApi.ContentItem[] = [];
    let apiClient = new mgmtApi.ApiClient(this._options);
    let contentItems = this.localContentItems;
    for (let i = 0; i < contentItems.length; i++) {
      let contentItem = contentItems[i];
      let containerRef = contentItem.properties.referenceName;
      try {
        let container = await apiClient.containerMethods.getContainerByReferenceName(containerRef, this._guid);
        let model = await apiClient.modelMethods.getContentModel(container.contentDefinitionID, this._guid);

        model.fields.flat().find((field) => {
          if (field.type === "Content") {
            this.localLinkedContentItems.push(contentItem);
            return linkedContentItems.push(contentItem);
          }
        });
      } catch {
        continue;
      }
    }
    return linkedContentItems;
  }

  async getLinkedContent(contentItems: mgmtApi.ContentItem[]) {
    let linkedContentItems: mgmtApi.ContentItem[] = [];
    let apiClient = new mgmtApi.ApiClient(this._options);
    for (let i = 0; i < contentItems.length; i++) {
      let contentItem = contentItems[i];
      let containerRef = contentItem.properties.referenceName;
      try {
        let container = await apiClient.containerMethods.getContainerByReferenceName(containerRef, this._guid);
        let model = await apiClient.modelMethods.getContentModel(container.contentDefinitionID, this._guid);

        model.fields.flat().find((field) => {
          if (field.type === "Content") {
            this.localLinkedContentItems.push(contentItem);
            return linkedContentItems.push(contentItem);
          }
        });
      } catch {
        continue;
      }
    }
    return linkedContentItems;
  }
  async getNormalContentFromLocalStore() {
    let baseContentItems = this.localContentItems;
    let linkedContentItems = this.localLinkedContentItems;
    let contentItems = baseContentItems.filter((contentItem) => linkedContentItems.indexOf(contentItem) < 0);

    this.localNormalContentItems = contentItems;
    // let fileOperation = new fileOperations();
    // let contentItems: mgmtApi.ContentItem[] = [];
    // try {
    //   let files = fileOperation.readDirectory(`${this._guid}/${this._locale}/${isPreview ? 'preview':'live'}/item`);

    //   for (const file of files) {
    //     let contentItem = JSON.parse(file) as mgmtApi.ContentItem;
    //     this.localNormalContentItems.push(contentItem);
    //     contentItems.push(contentItem);
    //   }
    //   return contentItems;
    // } catch {
    //   console.log("No Content Items were found in the source Instance to process.");
    // }
  }
  async getNormalContent(
    guid: string,
    baseContentItems: mgmtApi.ContentItem[],
    linkedContentItems: mgmtApi.ContentItem[]
  ) {
    let apiClient = new mgmtApi.ApiClient(this._options);
    let contentItems = baseContentItems.filter((contentItem) => linkedContentItems.indexOf(contentItem) < 0);

    return contentItems;
  }

  async pushTemplates(templates: mgmtApi.PageModel[]) {
    let apiClient = new mgmtApi.ApiClient(this._options);
    let createdTemplates: mgmtApi.PageModel[] = [];
    const progressBar8 = this._multibar.create(templates.length, 0);
    progressBar8.update(0, { name: "Page Templates" });

    let index = 1;
    for (let i = 0; i < templates.length; i++) {
      let template = templates[i];
      progressBar8.update(index);
      index += 1;
      try {
        let existingTemplate = await apiClient.pageMethods.getPageTemplateName(
          this._guid,
          this._locale,
          template.pageTemplateName
        );

        if (existingTemplate) {
          template.pageTemplateID = existingTemplate.pageTemplateID;
          let existingDefinitions = await apiClient.pageMethods.getPageItemTemplates(
            this._guid,
            this._locale,
            existingTemplate.pageTemplateID
          );

          if (existingDefinitions) {
            for (const sourceDef of template.contentSectionDefinitions) {
              for (const targetDef of existingDefinitions) {
                if (sourceDef.pageItemTemplateReferenceName !== targetDef.pageItemTemplateReferenceName) {
                  sourceDef.pageItemTemplateID = -1;
                  sourceDef.pageTemplateID = -1;
                  sourceDef.contentViewID = 0;
                  sourceDef.contentReferenceName = null;
                  sourceDef.contentDefinitionID = 0;
                  sourceDef.itemContainerID = 0;
                  sourceDef.publishContentItemID = 0;
                }
              }
            }
          }
        }
      } catch {
        template.pageTemplateID = -1;
        for (let j = 0; j < template.contentSectionDefinitions.length; j++) {
          template.contentSectionDefinitions[j].pageItemTemplateID = -1;
          template.contentSectionDefinitions[j].pageTemplateID = -1;
          template.contentSectionDefinitions[j].contentViewID = 0;
          template.contentSectionDefinitions[j].contentReferenceName = null;
          template.contentSectionDefinitions[j].contentDefinitionID = 0;
          template.contentSectionDefinitions[j].itemContainerID = 0;
          template.contentSectionDefinitions[j].publishContentItemID = 0;
        }
      }
      try {
        let createdTemplate = await apiClient.pageMethods.savePageTemplate(this._guid, this._locale, template);
        createdTemplates.push(createdTemplate);
        this.processedTemplates[createdTemplate.pageTemplateName] = createdTemplate.pageTemplateID;
      } catch {}
    }

    return createdTemplates;
  }

  async pushPages() {
    const pages = this.localPages;
    const progressBar = this._multibar.create(pages.length, 0);
    progressBar.update(0, { name: "Pages" });

    let index = 1;

    let parentPages = pages.filter((p) => p.parentPageID < 0);
    let childPages = pages.filter((p) => p.parentPageID > 0);

    // console.log("Parent Pages", parentPages);
    // console.log("Child Pages", childPages);

    // first process all the parent pages
    for (let i = 0; i < parentPages.length; i++) {
      progressBar.increment();
      index += 1;

      if (parentPages[i].name === "home") {
        console.log("Parent page", parentPages[i].name);
        await this.processPageOld(parentPages[i], this._guid, this._locale, false);
      }
    }

    for (let j = 0; j < childPages.length; j++) {
      progressBar.increment();
      index += 1;
      // await this.processPageOld(childPages[j], guid, locale, true);
    }

    // progressBar.stop();
    // this._multibar.stop();
  }

  async processPageOld(page: mgmtApi.PageItem, guid: string, locale: string, isChildPage: boolean) {
    let fileOperation = new fileOperations();
    let pageName = page.name;
    let pageId = page.pageID;

    console.log("Processing page", pageName);

    try {
      let apiClient = new mgmtApi.ApiClient(this._options);
      let parentPageID = -1;
      if (isChildPage) {
        if (this.processedPages[page.parentPageID]) {
          parentPageID = this.processedPages[page.parentPageID];
          page.parentPageID = parentPageID;
        } else {
          page = null;
          fileOperation.appendLogFile(
            `\n Unable to process page for name ${page.name} with pageID ${page.pageID} as the parent page is not present in the instance.`
          );
        }
      }
      if (page) {
        if (page.zones) {
          let keys = Object.keys(page.zones);
          let zones = page.zones;
          for (let k = 0; k < keys.length; k++) {
            let zone = zones[keys[k]];
            for (let z = 0; z < zone.length; z++) {
              if ("contentId" in zone[z].item) {
                if (this.processedContentIds[zone[z].item.contentId]) {
                  zone[z].item.contentId = this.processedContentIds[zone[z].item.contentId];
                  continue;
                } else {
                  console.log("processedContentIds", this.processedContentIds);
                  console.log("couldnt find contentIds", zone[z].item.contentId);
                  console.log("2. Unable to process page for name >", page.name, "< with pageID", page.pageID);
                  fileOperation.appendLogFile(
                    `\n Unable to process page for name ${page.name} with pageID ${page.pageID} as the content is not present in the instance.`
                  );
                  page = null;
                  break;
                }
              }
            }
          }
        }
      }

      if (page) {
        console.log("-page-", page.name);
        let oldPageId = page.pageID;
        page.pageID = -1;
        page.channelID = -1;

        let createdPage = null;
        try {
          createdPage = await apiClient.pageMethods.savePage(page, guid, locale, parentPageID, -1);
        } catch (err) {
          console.log("Error creating page", err);
        }
        console.log("Save Page Response");
        console.log("Success response -", page.name, createdPage);
        console.log("\n");
        if (createdPage[0]) {
          // so here we're making sure the pageID returned
          // is greater than -1
          //

          if (createdPage[0] > 0) {
            this.processedPages[oldPageId] = createdPage[0];
          } else {
            console.log(
              "3. Unable to create page for name >",
              page.name,
              "< with originalPageID",
              oldPageId,
              "-r-",
              createdPage[0]
            );
            fileOperation.appendLogFile(`\n Unable to create page for name ${page.name} with pageID ${oldPageId}.`);
          }
        }
      }
    } catch {
      console.log("4. Unable to create page for name >", pageName, "< with id", pageId);
      fileOperation.appendLogFile(`\n Unable to create page for name ${pageName} with id ${pageId}.`);
    }
  }

  async processPage(page: mgmtApi.PageItem, guid: string, locale: string, isChildPage: boolean) {
    let fileOperation = new fileOperations();
    let pageName = page.name;
    let pageId = page.pageID;

    let apiClient = new mgmtApi.ApiClient(this._options);

    console.log("Processing page", pageName);

    try {
      //   if (isChildPage) {
      //     if (this.processedPages[page.parentPageID]) {
      //       parentPageID = this.processedPages[page.parentPageID];
      //       page.parentPageID = parentPageID;
      //     } else {
      //       page = null;
      //       fileOperation.appendLogFile(
      //         `\n 1. Unable to process page for name ${page.name} with pageID ${page.pageID} as the parent page is not present in the instance.`
      //       );
      //     }
      //   }

      //   if (page) {
      //     if (page.zones) {
      //       let keys = Object.keys(page.zones);
      //       let zones = page.zones;
      //       for (let k = 0; k < keys.length; k++) {
      //         let zone = zones[keys[k]];

      //         console.log('zone', zone)
      //         for (let z = 0; z < zone.length; z++) {

      //           if ("contentId" in zone[z].item) {

      //             if (this.processedContentIds[zone[z].item.contentId]) {
      //               zone[z].item.contentId = this.processedContentIds[zone[z].item.contentId];
      //               continue;
      //             } else {
      //               fileOperation.appendLogFile(
      //                 `\n 2. Unable to process page for name ${page.name} with pageID ${page.pageID} as the content is not present in the instance.`
      //               );
      //               page = null;
      //               break;
      //             }
      //           } else {
      //             console.log("contentId not found in zone item", zone[z].item);
      //           }
      //         }
      //       }
      //     }
      //   }

      if (page) {
        // console.log('xxxxx-->', page.name)
        let parentPageID = -1;
        let oldPageId = page.pageID;
        page.pageID = -1; // if the page doesn't exist on the target
        // instance, we have to use -1 to create a new page
        page.channelID = -1; // this doesn't exist on the stored values, we're adding it

        // why are we creating a new channel?

        console.log(
          ansiColors.yellow("Creating page"),
          page.name,
          "channelID:",
          page.channelID,
          "pageID:",
          page.pageID
        );
        console.log(page);
        try {
          let createdPage = await apiClient.pageMethods.savePage(page, guid, locale, parentPageID, -1);

          // console.log("------xxxx---->", page.name, "-----", createdPage);
          // console.log(`Created ${page.name} success in instance: ${guid} - pageID:`, createdPage)
          if (createdPage[0]) {
            if (createdPage[0] > 0) {
              this.processedPages[oldPageId] = createdPage[0];
            } else {
              console.log("3. Unable to create page for name >", page.name, "< with pageID", createdPage);
              fileOperation.appendLogFile(`\n Unable to create page for name ${page.name} with pageID ${oldPageId}.`);
            }
          }
        } catch (err) {
          console.log("5. Error creating page", err);
        }
      }
    } catch {
      console.log("4. Unable to create page for name >", pageName, "< with id", pageId);
      fileOperation.appendLogFile(`\n Unable to create page for name ${pageName} with id ${pageId}.`);
    }
  }

  async pushNormalContentItems() {
    let apiClient = new mgmtApi.ApiClient(this._options);
    let fileOperation = new fileOperations();

    const contentItems: any = this.localNormalContentItems;
    const containers = this.localContainers;


    const progressBar = this._multibar.create(contentItems.length, 0);
    progressBar.update(0, { name: "Content Items: Non Linked" });

    let index = 1;
    for (let contentItem of contentItems) {

      const targetInstanceData = containers.find((container) => {
        return container.referenceName.toLowerCase() === contentItem.properties.referenceName.toLowerCase();
      })['targetInstance'];

      const { contentViewID:targetContentViewID, contentDefinitionID:targetContentDefinitionID, referenceName: targetReferenceName } = targetInstanceData;




      // if(index == 1){
      // console.log("contentItem", contentItem);
      // }
      // let contentItem = contentItem; //contentItems.find((content) => content.contentID === 122);//160, 106
      progressBar.update(index);
      index += 1;

      let container = new mgmtApi.Container();
      let model = new mgmtApi.Model();
     
     
      try {

        container = await apiClient.containerMethods.getContainerByID(
          targetContentViewID,
          this._targetGuid
        );

        // console.log('Container -> ', container)


        if(!container){
          console.log("\n Unable to find a container for content item referenceName", contentItem.properties.referenceName, "with contentId", targetContentViewID);
        }
      } catch {
        this.skippedContentItems[contentItem.contentID] = contentItem.properties.referenceName;
        fileOperation.appendLogFile(
          `\n Unable to find a container for content item referenceName ${contentItem.properties.referenceName} with contentId ${contentItem.contentID}.`
        );
        console.log('\n Unable to find a container for content item referenceName', contentItem.properties.referenceName, 'with contentId', contentItem.contentID);
        continue;
      }

      try {
        model = await apiClient.modelMethods.getContentModel(targetContentDefinitionID, this._targetGuid);
      } catch {
        fileOperation.appendLogFile(
          `\n Unable to find model for content item referenceName ${contentItem.properties.referenceName} with contentId ${contentItem.contentID}.`
        );
        this.skippedContentItems[contentItem.contentID] = contentItem.properties.referenceName;
        continue;
      }


      for (let field of model.fields) {
        // let field = model.fields[j];
        let fieldName = this.camelize(field.name);
        let fieldVal = contentItem.fields[fieldName];

        // if any of the content is an Image or File attachment, we need to change the origin key
        // to the target instance, this is the filepath

        if (field.type === "ImageAttachment" || field.type === "FileAttachment" || field.type === "AttachmentList") {
          if (typeof fieldVal === "object") {
            if (Array.isArray(fieldVal)) {
              for (let k = 0; k < fieldVal.length; k++) {
                let retUrl = await this.changeOriginKey(this._targetGuid, fieldVal[k].url);
                contentItem.fields[fieldName][k].url = retUrl;
              }
            } else {
              if ("url" in fieldVal) {
                let retUrl = await this.changeOriginKey(this._targetGuid, fieldVal.url);
                contentItem.fields[fieldName].url = retUrl;
              }
            }
          }
        } else {
          if (typeof fieldVal === "object") {
            if ("fulllist" in fieldVal) {
              delete fieldVal.fulllist;
              if (field.type === "PhotoGallery") {
                let oldGalleryId = fieldVal.galleryid;
                if (this.processedGalleries[oldGalleryId]) {
                  contentItem.fields[fieldName] = this.processedGalleries[oldGalleryId].toString();
                } else {
                  contentItem.fields[fieldName] = fieldVal.galleryid.toString();
                }
              }
            }
          }
        }
      }


      const oldContentId = contentItem.contentID;
      // contentItem.contentID = -1;
      const clone = {
        ...contentItem,
        contentID: -1,
      }

      clone.properties.referenceName = targetReferenceName.toLowerCase();

      // console.log("\n clone", clone);

      try {
      let createdContentItemId = await apiClient.contentMethods.saveContentItem(clone, this._targetGuid, this._locale);

      console.log('\n createdContentItemId', createdContentItemId)

      if (createdContentItemId[0]) {
        
        if (createdContentItemId[0] > 0) {
          
          this.processedContentIds[oldContentId] = createdContentItemId[0];
          // contentItem["targetInstance"]["contentID"] = createdContentItemId[0];
        } else {

          // -1 means it couldn't save the contnet item.
         
          this.skippedContentItems[oldContentId] = contentItem.properties.referenceName;
          fileOperation.appendLogFile(
            `\n Unable to process content item for referenceName ${contentItem.properties.referenceName} with contentId ${oldContentId}.`
          );
         
          console.log(
            "\n Unable to process content item for referenceName",
            contentItem.properties.referenceName,
            "with contentId",
            oldContentId
          );

          console.log(contentItem)
        }
      }
    } catch(err){
      console.log("Error creating content item", err);
    
    }

    }
  }

  async pushLinkedContentItems() {
    let apiClient = new mgmtApi.ApiClient(this._options);
    let fileOperation = new fileOperations();

    const contentItems = this.localLinkedContentItems;

    const progressBar7 = this._multibar.create(contentItems.length, 0);
    progressBar7.update(0, { name: "Content Items: Linked" });

    let index = 1;
    let contentLength = contentItems.length;
    try {
      do {
        for (let contentItem of contentItems) {
          // console.log("contentItem", contentItem);

          if (index <= contentLength) progressBar7.update(index);
          index += 1;
          if (this.skippedContentItems[contentItem.contentID]) {
            contentItem = null;
          }
          if (!contentItem) {
            continue;
          }
          let container = new mgmtApi.Container();
          let model = new mgmtApi.Model();

          try {
            container = await apiClient.containerMethods.getContainerByReferenceName(
              contentItem.properties.referenceName,
              this._guid
            );
          } catch {
            this.skippedContentItems[contentItem.contentID] = contentItem.properties.referenceName;
            fileOperation.appendLogFile(
              `\n Unable to find a container for content item referenceName ${contentItem.properties.referenceName} with contentId ${contentItem.contentID}.`
            );
            console.log(
              "\n Unable to find a container for content item referenceName",
              contentItem.properties.referenceName,
              "with contentId",
              contentItem.contentID
            );
            contentItem = null;
          }

          try {
            model = await apiClient.modelMethods.getContentModel(container.contentDefinitionID, this._guid);
          } catch {
            this.skippedContentItems[contentItem.contentID] = contentItem.properties.referenceName;
            fileOperation.appendLogFile(
              `\n Unable to find model for content item referenceName ${contentItem.properties.referenceName} with contentId ${contentItem.contentID}.`
            );
            console.log(
              "\n Unable to find model for content item referenceName",
              contentItem.properties.referenceName,
              "with contentId",
              contentItem.contentID
            );
            contentItem = null;
          }
          for (let j = 0; j < model.fields.length; j++) {
            let field = model.fields[j];
            let settings = field.settings;
            let fieldName = this.camelize(field.name);
            let fieldVal = contentItem.fields[fieldName];
            if (fieldVal) {
              if (field.type === "Content") {
                if (settings["LinkeContentDropdownValueField"]) {
                  if (settings["LinkeContentDropdownValueField"] !== "CREATENEW") {
                    let linkedField = this.camelize(settings["LinkeContentDropdownValueField"]);
                    let linkedContentIds = contentItem.fields[linkedField];
                    let newlinkedContentIds = "";
                    if (linkedContentIds) {
                      let splitIds = linkedContentIds.split(",");
                      for (let k = 0; k < splitIds.length; k++) {
                        let id = splitIds[k];
                        if (this.skippedContentItems[id]) {
                          this.skippedContentItems[contentItem.contentID] = contentItem.properties.referenceName;
                          fileOperation.appendLogFile(
                            `\n Unable to process content item for referenceName ${contentItem.properties.referenceName} with contentId ${contentItem.contentID}.`
                          );
                          continue;
                        }
                        if (this.processedContentIds[id]) {
                          let newSortId = this.processedContentIds[id].toString();
                          if (!newlinkedContentIds) {
                            newlinkedContentIds = newSortId.toString();
                          } else {
                            newlinkedContentIds += "," + newSortId.toString();
                          }
                        } else {
                          try {
                            let file = fileOperation.readFile(
                              `.agility-files/${this._guid}/${this._locale}/${
                                isPreview ? "preview" : "live"
                              }/item/${id}.json`
                            );
                            contentItem = null;
                            break;
                          } catch {
                            this.skippedContentItems[contentItem.contentID] = contentItem.properties.referenceName;
                            this.skippedContentItems[id] = "OrphanRef";
                            fileOperation.appendLogFile(
                              `\n Unable to process content item for referenceName ${contentItem.properties.referenceName} with contentId ${contentItem.contentID} as the content is orphan. Orphan ID ${id}.`
                            );
                            continue;
                          }
                        }
                      }
                    }
                    if (newlinkedContentIds) contentItem.fields[linkedField] = newlinkedContentIds;
                  }
                }
                if (settings["SortIDFieldName"]) {
                  if (settings["SortIDFieldName"] !== "CREATENEW") {
                    let sortField = this.camelize(settings["SortIDFieldName"]);
                    let sortContentIds = contentItem.fields[sortField];
                    let newSortContentIds = "";

                    if (sortContentIds) {
                      let splitIds = sortContentIds.split(",");
                      for (let k = 0; k < splitIds.length; k++) {
                        let id = splitIds[k];
                        if (this.skippedContentItems[id]) {
                          this.skippedContentItems[contentItem.contentID] = contentItem.properties.referenceName;
                          fileOperation.appendLogFile(
                            `\n Unable to process content item for referenceName ${contentItem.properties.referenceName} with contentId ${contentItem.contentID}.`
                          );
                          continue;
                        }
                        if (this.processedContentIds[id]) {
                          let newSortId = this.processedContentIds[id].toString();
                          if (!newSortContentIds) {
                            newSortContentIds = newSortId.toString();
                          } else {
                            newSortContentIds += "," + newSortId.toString();
                          }
                        } else {
                          try {
                            let file = fileOperation.readFile(
                              `.agility-files/${this._guid}/${this._locale}/${
                                isPreview ? "preview" : "live"
                              }/item/${id}.json`
                            );
                            contentItem = null;
                            break;
                          } catch {
                            this.skippedContentItems[contentItem.contentID] = contentItem.properties.referenceName;
                            this.skippedContentItems[id] = "OrphanRef";
                            fileOperation.appendLogFile(
                              `\n Unable to process content item for referenceName ${contentItem.properties.referenceName} with contentId ${contentItem.contentID} as the content is orphan. Orphan ID ${id}`
                            );
                            continue;
                          }
                        }
                      }
                    }
                    if (newSortContentIds) contentItem.fields[sortField] = newSortContentIds;
                  }
                }
                delete fieldVal.fulllist;
                if ("contentid" in fieldVal) {
                  let linkedContentId = fieldVal.contentid;
                  if (this.skippedContentItems[linkedContentId]) {
                    this.skippedContentItems[contentItem.contentID] = contentItem.properties.referenceName;
                    fileOperation.appendLogFile(
                      `\n Unable to process content item for referenceName ${contentItem.properties.referenceName} with contentId ${contentItem.contentID}.`
                    );
                    continue;
                  }
                  if (this.processedContentIds[linkedContentId]) {
                    let file = fileOperation.readFile(
                      `.agility-files/${this._guid}/${this._locale}/${
                        isPreview ? "preview" : "live"
                      }/item/${linkedContentId}.json`
                    );
                    let extractedContent = JSON.parse(file) as mgmtApi.ContentItem;
                    contentItem.fields[fieldName] = extractedContent.properties.referenceName;
                  } else {
                    try {
                      let file = fileOperation.readFile(
                        `.agility-files/${this._guid}/${this._locale}/${
                          isPreview ? "preview" : "live"
                        }/item/${linkedContentId}.json`
                      );
                      contentItem = null;
                      break;
                    } catch {
                      this.skippedContentItems[contentItem.contentID] = contentItem.properties.referenceName;
                      this.skippedContentItems[linkedContentId] = "OrphanRef";
                      fileOperation.appendLogFile(
                        `\n Unable to process content item for referenceName ${contentItem.properties.referenceName} with contentId ${contentItem.contentID} as the content is orphan. Orphan ID ${linkedContentId}`
                      );
                      continue;
                    }
                  }
                }
                if ("referencename" in fieldVal) {
                  let refName = fieldVal.referencename;
                  try {
                    let container = await apiClient.containerMethods.getContainerByReferenceName(refName, this._guid);
                    if (!container) {
                      this.skippedContentItems[contentItem.contentID] = contentItem.properties.referenceName;
                      fileOperation.appendLogFile(
                        `\n Unable to find a container for content item referenceName ${contentItem.properties.referenceName} with contentId ${contentItem.contentID}.`
                      );
                      continue;
                    }
                    if ("sortids" in fieldVal) {
                      contentItem.fields[fieldName].referencename = fieldVal.referencename;
                    } else {
                      contentItem.fields[fieldName] = fieldVal.referencename;
                    }
                  } catch {
                    this.skippedContentItems[contentItem.contentID] = contentItem.properties.referenceName;
                    fileOperation.appendLogFile(
                      `\n Unable to process content item for referenceName ${contentItem.properties.referenceName} with contentId ${contentItem.contentID}.`
                    );
                    continue;
                  }
                }
                if ("sortids" in fieldVal) {
                  let sortids = fieldVal.sortids.split(",");
                  let newSortIds = "";
                  for (let s = 0; s < sortids.length; s++) {
                    let sortid = sortids[s];
                    if (this.skippedContentItems[sortid]) {
                      this.skippedContentItems[contentItem.contentID] = contentItem.properties.referenceName;
                      fileOperation.appendLogFile(
                        `\n Unable to process content item for referenceName ${contentItem.properties.referenceName} with contentId ${contentItem.contentID}.`
                      );
                      continue;
                    }
                    if (this.processedContentIds[sortid]) {
                      let newSortId = this.processedContentIds[sortid].toString();
                      if (!newSortIds) {
                        newSortIds = newSortId.toString();
                      } else {
                        newSortIds += "," + newSortId.toString();
                      }
                    } else {
                      try {
                        let file = fileOperation.readFile(
                          `.agility-files/${this._guid}/${this._locale}/${
                            isPreview ? "preview" : "live"
                          }/item/${sortid}.json`
                        );
                        contentItem = null;
                        break;
                      } catch {
                        this.skippedContentItems[contentItem.contentID] = contentItem.properties.referenceName;
                        this.skippedContentItems[sortid] = "OrphanRef";
                        fileOperation.appendLogFile(
                          `\n Unable to process content item for referenceName ${contentItem.properties.referenceName} with contentId ${contentItem.contentID} as the content is orphan. . Orphan ID ${sortid}`
                        );
                        continue;
                      }
                    }
                  }
                  if (newSortIds) {
                    newSortIds = newSortIds.substring(0, newSortIds.length);
                  }
                  contentItem.fields[fieldName].sortids = newSortIds;
                }
              } else if (
                field.type === "ImageAttachment" ||
                field.type === "FileAttachment" ||
                field.type === "AttachmentList"
              ) {
                if (typeof fieldVal === "object") {
                  if (Array.isArray(fieldVal)) {
                    for (let k = 0; k < fieldVal.length; k++) {
                      let retUrl = await this.changeOriginKey(this._guid, fieldVal[k].url);
                      contentItem.fields[fieldName][k].url = retUrl;
                    }
                  } else {
                    if ("url" in fieldVal) {
                      let retUrl = await this.changeOriginKey(this._guid, fieldVal.url);
                      contentItem.fields[fieldName].url = retUrl;
                    }
                  }
                }
              } else {
                if (typeof fieldVal === "object") {
                  if ("fulllist" in fieldVal) {
                    delete fieldVal.fulllist;
                    if (field.type === "PhotoGallery") {
                      let oldGalleryId = fieldVal.galleryid;
                      if (this.processedGalleries[oldGalleryId]) {
                        contentItem.fields[fieldName] = this.processedGalleries[oldGalleryId].toString();
                      } else {
                        contentItem.fields[fieldName] = fieldVal.galleryid.toString();
                      }
                    }
                  }
                }
              }
            }
          }

          if (contentItem) {
            if (!this.skippedContentItems[contentItem.contentID]) {
              const oldContentId = contentItem.contentID;
              contentItem.contentID = -1;

              let createdContentItemId = await apiClient.contentMethods.saveContentItem(
                contentItem,
                this._guid,
                this._locale
              );

              if (createdContentItemId[0]) {
                if (createdContentItemId[0] > 0) {
                  this.processedContentIds[oldContentId] = createdContentItemId[0];
                } else {
                  this.skippedContentItems[oldContentId] = contentItem.properties.referenceName;
                  fileOperation.appendLogFile(
                    `\n Unable to process content item for referenceName ${contentItem.properties.referenceName} with contentId ${oldContentId}.`
                  );
                }
              }
              contentItem = null;
            }
          }
        }
      } while (contentItems.filter((c) => c !== null).length !== 0);
    } catch {}
  }

  async changeOriginKey(guid: string, url: string) {
    let apiClient = new mgmtApi.ApiClient(this._options);

    let defaultContainer = await apiClient.assetMethods.getDefaultContainer(guid);

    let filePath = this.getFilePath(url);
    filePath = filePath.replace(/%20/g, " ");

    let edgeUrl = `${defaultContainer.edgeUrl}/${filePath}`;

    try {
      let existingMedia = await apiClient.assetMethods.getAssetByUrl(edgeUrl, guid);
      return edgeUrl;
    } catch {
      return url;
    }
  }

  camelize(str: string) {
    return str
      .replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
        return index === 0 ? word.toLowerCase() : word.toUpperCase();
      })
      .replace(/\s+/g, "");
  }

  async getLinkedModels() {
    const models = this.localModels;
    try {
      let linkedModels: mgmtApi.Model[] = [];
      models.forEach((model) =>
        model.fields.flat().find((field) => {
          if (field.type === "Content") {
            this.localLinkedModels.push(model);
            return linkedModels.push(model);
          }
        })
      );
      return linkedModels;
    } catch {}
  }

  async getNormalModels() {
    const allModels = this.localModels;
    const linkedModels = this.localLinkedModels;
    try {
      let normalModels = allModels.filter((model) => linkedModels.indexOf(model) < 0);
      for (const model of normalModels) {
        this.localNormalModels.push(model);
        // this.localNormalModels[model.referenceName] = model;
      }
      return normalModels;
    } catch {}
  }

  async pushNormalModels() {
    const models = this.localNormalModels;
    const processedModels: mgmtApi.Model[] = [];
    const progressBar = this._multibar.create(models.length, 0);
    progressBar.update(0, { name: "Models: Non Linked" });

    let index = 0;
    for (const model of models) {

      // console.log(model)
      const newModel = await this.createModel(model);
      // console.log('\n newModel', newModel)
      processedModels.push(newModel);
      model["targetInstance"] = newModel;
      progressBar.increment();
      index++;
    }

    return processedModels;
  }
  async pushContainers() {
    const apiClient = new mgmtApi.ApiClient(this._options);
    const containers = this.localContainers.slice(0, 1);
    const progressBar = this._multibar.create(containers.length, 0);
    progressBar.update(0, { name: "Containers" });
  
    // Step 1: Build contentDefinitionID -> referenceName map
    const modelRefs: { [key: number]: string } = {};
   console.log(this.localModels)
    for (const container of containers) {

      console.log(container)

      const model = this.localModels.find(
        (model) => model.id === container.contentDefinitionID
      );


      if (model) {
        modelRefs[container.contentDefinitionID] = model.referenceName;
      }
    }
  
    // Step 2: Loop and process containers
    const containerPromises = containers.map(async (container) => {
      const referenceName = modelRefs[container.contentDefinitionID];

      console.log('\n referenceName', referenceName)
      const targetModelID = this.processedModels[referenceName];
      console.log('localModel', this.localModels.find((model) => model.id === container.contentDefinitionID))
      // Skip if we don't have a model mapping
      if (!targetModelID) {

        console.log('\n Target model ID not found for container', targetModelID);

        console.warn(`Skipping container ${container.referenceName}, no model mapping found.`);
        progressBar.increment();
        return;
      }
  
      // Assign correct model ID for the target instance
      const clonedContainer = {
        ...container,
        contentDefinitionID: targetModelID,
      };
  
      try {
        const existingContainer = await apiClient.containerMethods.getContainerByReferenceName(
          container.referenceName,
          this._targetGuid
        );
  
        if (existingContainer) {
          clonedContainer.contentViewID = existingContainer.contentViewID;
          const updatedContainer = await apiClient.containerMethods.saveContainer(
            clonedContainer,
            this._targetGuid
          );
  
          const containerIndex = this.localContainers.findIndex(
            (c) => c.referenceName === container.referenceName
          );
          if (containerIndex !== -1) {
            container["targetInstance"] = updatedContainer;
          }
        } else {
          // Doesn't exist, create new
          clonedContainer.contentViewID = -1;
          const newContainer = await apiClient.containerMethods.saveContainer(
            clonedContainer,
            this._targetGuid
          );
  
          const containerIndex = this.localContainers.findIndex(
            (c) => c.referenceName === container.referenceName
          );
          if (containerIndex !== -1) {
            container["targetInstance"] = newContainer;
          }
        }
      } catch (err) {
        console.log(`\n Error creating or updating container ${container.referenceName}`, err);
      } finally {
        progressBar.increment();
      }
    });
  
    await Promise.all(containerPromises);
  
    // for (const container of containers) {
    //   try {
    //     let existingContainer = await apiClient.containerMethods.getContainerByReferenceName(
    //       container.referenceName,
    //       this._targetGuid
    //     );

    //     if (existingContainer) {
    //       const containerIndex = this.localContainers.findIndex((c) => c.referenceName === container.referenceName);
    //       if (containerIndex !== -1) {
    //         this.localContainers[containerIndex]["targetInstance"] = existingContainer;
    //       }
    //     }
    //   } catch {
    //     // console.log('\n Unable to find container for referenceName', container.referenceName);       
    //     container.contentViewID = -1;
        
    //     try {
    //       const newContainer = await apiClient.containerMethods.saveContainer(container, this._targetGuid);

    //       const containerIndex = this.localContainers.findIndex((c) => c.referenceName === container.referenceName);
    //       if (containerIndex !== -1) {
    //         this.localContainers[containerIndex]["targetInstance"] = newContainer;
    //         // console.log(`\n Created container for referenceName ${container.referenceName} as ${newContainer.referenceName}`, newContainer.contentViewID);
    //       }
    //     } catch(createError){
    //       console.log('\n Unable to create container for referenceName', container.referenceName);
    //       console.log('createError', createError);
    //     }

    //   } finally {
    //     progressBar.increment();
    //   }
    // }

    const check = await apiClient.containerMethods.getContainerList(this._targetGuid);

    console.log('\n check', check)

    console.log(ansiColors.green("\n 🚀 Containers completed \n"));
  }

  async pushLinkedModels() {
    const models = this.localLinkedModels;
    let apiClient = new mgmtApi.ApiClient(this._options);
    let fileOperation = new fileOperations();
    let processedModels: mgmtApi.Model[] = [];
    let completedModels: string[] = [];
    let unprocessedModels: string[] = [];
    const progressBar4 = this._multibar.create(models.length, 0);
    progressBar4.update(0, { name: "Models: Linked" });
    let index = 1;

    do {
      for (let i = 0; i < models.length; i++) {
        let model = models[i];
        progressBar4.update(index);
        index += 1;

        if (!model) {
          continue;
        }
        try {
          let existing = await apiClient.modelMethods.getModelByReferenceName(model.referenceName, this._targetGuid);
          if (existing) {
            let updatesToModel = this.updateModel(existing, model);
            updatesToModel.id = existing.id;
            let updatedModel = await apiClient.modelMethods.saveModel(updatesToModel, this._targetGuid);
            processedModels.push(updatedModel);
            this.processedModels[updatedModel.referenceName] = updatedModel.id;
            completedModels.push(updatedModel.referenceName);
            this.localLinkedModels.push(updatedModel);
            models[i] = null;
          }
        } catch {
          for (let j = 0; j < model.fields.length; j++) {
            let field = model.fields[j];
            if (field.settings["ContentDefinition"]) {
              let modelRef = field.settings["ContentDefinition"];
              if (model.referenceName !== modelRef) {
                if (this.processedModels[modelRef] && !this.processedModels[model.referenceName]) {
                  model.id = 0;
                  try {
                    let createdModel = await apiClient.modelMethods.saveModel(model, this._targetGuid);
                    processedModels.push(createdModel);
                    this.processedModels[createdModel.referenceName] = createdModel.id;
                    completedModels.push(createdModel.referenceName);
                    this.localLinkedModels.push(createdModel);
                    models[i] = null;
                  } catch {
                    unprocessedModels.push(model.referenceName);
                    //fileOperation.appendLogFile(`\n Unable to process model for referenceName ${model.referenceName} with modelId ${model.id}.`);
                    models[i] = null;
                    continue;
                  }
                }
              } else {
                let oldModelId = model.id;
                model.id = 0;
                try {
                  let createdModel = await apiClient.modelMethods.saveModel(model, this._targetGuid);
                  processedModels.push(createdModel);
                  this.processedModels[createdModel.referenceName] = createdModel.id;
                  completedModels.push(createdModel.referenceName);
                  this.localLinkedModels.push(createdModel);
                  models[i] = null;
                } catch {
                  unprocessedModels.push(model.referenceName);
                  //fileOperation.appendLogFile(`\n Unable to process model for referenceName ${model.referenceName} with modelId ${oldModelId}.`);
                  models[i] = null;
                  continue;
                }
              }
            } else {
              //special case to handle if the content definition id is not present.
              let oldModelId = model.id;
              model.id = 0;
              try {
                let createdModel = await apiClient.modelMethods.saveModel(model, this._targetGuid);
                processedModels.push(createdModel);
                this.processedModels[createdModel.referenceName] = createdModel.id;
                completedModels.push(createdModel.referenceName);
                this.localLinkedModels.push(createdModel);
                models[i] = null;
              } catch (err) {
                unprocessedModels.push(model.referenceName);
                //fileOperation.appendLogFile(`\n Unable to process model for referenceName ${model.referenceName} with modelId ${oldModelId}.`);
                models[i] = null;
                continue;
              }
            }
          }
        }
      }
    } while (models.filter((m) => m !== null).length !== 0);

    let unprocessed = unprocessedModels.filter((x) => !completedModels.includes(x));

    for (let i = 0; i < unprocessed.length; i++) {
      fileOperation.appendLogFile(`\n Unable to process model for referenceName ${unprocessed[i]}.`);
    }
    return processedModels;
  }

  async createModel(model: mgmtApi.Model) {
    let apiClient = new mgmtApi.ApiClient(this._options);
    try {
      let existing = await apiClient.modelMethods.getModelByReferenceName(model.referenceName, this._targetGuid);
      console.log('Create model - existing?', existing)
      let oldModelId = model.id;
      if (existing) {
        let updatesToModel = this.updateModel(existing, model);
        updatesToModel.id = existing.id;
        let updatedModel = await apiClient.modelMethods.saveModel(updatesToModel, this._targetGuid);
        this.processedModels[updatedModel.referenceName] = updatedModel.id;
        return updatedModel;
      } else {
        model.id = 0;
        let newModel = await apiClient.modelMethods.saveModel(model, this._targetGuid);
        this.processedModels[newModel.referenceName] = newModel.id;
        return newModel;
      }
    } catch {
      model.id = 0;
      let newModel = await apiClient.modelMethods.saveModel(model, this._targetGuid);
      this.processedModels[newModel.referenceName] = newModel.id;
      return newModel;
    }
  }

  updateFields(obj1: mgmtApi.Model, obj2: mgmtApi.Model): mgmtApi.ModelField[] {
    const updatedFields: mgmtApi.ModelField[] = [];

    obj1.fields.forEach((field1) => {
      const field2Index = obj2.fields.findIndex((field2) => field2.name === field1.name);

      if (field2Index !== -1) {
        field1.settings = {
          ...field1.settings,
          ...obj2.fields[field2Index].settings,
        };
        updatedFields.push(field1);
      } else {
        updatedFields.push(field1);
      }
    });

    obj2.fields.forEach((field2) => {
      const field1Index = obj1.fields.findIndex((field1) => field1.name === field2.name);

      if (field1Index === -1) {
        updatedFields.push(field2);
      }
    });

    return updatedFields;
  }

  updateModel(obj1: mgmtApi.Model, obj2: mgmtApi.Model): mgmtApi.Model {
    const updatedObj: mgmtApi.Model = {
      ...obj1,
      id: obj1.id,
      lastModifiedDate: obj1.lastModifiedDate,
    };

    // Update other properties from obj2
    updatedObj.displayName = obj2.displayName;
    updatedObj.referenceName = obj2.referenceName;
    updatedObj.lastModifiedBy = obj2.lastModifiedBy;
    updatedObj.lastModifiedAuthorID = obj2.lastModifiedAuthorID;
    updatedObj.description = obj2.description;
    updatedObj.allowTagging = obj2.allowTagging;
    updatedObj.contentDefinitionTypeName = obj2.contentDefinitionTypeName;
    updatedObj.isPublished = obj2.isPublished;
    updatedObj.wasUnpublished = obj2.wasUnpublished;

    // Update fields based on rules
    updatedObj.fields = this.updateFields(updatedObj, obj2);

    return updatedObj;
  }

  async validateDryRun(model: mgmtApi.Model, guid: string) {
    let apiClient = new mgmtApi.ApiClient(this._options);
    let differences: any = {};
    try {
      let existing = await apiClient.modelMethods.getModelByReferenceName(model.referenceName, guid);
      if (existing) {
        differences = await this.findModelDifferences(model, existing, model.referenceName);
      } else {
        differences["referenceName"] = {
          referenceName: "Model with referenceName " + model.referenceName + " will be added.",
        };
      }
    } catch {
      differences["referenceName"] = {
        referenceName: "Model with referenceName " + model.referenceName + " will be added.",
      };
    }
    return differences;
  }

  async validateDryRunLinkedModels(model: mgmtApi.Model, guid: string) {
    let apiClient = new mgmtApi.ApiClient(this._options);
    let differences: any = {};
    let fileOperation = new fileOperations();
    for (let j = 0; j < model.fields.length; j++) {
      let field = model.fields[j];
      if (field.settings["ContentDefinition"]) {
        let modelRef = field.settings["ContentDefinition"];
        try {
          let existingLinked = await apiClient.modelMethods.getModelByReferenceName(modelRef, guid);
          if (existingLinked) {
            if (fileOperation.checkFileExists(`.agility-files/models/${existingLinked.id}.json`)) {
              let file = fileOperation.readFile(`.agility-files/models/${existingLinked.id}.json`);
              const modelData = JSON.parse(file) as mgmtApi.Model;
              differences = await this.findModelDifferences(modelData, existingLinked, model.referenceName);
            } else {
              fileOperation.appendLogFile(
                `\n Unable to find model for referenceName ${existingLinked.referenceName} in the dry run for linked models.`
              );
            }
          }
        } catch {
          differences["referenceName"] = {
            referenceName: "Model with referenceName " + modelRef + " will be added.",
          };
        }
      }
    }
    try {
      let existing = await apiClient.modelMethods.getModelByReferenceName(model.referenceName, guid);
      if (existing) {
        differences = await this.findModelDifferences(model, existing, model.referenceName);
      } else {
        differences["referenceName"] = {
          referenceName: "Model with referenceName " + model.referenceName + " will be added.",
        };
      }
    } catch {
      differences["referenceName"] = {
        referenceName: "Model with referenceName " + model.referenceName + " will be added.",
      };
    }
    return differences;
  }

  async validateDryRunTemplates(template: mgmtApi.PageModel, guid: string, locale: string) {
    let apiClient = new mgmtApi.ApiClient(this._options);
    let differences: any = {};
    try {
      let existingTemplate = await apiClient.pageMethods.getPageTemplateName(guid, locale, template.pageTemplateName);
      if (existingTemplate) {
        differences = await this.findTemplateDifferences(template, existingTemplate, existingTemplate.pageTemplateName);
      } else {
        differences["templateName"] = {
          templateName: "Page Template with templateName " + template.pageTemplateName + " will be added.",
        };
      }
    } catch {
      differences["templateName"] = {
        templateName: "Page Template with templateName " + template.pageTemplateName + " will be added.",
      };
    }

    return differences;
  }

  // async compareTemplateObjects(obj1: any, obj2: any, templateName: string) {
  //     const differences: any = {};
  //     const ignoreFields = ['pageTemplateID', 'releaseDate', 'pullDate'];
  //     const compareProps = (obj1: any, obj2: any, path: string = '') => {
  //       for (const key in obj1) {
  //         if (obj1.hasOwnProperty(key) && !ignoreFields.includes(key)) {
  //           const newPath = path ? `${path}.${key}` : key;
  //           if (typeof obj1[key] === 'object' && obj1[key] !== null && typeof obj2[key] === 'object' && obj2[key] !== null) {
  //             compareProps(obj1[key], obj2[key], newPath);
  //           } else if (obj1[key] !== obj2[key]) {
  //             differences[newPath] = {
  //               oldValue: obj1[key],
  //               newValue: obj2[key],
  //               templateName: templateName
  //             };
  //           }
  //         }
  //       }
  //     };

  //     compareProps(obj1, obj2);
  //     return differences;
  //   }

  findModelDifferences(obj1: any, obj2: any, referenceName: string): { added: any; updated: any } {
    const added: any = {};
    const updated: any = {};
    const data: any = {};

    if (obj1.displayName !== obj2.displayName) {
      updated.displayName = obj1.displayName;
    }

    obj1.fields.forEach((field1) => {
      const field2 = obj2.fields.find((f) => f.name === field1.name);

      if (!field2) {
        added[field1.name] = field1;
      } else {
        const updatedProps: any = {};

        if (field1.label !== field2.label) {
          updatedProps.label = field2.label;
        }
        if (field1.labelHelpDescription !== field2.labelHelpDescription) {
          updatedProps.labelHelpDescription = field1.labelHelpDescription;
        }
        if (field1.designerOnly !== field2.designerOnly) {
          updatedProps.designerOnly = field1.designerOnly;
        }
        if (field1.isDataField !== field2.isDataField) {
          updatedProps.isDataField = field1.isDataField;
        }
        if (field1.editable !== field2.editable) {
          updatedProps.editable = field1.editable;
        }
        if (field1.hiddenField !== field2.hiddenField) {
          updatedProps.hiddenField = field1.hiddenField;
        }
        if (field1.description !== field2.description) {
          updatedProps.description = field1.description;
        }

        const settings1 = field1.settings;
        const settings2 = field2.settings;
        const settingsDiff: any = {};

        Object.keys(settings1).forEach((key) => {
          if (settings1[key] !== settings2[key]) {
            settingsDiff[key] = settings1[key];
          }
        });

        if (Object.keys(settingsDiff).length > 0) {
          updatedProps.settings = settingsDiff;
        }

        if (Object.keys(updatedProps).length > 0) {
          updated[field1.name] = updatedProps;
        }
      }
    });
    if (Object.keys(added).length > 0 || Object.keys(updated).length > 0) {
      let result = { added, updated };
      data[referenceName] = { result };
      return data;
    } else {
      return null;
    }
  }

  findTemplateDifferences(
    obj1: mgmtApi.PageModel,
    obj2: mgmtApi.PageModel,
    pageTemplateName: string
  ): { added: any; updated: any } {
    const added: any = {};
    const updated: any = {};
    const data: any = {};

    if (obj1.doesPageTemplateHavePages !== obj2.doesPageTemplateHavePages) {
      updated.doesPageTemplateHavePages = obj2.doesPageTemplateHavePages;
    }

    if (obj1.digitalChannelTypeName !== obj2.digitalChannelTypeName) {
      updated.digitalChannelTypeName = obj2.digitalChannelTypeName;
    }
    if (obj1.agilityCode !== obj2.agilityCode) {
      updated.agilityCode = obj2.agilityCode;
    }
    if (obj1.relativeURL !== obj2.relativeURL) {
      updated.relativeURL = obj2.relativeURL;
    }
    if (obj1.previewUrl !== obj2.previewUrl) {
      updated.previewUrl = obj2.previewUrl;
    }

    // for (const key in obj1) {
    //   if (obj1.hasOwnProperty(key) && obj2.hasOwnProperty(key)) {
    //     if (obj1[key] !== obj2[key]) {
    //       updated[key] = obj2[key];
    //     }
    //   }
    // }

    // for (const key in obj2) {
    //   if (obj2.hasOwnProperty(key) && !obj1.hasOwnProperty(key)) {
    //     added[key] = obj2[key];
    //   }
    // }

    // Compare contentSectionDefinitions
    const csd1 = obj1.contentSectionDefinitions || [];
    const csd2 = obj2.contentSectionDefinitions || [];

    csd1.forEach((csd1Item) => {
      const csd2Item = csd2.find(
        (item) => item?.pageItemTemplateReferenceName === csd1Item?.pageItemTemplateReferenceName
      );
      if (!csd2Item) {
        added.contentSectionDefinitions = added.contentSectionDefinitions || [];
        added.contentSectionDefinitions.push(csd1Item);
      } else {
        const diff = this.compareObjects(csd1Item, csd2Item);
        if (Object.keys(diff).length > 0) {
          updated.contentSectionDefinitions = updated.contentSectionDefinitions || [];
          updated.contentSectionDefinitions.push(diff);
        }
      }
    });

    // Compare sharedModules
    const sharedModules1 = obj1.contentSectionDefinitions?.flatMap((csd) => csd?.sharedModules || []) || [];
    const sharedModules2 = obj2.contentSectionDefinitions?.flatMap((csd) => csd?.sharedModules || []) || [];

    sharedModules1.forEach((sm1) => {
      const sm2 = sharedModules2.find((item) => item?.name === sm1?.name);
      if (!sm2) {
        added.sharedModules = added.sharedModules || [];
        added.sharedModules.push(sm1);
      } else {
        const diff = this.compareObjects(sm1, sm2);
        if (Object.keys(diff).length > 0) {
          updated.sharedModules = updated.sharedModules || [];
          updated.sharedModules.push(diff);
        }
      }
    });

    // Compare defaultModules
    const defaultModules1 = obj1.contentSectionDefinitions?.flatMap((csd) => csd?.defaultModules || []) || [];
    const defaultModules2 = obj2.contentSectionDefinitions?.flatMap((csd) => csd?.defaultModules || []) || [];

    defaultModules1.forEach((dm1) => {
      const dm2 = defaultModules2.find((item) => item?.title === dm1?.title);
      if (!dm2) {
        added.defaultModules = added.defaultModules || [];
        added.defaultModules.push(dm1);
      } else {
        const diff = this.compareObjects(dm1, dm2);
        if (Object.keys(diff).length > 0) {
          updated.defaultModules = updated.defaultModules || [];
          updated.defaultModules.push(diff);
        }
      }
    });

    if (Object.keys(added).length > 0 || Object.keys(updated).length > 0) {
      let result = { added, updated };
      data[pageTemplateName] = { result };
      return data;
    } else {
      return null;
    }
  }

  compareObjects(obj1: any, obj2: any): any {
    const diff: any = {};

    for (const key in obj1) {
      if (obj1.hasOwnProperty(key) && obj2.hasOwnProperty(key)) {
        if (obj1[key] !== obj2[key]) {
          diff[key] = obj2[key];
        }
      }
    }

    return diff;
  }

  //   compareModelObjects = (obj1: any, obj2: any, referenceName: string): string => {
  //     const result: ComparisonResult = {};
  //     const data: any = {};

  //     const compareProperties = (field1: mgmtApi.ModelField, field2: mgmtApi.ModelField) => {
  //         const fieldChanges: ComparisonResult = {};

  //         for (const key in field1) {
  //             if (key !== "id" && key !== "lastModifiedDate" && field1[key as keyof mgmtApi.ModelField] !== field2[key as keyof mgmtApi.ModelField]) {
  //                 fieldChanges[key] = {
  //                     oldValue: field1[key as keyof mgmtApi.ModelField],
  //                     newValue: field2[key as keyof mgmtApi.ModelField]
  //                 };
  //             }
  //         }

  //         return fieldChanges;
  //     };

  //     // Compare top-level properties
  //     const topLevelChanges = compareProperties(obj1, obj2);
  //     Object.assign(result, topLevelChanges);

  //     // Compare fields
  //     const fieldsChanges: ComparisonResult = {
  //         oldValue: [],
  //         newValue: []
  //     };

  //     for (const field1 of obj1.fields) {
  //         const field2 = obj2.fields.find((f: mgmtApi.ModelField) => f.name === field1.name);
  //         if (!field2) {
  //             fieldsChanges.oldValue.push(field1);
  //             fieldsChanges.newValue.push(field1); // Add null for missing field in newValue
  //         } else {
  //             const fieldChanges = compareProperties(field1, field2);
  //             if (Object.keys(fieldChanges).length > 0) {
  //                 fieldsChanges.oldValue.push(field1);
  //                 fieldsChanges.newValue.push(field2);
  //             }
  //         }
  //     }

  //     for (const field2 of obj2.fields) {
  //         const field1 = obj1.fields.find((f: mgmtApi.ModelField) => f.name === field2.name);
  //         if (!field1) {
  //             fieldsChanges.newValue.push(field2);
  //             //fieldsChanges.oldValue.push(null); // Add null for missing field in oldValue
  //         }
  //     }

  //     if (fieldsChanges.oldValue.length > 0 || fieldsChanges.newValue.length > 0) {
  //         result.fields = fieldsChanges;
  //     }

  //     data[referenceName] = {
  //         result
  //     }
  //     return data;
  // };

  async compareModelObjects(obj1: any, obj2: any, referenceName: string) {
    const differences: any = {};
    const ignoreFields = ["lastModifiedDate", "fieldID", "id"];
    const compareProps = (obj1: any, obj2: any, path: string = "") => {
      for (const key in obj1) {
        if (obj1.hasOwnProperty(key) && !ignoreFields.includes(key)) {
          const newPath = path ? `${path}.${key}` : key;
          if (
            typeof obj1[key] === "object" &&
            obj1[key] !== null &&
            typeof obj2[key] === "object" &&
            obj2[key] !== null
          ) {
            compareProps(obj1[key], obj2[key], newPath);
          } else if (obj1[key] !== obj2[key]) {
            differences[newPath] = {
              oldValue: obj1[key],
              newValue: obj2[key],
              referenceName: referenceName,
            };
          }
        }
      }
    };

    compareProps(obj1, obj2);
    return differences;
  }

  async pushGalleries() {
    let apiClient = new mgmtApi.ApiClient(this._options);

    let assetGalleries = this.createBaseGalleries();
    if (assetGalleries) {
      const progressBar1 = this._multibar.create(assetGalleries.length, 0);
      progressBar1.update(0, { name: "Galleries" });
      let index = 1;
      for (let i = 0; i < assetGalleries.length; i++) {
        let assetGallery = assetGalleries[i];

        progressBar1.update(index);
        index += 1;
        for (let j = 0; j < assetGallery.assetMediaGroupings.length; j++) {
          let gallery = assetGallery.assetMediaGroupings[j];
          const oldGalleryId = gallery.mediaGroupingID;
          try {
            let existingGallery = await apiClient.assetMethods.getGalleryByName(this._targetGuid, gallery.name);
            if (existingGallery) {
              gallery.mediaGroupingID = existingGallery.mediaGroupingID;
            } else {
              gallery.mediaGroupingID = 0;
            }
            let createdGallery = await apiClient.assetMethods.saveGallery(this._targetGuid, gallery);
            this.processedGalleries[oldGalleryId] = createdGallery.mediaGroupingID;
          } catch {
            gallery.mediaGroupingID = 0;
            let createdGallery = await apiClient.assetMethods.saveGallery(this._targetGuid, gallery);
            this.processedGalleries[oldGalleryId] = createdGallery.mediaGroupingID;
          }
        }
      }
    }
  }

  async pushAssets() {
    let apiClient = new mgmtApi.ApiClient(this._options);
    let defaultContainer = await apiClient.assetMethods.getDefaultContainer(this._targetGuid);
    let fileOperation = new fileOperations();

    let failedAssetsExists = fileOperation.fileExists(`.agility-files/${this._guid}/${this._locale}/${this._isPreview ? 'preview':'live'}/assets/failedAssets/unProcessedAssets.json`);
    let file = failedAssetsExists
      ? fileOperation.readFile(`.agility-files/${this._guid}/${this._locale}/${this._isPreview ? 'preview':'live'}/assets/failedAssets/unProcessedAssets.json`)
      : null;

    let unProcessedAssets = JSON.parse(file) as {};

    let assetMedias = this.createBaseAssets();

    if (assetMedias) {
      let medias: mgmtApi.Media[] = [];
      for (let i = 0; i < assetMedias.length; i++) {
        let assetMedia = assetMedias[i];
        for (let j = 0; j < assetMedia.assetMedias.length; j++) {
          let media = assetMedia.assetMedias[j];
          if (unProcessedAssets) {
            if (unProcessedAssets[media.mediaID]) {
              fileOperation.appendLogFile(
                `\n Unable to process asset for mediaID ${media.mediaID} for fileName ${media.fileName}.`
              );
            } else {
              medias.push(media);
            }
          } else {
            medias.push(media);
          }
        }
      }

      let re = /(?:\.([^.]+))?$/;
      const progressBar2 = this._multibar.create(medias.length, 0);
      progressBar2.update(0, { name: "Assets" });

      let index = 1;
      for (let i = 0; i < medias.length; i++) {
        let media = medias[i];

        progressBar2.update(index);
        index += 1;

        let filePath = this.getFilePath(media.originUrl);
        filePath = filePath.replace(/%20/g, " ");
        let folderPath = filePath.split("/").slice(0, -1).join("/");
        if (!folderPath) {
          folderPath = "/";
        }
        let orginUrl = `${defaultContainer.originUrl}/${filePath}`;
        const form = new FormData();
        const file = fs.readFileSync(`.agility-files/${this._guid}/${this._locale}/${this._isPreview ? 'preview':'live'}/assets/${filePath}`, null);
        form.append("files", file, media.fileName);
        let mediaGroupingID = -1;
        try {
          let existingMedia = await apiClient.assetMethods.getAssetByUrl(orginUrl, this._targetGuid);

          if (existingMedia) {
            if (media.mediaGroupingID > 0) {
              mediaGroupingID = await this.doesGalleryExists(this._targetGuid, media.mediaGroupingName);
            }
          } else {
            if (media.mediaGroupingID > 0) {
              mediaGroupingID = await this.doesGalleryExists(this._targetGuid, media.mediaGroupingName);
            }
          }
          let uploadedMedia = await apiClient.assetMethods.upload(form, folderPath, this._targetGuid, mediaGroupingID);
        } catch {
          if (media.mediaGroupingID > 0) {
            mediaGroupingID = await this.doesGalleryExists(this._targetGuid, media.mediaGroupingName);
          }
          let uploadedMedia = await apiClient.assetMethods.upload(form, folderPath, this._targetGuid, mediaGroupingID);
        }
      }
    }
  }

  async doesGalleryExists(guid: string, mediaGroupingName: string) {
    let apiClient = new mgmtApi.ApiClient(this._options);
    let mediaGroupingID = -1;
    try {
      let gallery = await apiClient.assetMethods.getGalleryByName(guid, mediaGroupingName);
      if (gallery) {
        mediaGroupingID = gallery.mediaGroupingID;
      } else {
        mediaGroupingID = -1;
      }
    } catch {
      return -1;
    }
    return mediaGroupingID;
  }

  getFilePath(originUrl: string): string {
    let url = new URL(originUrl);
    let pathName = url.pathname;
    let extractedStr = pathName.split("/")[1];
    let removedStr = pathName.replace(`/${extractedStr}/`, "");

    return removedStr;
  }

  async syncInstance(guid: string, targetGuid: string, locale: string, isPreview: boolean) {
    /////////////// SYNC INSTANCE
  }

  async pushContentItems() {
    const contentItems = this.localContentItems;

    if (contentItems) {
      await this.pushNormalContentItems();
      // let linkedContentItems = await this.getLinkedContent(guid, Object.values(contentItems));
      await this.pushLinkedContentItems();

      // let normalContentItems = await this.getNormalContent(guid, Object.values(contentItems), linkedContentItems);
   
    }
  }

  async pushModels() {
    await this.pushNormalModels();
    await this.pushLinkedModels();
    await this.pushPageModels();
  }

  async pushPageModels() {
    const pageModels = this.localPageModels;
    if (pageModels && Array.isArray(pageModels)) {
      for (const pageModel of pageModels) {
        await this.pushTemplates([pageModel]);
      }
    }
  }

  // async pushPages(pages: mgmtApi.PageItem[], guid: string, targetGuid: string, locale: string, isPreview: boolean) {
  //   if (pages) {
  //     for (const page of pages) {
  //       await this.processPage(page, targetGuid, locale, page.parentPageID > 0);
  //     }
  //   }
  // }

  async pushContentModelsFromLocalStore(guid: string, targetGuid: string, locale: string, isPreview: boolean) {
    let contentModels = this.getModelsFromLocalStore();
    if (contentModels) {
      // console.log("Content Models", contentModels);
      // await this.pushModels(models, guid, targetGuid);
    }
  }

  async pushInstance() {
    // TODO: we want to check if the target instance is empty
    // if not, we should offer to clean the instance
    console.log(`Pushing Instance ${this._guid} to ${this._targetGuid} \n`);

    // we need to assemble everything in memory first
    // like the pages, content items, models, containers, etc

    let fileOperation = new fileOperations();
    fileOperation.createLogFile("logs", "instancelog");

    // ⚡ PULL THE DATA INTO MEMORY!!!

    // push assets and media
    // await this.pushAssets();
    // await this.pushGalleries();

    
    // 1. Get the Models
    console.log(ansiColors.yellow('\nGetting models from local file storage...\n'));
    await this.getModelsFromLocalStore();
    console.log(ansiColors.yellow(`Pushing models to ${this._targetGuid}...\n`));
    await this.pushModels();
    console.log(ansiColors.green("\n 🚀 Models completed \n"));

    // // 2. Get the Containers
    // console.log(ansiColors.yellow('Getting containers from local file storage...\n'));
    // await this.getContainersFromLocalStore();
    // console.log(ansiColors.yellow(`Pushing containers to ${this._targetGuid}...\n`));
    // await this.pushContainers();
  
    // there is still an issue where one container completes after the rest of the containers


 
    // // 3. Get the Content Items
    // console.log(ansiColors.yellow('Getting content items from local file storage...\n'));
    // await this.getContentItemsFromLocalStore();
    // console.log(ansiColors.yellow(`Pushing content items to ${this._targetGuid}...\n`));
    
    // await this.pushContentItems();
    // console.log(ansiColors.green("\n 🚀 Content items completed \n"));


    // // 4. Get the Pages
    // console.log(ansiColors.yellow('Getting pages from local file storage...\n'));
    // await this.getPagesFromLocalStore();
    // console.log(ansiColors.yellow(`Pushing pages to ${this._targetGuid}...\n`));
    // await this.pushPages();
    // console.log(ansiColors.green("\n 🚀 Pages completed \n"));


    console.log("\n Instance Pushed Successfully \n");
    homePrompt();
  }
}
