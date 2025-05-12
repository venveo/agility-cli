import * as mgmtApi from "@agility/management-sdk";
import * as cliProgress from "cli-progress";
import { assets as AssetsService } from "../services/assets";
import * as fs from "fs";
import * as path from "path";
import ansiColors from "ansi-colors"; // For colored logging

export async function downloadAllGalleries(
  guid: string,
  locale: string,
  isPreview: boolean,
  options: mgmtApi.Options,
  multibar: cliProgress.MultiBar,
  basePath: string, 
  forceOverwrite: boolean, // New parameter
  progressCallback?: (processed: number, total: number, status?: 'success' | 'error' | 'progress') => void
): Promise<void> {
  const galleriesParentPath = path.join(basePath, "assets"); // Parent for galleries
  const galleriesFolderPath = path.join(galleriesParentPath, "galleries");

  if (forceOverwrite) {
    // console.log(ansiColors.yellow(`Overwrite selected: Existing galleries will be refreshed.`));
  } else {
    if (fs.existsSync(galleriesFolderPath)) {
      const filesOrDirs = fs.readdirSync(galleriesFolderPath);
      if (filesOrDirs.length > 0) {
        console.log(ansiColors.yellow(`Skipping Galleries download: Local files exist at ${galleriesFolderPath} and overwrite not selected.`));
        if (progressCallback) progressCallback(1, 1, 'success'); // Mark as complete (skipped)
        return;
      }
    }
  }

  // Ensure galleries directory exists (it might have been deleted or never existed)
  if (!fs.existsSync(galleriesFolderPath)) {
    fs.mkdirSync(galleriesFolderPath, { recursive: true });
  }
  // Also ensure the parent 'assets' directory exists, as galleries are nested
  if (!fs.existsSync(galleriesParentPath)) {
    fs.mkdirSync(galleriesParentPath, { recursive: true });
  }

  const assetsServiceInstance = new AssetsService(options, multibar, basePath, false);

  try {
    if (progressCallback) progressCallback(0, 1, 'progress'); // Initial progress before actual download
    await assetsServiceInstance.getGalleries(guid, locale, isPreview);
    if (progressCallback) progressCallback(1, 1, 'success');
  } catch (error) {
    console.error(`\nError during gallery download process for ${guid}/${locale}:`, error);
    if (progressCallback) progressCallback(0, 1, 'error');
    throw error;
  }
} 