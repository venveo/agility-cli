import * as mgmtApi from "@agility/management-sdk";
import * as cliProgress from "cli-progress";
import { fileOperations } from "../services/fileOperations";
import * as fs from "fs";
import * as path from "path";

export async function downloadAllPages(
  guid: string,
  locale: string,
  isPreview: boolean,
  options: mgmtApi.Options,
  multibar: cliProgress.MultiBar,
  basePath: string // e.g., agility-files/{guid}/{locale}/{isPreview ? "preview" : "live"}
): Promise<void> {
  // let basePath = path.join(rootPath, guid, locale, isPreview ? "preview" : "live");
  // The sync client likely places page references (sitemap) in a folder like 'sitemap' or 'page'.
  // Based on original code, it was 'page' singular: fileOperation.readDirectory(`${guid}/${locale}/${isPreview ? "preview" : "live"}/page`)
  // However, the @agility/content-sync typically uses 'sitemap' for these flat files.
  // Let's assume 'sitemap' is the folder containing page reference JSON files after `runSync()`.
  const pageReferencesPath = path.join(basePath, "sitemap"); // Or 'page' if confirmed from sync client behavior
  const pagesDestFolderPath = path.join(basePath, "pages"); // Where full page JSONs are saved

  const fileOps = new fileOperations();
  let progressBar: cliProgress.SingleBar;

  // Check if the DESTINATION pages folder exists and is not empty
  if (fs.existsSync(pagesDestFolderPath)) {
    const filesInDest = fs.readdirSync(pagesDestFolderPath);
    if (filesInDest.length > 0) {
      progressBar = multibar.create(1, 1);
      progressBar.update(1, { name: "Pages (Skipped - Folder Not Empty)" });
      return;
    }
  }

  // Ensure base directory and pagesDestFolderPath exist before trying to write pages
  if (!fs.existsSync(basePath)) {
    fs.mkdirSync(basePath, { recursive: true });
  }
  if (!fs.existsSync(pagesDestFolderPath)) {
    fs.mkdirSync(pagesDestFolderPath, { recursive: true });
  }

  // Check if the page references folder exists (it should, after agilitySync.runSync())
  if (!fs.existsSync(pageReferencesPath) || !fs.lstatSync(pageReferencesPath).isDirectory()) {
    // console.warn(`Page references folder not found at ${pageReferencesPath}. Skipping page download.`);
    progressBar = multibar.create(1,1);
    progressBar.update(1, { name: "Pages (Skipped - Refs Not Found)" });
    return;
  }

  const pageReferenceFiles = fs.readdirSync(pageReferencesPath).filter(f => f.endsWith(".json"));

  if (pageReferenceFiles.length === 0) {
    progressBar = multibar.create(1, 1);
    progressBar.update(1, { name: "Pages (No page references found)" });
    return;
  }

  let apiClient = new mgmtApi.ApiClient(options);
  progressBar = multibar.create(pageReferenceFiles.length, 0);
  progressBar.update(0, { name: "Downloading Pages" });
  let SucceededCount = 0;
  let ErrorCount = 0;

  try {
    for (let i = 0; i < pageReferenceFiles.length; i++) {
      const filePath = path.join(pageReferencesPath, pageReferenceFiles[i]);
      try {
        const fileContent = fs.readFileSync(filePath, "utf-8");
        // Assuming the reference file itself contains enough info like { pageID: number }
        // Or, if the filename is the pageID (e.g., {pageID}.json)
        // The original code did: let pageItem = JSON.parse(files[i]) as mgmtApi.PageItem;
        // This implied files[i] was the content, not the name. So we use fileContent.
        const pageItem = JSON.parse(fileContent) as mgmtApi.PageItem; // Must have pageID

        if (!pageItem.pageID) {
            // console.warn(`Skipping page reference ${pageReferenceFiles[i]} as it does not contain a pageID.`);
            ErrorCount++;
            progressBar.increment(1);
            continue;
        }

        const page = await apiClient.pageMethods.getPage(pageItem.pageID, guid, locale);
        // Original code: fileOperation.exportFiles(`${guid}/${locale}/${isPreview ? "preview" : "live"}/pages`, page.pageID, page)
        // The first arg to exportFiles was the FOLDER name for that content type WITHIN the base path.
        // So, it should be 'pages', then pageID, then page object, then the overall basePath for the instance.
        fileOps.exportFiles("pages", page.pageID, page, basePath);
        SucceededCount++;
      } catch (itemError) {
        // console.error(`Error processing page reference ${pageReferenceFiles[i]}:`, itemError);
        ErrorCount++;
      }
      progressBar.increment(1, {name: `Downloading Pages` });
    }
    if(progressBar) progressBar.stop();
  } catch (error) {
    if(progressBar) progressBar.stop();
    console.error("\nError downloading pages:", error);
  }
} 