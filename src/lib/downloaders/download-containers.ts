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
  basePath: string // e.g., agility-files/{guid}/{locale}/{isPreview ? "preview" : "live"}
): Promise<void> {
  // let basePath = path.join(rootPath, guid, locale, isPreview ? "preview" : "live");
  const containersFolderPath = path.join(basePath, "containers");
  let progressBar: cliProgress.SingleBar;

  // Check if the main containers folder exists and is not empty
  if (fs.existsSync(containersFolderPath)) {
    const filesOrDirs = fs.readdirSync(containersFolderPath);
    if (filesOrDirs.length > 0) {
      progressBar = multibar.create(1, 1);
      progressBar.update(1, { name: "Containers (Skipped - Folder Not Empty)" });
      return;
    }
  }

  if (!fs.existsSync(containersFolderPath)) {
    fs.mkdirSync(containersFolderPath, { recursive: true });
  }

  // Instantiate the containers service.
  // The service's getContainers method uses guid, locale, isPreview for its internal path logic when saving files.
  const containersServiceInstance = new ContainersService(options, multibar, basePath, false);

  try {
    // This method from ContainersService should handle its own progress bar
    // and save files to agility-files/{guid}/{locale}/{mode}/containers/
    // console.log(`Downloading containers into: ${containersFolderPath}`);
    await containersServiceInstance.getContainers(guid, locale, isPreview);
  } catch (error) {
    console.error(`\nError during container download process for ${guid}/${locale}:`, error);
    // Add a failed progress bar item if not handled by the service method
    // progressBar = multibar.create(1, 0); 
    // progressBar.update(0, { name: `Containers (Failed)` });
    // progressBar.stop();
  }
} 