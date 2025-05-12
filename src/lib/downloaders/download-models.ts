import * as mgmtApi from "@agility/management-sdk";
import * as cliProgress from "cli-progress";
import { models as ModelsService } from "../services/models"; // Renamed import
import * as fs from "fs";
import * as path from "path";
import ansiColors from "ansi-colors"; // For colored logging

export async function downloadAllModels(
  guid: string,
  locale: string, 
  isPreview: boolean, 
  options: mgmtApi.Options,
  multibar: cliProgress.MultiBar,
  basePath: string, // e.g., agility-files/{guid}/{locale}/{isPreview ? "preview" : "live"}
  forceOverwrite: boolean, // New parameter
  progressCallback?: (processed: number, total: number, status?: 'success' | 'error' | 'progress') => void
): Promise<void> {
  // let basePath = path.join(rootPath, guid, locale, isPreview ? "preview" : "live");
  const modelsFolderPath = path.join(basePath, "models");
  // let progressBar: cliProgress.SingleBar; // Old cli-progress bar, remove

  if (forceOverwrite) {
    // REMOVE: fs.rmSync for deleting the folder
    // if (fs.existsSync(modelsFolderPath)) {
    //   console.log(ansiColors.yellow(`Overwrite selected: Deleting existing models folder at ${modelsFolderPath}`));
    //   fs.rmSync(modelsFolderPath, { recursive: true, force: true });
    // }
    // ADD: Log message for overwriting
    // console.log(ansiColors.yellow(`Overwrite selected: Existing models will be refreshed.`));
  } else {
    if (fs.existsSync(modelsFolderPath)) {
      const filesOrDirs = fs.readdirSync(modelsFolderPath);
      if (filesOrDirs.length > 0) {
        const pathParts = modelsFolderPath.split('/');
        const displayPath = pathParts.slice(1).join('/'); // Changed from slice(0) to slice(1) to remove first part
        console.log(ansiColors.yellow(`Skipping Models download as ${displayPath} exists, overwrite not selected.`));
        if (progressCallback) progressCallback(1, 1, 'success'); // Mark as complete (skipped)
        return;
      }
    }
  }

  if (!fs.existsSync(modelsFolderPath)) {
    fs.mkdirSync(modelsFolderPath, { recursive: true });
  }

  // Instantiate the models service, passing the progressCallback.
  const modelsServiceInstance = new ModelsService(options, multibar, basePath, false, progressCallback);

  try {
    // console.log("Starting download of all content and page models...");
    // Initial progress can be set here if desired, but getModels will also call it.
    await modelsServiceInstance.getModels(guid, locale, isPreview, basePath);
    // Final success/error callback is handled by modelsServiceInstance.getModels
  } catch (error) {
    // Error-specific callback is handled by modelsServiceInstance.getModels.
    // Re-throw to allow pull.ts to manage its step status.
    throw error;
  }
} 