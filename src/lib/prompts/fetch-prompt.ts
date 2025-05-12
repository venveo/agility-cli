import inquirer from "inquirer";
import { localePrompt } from "./locale-prompt";
import { channelPrompt } from "./channel-prompt";
import { isPreviewPrompt } from "./isPreview-prompt";
import { baseUrlPrompt, getBaseURLfromGUID } from "./base-url-prompt";
import agilitySDK from "@agility/content-fetch";
import process from "process";

import { fileOperations } from "../services/fileOperations";
import { exec } from "child_process";
import { homePrompt } from "./home-prompt";
import { instancesPrompt } from "./instance-prompt";
import { AgilityInstance } from "../../types/instance";
import ansiColors from "ansi-colors";
import { blessedUIEnabled } from "../../index";
import rootPathPrompt from "./root-path-prompt";

export async function fetchCommandsPrompt(
  selectedInstance: AgilityInstance,
  keys: any,
  guid: string,
  locale: string,
  channel: string,
  isPreview: boolean,
  apiKey: string,
  rootPath: string
) {
  let files = new fileOperations(rootPath, guid, locale, isPreview);
  let data: any = null;
  const api = agilitySDK.getApi({
    guid,
    apiKey,
    isPreview,
  });
  const choices = [
    "getSitemapFlat",
    "getSitemapNested",
    'getContentList',
    'getContentItem',
    'getPage (by ID)',
    'getPageByPath',
    new inquirer.Separator(),
    "< Back to Instance",
    new inquirer.Separator(),
  ];

  const answer = await inquirer.prompt([
    {
      type: "list",
      name: "apiMethod",
      message: "Select an API method:",
      choices: choices,
    },
  ]);

  if (answer.apiMethod === "getSitemapFlat") {
    console.log("Fetching sitemap...");

    const sitemap = await api.getSitemapFlat({
      channelName: channel,
      languageCode: locale.toLowerCase(),
    });

    data = sitemap;
    files.createFile(
      `agility-files/${guid}/${locale}/${isPreview ? "preview" : "live"}/fetch/sitemapFlat.json`,
      JSON.stringify(sitemap, null, 2)
    );
    console.log(
      `Sitemap saved to ${process.cwd()}/agility-files/${guid}/${locale}/${
        isPreview ? "preview" : "live"
      }/fetch/sitemapFlat.json`
    );
    // fetchCommandsPrompt(selectedInstance, keys, guid, locale, channel, isPreview, baseUrl, apiKey);
    // homePrompt();
  } else if (answer.apiMethod === "getSitemapNested") {
    console.log("\nFetching sitemap...");
    const sitemapNested = await api.getSitemapNested({
      channelName: channel,
      languageCode: locale.toLowerCase(),
    });

    data = sitemapNested;
    files.createFile(
      `agility-files/${guid}/${locale}/${isPreview ? "preview" : "live"}/fetch/sitemapNested.json`,
      JSON.stringify(sitemapNested, null, 2)
    );
    console.log(
      `Sitemap saved to ${process.cwd()}/agility-files/${guid}/${locale}/${
        isPreview ? "preview" : "live"
      }/fetch/sitemapNested.json`
    );
    // fetchCommandsPrompt(selectedInstance, keys, guid, locale, channel, isPreview, baseUrl, apiKey);
    // homePrompt();
  } else if (answer.apiMethod === "getContentList") {
    const listAnswer = await inquirer.prompt([
      {
        type: "input",
        name: "referenceName",
        message: "Enter the reference name of the content list:",
        validate: (input) => input.trim() !== "" || "Reference name cannot be empty.",
      },
    ]);

    const contentList = await api.getContentList({
      referenceName: listAnswer.referenceName,
      languageCode: locale.toLowerCase(),
      contentLinkDepth: 2, // Adjust depth as needed
    });

    data = contentList;
    files.createFile(
      `agility-files/${guid}/${locale}/${isPreview ? "preview" : "live"}/fetch/${listAnswer.referenceName}.json`,
      JSON.stringify(contentList, null, 2)
    );
    console.log(
      `Content list saved to ${process.cwd()}/agility-files/${guid}/${locale}/${isPreview ? "preview" : "live"}/fetch/${
        listAnswer.referenceName
      }.json`
    );
  } else if (answer.apiMethod === "getContentItem") {
    const itemAnswer = await inquirer.prompt([
      {
        type: "input",
        name: "contentItemID",
        message: "Enter the contentItemID:",
        validate: (input) => input.trim() !== "" || "Content Item ID cannot be empty.",
      },
    ]);

    const contentItem = await api.getContentItem({
      contentID: parseInt(itemAnswer.contentItemID),
      languageCode: locale.toLowerCase(),
    });

    data = contentItem;
    files.createFile(
      `agility-files/${guid}/${locale}/${isPreview ? "preview" : "live"}/fetch/contentItem-${itemAnswer.contentItemID}.json`,
      JSON.stringify(contentItem, null, 2)
    );
    console.log(
      `Content item saved to ${process.cwd()}/agility-files/${guid}/${locale}/${
        isPreview ? "preview" : "live"
      }/fetch/contentItem-${itemAnswer.contentItemID}.json`
    );
  } else if (answer.apiMethod === "getPage (by ID)") {
    const pageAnswer = await inquirer.prompt([
      {
        type: "input",
        name: "pageID",
        message: "Enter the page ID:",
        validate: (input) => input.trim() !== "" || "Page ID cannot be empty.",
      },
    ]);
    const page = await api.getPage({
      pageID: parseInt(pageAnswer.pageID),
      languageCode: locale.toLowerCase(),
    });
    data = page;
    files.createFile(
      `agility-files/${guid}/${locale}/${isPreview ? "preview" : "live"}/fetch/page-${pageAnswer.pageID}.json`,
      JSON.stringify(page, null, 2)
    );
    console.log(
      `Page data saved to ${process.cwd()}/agility-files/${guid}/${locale}/${isPreview ? "preview" : "live"}/fetch/page-${
        pageAnswer.pageID
      }.json`
    );
  } else if (answer.apiMethod === "getPageByPath") {
    const pathAnswer = await inquirer.prompt([
      {
        type: "input",
        name: "pagePath",
        message: "Enter the page path (e.g., /users/group-activities):",
        validate: (input) => input.trim() !== "" || "Page path cannot be empty.",
      },
    ]);

    const page = await api.getPageByPath({
      pagePath: pathAnswer.pagePath,
      channelName: channel,
      languageCode: locale.toLowerCase(),
    });

    data = page;
    files.createFile(
      `agility-files/${guid}/${locale}/${isPreview ? "preview" : "live"}/fetch/page-${pathAnswer.pagePath.replace(
        /\//g,
        "-"
      )}.json`,
      JSON.stringify(page, null, 2)
    );
    console.log(
      `Page data saved to ${process.cwd()}/agility-files/${guid}/${locale}/${
        isPreview ? "preview" : "live"
      }/fetch/page-${pathAnswer.pagePath.replace(/\//g, "-")}.json`
    );
  } else if (answer.apiMethod === "< Back to Instance") {
    await instancesPrompt(selectedInstance, keys, blessedUIEnabled);
  }

  // homePrompt();
  return data;
}
export async function fetchAPIPrompt(selectedInstance: AgilityInstance, keys: any) {
  const guid = selectedInstance.guid;
  const locale = await localePrompt(selectedInstance);
  const channel = await channelPrompt();
  const isPreview = await isPreviewPrompt();
  const baseUrl = await getBaseURLfromGUID(guid);
  const rootPath = await rootPathPrompt();
  const apiKey = isPreview ? keys.previewKey : keys.fetchKey;
  let code = new fileOperations(rootPath, guid, locale, isPreview);

  // we need to make sure there's a fetch folder in the path directory
  code.createFolder(`/${guid}/${locale}/${isPreview ? 'preview' : 'live'}/fetch`);
      
  const data = await fetchCommandsPrompt(selectedInstance, keys, guid, locale, channel, isPreview, apiKey, rootPath);

  if (data) {
    console.log(ansiColors.yellow("\Search the data or hit enter/return to view full API response."));
    const searchAnswer = await inquirer.prompt([
      {
        type: "input",
        name: "searchQuery",
        message: "Search in data:",
      },
    ]);

    if (searchAnswer.searchQuery === "") {
      console.log(data);
    } else {
      const searchResults = Object.entries(data).filter(
        ([key, value]) =>
          key.includes(searchAnswer.searchQuery) || JSON.stringify(value).includes(searchAnswer.searchQuery)
      );
      console.log("\nSearch results:", searchResults);
    }
  }

  return true;
}
