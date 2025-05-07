import * as mgmtApi from "@agility/management-sdk";
import * as cliProgress from "cli-progress";
import { models as ModelsService } from "../services/models"; // Renamed import
import * as fs from "fs";
import * as path from "path";

export async function downloadAllModels(
  guid: string,
  locale: string, 
  isPreview: boolean, 
  options: mgmtApi.Options,
  multibar: cliProgress.MultiBar,
  basePath: string // e.g., agility-files/{guid}/{locale}/{isPreview ? "preview" : "live"}
): Promise<void> {
  // let basePath = path.join(rootPath, guid, locale, isPreview ? "preview" : "live");
  const modelsFolderPath = path.join(basePath, "models");
  let progressBar: cliProgress.SingleBar;

  // Check if the main models folder exists and is not empty
  if (fs.existsSync(modelsFolderPath)) {
    const filesOrDirs = fs.readdirSync(modelsFolderPath);
    if (filesOrDirs.length > 0) {
      progressBar = multibar.create(1, 1);
      progressBar.update(1, { name: "Models (Skipped - Folder Not Empty)" });
      return;
    }
  }

  if (!fs.existsSync(modelsFolderPath)) {
    fs.mkdirSync(modelsFolderPath, { recursive: true });
  }

  // Instantiate the models service.
  // The service's getModels method takes guid, locale, isPreview, and a baseFolder (our basePath) for saving files.
  const modelsServiceInstance = new ModelsService(options, multibar, basePath, false);

  try {
    // This method from ModelsService should handle its own progress bar
    // and save files to agility-files/{guid}/{locale}/{mode}/models/
    // console.log(`Downloading models into: ${modelsFolderPath}`);
    await modelsServiceInstance.getModels(guid, locale, isPreview, basePath);
  } catch (error) {
    console.error(`\nError during model download process for ${guid}/${locale}:`, error);
    // Add a failed progress bar item if not handled by the service method
    // progressBar = multibar.create(1, 0);
    // progressBar.update(0, { name: `Models (Failed)` });
    // progressBar.stop();
  }
} 