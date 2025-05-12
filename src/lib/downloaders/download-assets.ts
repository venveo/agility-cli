import * as mgmtApi from "@agility/management-sdk";
import * as cliProgress from "cli-progress";
import { assets as AssetsService } from "../services/assets";
import * as fs from "fs";
import * as path from "path";
import ansiColors from "ansi-colors"; // For colored logging

export async function downloadAllAssets(
  guid: string,
  locale: string,
  isPreview: boolean,
  options: mgmtApi.Options,
  multibar: cliProgress.MultiBar,
  basePath: string, 
  forceOverwrite: boolean, // New parameter
  progressCallback?: (processed: number, total: number, status?: 'success' | 'error' | 'progress') => void
): Promise<void> {
  const mainAssetsPath = path.join(basePath, "assets");
  const assetJsonMetaPath = path.join(mainAssetsPath, "json");

  if (forceOverwrite) {
    // REMOVE: fs.rmSync for deleting the folder
    // if (fs.existsSync(assetJsonMetaPath)) {
    //   console.log(ansiColors.yellow(`Overwrite selected: Deleting existing asset JSON metadata folder at ${assetJsonMetaPath}`));
    //   fs.rmSync(assetJsonMetaPath, { recursive: true, force: true });
    // }
    // Note: Actual asset binary files are typically within gallery folders or handled by AssetsService.
    // Clearing assetJsonMetaPath ensures their metadata is re-fetched and they might be re-downloaded by AssetsService.
    // ADJUST Log message
    // console.log(ansiColors.yellow(`Overwrite selected: Asset files and metadata will be refreshed.`));
  } else {
    let skipDownload = false;
    if (fs.existsSync(assetJsonMetaPath) && fs.readdirSync(assetJsonMetaPath).length > 0) {
      skipDownload = true;
    } else if (fs.existsSync(mainAssetsPath)) {
      const assetDirContents = fs.readdirSync(mainAssetsPath);
      // Check if there's anything in mainAssetsPath other than 'galleries' (managed separately) or 'json' (already checked)
      const otherAssetContent = assetDirContents.filter(item => item !== 'galleries' && item !== 'json');
      if (otherAssetContent.length > 0) {
        // This implies other asset files or structures exist directly in mainAssetsPath
        skipDownload = true;
      }
    }

    if (skipDownload) {
      console.log(ansiColors.yellow(`Skipping Assets download: Local asset files/metadata exist (e.g., in ${assetJsonMetaPath} or ${mainAssetsPath}) and overwrite not selected.`));
      if (progressCallback) progressCallback(1, 1, 'success'); // Mark as complete (skipped)
      return;
    }
  }

  // Ensure base assets directory and json metadata directory exist if we proceed
  if (!fs.existsSync(mainAssetsPath)) {
    fs.mkdirSync(mainAssetsPath, { recursive: true });
  }
  if (!fs.existsSync(assetJsonMetaPath)) {
    // This might be created by AssetsService too, but ensuring it here is safe if forceOverwrite happened
    fs.mkdirSync(assetJsonMetaPath, { recursive: true });
  }

  const assetsServiceInstance = new AssetsService(options, multibar, basePath, false, progressCallback);

  try {
    // AssetsService already calls progressCallback internally for its multiple steps.
    // Initial call to set to 0% for the overall "Assets" step in pull.ts was handled before calling this.
    // If progressCallback is directly passed and used by AssetsService, we don't need to call it here explicitly for start/end of this function.
    await assetsServiceInstance.getAssets(guid, locale, isPreview);
    // Final success call might be redundant if AssetsService calls it with 100%.
    // However, to ensure the step in pull.ts is marked complete if AssetsService doesn't do a final 100%:
    // if (progressCallback) progressCallback(1, 1, 'success'); 
    // Let AssetsService manage its own detailed progress. pull.ts will mark success upon non-error completion of this function.
  } catch (error) {
    // AssetsService should ideally call progressCallback with error status.
    // If not, this error will propagate, and pull.ts will mark the step as error.
    throw error; 
  }
} 