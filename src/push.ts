import * as mgmtApi from '@agility/management-sdk';
import { fileOperations } from './fileOperations';
import * as fs from 'fs';
const FormData = require('form-data');
import * as cliProgress from 'cli-progress';
import ansiColors from 'ansi-colors';

export class push {
  _options: mgmtApi.Options;
  _multibar: cliProgress.MultiBar;
  processedModels: { [key: string]: number };
  processedContentIds: { [key: number]: number }; //format Key -> Old ContentId, Value New ContentId.
  skippedContentItems: { [key: number]: string }; //format Key -> ContentId, Value ReferenceName of the content.
  processedGalleries: { [key: number]: number };
  processedTemplates: { [key: string]: number }; //format Key -> pageTemplateName, Value pageTemplateID.
  processedPages: { [key: number]: number }; //format Key -> old page id, Value new page id.

  constructor(options: mgmtApi.Options, multibar: cliProgress.MultiBar) {
    this._options = options;
    this._multibar = multibar;
    this.processedModels = {};
    this.processedContentIds = {};
    this.processedGalleries = {};
    this.skippedContentItems = {};
    this.processedTemplates = {};
    this.processedPages = {};
  }

  /////////////////////////////START: METHODS FOR DEBUG ONLY/////////////////////////////////////////////////////////////////
  createAllContent() {
    const fileOperation = new fileOperations();
    try {
      const files = fileOperation.readFile('.agility-files/all/all.json');
      const contentItems = JSON.parse(files) as mgmtApi.ContentItem[];

      return contentItems;
    } catch (err) {
      console.log(err);
    }
  }

  createLinkedContent() {
    const fileOperation = new fileOperations();
    try {
      const files = fileOperation.readFile('.agility-files/linked/linked.json');
      const contentItems = JSON.parse(files) as mgmtApi.ContentItem[];

      return contentItems;
    } catch (err) {
      console.log(err);
    }
  }

  createNonLinkedContent() {
    const fileOperation = new fileOperations();
    try {
      const files = fileOperation.readFile('.agility-files/nonlinked/nonlinked.json');
      const contentItems = JSON.parse(files) as mgmtApi.ContentItem[];

      return contentItems;
    } catch (err) {
      console.log(err);
    }
  }
  /////////////////////////////END: METHODS FOR DEBUG ONLY/////////////////////////////////////////////////////////////////

  getBaseModels(baseFolder?: string) {
    if (baseFolder === undefined || baseFolder === '') {
      baseFolder = '.agility-files';
    }
    const fileOperation = new fileOperations();
    try {
      const files = fileOperation.readDirectory('models', baseFolder);

      const models: mgmtApi.Model[] = [];

      for (let i = 0; i < files.length; i++) {
        const model = JSON.parse(files[i]) as mgmtApi.Model;
        models.push(model);
      }
      return models;
    } catch {
      fileOperation.appendLogFile(`\n No Models were found in the source Instance to process.`);
      return null;
    }
  }

  getBaseModel(modelId: string, baseFolder?: string) {
    if (baseFolder === undefined || baseFolder === '') {
      baseFolder = '.agility-files';
    }
    const fileOperation = new fileOperations();
    try {
      const file = fileOperation.readFile(`${baseFolder}/models/${modelId}.json`);
      const model = JSON.parse(file) as mgmtApi.Model;
      return model;
    } catch {
      fileOperation.appendLogFile(
        `\n Model with ID ${modelId} was not found in the source Instance.`
      );
      return null;
    }
  }

  createBaseAssets() {
    const fileOperation = new fileOperations();
    try {
      const files = fileOperation.readDirectory('assets/json');

      const assets: mgmtApi.AssetMediaList[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = JSON.parse(files[i]) as mgmtApi.AssetMediaList;
        assets.push(file);
      }
      return assets;
    } catch {
      fileOperation.appendLogFile(`\n No Assets were found in the source Instance to process.`);
      return null;
    }
  }

  createBaseGalleries() {
    const fileOperation = new fileOperations();
    try {
      const files = fileOperation.readDirectory('assets/galleries');

      const assetGalleries: mgmtApi.assetGalleries[] = [];

      for (let i = 0; i < files.length; i++) {
        const assetGallery = JSON.parse(files[i]) as mgmtApi.assetGalleries;
        assetGalleries.push(assetGallery);
      }
      return assetGalleries;
    } catch {
      fileOperation.appendLogFile(`\n No Galleries were found in the source Instance to process.`);
      return null;
    }
  }

  getBaseContainers() {
    const fileOperation = new fileOperations();
    try {
      const files = fileOperation.readDirectory('containers');

      const containers: mgmtApi.Container[] = [];

      for (let i = 0; i < files.length; i++) {
        const container = JSON.parse(files[i]) as mgmtApi.Container;
        containers.push(container);
      }
      return containers;
    } catch {
      fileOperation.appendLogFile(`\n No Containers were found in the source Instance to process.`);
      return null;
    }
  }

  async createBaseTemplates(baseFolder?: string) {
    if (baseFolder === undefined || baseFolder === '') {
      baseFolder = '.agility-files';
    }
    const fileOperation = new fileOperations();
    try {
      const files = fileOperation.readDirectory('templates', baseFolder);

      const pageModels: mgmtApi.PageModel[] = [];

      for (let i = 0; i < files.length; i++) {
        const pageModel = JSON.parse(files[i]) as mgmtApi.PageModel;
        pageModels.push(pageModel);
      }
      return pageModels;
    } catch {
      fileOperation.appendLogFile(
        `\n No Page Templates were found in the source Instance to process.`
      );
      return null;
    }
  }

  async createBasePages(locale: string) {
    const fileOperation = new fileOperations();
    try {
      const files = fileOperation.readDirectory(`${locale}/pages`);

      const pages: mgmtApi.PageItem[] = [];

      for (let i = 0; i < files.length; i++) {
        const page = JSON.parse(files[i]) as mgmtApi.PageItem;
        pages.push(page);
      }
      return pages;
    } catch {
      fileOperation.appendLogFile(`\n No Pages were found in the source Instance to process.`);
      return null;
    }
  }

