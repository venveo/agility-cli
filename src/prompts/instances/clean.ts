import inquirer from "inquirer";
import * as mgmtApi from "@agility/management-sdk";
import * as fetchApi from "@agility/content-fetch";
import * as cliProgress from "cli-progress";
import { fileOperations } from "../../fileOperations";
import { Auth } from "../../auth";
import { createMultibar } from "../../multibar";
import { asset } from "../../asset";
import { homePrompt } from "../home-prompt";
import ansiColors from "ansi-colors";
import { assetNew } from "../../asset_new";
import { AgilityInstance } from "../../types/instance";
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");

let auth: Auth;
let options: mgmtApi.Options;

class Clean {
  _selectedInstance: AgilityInstance;
  _locale: string;
  _guid: string;
  _websiteName: string;

  constructor(selectedInstance: AgilityInstance, locale: string) {
    this._selectedInstance = selectedInstance;
    this._locale = locale;
    this._guid = this._selectedInstance.guid;
    this._websiteName = this._selectedInstance.websiteDetails.websiteName;
  }

  async cleanAll() {
    auth = new Auth();
    let code = new fileOperations();
    let codeFileStatus = code.codeFileExists();

    if (codeFileStatus) {
      let data = JSON.parse(code.readTempFile("code.json"));

      const form = new FormData();
      form.append("cliCode", data.code);

      let token = await auth.cliPoll(form, this._guid);
      let multibar = createMultibar({ name: "Cleaning" });

      options = new mgmtApi.Options();
      options.token = token.access_token;

      let mgmtApiClient:mgmtApi.ApiClient = new mgmtApi.ApiClient(options);

      try {
        const answers = await inquirer.prompt([
          {
            type: "confirm",
            name: "cleanInstance",
            message: `⚠️ Are you sure you want to clean ${this._websiteName} instance ${this._guid}? All files and content will be deleted.`,
            default: false,
          },
        ]);

        if (answers.cleanInstance) {
          console.log("\n");

          const content = await this.cleanContent(mgmtApiClient, multibar);
          if (content) {
            const pages = await this.cleanPages(mgmtApiClient, multibar);
            if (pages) {
              const containers = await this.cleanContainers(mgmtApiClient, multibar);
              if (containers) {
                const models = await this.cleanModels(mgmtApiClient, multibar);
                if (models) {
                  const media = await this.cleanMedia(multibar);
                  if (media) {
                    return true;
                  }
                }
              }
            }
          }

        }
      } catch (err) {
        console.log("Error cleaning instance", err);
      } finally {
        console.log(ansiColors.green("🗑️ Instance cleaned successfully"));
        return true;
      }
    }

    return true;
  }

  async cleanContainers(mgmt: mgmtApi.ApiClient, multibar: any) {
    const containers = await mgmt.containerMethods.getContainerList(this._guid);
    const progressBar = multibar.create(containers.length, 0);
    progressBar.update(0, { name: "Deleting Containers" });
    for (const container of containers) {
      try {
        await mgmt.containerMethods.deleteContainer(container.contentViewID, this._guid);
        progressBar.increment();
      } catch (err) {
        console.log("Error deleting container");
      }
    }

    return true;
  }
  async cleanPages(mgmt: mgmtApi.ApiClient, multibar: any) {
    const sitemap = await mgmt.pageMethods.getSitemap(this._guid, this._locale);

    const pages:mgmtApi.SitemapItem[] = sitemap[0].pages;

    let parentPages = pages.filter((p) => p.parentPageID < 0);
    let childPages = pages.filter((p) => p.parentPageID > 0);

    let totalPages = parentPages.length + childPages.length;

    const progressBar = multibar.create(totalPages, 0);
    progressBar.update(0, { name: "Deleting Pages" });

    for (const page of childPages) {
      try {
        await mgmt.pageMethods.deletePage(page.pageID, this._guid, this._locale);
        progressBar.increment();
      } catch (err) {
        console.log("Error deleting page");
      }
    }

    for (const page of parentPages) {
      try {
        await mgmt.pageMethods.deletePage(page.pageID, this._guid, this._locale);
        progressBar.increment();
      } catch (err) {
        console.log("Error deleting page");
      }
    }

    return true;
  }

  async cleanContent(mgmt: mgmtApi.ApiClient, multibar: any) {
    const containers: mgmtApi.Container[] = await mgmt.containerMethods.getContainerList(this._guid);
    const progressBar = multibar.create(containers.length, 0);
    progressBar.update(0, { name: "Deleting Content Lists" });

    let content:mgmtApi.ContentItem[] = [];

    for (const container of containers) {
      try {
        const contentList = await mgmt.contentMethods.getContentList(container.referenceName, this._guid, this._locale, null);
        content = contentList.items;
      } catch {
      }
      if (content) {
        for (const contentItem of content) {
          try {
            await mgmt.contentMethods.deleteContent(contentItem.contentID, this._guid, this._locale);
          } catch (err) {
            console.log("Error deleting content", err);
          }
        }
      } else {
        console.log("No content list found in container", container);
      }

      progressBar.increment();
    }
    return true;
  }

  async cleanModels(mgmt: mgmtApi.ApiClient, multibar: any) {
    const contentModels = await mgmt.modelMethods.getContentModules(true, this._guid);
    const componentModels = await mgmt.modelMethods.getPageModules(true, this._guid);

    let pageModels: mgmtApi.PageModel[] = [];
    try {
      pageModels = await mgmt.pageMethods.getPageTemplates(this._guid, this._locale, true);
    } catch {
      // do nothing, empty array
    }

    const totalModels = contentModels.length + componentModels.length + pageModels.length;

    const progressBar = multibar.create(totalModels, 0);
    progressBar.update(0, { name: "Deleting Models" });
    for (const model of contentModels) {
      try {
        await mgmt.modelMethods.deleteModel(model.id, this._guid);
        progressBar.increment();
      } catch (err) {
        console.log("Error deleting content model");
      }
    }

    for (const model of componentModels) {
      try {
        await mgmt.modelMethods.deleteModel(model.id, this._guid);
        progressBar.increment();
      } catch (err) {
        console.log("Error deleting component model");
      }
    }

    for (const model of pageModels) {
      try {
        await mgmt.pageMethods.deletePageTemplate(this._guid, this._locale, model.pageTemplateID);
        progressBar.increment();
      } catch (err) {
        console.log("Error deleting page model");
      }
    }

    return true;
  }

  async cleanMedia(multibar: any) {
    let assetsSync = new assetNew(options, multibar);
    await assetsSync.deleteAllAssets(this._guid, this._locale, true);
    await assetsSync.deleteAllGalleries(this._guid, this._locale, true);
    return true;
  }
}

export default Clean;
