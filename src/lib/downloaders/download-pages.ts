import * as mgmtApi from "@agility/management-sdk";
import * as cliProgress from "cli-progress";
import { fileOperations } from "../services/fileOperations";
import * as fs from "fs";
import * as path from "path";
import ansiColors from "ansi-colors";

export async function downloadAllPages(
  guid: string,
  locale: string,
  isPreview: boolean,
  options: mgmtApi.Options,
  multibar: cliProgress.MultiBar,
  basePath: string, // e.g., agility-files/{guid}/{locale}/{isPreview ? "preview" : "live"}
  progressCallback?: (processed: number, total: number, status?: 'success' | 'error' | 'progress') => void
): Promise<void> {
  // let basePath = path.join(rootPath, guid, locale, isPreview ? "preview" : "live");
  // The sync client likely places page references (sitemap) in a folder like 'sitemap' or 'page'.
  // Based on original code, it was 'page' singular: fileOperation.readDirectory(`${guid}/${locale}/${isPreview ? "preview" : "live"}/page`)
  // However, the @agility/content-sync typically uses 'sitemap' for these flat files.
  // Let's assume 'sitemap' is the folder containing page reference JSON files after `runSync()`.
  const pageReferencesPath = path.join(basePath, "sitemap"); 
  const pagesDestFolderPath = path.join(basePath, "pages"); 

  const fileOps = new fileOperations();
  // let progressBar: cliProgress.SingleBar; // Old cli-progress bar, remove

  // Check if the DESTINATION pages folder exists and is not empty
  // if (fs.existsSync(pagesDestFolderPath)) {
  //   const filesInDest = fs.readdirSync(pagesDestFolderPath);
  //   if (filesInDest.length > 0) {
  //     console.log(`Pages destination folder at ${pagesDestFolderPath} is not empty. Skipping page download.`);
  //     if (progressCallback) progressCallback(1, 1, 'success');
  //     return;
  //   }
  // }

  // Ensure base directory and pagesDestFolderPath exist before trying to write pages
  if (!fs.existsSync(basePath)) {
    fs.mkdirSync(basePath, { recursive: true });
  }
  if (!fs.existsSync(pagesDestFolderPath)) {
    fs.mkdirSync(pagesDestFolderPath, { recursive: true });
  }

  // Check if the page references folder exists (it should, after agilitySync.runSync())
  if (!fs.existsSync(pageReferencesPath) || !fs.lstatSync(pageReferencesPath).isDirectory()) {
    console.log(`Page references folder (sitemap) not found at ${pageReferencesPath}. Skipping page download.`);
    if (progressCallback) progressCallback(0, 0, 'success'); // No pages to process
    return;
  }

  // The itemID for sitemaps (flat and nested) is typically the channel reference name, e.g., "website".
  const sitemapItemID = "website"; // Assuming this is the standard itemID for the channel's sitemap.
  const flatSitemapFilePath = path.join(pageReferencesPath, `${sitemapItemID}.json`);

  if (!fs.existsSync(flatSitemapFilePath)) {
    console.warn(ansiColors.yellow(`Flat sitemap file not found at ${flatSitemapFilePath}. Skipping page download.`));
    if (progressCallback) progressCallback(0, 0, 'success'); // No pages to process
    return;
  }
  
  let sitemapEntriesToProcess: [string, mgmtApi.PageItem][] = [];
  let sitemapObject: any = null; // To store the parsed sitemap

  try {
    const fileContent = fs.readFileSync(flatSitemapFilePath, "utf-8");
    sitemapObject = JSON.parse(fileContent);
    if (sitemapObject && typeof sitemapObject === 'object') {
        sitemapEntriesToProcess = Object.entries(sitemapObject)
            .filter(([pathKey, pageData]: [string, any]) => pageData && typeof pageData.pageID === 'number')
            .map(([pathKey, pageData]): [string, mgmtApi.PageItem] => [pathKey, pageData as mgmtApi.PageItem]);
    } else {
        throw new Error(`Sitemap content in ${flatSitemapFilePath} is not a valid object.`);
    }
  } catch (parseError: any) {
    console.error(ansiColors.red(`Error parsing sitemap file ${flatSitemapFilePath}: ${parseError.message}`));
    if (progressCallback) progressCallback(0, 0, 'error');
    return;
  }

  const totalPages = sitemapEntriesToProcess.length;

  if (totalPages === 0) {
    console.log("No page items with pageID found in sitemap to download.");
    if (progressCallback) progressCallback(0, 0, 'success');
    return;
  }

  let apiClient = new mgmtApi.ApiClient(options);
  if (progressCallback) progressCallback(0, totalPages, 'progress');
  let processedCount = 0;
  let successCount = 0;
  let errorCount = 0;

  try {
    for (let i = 0; i < sitemapEntriesToProcess.length; i++) {
      const [pagePath, pageItem] = sitemapEntriesToProcess[i]; // pageItem is an actual PageItem, pagePath is its key

      try {
        if (!pageItem.pageID) { // Should be filtered out already, but as a safeguard
            console.warn(ansiColors.yellow(`~ Skipping sitemap entry for path ${pagePath}: missing pageID.`));
        } else {
            const page = await apiClient.pageMethods.getPage(pageItem.pageID, guid, locale);
            fileOps.exportFiles("pages", String(page.pageID), page, basePath); 
            console.log(`✓ Downloaded page by path ${ansiColors.cyan(pagePath)}, ID: ${page.pageID}`);
            successCount++;
        }
      } catch (itemError: any) {
        console.error(ansiColors.red(`✗ Error processing page (ID ${pageItem.pageID}, Path ${pagePath}): ${itemError.message}`));
        errorCount++;
      }
      processedCount++; 
      if (progressCallback) progressCallback(processedCount, totalPages, 'progress');
    }
    
    let summaryMessage = `Downloaded ${processedCount}/${totalPages} pages. Errors: ${errorCount}.`;
    if (errorCount > 0) {
        console.log(ansiColors.yellow(summaryMessage));
    } else {
        console.log(ansiColors.yellow(summaryMessage));
    }

    if (progressCallback) progressCallback(processedCount, totalPages, errorCount === 0 && processedCount === totalPages ? 'success' : 'error');

  } catch (error: any) {
    console.error(ansiColors.red("\nFatal error during page download process:"), error.message);
    if (progressCallback) progressCallback(processedCount, totalPages, 'error');
    throw error;
  }
} 