  async getBaseContentItems(guid: string, locale: string, contentItems?: any[]) {
    const apiClient = new mgmtApi.ApiClient(this._options);
    const fileOperation = new fileOperations();
    const contentItemsArray: mgmtApi.ContentItem[] = [];

    if (fileOperation.folderExists(`${locale}/item`)) {
      const files = fileOperation.readDirectory(`${locale}/item`);

      const validBar1 = this._multibar.create(files.length, 0);
      validBar1.update(0, { name: 'Content Items: Validation' });

      let index = 1;

      for (let i = 0; i < files.length; i++) {
        const contentItem = JSON.parse(files[i]) as mgmtApi.ContentItem;
        validBar1.update(index);
        index += 1;
        try {
          const container = await apiClient.containerMethods.getContainerByReferenceName(
            contentItem.properties.referenceName,
            guid
          );
          if (container) {
            contentItemsArray.push(contentItem);
          }
        } catch {
          this.skippedContentItems[contentItem.contentID] = contentItem.properties.referenceName;
          fileOperation.appendLogFile(
            `\n Unable to find a container for content item referenceName ${contentItem.properties.referenceName}`
          );
          continue;
        }
      }
    } else {
      fileOperation.appendLogFile(
        `\n No Content Items were found in the source Instance to process.`
      );
    }

    return contentItemsArray;
  }

  async getLinkedContent(guid: string, contentItems: mgmtApi.ContentItem[]) {
    const linkedContentItems: mgmtApi.ContentItem[] = [];
    const apiClient = new mgmtApi.ApiClient(this._options);

    const progressBar10 = this._multibar.create(contentItems.length, 0);
    progressBar10.update(0, { name: 'Get Content Items: Linked' });

    let index = 1;

    for (let i = 0; i < contentItems.length; i++) {
      const contentItem = contentItems[i];
      progressBar10.update(index);
      index += 1;
      const containerRef = contentItem.properties.referenceName;
      try {
        const container = await apiClient.containerMethods.getContainerByReferenceName(
          containerRef,
          guid
        );
        const model = await apiClient.modelMethods.getContentModel(
          container.contentDefinitionID,
          guid
        );

        model.fields.flat().find(field => {
          if (field.type === 'Content') {
            return linkedContentItems.push(contentItem);
          }
        });
      } catch {
        continue;
      }
    }
    return linkedContentItems;
  }

  async getNormalContent(
    guid: string,
    baseContentItems: mgmtApi.ContentItem[],
    linkedContentItems: mgmtApi.ContentItem[]
  ) {
    const apiClient = new mgmtApi.ApiClient(this._options);
    const contentItems = baseContentItems.filter(
      contentItem => linkedContentItems.indexOf(contentItem) < 0
    );

    return contentItems;
  }

