import * as mgmtApi from "@agility/management-sdk";
import * as cliProgress from "cli-progress";
import { fileOperations } from "../services/fileOperations"; // Assuming fileOperations is in services
import * as fs from "fs"; // For checking if folder is empty
import * as path from "path"; // For path operations
import ansiColors from "ansi-colors";

export async function downloadAllTemplates(
  guid: string,
  locale: string,
  isPreview: boolean,
  options: mgmtApi.Options,
  multibar: cliProgress.MultiBar,
  // basePath will be agility-files/{guid}/{locale}/{isPreview ? "preview" : "live"}
  // This is constructed by the caller (Pull service)
  basePath: string,
  progressCallback?: (processed: number, total: number, status?: 'success' | 'error' | 'progress') => void
): Promise<void> {

  // let basePath = path.join(rootPath, guid, locale, isPreview ? "preview" : "live");

  const templatesFolderPath = path.join(basePath, 'templates');
  const fileOps = new fileOperations();
  // let progressBar: cliProgress.SingleBar; // Old cli-progress bar, remove

  // Check if the templates folder exists and is not empty
  // if (fs.existsSync(templatesFolderPath)) {
  //   const files = fs.readdirSync(templatesFolderPath);
  //   if (files.length > 0) {
  //     console.log(`Templates folder at ${templatesFolderPath} is not empty. Skipping download.`);
  //     if (progressCallback) progressCallback(1,1, 'success'); 
  //     return;
  //   }
  // }

  // Ensure base directory exists before trying to write templates
  if (!fs.existsSync(basePath)) {
    fs.mkdirSync(basePath, { recursive: true });
  }
  // Ensure templates directory exists
   if (!fs.existsSync(templatesFolderPath)) {
    fs.mkdirSync(templatesFolderPath, { recursive: true });
  }

  let apiClient = new mgmtApi.ApiClient(options);
  let totalTemplates = 0; // Define totalTemplates in a broader scope for the catch block
  try {
    // console.log("Fetching list of page templates...");
    let pageTemplates = await apiClient.pageMethods.getPageTemplates(guid, locale, true); 
    totalTemplates = pageTemplates.length; // Assign here
    // console.log(`Found ${totalTemplates} page templates to download.`);

    if (totalTemplates === 0) {
        console.log("No page templates found to download.");
        if (progressCallback) progressCallback(0, 0, 'success'); 
        return;
    }

    let processedCount = 0;
    if (progressCallback) progressCallback(0, totalTemplates, 'progress');
    // console.log("Starting download of page templates...");

    for (let i = 0; i < totalTemplates; i++) {
      let template = pageTemplates[i];
      fileOps.exportFiles(`templates`, template.pageTemplateID, template, basePath);
      processedCount++;
      if (progressCallback) progressCallback(processedCount, totalTemplates, 'progress');
      console.log(`✓ Downloaded template ${ansiColors.cyan(template.pageTemplateName)} ID: ${template.pageTemplateID}`);
    }
    
    // Summary of downloaded templates
    console.log(ansiColors.yellow(`\nDownloaded ${totalTemplates} templates (${processedCount}/${totalTemplates} templates, 0 errors)\n`));
    // console.log("All page templates downloaded successfully.");
    if (progressCallback) progressCallback(totalTemplates, totalTemplates, 'success');
  } catch (error) {
    console.error("\nError downloading page templates:", error);
    // Use the totalTemplates variable from the outer scope
    if (progressCallback) progressCallback(0, totalTemplates, 'error'); 
    throw error; 
  }
} 