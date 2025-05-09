import * as mgmtApi from "@agility/management-sdk";
import * as cliProgress from "cli-progress";
import * as agilitySync from "@agility/content-sync";
import * as path from "path";
import * as fs from 'fs';
const storeInterfaceFileSystem = require("./store-interface-filesystem"); 
const blessed = require('blessed');
const contrib = require('blessed-contrib');
const ora = require('ora'); // Use require for ora v5
import { fileOperations } from "./fileOperations"; // Added import

// Path relative to services folder
import { downloadAllGalleries, 
    downloadAllAssets, 
    downloadAllModels, 
    downloadAllContainers, 
    downloadAllContent, 
    downloadAllTemplates, 
    downloadAllPages
} from "../downloaders/index";
import ansiColors from "ansi-colors";

// Define a type for the progress callback
type ProgressCallbackType = (processed: number, total: number, status?: 'success' | 'error' | 'progress') => void;

export class Pull {
  private _guid: string;
  private _apiKey: string;
  private _locale: string;
  private _channel: string;
  private _isPreview: boolean;
  private _options: mgmtApi.Options;
  private _multibar: cliProgress.MultiBar | null; // Can be null if not used
  private _elements: any;
  private _rootPath: string;
  private _legacyFolders: boolean;
  private _useBlessedUI: boolean; // This will be determined by the new flags
  private isHeadless: boolean;
  private isVerbose: boolean;
  private fileOps: fileOperations; // For logging to file in headless mode

  constructor(
    guid: string,
    apiKey: string,
    locale: string,
    channel: string,
    isPreview: boolean,
    options: mgmtApi.Options,
    multibar: cliProgress.MultiBar | null, // Updated to allow null
    elements: any,
    rootPath: string = "agility-files",
    legacyFolders: boolean = false,
    // New flags controlling UI and output behavior
    useBlessedArgument: boolean = true, // Default to true if not specified, aligns with old blessed flag
    isHeadlessMode: boolean = false,
    isVerboseMode: boolean = false
  ) {
    this._guid = guid;
    this._apiKey = apiKey;
    this._locale = locale;
    this._channel = channel;
    this._isPreview = isPreview;
    this._options = options;
    this._multibar = multibar; // Store it, might be null
    this._elements = elements;
    this._rootPath = rootPath;
    this._legacyFolders = legacyFolders;

    this.isHeadless = isHeadlessMode;
    this.isVerbose = !this.isHeadless && isVerboseMode; // verbose is overridden by headless
    // _useBlessedUI is true if the blessed argument is true, AND we are not in headless or verbose mode.
    this._useBlessedUI = useBlessedArgument && !this.isHeadless && !this.isVerbose;
    this.fileOps = new fileOperations(); // Initialize for potential file logging
  }

  // Add a helper for logging to file in headless mode
  private _logToFile(message: string, isError: boolean = false): void {
    const timestamp = new Date().toISOString();
    const level = isError ? 'ERROR' : 'INFO';
    // Ensure fileOperations.appendLogFile handles newline if needed or add it here.
    // Assuming appendLogFile needs the full string including newline.
    this.fileOps.appendLogFile(`${timestamp} [${level}] ${message}\n`);
  }