  async pushTemplates(templates: mgmtApi.PageModel[], guid: string, locale: string) {
    const apiClient = new mgmtApi.ApiClient(this._options);
    const createdTemplates: mgmtApi.PageModel[] = [];
    const progressBar8 = this._multibar.create(templates.length, 0);
    progressBar8.update(0, { name: 'Page Templates' });

    let index = 1;
    for (let i = 0; i < templates.length; i++) {
      const template = templates[i];
      progressBar8.update(index);
      index += 1;
      try {
        const existingTemplate = await apiClient.pageMethods.getPageTemplateName(
          guid,
          locale,
          template.pageTemplateName
        );

        if (existingTemplate) {
          template.pageTemplateID = existingTemplate.pageTemplateID;
          const existingDefinitions = await apiClient.pageMethods.getPageItemTemplates(
            guid,
            locale,
            existingTemplate.pageTemplateID
          );

          if (existingDefinitions) {
            for (const sourceDef of template.contentSectionDefinitions) {
              for (const targetDef of existingDefinitions) {
                if (
                  sourceDef.pageItemTemplateReferenceName !==
                  targetDef.pageItemTemplateReferenceName
                ) {
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
        const createdTemplate = await apiClient.pageMethods.savePageTemplate(
          guid,
          locale,
          template
        );
        createdTemplates.push(createdTemplate);
        this.processedTemplates[createdTemplate.pageTemplateName] = createdTemplate.pageTemplateID;
      } catch {}
    }

    return createdTemplates;
  }

  async pushPages(guid: string, locale: string, pages: mgmtApi.PageItem[]) {
    const progressBar9 = this._multibar.create(pages.length, 0);
    const code = new fileOperations();
    //        this.processedContentIds = JSON.parse(code.readTempFile('processed.json'));
    progressBar9.update(0, { name: 'Pages' });

    let index = 1;

    const parentPages = pages.filter(p => p.parentPageID < 0);

    const childPages = pages.filter(p => p.parentPageID > 0);

    for (let i = 0; i < parentPages.length; i++) {
      progressBar9.update(index);
      index += 1;
      await this.processPage(parentPages[i], guid, locale, false);
    }

    for (let j = 0; j < childPages.length; j++) {
      progressBar9.update(index);
      index += 1;
      await this.processPage(childPages[j], guid, locale, true);
    }
    // this._multibar.stop();
  }

  async processPage(page: mgmtApi.PageItem, guid: string, locale: string, isChildPage: boolean) {
    const fileOperation = new fileOperations();
    const pageName = page.name;
    const pageId = page.pageID;
    try {
      const apiClient = new mgmtApi.ApiClient(this._options);
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
          const keys = Object.keys(page.zones);
          const zones = page.zones;
          for (let k = 0; k < keys.length; k++) {
            const zone = zones[keys[k]];
            for (let z = 0; z < zone.length; z++) {
              if ('contentId' in zone[z].item) {
                if (this.processedContentIds[zone[z].item.contentId]) {
                  zone[z].item.contentId = this.processedContentIds[zone[z].item.contentId];
                  continue;
                } else {
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
        const oldPageId = page.pageID;
        page.pageID = -1;
        page.channelID = -1;
        const createdPage = await apiClient.pageMethods.savePage(
          page,
          guid,
          locale,
          parentPageID,
          -1
        );
        if (createdPage[0]) {
          if (createdPage[0] > 0) {
            this.processedPages[oldPageId] = createdPage[0];
          } else {
            fileOperation.appendLogFile(
              `\n Unable to create page for name ${page.name} with pageID ${oldPageId}.`
            );
          }
        }
      }
    } catch {
      fileOperation.appendLogFile(
        `\n Unable to create page for name ${pageName} with id ${pageId}.`
      );
    }
  }

  async pushNormalContentItems(guid: string, locale: string, contentItems: mgmtApi.ContentItem[]) {
    const apiClient = new mgmtApi.ApiClient(this._options);
    const fileOperation = new fileOperations();
    const progressBar6 = this._multibar.create(contentItems.length, 0);
    progressBar6.update(0, { name: 'Content Items: Non Linked' });

    let index = 1;
    for (let i = 0; i < contentItems.length; i++) {
      const contentItem = contentItems[i]; //contentItems.find((content) => content.contentID === 122);//160, 106
      progressBar6.update(index);
      index += 1;

      let container = new mgmtApi.Container();
      let model = new mgmtApi.Model();
      try {
        container = await apiClient.containerMethods.getContainerByReferenceName(
          contentItem.properties.referenceName,
          guid
        );
      } catch {
        this.skippedContentItems[contentItem.contentID] = contentItem.properties.referenceName;
        fileOperation.appendLogFile(
          `\n Unable to find a container for content item referenceName ${contentItem.properties.referenceName} with contentId ${contentItem.contentID}.`
        );
        continue;
      }

      try {
        model = await apiClient.modelMethods.getContentModel(container.contentDefinitionID, guid);
      } catch {
        fileOperation.appendLogFile(
          `\n Unable to find model for content item referenceName ${contentItem.properties.referenceName} with contentId ${contentItem.contentID}.`
        );
        this.skippedContentItems[contentItem.contentID] = contentItem.properties.referenceName;
        continue;
      }
      for (let j = 0; j < model.fields.length; j++) {
        const field = model.fields[j];
        const fieldName = this.camelize(field.name);
        const fieldVal = contentItem.fields[fieldName];

        if (
          field.type === 'ImageAttachment' ||
          field.type === 'FileAttachment' ||
          field.type === 'AttachmentList'
        ) {
          if (typeof fieldVal === 'object') {
            if (Array.isArray(fieldVal)) {
              for (let k = 0; k < fieldVal.length; k++) {
                const retUrl = await this.changeOriginKey(guid, fieldVal[k].url);
                contentItem.fields[fieldName][k].url = retUrl;
              }
            } else {
              if ('url' in fieldVal) {
                const retUrl = await this.changeOriginKey(guid, fieldVal.url);
                contentItem.fields[fieldName].url = retUrl;
              }
            }
          }
        } else {
          if (typeof fieldVal === 'object') {
            if ('fulllist' in fieldVal) {
              delete fieldVal.fulllist;
              if (field.type === 'PhotoGallery') {
                const oldGalleryId = fieldVal.galleryid;
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
      contentItem.contentID = -1;

      const createdContentItemId = await apiClient.contentMethods.saveContentItem(
        contentItem,
        guid,
        locale
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
    }
  }

  async pushLinkedContentItems(guid: string, locale: string, contentItems: mgmtApi.ContentItem[]) {
    const apiClient = new mgmtApi.ApiClient(this._options);
    const fileOperation = new fileOperations();
    const progressBar7 = this._multibar.create(contentItems.length, 0);
    progressBar7.update(0, { name: 'Content Items: Linked' });

    let index = 1;
    const contentLength = contentItems.length;
    try {
      do {
        for (let i = 0; i < contentItems.length; i++) {
          let contentItem = contentItems[i];
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
              guid
            );
          } catch {
            this.skippedContentItems[contentItem.contentID] = contentItem.properties.referenceName;
            fileOperation.appendLogFile(
              `\n Unable to find a container for content item referenceName ${contentItem.properties.referenceName} with contentId ${contentItem.contentID}.`
            );
            contentItem[i] = null;
          }

          try {
            model = await apiClient.modelMethods.getContentModel(
              container.contentDefinitionID,
              guid
            );
          } catch {
            this.skippedContentItems[contentItem.contentID] = contentItem.properties.referenceName;
            fileOperation.appendLogFile(
              `\n Unable to find model for content item referenceName ${contentItem.properties.referenceName} with contentId ${contentItem.contentID}.`
            );
            contentItem[i] = null;
          }
          for (let j = 0; j < model.fields.length; j++) {
            const field = model.fields[j];
            const settings = field.settings;
            const fieldName = this.camelize(field.name);
            const fieldVal = contentItem.fields[fieldName];
            if (fieldVal) {
              if (field.type === 'Content') {
                if (settings['LinkeContentDropdownValueField']) {
                  if (settings['LinkeContentDropdownValueField'] !== 'CREATENEW') {
                    const linkedField = this.camelize(settings['LinkeContentDropdownValueField']);
                    const linkedContentIds = contentItem.fields[linkedField];
                    let newlinkedContentIds = '';
                    if (linkedContentIds) {
                      const splitIds = linkedContentIds.split(',');
                      for (let k = 0; k < splitIds.length; k++) {
                        const id = splitIds[k];
                        if (this.skippedContentItems[id]) {
                          this.skippedContentItems[contentItem.contentID] =
                            contentItem.properties.referenceName;
                          fileOperation.appendLogFile(
                            `\n Unable to process content item for referenceName ${contentItem.properties.referenceName} with contentId ${contentItem.contentID}.`
                          );
                          continue;
                        }
                        if (this.processedContentIds[id]) {
                          const newSortId = this.processedContentIds[id].toString();
                          if (!newlinkedContentIds) {
                            newlinkedContentIds = newSortId.toString();
                          } else {
                            newlinkedContentIds += ',' + newSortId.toString();
                          }
                        } else {
                          try {
                            const file = fileOperation.readFile(
                              `.agility-files/${locale}/item/${id}.json`
                            );
                            contentItem = null;
                            break;
                          } catch {
                            this.skippedContentItems[contentItem.contentID] =
                              contentItem.properties.referenceName;
                            this.skippedContentItems[id] = 'OrphanRef';
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
                if (settings['SortIDFieldName']) {
                  if (settings['SortIDFieldName'] !== 'CREATENEW') {
                    const sortField = this.camelize(settings['SortIDFieldName']);
                    const sortContentIds = contentItem.fields[sortField];
                    let newSortContentIds = '';

                    if (sortContentIds) {
                      const splitIds = sortContentIds.split(',');
                      for (let k = 0; k < splitIds.length; k++) {
                        const id = splitIds[k];
                        if (this.skippedContentItems[id]) {
                          this.skippedContentItems[contentItem.contentID] =
                            contentItem.properties.referenceName;
                          fileOperation.appendLogFile(
                            `\n Unable to process content item for referenceName ${contentItem.properties.referenceName} with contentId ${contentItem.contentID}.`
                          );
                          continue;
                        }
                        if (this.processedContentIds[id]) {
                          const newSortId = this.processedContentIds[id].toString();
                          if (!newSortContentIds) {
                            newSortContentIds = newSortId.toString();
                          } else {
                            newSortContentIds += ',' + newSortId.toString();
                          }
                        } else {
                          try {
                            const file = fileOperation.readFile(
                              `.agility-files/${locale}/item/${id}.json`
                            );
                            contentItem = null;
                            break;
                          } catch {
                            this.skippedContentItems[contentItem.contentID] =
                              contentItem.properties.referenceName;
                            this.skippedContentItems[id] = 'OrphanRef';
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
                if ('contentid' in fieldVal) {
                  const linkedContentId = fieldVal.contentid;
                  if (this.skippedContentItems[linkedContentId]) {
                    this.skippedContentItems[contentItem.contentID] =
                      contentItem.properties.referenceName;
                    fileOperation.appendLogFile(
                      `\n Unable to process content item for referenceName ${contentItem.properties.referenceName} with contentId ${contentItem.contentID}.`
                    );
                    continue;
                  }
                  if (this.processedContentIds[linkedContentId]) {
                    const file = fileOperation.readFile(
                      `.agility-files/${locale}/item/${linkedContentId}.json`
                    );
                    const extractedContent = JSON.parse(file) as mgmtApi.ContentItem;
                    contentItem.fields[fieldName] = extractedContent.properties.referenceName;
                  } else {
                    try {
                      const file = fileOperation.readFile(
                        `.agility-files/${locale}/item/${linkedContentId}.json`
                      );
                      contentItem = null;
                      break;
                    } catch {
                      this.skippedContentItems[contentItem.contentID] =
                        contentItem.properties.referenceName;
                      this.skippedContentItems[linkedContentId] = 'OrphanRef';
                      fileOperation.appendLogFile(
                        `\n Unable to process content item for referenceName ${contentItem.properties.referenceName} with contentId ${contentItem.contentID} as the content is orphan. Orphan ID ${linkedContentId}`
                      );
                      continue;
                    }
                  }
                }
                if ('referencename' in fieldVal) {
                  const refName = fieldVal.referencename;
                  try {
                    const container = await apiClient.containerMethods.getContainerByReferenceName(
                      refName,
                      guid
                    );
                    if (!container) {
                      this.skippedContentItems[contentItem.contentID] =
                        contentItem.properties.referenceName;
                      fileOperation.appendLogFile(
                        `\n Unable to find a container for content item referenceName ${contentItem.properties.referenceName} with contentId ${contentItem.contentID}.`
                      );
                      continue;
                    }
                    if ('sortids' in fieldVal) {
                      contentItem.fields[fieldName].referencename = fieldVal.referencename;
                    } else {
                      contentItem.fields[fieldName] = fieldVal.referencename;
                    }
                  } catch {
                    this.skippedContentItems[contentItem.contentID] =
                      contentItem.properties.referenceName;
                    fileOperation.appendLogFile(
                      `\n Unable to process content item for referenceName ${contentItem.properties.referenceName} with contentId ${contentItem.contentID}.`
                    );
                    continue;
                  }
                }
                if ('sortids' in fieldVal) {
                  const sortids = fieldVal.sortids.split(',');
                  let newSortIds = '';
                  for (let s = 0; s < sortids.length; s++) {
                    const sortid = sortids[s];
                    if (this.skippedContentItems[sortid]) {
                      this.skippedContentItems[contentItem.contentID] =
                        contentItem.properties.referenceName;
                      fileOperation.appendLogFile(
                        `\n Unable to process content item for referenceName ${contentItem.properties.referenceName} with contentId ${contentItem.contentID}.`
                      );
                      continue;
                    }
                    if (this.processedContentIds[sortid]) {
                      const newSortId = this.processedContentIds[sortid].toString();
                      if (!newSortIds) {
                        newSortIds = newSortId.toString();
                      } else {
                        newSortIds += ',' + newSortId.toString();
                      }
                    } else {
                      try {
                        const file = fileOperation.readFile(
                          `.agility-files/${locale}/item/${sortid}.json`
                        );
                        contentItem = null;
                        break;
                      } catch {
                        this.skippedContentItems[contentItem.contentID] =
                          contentItem.properties.referenceName;
                        this.skippedContentItems[sortid] = 'OrphanRef';
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
                field.type === 'ImageAttachment' ||
                field.type === 'FileAttachment' ||
                field.type === 'AttachmentList'
              ) {
                if (typeof fieldVal === 'object') {
                  if (Array.isArray(fieldVal)) {
                    for (let k = 0; k < fieldVal.length; k++) {
                      const retUrl = await this.changeOriginKey(guid, fieldVal[k].url);
                      contentItem.fields[fieldName][k].url = retUrl;
                    }
                  } else {
                    if ('url' in fieldVal) {
                      const retUrl = await this.changeOriginKey(guid, fieldVal.url);
                      contentItem.fields[fieldName].url = retUrl;
                    }
                  }
                }
              } else {
                if (typeof fieldVal === 'object') {
                  if ('fulllist' in fieldVal) {
                    delete fieldVal.fulllist;
                    if (field.type === 'PhotoGallery') {
                      const oldGalleryId = fieldVal.galleryid;
                      if (this.processedGalleries[oldGalleryId]) {
                        contentItem.fields[fieldName] =
                          this.processedGalleries[oldGalleryId].toString();
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

              const createdContentItemId = await apiClient.contentMethods.saveContentItem(
                contentItem,
                guid,
                locale
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
              contentItem[i] = null;
            }
          }
        }
      } while (contentItems.filter(c => c !== null).length !== 0);
    } catch {}
  }

  async changeOriginKey(guid: string, url: string) {
    const apiClient = new mgmtApi.ApiClient(this._options);

    const defaultContainer = await apiClient.assetMethods.getDefaultContainer(guid);

    let filePath = this.getFilePath(url);
    filePath = filePath.replace(/%20/g, ' ');

    const edgeUrl = `${defaultContainer.edgeUrl}/${filePath}`;

    try {
      const existingMedia = await apiClient.assetMethods.getAssetByUrl(edgeUrl, guid);
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
      .replace(/\s+/g, '');
  }

  async getLinkedModels(models: mgmtApi.Model[]) {
    try {
      const linkedModels: mgmtApi.Model[] = [];
      models.forEach(model =>
        model.fields.flat().find(field => {
          if (field.type === 'Content') {
            return linkedModels.push(model);
          }
        })
      );
      return linkedModels;
    } catch {}
  }

  async getNormalModels(allModels: mgmtApi.Model[], linkedModels: mgmtApi.Model[]) {
    try {
      const normalModels = allModels.filter(model => linkedModels.indexOf(model) < 0);
      return normalModels;
    } catch {}
  }

  async pushNormalModels(model: mgmtApi.Model, guid: string) {
    const procesedModel = await this.createModel(model, guid);
    return procesedModel;
  }

  async pushContainers(containers: mgmtApi.Container[], models: mgmtApi.Model[], guid: string) {
    const apiClient = new mgmtApi.ApiClient(this._options);
    try {
      const progressBar5 = this._multibar.create(containers.length, 0);
      progressBar5.update(0, { name: 'Containers' });

      const modelRefs: { [key: number]: string } = {};

      let index = 1;
      for (let i = 0; i < containers.length; i++) {
        const container = containers[i];
        try {
          const referenceName = models.find(model => model.id === container.contentDefinitionID);
          if (referenceName) {
            if (!modelRefs[container.contentDefinitionID])
              modelRefs[container.contentDefinitionID] = referenceName.referenceName;
          }
        } catch {}
      }
      for (let i = 0; i < containers.length; i++) {
        const container = containers[i];
        progressBar5.update(index);
        index += 1;
        const referenceName = modelRefs[container.contentDefinitionID];
        if (referenceName) {
          const modelID = this.processedModels[referenceName];
          if (modelID) {
            container.contentDefinitionID = modelID;
            try {
              const existingContainer =
                await apiClient.containerMethods.getContainerByReferenceName(
                  container.referenceName,
                  guid
                );
              if (existingContainer) {
                container.contentViewID = existingContainer.contentViewID;
              } else {
                container.contentViewID = -1;
              }
              await apiClient.containerMethods.saveContainer(container, guid);
            } catch {
              container.contentViewID = -1;
              await apiClient.containerMethods.saveContainer(container, guid);
            }
          } else {
          }
        } else {
        }
      }
    } catch {}
  }

  async pushLinkedModels(models: mgmtApi.Model[], guid: string) {
    const apiClient = new mgmtApi.ApiClient(this._options);
    const fileOperation = new fileOperations();
    const processedModels: mgmtApi.Model[] = [];
    const completedModels: string[] = [];
    const unprocessedModels: string[] = [];
    const progressBar4 = this._multibar.create(models.length, 0);
    progressBar4.update(0, { name: 'Models: Linked' });
    let index = 1;
    do {
      for (let i = 0; i < models.length; i++) {
        const model = models[i];
        progressBar4.update(index);
        index += 1;

        if (!model) {
          continue;
        }
        try {
          const existing = await apiClient.modelMethods.getModelByReferenceName(
            model.referenceName,
            guid
          );
          if (existing) {
            const updatesToModel = this.updateModel(existing, model);
            updatesToModel.id = existing.id;
            const updatedModel = await apiClient.modelMethods.saveModel(updatesToModel, guid);
            processedModels.push(updatedModel);
            this.processedModels[updatedModel.referenceName] = updatedModel.id;
            completedModels.push(updatedModel.referenceName);
            models[i] = null;
          }
        } catch {
          for (let j = 0; j < model.fields.length; j++) {
            const field = model.fields[j];
            if (field.settings['ContentDefinition']) {
              const modelRef = field.settings['ContentDefinition'];
              if (model.referenceName !== modelRef) {
                if (this.processedModels[modelRef] && !this.processedModels[model.referenceName]) {
                  model.id = 0;
                  try {
                    const createdModel = await apiClient.modelMethods.saveModel(model, guid);
                    processedModels.push(createdModel);
                    this.processedModels[createdModel.referenceName] = createdModel.id;
                    completedModels.push(createdModel.referenceName);
                    models[i] = null;
                  } catch {
                    unprocessedModels.push(model.referenceName);
                    //fileOperation.appendLogFile(`\n Unable to process model for referenceName ${model.referenceName} with modelId ${model.id}.`);
                    models[i] = null;
                    continue;
                  }
                }
              } else {
                const oldModelId = model.id;
                model.id = 0;
                try {
                  const createdModel = await apiClient.modelMethods.saveModel(model, guid);
                  processedModels.push(createdModel);
                  this.processedModels[createdModel.referenceName] = createdModel.id;
                  completedModels.push(createdModel.referenceName);
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
              const oldModelId = model.id;
              model.id = 0;
              try {
                const createdModel = await apiClient.modelMethods.saveModel(model, guid);
                processedModels.push(createdModel);
                this.processedModels[createdModel.referenceName] = createdModel.id;
                completedModels.push(createdModel.referenceName);
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
    } while (models.filter(m => m !== null).length !== 0);

    const unprocessed = unprocessedModels.filter(x => !completedModels.includes(x));

    for (let i = 0; i < unprocessed.length; i++) {
      fileOperation.appendLogFile(
        `\n Unable to process model for referenceName ${unprocessed[i]}.`
      );
    }
    return processedModels;
  }

  async createModel(model: mgmtApi.Model, guid: string) {
    const apiClient = new mgmtApi.ApiClient(this._options);
    try {
      const existing = await apiClient.modelMethods.getModelByReferenceName(
        model.referenceName,
        guid
      );
      const oldModelId = model.id;
      if (existing) {
        const updatesToModel = this.updateModel(existing, model);
        updatesToModel.id = existing.id;
        const updatedModel = await apiClient.modelMethods.saveModel(updatesToModel, guid);
        this.processedModels[updatedModel.referenceName] = updatedModel.id;
        return updatedModel;
      } else {
        model.id = 0;
        const newModel = await apiClient.modelMethods.saveModel(model, guid);
        this.processedModels[newModel.referenceName] = newModel.id;
        return newModel;
      }
    } catch {
      model.id = 0;
      const newModel = await apiClient.modelMethods.saveModel(model, guid);
      this.processedModels[newModel.referenceName] = newModel.id;
      return newModel;
    }
  }

  updateFields(obj1: mgmtApi.Model, obj2: mgmtApi.Model): mgmtApi.ModelField[] {
    const updatedFields: mgmtApi.ModelField[] = [];

    obj1.fields.forEach(field1 => {
      const field2Index = obj2.fields.findIndex(field2 => field2.name === field1.name);

      if (field2Index !== -1) {
        field1.settings = { ...field1.settings, ...obj2.fields[field2Index].settings };
        updatedFields.push(field1);
      } else {
        updatedFields.push(field1);
      }
    });

    obj2.fields.forEach(field2 => {
      const field1Index = obj1.fields.findIndex(field1 => field1.name === field2.name);

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
    const apiClient = new mgmtApi.ApiClient(this._options);
    let differences: any = {};
    try {
      const existing = await apiClient.modelMethods.getModelByReferenceName(
        model.referenceName,
        guid
      );
      if (existing) {
        differences = await this.findModelDifferences(model, existing, model.referenceName);
      } else {
        differences['referenceName'] = {
          referenceName: 'Model with referenceName ' + model.referenceName + ' will be added.',
        };
      }
    } catch {
      differences['referenceName'] = {
        referenceName: 'Model with referenceName ' + model.referenceName + ' will be added.',
      };
    }
    return differences;
  }

  async validateDryRunLinkedModels(model: mgmtApi.Model, guid: string) {
    const apiClient = new mgmtApi.ApiClient(this._options);
    let differences: any = {};
    const fileOperation = new fileOperations();
    for (let j = 0; j < model.fields.length; j++) {
      const field = model.fields[j];
      if (field.settings['ContentDefinition']) {
        const modelRef = field.settings['ContentDefinition'];
        try {
          const existingLinked = await apiClient.modelMethods.getModelByReferenceName(
            modelRef,
            guid
          );
          if (existingLinked) {
            if (fileOperation.checkFileExists(`.agility-files/models/${existingLinked.id}.json`)) {
              const file = fileOperation.readFile(
                `.agility-files/models/${existingLinked.id}.json`
              );
              const modelData = JSON.parse(file) as mgmtApi.Model;
              differences = await this.findModelDifferences(
                modelData,
                existingLinked,
                model.referenceName
              );
            } else {
              fileOperation.appendLogFile(
                `\n Unable to find model for referenceName ${existingLinked.referenceName} in the dry run for linked models.`
              );
            }
          }
        } catch {
          differences['referenceName'] = {
            referenceName: 'Model with referenceName ' + modelRef + ' will be added.',
          };
        }
      }
    }
    try {
      const existing = await apiClient.modelMethods.getModelByReferenceName(
        model.referenceName,
        guid
      );
      if (existing) {
        differences = await this.findModelDifferences(model, existing, model.referenceName);
      } else {
        differences['referenceName'] = {
          referenceName: 'Model with referenceName ' + model.referenceName + ' will be added.',
        };
      }
    } catch {
      differences['referenceName'] = {
        referenceName: 'Model with referenceName ' + model.referenceName + ' will be added.',
      };
    }
    return differences;
  }

  async validateDryRunTemplates(template: mgmtApi.PageModel, guid: string, locale: string) {
    const apiClient = new mgmtApi.ApiClient(this._options);
    let differences: any = {};
    try {
      const existingTemplate = await apiClient.pageMethods.getPageTemplateName(
        guid,
        locale,
        template.pageTemplateName
      );
      if (existingTemplate) {
        differences = await this.findTemplateDifferences(
          template,
          existingTemplate,
          existingTemplate.pageTemplateName
        );
      } else {
        differences['templateName'] = {
          templateName:
            'Page Template with templateName ' + template.pageTemplateName + ' will be added.',
        };
      }
    } catch {
      differences['templateName'] = {
        templateName:
          'Page Template with templateName ' + template.pageTemplateName + ' will be added.',
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

    obj1.fields.forEach(field1 => {
      const field2 = obj2.fields.find(f => f.name === field1.name);

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

        Object.keys(settings1).forEach(key => {
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
      const result = { added, updated };
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

    csd1.forEach(csd1Item => {
      const csd2Item = csd2.find(
        item => item?.pageItemTemplateReferenceName === csd1Item?.pageItemTemplateReferenceName
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
    const sharedModules1 =
      obj1.contentSectionDefinitions?.flatMap(csd => csd?.sharedModules || []) || [];
    const sharedModules2 =
      obj2.contentSectionDefinitions?.flatMap(csd => csd?.sharedModules || []) || [];

    sharedModules1.forEach(sm1 => {
      const sm2 = sharedModules2.find(item => item?.name === sm1?.name);
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
    const defaultModules1 =
      obj1.contentSectionDefinitions?.flatMap(csd => csd?.defaultModules || []) || [];
    const defaultModules2 =
      obj2.contentSectionDefinitions?.flatMap(csd => csd?.defaultModules || []) || [];

    defaultModules1.forEach(dm1 => {
      const dm2 = defaultModules2.find(item => item?.title === dm1?.title);
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
      const result = { added, updated };
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
    const ignoreFields = ['lastModifiedDate', 'fieldID', 'id'];
    const compareProps = (obj1: any, obj2: any, path: string = '') => {
      for (const key in obj1) {
        if (obj1.hasOwnProperty(key) && !ignoreFields.includes(key)) {
          const newPath = path ? `${path}.${key}` : key;
          if (
            typeof obj1[key] === 'object' &&
            obj1[key] !== null &&
            typeof obj2[key] === 'object' &&
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

  async pushGalleries(guid: string) {
    const apiClient = new mgmtApi.ApiClient(this._options);

    const assetGalleries = this.createBaseGalleries();
    if (assetGalleries) {
      const progressBar1 = this._multibar.create(assetGalleries.length, 0);
      progressBar1.update(0, { name: 'Galleries' });
      let index = 1;
      for (let i = 0; i < assetGalleries.length; i++) {
        const assetGallery = assetGalleries[i];

        progressBar1.update(index);
        index += 1;
        for (let j = 0; j < assetGallery.assetMediaGroupings.length; j++) {
          const gallery = assetGallery.assetMediaGroupings[j];
          const oldGalleryId = gallery.mediaGroupingID;
          try {
            const existingGallery = await apiClient.assetMethods.getGalleryByName(
              guid,
              gallery.name
            );
            if (existingGallery) {
              gallery.mediaGroupingID = existingGallery.mediaGroupingID;
            } else {
              gallery.mediaGroupingID = 0;
            }
            const createdGallery = await apiClient.assetMethods.saveGallery(guid, gallery);
            this.processedGalleries[oldGalleryId] = createdGallery.mediaGroupingID;
          } catch {
            gallery.mediaGroupingID = 0;
            const createdGallery = await apiClient.assetMethods.saveGallery(guid, gallery);
            this.processedGalleries[oldGalleryId] = createdGallery.mediaGroupingID;
          }
        }
      }
    }
  }

  async pushAssets(guid: string) {
    const apiClient = new mgmtApi.ApiClient(this._options);
    const defaultContainer = await apiClient.assetMethods.getDefaultContainer(guid);
    const fileOperation = new fileOperations();

    const failedAssetsExists = fileOperation.fileExists(
      '.agility-files/assets/failedAssets/unProcessedAssets.json'
    );
    const file = failedAssetsExists
      ? fileOperation.readFile('.agility-files/assets/failedAssets/unProcessedAssets.json')
      : null;

    const unProcessedAssets = JSON.parse(file) as {};

    const assetMedias = this.createBaseAssets();

    if (assetMedias) {
      const medias: mgmtApi.Media[] = [];
      for (let i = 0; i < assetMedias.length; i++) {
        const assetMedia = assetMedias[i];
        for (let j = 0; j < assetMedia.assetMedias.length; j++) {
          const media = assetMedia.assetMedias[j];
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

      const re = /(?:\.([^.]+))?$/;
      const progressBar2 = this._multibar.create(medias.length, 0);
      progressBar2.update(0, { name: 'Assets' });

      let index = 1;
      for (let i = 0; i < medias.length; i++) {
        const media = medias[i];

        progressBar2.update(index);
        index += 1;

        let filePath = this.getFilePath(media.originUrl);
        filePath = filePath.replace(/%20/g, ' ');
        let folderPath = filePath.split('/').slice(0, -1).join('/');
        if (!folderPath) {
          folderPath = '/';
        }
        const orginUrl = `${defaultContainer.originUrl}/${filePath}`;
        const form = new FormData();
        const file = fs.readFileSync(`.agility-files/assets/${filePath}`, null);
        form.append('files', file, media.fileName);
        let mediaGroupingID = -1;
        try {
          const existingMedia = await apiClient.assetMethods.getAssetByUrl(orginUrl, guid);

          if (existingMedia) {
            if (media.mediaGroupingID > 0) {
              mediaGroupingID = await this.doesGalleryExists(guid, media.mediaGroupingName);
            }
          } else {
            if (media.mediaGroupingID > 0) {
              mediaGroupingID = await this.doesGalleryExists(guid, media.mediaGroupingName);
            }
          }
          const uploadedMedia = await apiClient.assetMethods.upload(
            form,
            folderPath,
            guid,
            mediaGroupingID
          );
        } catch {
          if (media.mediaGroupingID > 0) {
            mediaGroupingID = await this.doesGalleryExists(guid, media.mediaGroupingName);
          }
          const uploadedMedia = await apiClient.assetMethods.upload(
            form,
            folderPath,
            guid,
            mediaGroupingID
          );
        }
      }
    }
  }

  async doesGalleryExists(guid: string, mediaGroupingName: string) {
    const apiClient = new mgmtApi.ApiClient(this._options);
    let mediaGroupingID = -1;
    try {
      const gallery = await apiClient.assetMethods.getGalleryByName(guid, mediaGroupingName);
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
    const url = new URL(originUrl);
    const pathName = url.pathname;
    const extractedStr = pathName.split('/')[1];
    const removedStr = pathName.replace(`/${extractedStr}/`, '');

    return removedStr;
  }

  async pushInstance(guid: string, locale: string) {
    try {
      const fileOperation = new fileOperations();
      fileOperation.createLogFile('logs', 'instancelog');
      await this.pushGalleries(guid);
      await this.pushAssets(guid);
      const models = this.getBaseModels();
      if (models) {
        const containers = this.getBaseContainers();
        const linkedModels = await this.getLinkedModels(models);
        const normalModels = await this.getNormalModels(models, linkedModels);

        const progressBar3 = this._multibar.create(normalModels.length, 0);
        progressBar3.update(0, { name: 'Models: Non Linked' });
        let index = 1;

        for (let i = 0; i < normalModels.length; i++) {
          const normalModel = normalModels[i];
          await this.pushNormalModels(normalModel, guid);
          progressBar3.update(index);
          index += 1;
        }

        await this.pushLinkedModels(linkedModels, guid);
        const containerModels = models;

        if (containers) {
          await this.pushContainers(containers, containerModels, guid);
          const contentItems = await this.getBaseContentItems(guid, locale);
          if (contentItems) {
            const totalItems = contentItems.length;
            const linkedContentItems = await this.getLinkedContent(guid, contentItems);
            const normalContentItems = await this.getNormalContent(
              guid,
              contentItems,
              linkedContentItems
            );
            await this.pushNormalContentItems(guid, locale, normalContentItems);
            await this.pushLinkedContentItems(guid, locale, linkedContentItems);
          }
          const pageTemplates = await this.createBaseTemplates();

          if (pageTemplates) {
            await this.pushTemplates(pageTemplates, guid, locale);
            if (contentItems) {
              const pages = await this.createBasePages(locale);
              if (pages) {
                await this.pushPages(guid, locale, pages);
              }
            }
          }
        }
        this._multibar.stop();
      } else {
        fileOperation.appendLogFile(
          `\n Nothing else to clone/push to the target instance as there are no Models present in the source Instance.`
        );
        this._multibar.stop();
      }
    } catch {}
  }

  async updateContentItems(guid: string, locale: string, selectedContentItems: string) {
    const apiClient = new mgmtApi.ApiClient(this._options);
    const fileOperation = new fileOperations();
    const contentItemsArray: mgmtApi.ContentItem[] = [];

    fileOperation.createLogFile('logs', 'instancelog');

    console.log('Updating content items...', selectedContentItems.split(', '));
    const contentItemArr = selectedContentItems.split(',');

    if (contentItemArr && contentItemArr.length > 0) {
      const validBar1 = this._multibar.create(contentItemArr.length, 0);
      validBar1.update(0, { name: 'Updating items' });

      let index = 1;
      const successfulItems = [];
      const notOnDestination = [];
      const notOnSource = [];
      const modelMismatch = [];

      for (let i = 0; i < contentItemArr.length; i++) {
        const contentItemId = parseInt(contentItemArr[i], 10);
        index += 1;

        try {
          await apiClient.contentMethods.getContentItem(contentItemId, guid, locale);
        } catch {
          notOnDestination.push(contentItemId);
          this.skippedContentItems[contentItemId] = contentItemId.toString();
          fileOperation.appendLogFile(
            `\n There was a problem reading content item ID ${contentItemId}`
          );
          continue;
        }

        try {
          const file = fileOperation.readFile(
            `.agility-files/${locale}/item/${contentItemId}.json`
          );
          const contentItem = JSON.parse(file) as mgmtApi.ContentItem;

          try {
            const containerFile = fileOperation.readFile(
              `.agility-files/containers/${this.camelize(contentItem.properties.referenceName)}.json`
            );
            const container = JSON.parse(containerFile) as mgmtApi.Container;

            const modelId = container.contentDefinitionID;
            const modelFile = fileOperation.readFile(`.agility-files/models/${modelId}.json`);
            const model = JSON.parse(modelFile) as mgmtApi.Model;

            const currentModel = await apiClient.modelMethods.getContentModel(modelId, guid);

            const modelFields = model.fields.map(field => ({ name: field.name, type: field.type }));
            const currentModelFields = currentModel.fields.map(field => ({
              name: field.name,
              type: field.type,
            }));

            const missingFields = modelFields.filter(
              field =>
                !currentModelFields.some(
                  currentField =>
                    currentField.name === field.name && currentField.type === field.type
                )
            );
            const extraFields = currentModelFields.filter(
              currentField =>
                !modelFields.some(
                  field => field.name === currentField.name && field.type === currentField.type
                )
            );

            if (missingFields.length > 0) {
              console.log(
                `Missing fields in local model: ${missingFields.map(field => `${field.name} (${field.type})`).join(', ')}`
              );
              fileOperation.appendLogFile(
                `\n Missing fields in local model: ${missingFields.map(field => `${field.name} (${field.type})`).join(', ')}`
              );
            }

            if (extraFields.length > 0) {
              console.log(
                `Extra fields in local model: ${extraFields.map(field => `${field.name} (${field.type})`).join(', ')}`
              );
              fileOperation.appendLogFile(
                `\n Extra fields in local model: ${extraFields.map(field => `${field.name} (${field.type})`).join(', ')}`
              );
            }

            if (!missingFields.length && !extraFields.length) {
              try {
                await apiClient.contentMethods.saveContentItem(contentItem, guid, locale);
              } catch {
                this.skippedContentItems[contentItemId] = contentItemId.toString();
                fileOperation.appendLogFile(`\n Unable to update content item ID ${contentItemId}`);
                continue;
              }

              contentItemsArray.push(contentItem);
              successfulItems.push(contentItemId);
            } else {
              modelMismatch.push(contentItemId);
              fileOperation.appendLogFile(`\n Model mismatch for content item ID ${contentItemId}`);
              continue;
            }
          } catch (err) {
            console.log('Container - > Error', err);
            this.skippedContentItems[contentItemId] = contentItemId.toString();
            fileOperation.appendLogFile(
              `\n Unable to find a container for content item ID ${contentItemId}`
            );
            continue;
          }
        } catch {
          notOnSource.push(contentItemId);
          this.skippedContentItems[contentItemId] = contentItemId.toString();
          fileOperation.appendLogFile(
            `\n There was a problem reading .agility-files/${locale}/item/${contentItemId}.json`
          );
          continue;
        }

        validBar1.update(index);
      }

      return {
        contentItemsArray,
        successfulItems,
        notOnDestination,
        notOnSource,
        modelMismatch,
      };
    }
  }
}
