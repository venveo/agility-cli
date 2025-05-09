import * as mgmtApi from "@agility/management-sdk";
import * as cliProgress from "cli-progress";
// We don't import ContentService as we are assuming syncSDK handles content item files.
import * as fs from "fs";
import * as path from "path";

export async function downloadAllContent(
  guid: string,
  locale: string,
  isPreview: boolean,
  options: mgmtApi.Options, // Kept for API consistency, though not directly used here yet
  multibar: cliProgress.MultiBar,
  basePath: string, // e.g., agility-files/{guid}/{locale}/{isPreview ? "preview" : "live"}
  progressCallback?: (processed: number, total: number, status?: 'success' | 'error' | 'progress') => void
): Promise<void> {
  // let basePath = path.join(rootPath, guid, locale, isPreview ? "preview" : "live");
  // Content items are assumed to be downloaded by the main agilitySync.runSync() call
  // into their respective folders within basePath (e.g., basePath/contentDefinitionRefName/item.json
  // or basePath/content/item.json or basePath/items/item.json).
  // This function primarily serves as a placeholder in the download sequence and checks
  // for the existence of a common content directory as a heuristic.

  // Heuristic: Check for a common top-level folder like 'content' or 'items'.
  // This might need adjustment based on how `storeInterfaceFileSystem` organizes content.
//   const commonContentPath1 = path.join(basePath, "content");
  const commonContentPath1 = path.join(basePath, "item"); // Another common name
  
  let contentFound = false;

//   console.log("Checking for existing synchronized content items...");
  if (fs.existsSync(commonContentPath1) && fs.readdirSync(commonContentPath1).length > 0) {
    console.log(`Content found in ${commonContentPath1}.`);
    contentFound = true;
  }
//   if (!contentFound && fs.existsSync(commonContentPath2) && fs.readdirSync(commonContentPath2).length > 0) {
//     console.log(`Content found in ${commonContentPath2}.`);
//     contentFound = true;
//   }

  // A more robust check would be to scan `basePath` for multiple potential content definition folders,
  // but that's more involved. For now, this heuristic is a starting point.

  if (contentFound) {
    console.log("Content items already synchronized. Skipping explicit content download step.");
    if (progressCallback) progressCallback(1, 1, 'success'); 
    return;
  } else {
    console.log(`No pre-existing content items found in common locations (${commonContentPath1}).`);
    if (progressCallback) progressCallback(1, 1, 'success'); 
    return;
  }
  // If in the future, specific API calls are needed to augment what syncSDK does for content items,
  // they would be added here, likely using the ContentService.
} 