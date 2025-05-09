import * as mgmtApi from "@agility/management-sdk";
import * as cliProgress from "cli-progress";
import { assets as AssetsService } from "../services/assets";
import * as fs from "fs";
import * as path from "path";

export async function downloadAllGalleries(
  guid: string,
  locale: string,
  isPreview: boolean,
  options: mgmtApi.Options,
  multibar: cliProgress.MultiBar,
  basePath: string, // e.g., agility-files/{guid}/{locale}/{isPreview ? "preview" : "live"}
  progressCallback?: (processed: number, total: number, status?: 'success' | 'error' | 'progress') => void
): Promise<void> {
  // let basePath = path.join(rootPath, guid, locale, isPreview ? "preview" : "live");
  const galleriesFolderPath = path.join(basePath, "assets", "galleries");
  // let progressBar: cliProgress.SingleBar; // Old cli-progress bar, remove

  // Check if the galleries folder exists and is not empty
  // if (fs.existsSync(galleriesFolderPath)) {
  //   const filesOrDirs = fs.readdirSync(galleriesFolderPath);
  //   if (filesOrDirs.length > 0) {
  //     console.log(`Galleries folder at ${galleriesFolderPath} is not empty. Skipping download.`);
  //     if (progressCallback) progressCallback(1, 1, 'success');
  //     return;
  //   }
  // }

  // Ensure galleries directory exists if we proceed
  if (!fs.existsSync(galleriesFolderPath)) {
    fs.mkdirSync(galleriesFolderPath, { recursive: true });
  }

  const assetsServiceInstance = new AssetsService(options, multibar, basePath, false);

  try {
    // console.log("Starting download of all galleries...");
    if (progressCallback) progressCallback(0, 1, 'progress');
    await assetsServiceInstance.getGalleries(guid, locale, isPreview);
    // console.log("Gallery download process completed.");
    if (progressCallback) progressCallback(1, 1, 'success');
  } catch (error) {
    console.error(`\nError during gallery download process for ${guid}/${locale}:`, error);
    if (progressCallback) progressCallback(0, 1, 'error');
    throw error;
  }
} 