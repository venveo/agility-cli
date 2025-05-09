import * as mgmtApi from "@agility/management-sdk";
import * as cliProgress from "cli-progress";
import { assets as AssetsService } from "../services/assets";
import * as fs from "fs";
import * as path from "path";

export async function downloadAllAssets(
  guid: string,
  locale: string,
  isPreview: boolean,
  options: mgmtApi.Options,
  multibar: cliProgress.MultiBar,
  basePath: string, // e.g., agility-files/{guid}/{locale}/{isPreview ? "preview" : "live"}
  progressCallback?: (processed: number, total: number, status?: 'success' | 'error' | 'progress') => void
): Promise<void> {
  // let basePath = path.join(rootPath, guid, locale, isPreview ? "preview" : "live");
  // Check specifically for the asset JSON metadata folder, or the main assets folder 
  // if it contains files/folders other than just 'galleries'.
  const assetJsonMetaPath = path.join(basePath, "assets", "json");
  const mainAssetsPath = path.join(basePath, "assets");
  // let shouldSkip = false;

  if (fs.existsSync(assetJsonMetaPath) && fs.readdirSync(assetJsonMetaPath).length > 0) {
    // shouldSkip = true;
  } else if (fs.existsSync(mainAssetsPath)) {
    // Check if main assets folder has more than just a 'galleries' subfolder
    const assetDirContents = fs.readdirSync(mainAssetsPath);
    const otherAssetContent = assetDirContents.filter(item => item !== 'galleries');
    if (otherAssetContent.length > 0) {
        // This implies asset files or their JSON metadata might already exist
        // shouldSkip = true;
    }
  }

  // if (shouldSkip) {
  //   console.log(`Asset folders (e.g. ${assetJsonMetaPath} or ${mainAssetsPath}) are already populated. Skipping asset download.`);
  //   if (progressCallback) progressCallback(1, 1, 'success');
  //   return;
  // }

  // Ensure base assets directory exists if we proceed (though service methods might also do this)
  if (!fs.existsSync(mainAssetsPath)) {
    fs.mkdirSync(mainAssetsPath, { recursive: true });
  }

  // Pass the progressCallback to the AssetsService constructor
  const assetsServiceInstance = new AssetsService(options, multibar, basePath, false, progressCallback);

  try {
    // console.log("Starting download of all asset files and metadata...");
    if (progressCallback) progressCallback(0, 1, 'progress');
    await assetsServiceInstance.getAssets(guid, locale, isPreview);
    // console.log("Asset file and metadata download process completed.");
  } catch (error) {
    // console.error(`\nError during asset file download process for ${guid}/${locale}:`, error);
    // The error specific callback is handled by assetsServiceInstance.getAssets
    // If it re-throws, then pull.ts will catch it and mark its own step as error.
    if (progressCallback && !(error instanceof Error && error.message === 'already_handled')) {
      // Fallback if AssetsService didn't manage to call progressCallback on error
      // progressCallback(0, 1, 'error'); 
      // Let the error propagate to be handled by pull.ts step management
    }
    throw error; // Re-throw to allow pull.ts to manage its step status
  }
} 