  async pullInstance(): Promise<void> {
    let screen: any | null = null;
    let logContainer: any | null = null;
    let progressContainerBox: any | null = null;
    let stepProgressBars: any[] = [];

    // Store original console methods AT THE START
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;

    // Function to restore console, now defined early and used carefully
    const restoreConsole = () => {
        console.log = originalConsoleLog;
        console.error = originalConsoleError;
    };

    // Setup based on mode
    if (this.isHeadless) {
        console.log = (...args: any[]) => this._logToFile(args.map(arg => String(arg)).join(' '));
        console.error = (...args: any[]) => this._logToFile(args.map(arg => String(arg)).join(' '), true);
        // For headless, no spinners or Blessed UI setup is needed.
        // Initial messages will go to the log file.
        console.log("Pull operation started in headless mode.");
    } else if (this.isVerbose) {
        // In verbose mode, use original console, no Blessed UI, no spinners.
        // console.log and console.error are already originalConsoleLog/Error
        originalConsoleLog("Pull operation started in verbose mode."); // Use original directly for startup messages
    } else if (this._useBlessedUI) {
        // Blessed UI Mode setup
        screen = blessed.screen({
            smartCSR: true,
            title: 'Agility CLI - Pull Operation'
        });

        const grid = new contrib.grid({
            rows: 12,
            cols: 12,
            screen: screen
        });
        
        progressContainerBox = grid.set(0, 0, 11, 4, blessed.box, {
            label: ' Progress ',
            border: { type: 'line' },
            style: { border: { fg: 'cyan' } }
        });

        // pullSteps needs to be defined before creating progress bars for them
        // This part of UI setup must come after pullSteps is defined

        logContainer = grid.set(0, 4, 11, 8, blessed.log, {
            label: ' Logs ',
            border: { type: 'line' },
            style: { border: { fg: 'green' } },
            padding: { left: 1, right: 1, top: 1, bottom: 1 },
            scrollable: true,
            alwaysScroll: true,
            scrollbar: { ch: ' ', inverse: true },
            keys: true,
            vi: true
        });

        console.log = (...args: any[]) => {
            if (logContainer) logContainer.log(args.map(arg => String(arg)).join(' '));
        };
        console.error = (...args: any[]) => {
            if (logContainer) logContainer.log(`ERROR: ${args.map(arg => String(arg)).join(' ')}`);
        };
        
        originalConsoleLog("Pull operation started with Blessed UI."); // Log this initial message to the Blessed log
        // Screen render and focus will happen after progress bars are added

        screen.key(['C-c'], (ch: any, key: any) => {
            if (screen && !screen.destroyed) screen.destroy();
            restoreConsole();
            process.stdout.write('\nPull operation exited via Ctrl+C.\n');
            process.exit(0);
        });
    } else {
        // Fallback: Neither headless, verbose, nor Blessed UI. Use plain console.
        // console.log and console.error are already originalConsoleLog/Error
        originalConsoleLog("Pull operation started (basic console output).");
    }

    // basePath calculation (moved slightly down, after initial console setup)
    let basePath = path.join(this._rootPath, this._guid, this._locale, this._isPreview ? "preview" : "live");
    if(this._legacyFolders){
        basePath = path.join(this._rootPath); // If legacy, rootPath is likely just 'agility-files'
    }
    console.log(`Base path for files: ${basePath}`); // This will go to appropriate log/console
 
    try {
        if (!fs.existsSync(basePath)) {
            fs.mkdirSync(basePath, { recursive: true });
            console.log(`Created base directory: ${basePath}`);
        }
    } catch (dirError: any) {
        console.error(`Error creating base directory ${basePath}: ${dirError.message}`);
        if (this.isHeadless || this.isVerbose || !this._useBlessedUI) restoreConsole(); // Restore if not using Blessed managed exit
        // No screen to destroy here if it failed this early.
        return; // Exit if base directory can't be created
    }

    // Define pullSteps and updateProgress function (essential for all modes for status tracking)
    const availableSteps = [ 'Galleries', 'Assets','Models','Containers', 'Content', 'Templates', 'Pages'];
    const pullSteps = availableSteps.filter(step => this._elements.includes(step));
    const totalSteps = pullSteps.length;
    let stepStatuses = new Array(totalSteps).fill(0); // 0: pending, 1: success, 2: error

    // updateProgress function needs to be robust for different modes
    const updateProgress = (currentStepIndex: number, status: 'success' | 'error' | 'progress', percentage?: number) => {
        if (this._useBlessedUI && screen && currentStepIndex >= 0 && currentStepIndex < totalSteps) {
            const targetBar = stepProgressBars[currentStepIndex];
            if (targetBar) {
                const fillPercentage = percentage !== undefined ? percentage : (status === 'success' || status === 'error' ? 100 : targetBar.filled);
                targetBar.setProgress(fillPercentage);
                let barColor = 'blue';
                if (status === 'error') stepStatuses[currentStepIndex] = 2;
                else if (status === 'success' && fillPercentage === 100) stepStatuses[currentStepIndex] = 1;
                
                if (stepStatuses[currentStepIndex] === 2) barColor = 'red';
                else if (stepStatuses[currentStepIndex] === 1) barColor = 'green';
                
                targetBar.style.bar.bg = barColor;
                const labelStatus = status === 'progress' ? (stepStatuses[currentStepIndex] === 1 ? 'success' : (stepStatuses[currentStepIndex] === 2 ? 'error' : 'done')) : status;
                targetBar.setLabel(` ${pullSteps[currentStepIndex]} (${fillPercentage === 100 ? labelStatus : `${fillPercentage}%`}) `);
            }
            screen.render(); 
        } else {
            // For non-Blessed UI (headless, verbose, or plain), still update internal status for final summary
            if (currentStepIndex >= 0 && currentStepIndex < totalSteps) {
                if (status === 'error') stepStatuses[currentStepIndex] = 2;
                else if (status === 'success') stepStatuses[currentStepIndex] = 1;
            }
        }
    };

    // Now, if using Blessed UI, create the progress bars (needs pullSteps and progressContainerBox)
    if (this._useBlessedUI && progressContainerBox) {
        pullSteps.forEach((stepName, index) => {
            const bar = blessed.progressbar({
               parent: progressContainerBox,
               border: 'line',
               pch: ' ', 
               style: { fg: 'white', bg: 'black', bar: { bg: 'blue', fg: 'white' }, border: { fg: '#f0f0f0' } },
               width: '90%', height: 3, top: 1 + (index * 3), left: 'center', filled: 0,
               label: ` ${stepName} (0%) `
            });
            stepProgressBars.push(bar);
        });
        // Initial render of screen with bars and focus log container
        screen.render();
        if (logContainer) logContainer.focus();
    }

   const syncClient = agilitySync.getSyncClient({
      guid: this._guid,
      apiKey: this._apiKey,
      languages: [`${this._locale}`],
      channels: [`${this._channel}`],
      isPreview: this._isPreview,
      store: {
        interface: storeInterfaceFileSystem,
        options: {
          rootPath: basePath,
        },
      },
    });

    // Main loop for processing steps
    for (let i = 0; i < pullSteps.length; i++) {
        const stepName = pullSteps[i];
        const currentStepIndex = i;

        // Simplified start of step logging
        if (this.isVerbose) {
            originalConsoleLog(`Starting ${stepName}...`);
        } else if (this._useBlessedUI) {
            console.log(`Starting ${stepName}...`); // Goes to Blessed log
        } // Headless logs its own start via its console.log override if services log at start
          // Plain console (neither verbose, blessed, nor headless) will not log step starts here explicitly.

        if(this._useBlessedUI) updateProgress(currentStepIndex, 'progress', 0);

        try {
            let stepProgressCallback: ProgressCallbackType | undefined = undefined;
            if (this._useBlessedUI) {
                stepProgressCallback = (processed, total, status = 'progress') => {
                    const percentage = total > 0 ? Math.floor((processed / total) * 100) : (status === 'success' || status === 'error' ? 100 : 0);
                    updateProgress(currentStepIndex, status, percentage);
                };
            } else if (this.isVerbose) { // Only verbose needs the minimal callback now
                stepProgressCallback = (processed, total, status = 'progress') => {
                    if (status === 'error') stepStatuses[currentStepIndex] = 2;
                    else if (status === 'success') stepStatuses[currentStepIndex] = 1;
                };
            }
            // In headless mode, or plain console (no verbose, no blessed), stepProgressCallback remains undefined.

            if (stepName === 'Content') {
                // Blessed/Verbose/Headless already logged start
                
                if(!this.isHeadless) updateProgress(currentStepIndex, 'progress', 10);

                await syncClient.runSync();
                
                const itemsPath = path.join(basePath, "item");
                let itemCount = 0;
                let itemsFoundMessage = "Content items sync attempted.";
                try {
                    if (fs.existsSync(itemsPath)) {
                        const files = fs.readdirSync(itemsPath);
                        itemCount = files.filter(file => path.extname(file).toLowerCase() === '.json').length;
                        itemsFoundMessage = `Found ${itemCount} content item(s).`;
                    }
                } catch (countError: any) { /* message already set by pull.ts if error */ itemsFoundMessage = `Error counting items: ${countError.message}`; }

                const contentSyncMessage = `${stepName} synchronized. ${itemsFoundMessage}`;
                console.log(`✓ ${contentSyncMessage}`); // To Blessed log, verbose console, or file
                
                updateProgress(currentStepIndex, 'success', 100);
                continue; 
            }

            // Call the appropriate downloader with the mode-specific stepProgressCallback
            switch (stepName) {
                case 'Galleries': await downloadAllGalleries(this._guid, this._locale, this._isPreview, this._options, this._multibar!, basePath, stepProgressCallback); break;
                case 'Assets': await downloadAllAssets(this._guid, this._locale, this._isPreview, this._options, this._multibar!, basePath, stepProgressCallback); break;
                case 'Models': await downloadAllModels(this._guid, this._locale, this._isPreview, this._options, this._multibar!, basePath, stepProgressCallback); break;
                case 'Containers': await downloadAllContainers(this._guid, this._locale, this._isPreview, this._options, this._multibar!, basePath, stepProgressCallback); break;
                case 'Templates': await downloadAllTemplates(this._guid, this._locale, this._isPreview, this._options, this._multibar!, basePath, stepProgressCallback); break;
                case 'Pages': await downloadAllPages(this._guid, this._locale, this._isPreview, this._options, this._multibar!, basePath, stepProgressCallback); break;
            }
            
            if (stepStatuses[currentStepIndex] === 0) { 
                updateProgress(currentStepIndex, 'success', 100);
            }

            // For Verbose, services log their own summaries. Blessed UI also.

        } catch (error: any) {
            console.error(`✗ ${stepName} failed: ${error.message}`); 
            updateProgress(currentStepIndex, 'error', this._useBlessedUI ? (stepProgressBars[currentStepIndex]?.filled || 0) : 0); 
        }
    }

    // After all steps, check statuses for overall completion message
    const overallSuccess = stepStatuses.every(s => s === 1);

    if (this._useBlessedUI) {
        if (logContainer) {
            logContainer.log("----------------------------------------------------------------------");
            if (overallSuccess) {
                logContainer.log("All selected pull operations completed successfully.");
            } else {
                logContainer.log("One or more pull operations encountered errors. Please check logs.");
            }
            logContainer.log("Press Ctrl+C to exit.");
        }
        screen?.render(); // Final render for Blessed UI
        // Don't restore console here, Ctrl+C handler does it.
    } else if (this.isVerbose) {
        if (overallSuccess) {
            originalConsoleLog("\nAll selected pull operations completed successfully.");
        } else {
            originalConsoleError("\nOne or more pull operations encountered errors. Please check logs.");
        }
        // No console restore needed as we used original console directly.
    } else if (this.isHeadless) {
        // Headless mode gets its final summary message via the handler in index.ts
        // because it needs the original console restored AFTER pullInstance finishes.
        // We just need to ensure the log file is complete.
        // No console restore needed here as console was redirected.
        originalConsoleLog(`Pull complete (headless). Log: ${this._rootPath}/logs/instancelog.txt`); // Log completion to file itself
    } else {
        // Plain console mode (useOraSpinners was true, or fallback)
        if (overallSuccess) {
            originalConsoleLog("\nAll selected pull operations completed successfully.");
        } else {
            originalConsoleError("\nOne or more pull operations encountered errors. Please check logs.");
        }
        // No console restore needed as we used original console directly.
    }

    // restoreConsole(); // Generally handled by Ctrl+C for Blessed, or not needed for others unless errors occurred early.

  }
}
