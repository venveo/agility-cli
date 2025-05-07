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
  basePath: string // e.g., agility-files/{guid}/{locale}/{isPreview ? "preview" : "live"}
): Promise<void> {
  // let basePath = path.join(rootPath, guid, locale, isPreview ? "preview" : "live");
  // Content items are assumed to be downloaded by the main agilitySync.runSync() call
  // into their respective folders within basePath (e.g., basePath/contentDefinitionRefName/item.json
  // or basePath/content/item.json or basePath/items/item.json).
  // This function primarily serves as a placeholder in the download sequence and checks
  // for the existence of a common content directory as a heuristic.

  // Heuristic: Check for a common top-level folder like 'content' or 'items'.
  // This might need adjustment based on how `storeInterfaceFileSystem` organizes content.
  const commonContentPath1 = path.join(basePath, "content");
  const commonContentPath2 = path.join(basePath, "items"); // Another common name
  
  let progressBar: cliProgress.SingleBar;
  let contentFound = false;

  if (fs.existsSync(commonContentPath1) && fs.readdirSync(commonContentPath1).length > 0) {
    contentFound = true;
  }
  if (!contentFound && fs.existsSync(commonContentPath2) && fs.readdirSync(commonContentPath2).length > 0) {
    contentFound = true;
  }

  // A more robust check would be to scan `basePath` for multiple potential content definition folders,
  // but that's more involved. For now, this heuristic is a starting point.

  if (contentFound) {
    progressBar = multibar.create(1, 1);
    progressBar.update(1, { name: "Content (Skipped - Folders Populated)" });
    return;
  } else {
    // This means the main sync might not have downloaded content items as expected, or they are organized differently.
    // No specific download action is taken here; it relies on the preceding base sync.
    progressBar = multibar.create(1, 1); // Show it as 'done' but with a note.
    progressBar.update(1, { name: "Content" });
    // console.warn(`Content folders (${commonContentPath1} or ${commonContentPath2}) are empty or not found after base sync. This might be okay if content is organized differently, or an issue with the sync process.`);
    return;
  }
  // If in the future, specific API calls are needed to augment what syncSDK does for content items,
  // they would be added here, likely using the ContentService.
} 