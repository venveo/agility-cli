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
  basePath: string // e.g., agility-files/{guid}/{locale}/{isPreview ? "preview" : "live"}
): Promise<void> {
  // let basePath = path.join(rootPath, guid, locale, isPreview ? "preview" : "live");
  const galleriesFolderPath = path.join(basePath, "assets", "galleries");
  let progressBar: cliProgress.SingleBar;

  // Check if the galleries folder exists and is not empty
  if (fs.existsSync(galleriesFolderPath)) {
    const filesOrDirs = fs.readdirSync(galleriesFolderPath);
    if (filesOrDirs.length > 0) {
      progressBar = multibar.create(1, 1);
      progressBar.update(1, { name: "Galleries (Skipped - Folder Not Empty)" });
      return;
    }
  }

  // Ensure galleries directory exists if we proceed
  if (!fs.existsSync(galleriesFolderPath)) {
    fs.mkdirSync(galleriesFolderPath, { recursive: true });
  }

  const assetsServiceInstance = new AssetsService(options, multibar, basePath, false);

  try {
    // console.log(`Downloading galleries into: ${galleriesFolderPath}`);
    await assetsServiceInstance.getGalleries(guid, locale, isPreview);
  } catch (error) {
    console.error(`\nError during gallery download process for ${guid}/${locale}:`, error);
  }
} 