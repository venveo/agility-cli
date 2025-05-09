import * as mgmtApi from "@agility/management-sdk";
import * as cliProgress from "cli-progress";
import { containers as ContainersService } from "../services/containers"; // Renamed import
import * as fs from "fs";
import * as path from "path";

export async function downloadAllContainers(
  guid: string,
  locale: string, // Locale might not be strictly needed by containersService.getContainers but good for consistency
  isPreview: boolean, // isPreview might not be strictly needed by getContainers but good for consistency with pathing expectations
  options: mgmtApi.Options,
  multibar: cliProgress.MultiBar,
  basePath: string, // e.g., agility-files/{guid}/{locale}/{isPreview ? "preview" : "live"}
  progressCallback?: (processed: number, total: number, status?: 'success' | 'error' | 'progress') => void
): Promise<void> {
  // let basePath = path.join(rootPath, guid, locale, isPreview ? "preview" : "live");
  const containersFolderPath = path.join(basePath, "containers");
  // let progressBar: cliProgress.SingleBar; // Old cli-progress bar, remove

  // Check if the main containers folder exists and is not empty
//   if (fs.existsSync(containersFolderPath)) {
//     const filesOrDirs = fs.readdirSync(containersFolderPath);
//     if (filesOrDirs.length > 0) {
//       console.log(`Containers folder at ${containersFolderPath} is not empty. Skipping download.`);
//       if (progressCallback) progressCallback(1, 1, 'success');
//       return;
//     }
//   }

  if (!fs.existsSync(containersFolderPath)) {
    fs.mkdirSync(containersFolderPath, { recursive: true });
  }

  // Instantiate the containers service, passing the progressCallback.
  // The service's getContainers method uses guid, locale, isPreview for its internal path logic when saving files.
  const containersServiceInstance = new ContainersService(options, multibar, basePath, false, progressCallback);

  try {
    // console.log("Starting download of all containers...");
    // Initial progress can be set here if desired, but getContainers will also call it.
    // if (progressCallback) progressCallback(0, 1, 'progress'); // Example: 0 out of 1 general step
    
    await containersServiceInstance.getContainers(guid, locale, isPreview);
    
    // The final success/error callback is now handled within containersServiceInstance.getContainers
    // So, no explicit progressCallback(1,1, 'success') call here is needed.
  } catch (error) {
    // console.error(`\nError during container download process for ${guid}/${locale}:`, error);
    // The error-specific callback is handled by containersServiceInstance.getContainers.
    // If it re-throws, pull.ts will catch it and mark its own step as error.
    // No need for a fallback progressCallback here as getContainers should call it on error before throwing.
    throw error; // Re-throw to allow pull.ts to manage its step status
  }
} 