import * as mgmtApi from "@agility/management-sdk";
import * as cliProgress from "cli-progress";
import { fileOperations } from "../services/fileOperations"; // Assuming fileOperations is in services
import * as fs from "fs"; // For checking if folder is empty
import * as path from "path"; // For path operations

export async function downloadAllTemplates(
  guid: string,
  locale: string,
  isPreview: boolean,
  options: mgmtApi.Options,
  multibar: cliProgress.MultiBar,
  // basePath will be agility-files/{guid}/{locale}/{isPreview ? "preview" : "live"}
  // This is constructed by the caller (Pull service)
  basePath: string 
): Promise<void> {

  // let basePath = path.join(rootPath, guid, locale, isPreview ? "preview" : "live");

  const templatesFolderPath = path.join(basePath, 'templates');
  const fileOps = new fileOperations();
  let progressBar: cliProgress.SingleBar; // Declare progressBar here

  // Check if the templates folder exists and is not empty
  if (fs.existsSync(templatesFolderPath)) {
    const files = fs.readdirSync(templatesFolderPath);
    if (files.length > 0) {
      // console.log(colors.yellow(`Templates folder at ${templatesFolderPath} is not empty. Skipping download.`));
      // Optionally, add a progress bar item to indicate skipping
      progressBar = multibar.create(1, 1);
      progressBar.update(1, { name: "Templates (Skipped - Folder Not Empty)" });
      return;
    }
  }

  // Ensure base directory exists before trying to write templates
  if (!fs.existsSync(basePath)) {
    fs.mkdirSync(basePath, { recursive: true });
  }
  // Ensure templates directory exists
   if (!fs.existsSync(templatesFolderPath)) {
    fs.mkdirSync(templatesFolderPath, { recursive: true });
  }

  let apiClient = new mgmtApi.ApiClient(options);
  try {
    let pageTemplates = await apiClient.pageMethods.getPageTemplates(guid, locale, true); // Assuming isPackaged is true

    if (pageTemplates.length === 0) {
        progressBar = multibar.create(1, 1);
        progressBar.update(1, { name: "Templates (No templates found)"});
        return;
    }

    progressBar = multibar.create(pageTemplates.length, 0); // Assign here
    progressBar.update(0, { name: "Downloading Templates" });
    let index = 0;

    for (let i = 0; i < pageTemplates.length; i++) {
      let template = pageTemplates[i];
      index += 1;
      progressBar.update(index);
      // fileOps.exportFiles needs to know the 'type' (templates) and the specific ID for the filename,
      // and the object to save, and the *root* output folder for that type.
      // The exportFiles method from sync.ts was:
      // fileExport.exportFiles(`templates`, template.pageTemplateID, template, baseFolder);
      // Here baseFolder was agility-files/{guid}/{locale}/{isPreview ? "preview" : "live"}
      // So, we pass 'templates' as type, template.pageTemplateID as id, template as obj, and templatesFolderPath
      fileOps.exportFiles(`templates`, template.pageTemplateID, template, basePath); 
    }
    if (progressBar) progressBar.stop(); // Ensure progress bar stops
  } catch (error) {
    if (progressBar) progressBar.stop(); // Ensure progress bar stops on error
    console.error("\nError downloading page templates:", error);
    // Potentially re-throw or handle more gracefully
  }
} 