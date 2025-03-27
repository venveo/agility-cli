import inquirer from "inquirer";
import * as mgmtApi from "@agility/management-sdk";
import * as fetchApi from "@agility/content-fetch";
import * as cliProgress from "cli-progress";
import { fileOperations } from "../fileOperations";
import { Auth } from "../auth";
import { createMultibar } from "../multibar";
import { asset } from "../asset";
import { homePrompt } from "./home";
import ansiColors from "ansi-colors";
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");

let auth: Auth;
let options: mgmtApi.Options;

class Clean {
  _selectedInstance: any;
  _locale: string;
  _guid: string;
  _websiteName: string;

  constructor(selectedInstance: string, locale: string) {
    this._selectedInstance = selectedInstance;
    this._guid = this._selectedInstance.guid;
    this._websiteName = this._selectedInstance.websiteName;
    this._locale = locale;
  }

  async cleanAll() {
    auth = new Auth();
    let code = new fileOperations();
    let codeFileStatus = code.codeFileExists();

    if (codeFileStatus) {
      let data = JSON.parse(code.readTempFile("code.json"));

      const form = new FormData();
      form.append("cliCode", data.code);

      // let guid: string = guid as string;
      // let userBaseUrl: string = baseUrl as string;
      let token = await auth.cliPoll(form, this._guid);
      let multibar = createMultibar({ name: "Cleaning" });

      options = new mgmtApi.Options();
      options.token = token.access_token;

      let mgmtApiClient = new mgmtApi.ApiClient(options);

      try {
        const answers = await inquirer.prompt([
          {
            type: "confirm",
            name: "cleanInstance",
            message: `Do you want to clean the instance with GUID: ${this._guid}? All files and content will be deleted.`,
            default: false,
          },
        ]);

        if (answers.cleanInstance) {
          console.log("\n");
          // console.log(`Cleaning the instance with GUID: ${this._guid}`);
          // console.log('\n');

          await Promise.all([
            this.cleanContent(mgmtApiClient, multibar),
            this.cleanPages(mgmtApiClient, multibar),
            this.cleanModels(mgmtApiClient, multibar),
            this.cleanMedia(mgmtApiClient, multibar),
          ]);

          return true;
          // setTimeout(() => {
          //     multibar.stop();

          // }, 500);
        }
      } catch (err) {
        console.log("Error cleaning instance", err);
      }
    }
  }

  async cleanPages(apiClient: any, multibar: any) {
    const sitemap = await apiClient.pageMethods.getSitemap(this._guid, this._locale);

    const pages = sitemap[0].pages;

    let parentPages = pages.filter((p) => p.parentPageID < 0);
    let childPages = pages.filter((p) => p.parentPageID > 0);

    let totalPages = parentPages.length + childPages.length;

    const progressBar = multibar.create(totalPages, 0);
    progressBar.update(0, { name: "Deleting Pages" });

    childPages.forEach(async (page) => {
      try {
        await apiClient.pageMethods.deletePage(page.pageID, this._guid, this._locale);
        progressBar.increment();
      } catch (err) {
        console.log("Error deleting page", err);
      }
    });

    parentPages.forEach(async (page) => {
        try {
          await apiClient.pageMethods.deletePage(page.pageID, this._guid, this._locale);
          progressBar.increment();
        } catch (err) {
          console.log("Error deleting page", err);
        }
      });

    
    
  }

  async cleanContent(mgmt: any, multibar: any) {
    const containers = await mgmt.containerMethods.getContainerList(this._guid);
    // console.log('Containers', containers)
    const progressBar = multibar.create(containers.length, 0);
    progressBar.update(0, { name: "Deleting Content Lists" });

    containers.forEach(async (container) => {
      try {
        const content = await mgmt.contentMethods.getContentList(container.referenceName, this._guid, this._locale);
        content.forEach(async (contentItem) => {
          await mgmt.contentMethods.deleteContent(contentItem.contentID, this._guid, this._locale);
        });
      } catch (err) {
        // console.log("Error deleting content", err);
      }

      try {
        await mgmt.containerMethods.deleteContainer(container.contentViewID, this._guid);
      } catch (err) {
        // console.log("Error deleting container", err);
      }

      progressBar.increment();
    });
  }

  async cleanModels(mgmt: any, multibar: any) {
    const contentModels = await mgmt.modelMethods.getContentModules(true, this._guid);

    const componentModels = await mgmt.modelMethods.getPageModules(true, this._guid);

    let pageModels = [];
    try {
      // TODO: this call fails if there's no page templates
      // we should fix this in the management API
      pageModels = await mgmt.pageMethods.getPageTemplates(this._guid, this._locale, true);
    } catch (err) {
      // do nothing, empty array
    }

    const totalModels = contentModels.length + componentModels.length + pageModels.length;

    const progressBar = multibar.create(totalModels, 0);
    progressBar.update(0, { name: "Deleting Models" });

    contentModels.forEach(async (model) => {
      try {
        await mgmt.modelMethods.deleteModel(model.id, this._guid);
        progressBar.increment();
      } catch (err) {
        console.log("Error deleting content model", err);
      }
    });

    componentModels.forEach(async (model) => {
      try {
        await mgmt.modelMethods.deleteModel(model.id, this._guid);
        progressBar.increment();
      } catch (err) {
        console.log("Error deleting component model", err);
      }
    });

    pageModels.forEach(async (model) => {
      try {
        await mgmt.pageMethods.deletePageTemplate(this._guid, this._locale, model.pageTemplateID);
        progressBar.increment();
      } catch (err) {
        console.log("Error deleting page model", err);
      }
    });
  }

  async cleanMedia(apiClient: any, multibar: any) {
    let assetsSync = new asset(options, multibar);
    // TODO: we need to loop over the locales

    await assetsSync.deleteAllAssets(this._guid, this._locale, true);
    await assetsSync.deleteAllGalleries(this._guid, this._locale, true);
  }
}

export default Clean;
