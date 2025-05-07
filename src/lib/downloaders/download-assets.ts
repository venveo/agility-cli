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
  basePath: string // e.g., agility-files/{guid}/{locale}/{isPreview ? "preview" : "live"}
): Promise<void> {
  // let basePath = path.join(rootPath, guid, locale, isPreview ? "preview" : "live");
  // Check specifically for the asset JSON metadata folder, or the main assets folder 
  // if it contains files/folders other than just 'galleries'.
  const assetJsonMetaPath = path.join(basePath, "assets", "json");
  const mainAssetsPath = path.join(basePath, "assets");
  let progressBar: cliProgress.SingleBar;
  let shouldSkip = false;

  if (fs.existsSync(assetJsonMetaPath) && fs.readdirSync(assetJsonMetaPath).length > 0) {
    shouldSkip = true;
  } else if (fs.existsSync(mainAssetsPath)) {
    // Check if main assets folder has more than just a 'galleries' subfolder
    const assetDirContents = fs.readdirSync(mainAssetsPath);
    const otherAssetContent = assetDirContents.filter(item => item !== 'galleries');
    if (otherAssetContent.length > 0) {
        // This implies asset files or their JSON metadata might already exist
        shouldSkip = true;
    }
  }

  if (shouldSkip) {
    progressBar = multibar.create(1, 1);
    progressBar.update(1, { name: "Asset Files (Skipped - Folders Populated)" });
    return;
  }

  // Ensure base assets directory exists if we proceed (though service methods might also do this)
  if (!fs.existsSync(mainAssetsPath)) {
    fs.mkdirSync(mainAssetsPath, { recursive: true });
  }

  const assetsServiceInstance = new AssetsService(options, multibar, basePath, false);

  try {
    // console.log(`Downloading asset files and metadata into: ${mainAssetsPath}`);
    await assetsServiceInstance.getAssets(guid, locale, isPreview);
  } catch (error) {
    console.error(`\nError during asset file download process for ${guid}/${locale}:`, error);
  }
} 