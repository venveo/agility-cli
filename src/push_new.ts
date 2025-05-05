import * as mgmtApi  from '@agility/management-sdk';
import { fileOperations } from './fileOperations';
import * as fs from 'fs';
// Use require instead of import for blessed and blessed-contrib
const blessed = require('blessed');
const contrib = require('blessed-contrib');
// import * as blessed from 'blessed'; 
// import * as contrib from 'blessed-contrib';
const FormData = require('form-data');
import * as cliProgress from 'cli-progress';
import ansiColors from 'ansi-colors';
import { homePrompt } from './lib/prompts/home-prompt';
import { Auth } from './auth';
import { ReferenceMapper } from './lib/mapper';
import { container } from 'container';
import { mapContentItem } from './lib/mappers/content-item-mapper';
import { findContainerInTargetInstance } from './lib/finders/container-finder';
import { ContainerPusher } from './lib/pushers/container-pusher';
import { ContentPusher } from './lib/pushers/content-item-pusher';
// // Extend the PageItem type to include pageTemplateID
// const wrapAnsi = require('wrap-ansi');
declare module '@agility/management-sdk' {
    interface PageItem {
        pageTemplateID?: number;
        
    }
}

export class pushNew{
    _options : mgmtApi.Options;
    _multibar: cliProgress.MultiBar;
    _guid: string;
    _targetGuid: string;
    _locale: string;
    _isPreview: boolean;
    _token: string;
    processedModels: { [key: string]: number; };
    processedDefinitionIds: { [key: number]: number; };
    processedContentIds : {[key: number]: number}; //format Key -> Old ContentId, Value New ContentId.
    skippedContentItems: {[key: number]: string}; //format Key -> ContentId, Value ReferenceName of the content.
    processedGalleries: {[key: number]: number};
    processedTemplates: {[key: string]: number}; //format Key -> pageTemplateName, Value pageTemplateID.
    processedPages : {[key: number]: number}; //format Key -> old page id, Value new page id.
    private settings: any;
    private processedCount: number = 0;
    processedAssets: { [key: string]: string; };
    processedContainers: { [key: number]: number; };
    private _apiClient: mgmtApi.ApiClient;
    private _referenceMapper: ReferenceMapper;
    private failedContainers: number = 0;
    private failedContent: number = 0;
    private _useBlessedUI: boolean = false;

    constructor(options: mgmtApi.Options, multibar: cliProgress.MultiBar, guid: string, targetGuid:string, locale:string, isPreview: boolean, useBlessedUI?: boolean){
        // Handle SSL certificate verification for local development
        if (process.env.NODE_ENV === 'development' || process.env.LOCAL) {
            process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
        }
        
        this._options = options;
        this._multibar = multibar;
        this._guid = guid;
        this._targetGuid = targetGuid;
        this._locale = locale;
        this._isPreview = isPreview;
        this._token = options.token;
        this.processedModels = {};
        this.processedDefinitionIds = {};
        this.processedContentIds = {};
        this.processedGalleries = {};
        this.skippedContentItems = {};
        this.processedTemplates = {};
        this.processedPages = {};
        this.settings = {};
        this.processedAssets = {};
        this.processedContainers = {};
        this._apiClient = new mgmtApi.ApiClient(this._options);
        this._referenceMapper = new ReferenceMapper(this._guid, this._targetGuid);
        this._useBlessedUI = useBlessedUI ?? false;
    }

    async initialize() {
        let auth = new Auth();
        this._options.token = await auth.getToken();
    }

    async pushInstance(): Promise<void> {
        
        let screen: any | null = null;
        let logContainer: any | null = null;
        let progressContainerBox: any | null = null;
        let stepProgressBars: any[] = [];
        const pushSteps = [ 'Galleries', 'Assets', 'Models', 'Containers', 'Content', 'Templates', 'Pages' ];
        const totalSteps = pushSteps.length;
        let stepStatuses = new Array(totalSteps).fill(0);
        let originalConsoleLog = console.log;
        let originalConsoleError = console.error;

        const restoreConsole = () => {
            console.log = originalConsoleLog;
            console.error = originalConsoleError;
        };

        const updateProgress = (currentStepIndex: number, status: 'success' | 'error', percentage?: number) => {
            if (!this._useBlessedUI) return; // Do nothing if UI not enabled
            if (currentStepIndex >= 0 && currentStepIndex < totalSteps) {
                const targetBar = stepProgressBars[currentStepIndex];
                if (targetBar) {
                    // Use provided percentage or default to 100 for completion
                    const fillPercentage = percentage !== undefined ? percentage : 100;
                    targetBar.setProgress(fillPercentage);

                    // Determine color - turn red on first error and stay red
                    let barColor = 'blue'; // Default/in-progress
                    
                    // --- Refined Logic --- 
                    // Mark step as errored immediately if status is error
                    if (status === 'error' && stepStatuses[currentStepIndex] !== 2) {
                         stepStatuses[currentStepIndex] = 2; // Mark step as errored PERMANENTLY
                    }
                    
                    // Set color based on the PERMANENT status
                    if (stepStatuses[currentStepIndex] === 2) { // If step is marked errored
                        barColor = 'red';
                    } else if (fillPercentage === 100) { // Completed successfully?
                        barColor = 'green';
                        stepStatuses[currentStepIndex] = 1; // Mark step as success
                    } else {
                        // Still in progress and no error encountered yet
                        barColor = 'blue'; 
                    }
                    
                    // Apply the style
                    targetBar.style.bar.bg = barColor;

                    // Optionally update label with status on completion
                    if(fillPercentage === 100) {
                        targetBar.setLabel(` ${pushSteps[currentStepIndex]} (${status}) `);
                    }
                }
            }
            screen?.render(); 
        };

        if (this._useBlessedUI) {
            // Initialize Blessed screen
            screen = blessed.screen({
                smartCSR: true,
                title: 'Agility CLI - Push Operation'
            });

            // Initialize Grid layout
            const grid = new contrib.grid({rows: 12, cols: 12, screen: screen});

            // Left Column Container (Box) - 1/3 width
            progressContainerBox = grid.set(0, 0, 12, 4, blessed.box, {
                label: ' Progress ',
                border: { type: 'line' },
                style: { 
                    border: { fg: 'cyan' },
                 }
            });

            // Create individual progress bars
            pushSteps.forEach((stepName, index) => {
                 const bar = blessed.progressbar({
                    parent: progressContainerBox,
                    border: 'line',
                    pch: ' ', // Use space character for filled portion
                    style: {
                        fg: 'white',
                        bg: 'black',
                        bar: { bg: 'blue', fg: 'white' }, // Default to blue (pending)
                        border: { fg: '#f0f0f0' }
                    },
                    width: '90%',
                    height: 3,
                    top: 1 + (index * 3), // Position vertically
                    left: 'center',
                    filled: 0,
                    label: ` ${stepName} ` // Add spaces for padding
                 });
                 stepProgressBars.push(bar);
            });

            // Logs (Right Column) - 2/3 width
            logContainer = grid.set(0, 4, 12, 8, blessed.log, {
                label: ' Logs ',
                border: { type: 'line' },
                style: { border: { fg: 'green' } },
                padding: { left: 1, right: 1 },
                scrollable: true,
                alwaysScroll: true,
                scrollbar: {
                    ch: ' ',
                    inverse: true
                },
                keys: true, // Enable scrolling with keys
                vi: true    // Enable vi keys for scrolling
            });

            // Redirect console logging to the blessed log widget
            console.log = (...args: any[]) => {
                if (logContainer) {
                    logContainer.log(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg).join(' '));
                    screen?.render(); // Ensure screen updates after log
                }
            };
            console.error = (...args: any[]) => {
                if (logContainer) {
                    const errorMsg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg).join(' ');
                    logContainer.log(ansiColors.red(`ERROR: ${errorMsg}`));
                    screen?.render(); // Ensure screen updates after error
                }
            };

            // Quit on Escape, q, or Control-C.
            screen.key(['escape', 'q', 'C-c'], function(ch, key) {
                restoreConsole();
                screen?.destroy(); // Destroy screen before exiting
                return process.exit(0);
            });

            // Render the screen.
            screen.render();

            // Explicitly focus the log container for scrolling
            logContainer.focus();

        } else {
            // If not using blessed UI, ensure original console is used
            restoreConsole(); 
        }

        // Initial update to show 0%
        if (this._useBlessedUI) {
            updateProgress(-1, 'success'); // Call initially to set 0%
        }

        let currentStep = -1;
        try {
            // --- Galleries --- 
            currentStep = 0;
            let galleryStatus: 'success' | 'error' = 'success';
            const galleryStepIndex = pushSteps.indexOf('Galleries');
            try {
                if (!this._useBlessedUI) console.log('Pushing galleries...'); // Log normally if no UI
                else logContainer?.log('Pushing galleries...');
                // Define the progress callback for galleries
                const galleryProgressCallback = (processed: number, total: number, status?: 'success' | 'error') => {
                    const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
                    // Pass status through
                    updateProgress(galleryStepIndex, status || 'success', percentage); 
                };
                await this.pushGalleries(this._targetGuid, galleryProgressCallback);
                if (!this._useBlessedUI) console.log('Galleries pushed.');
                else logContainer?.log('Galleries pushed.');
            } catch (e) {
                galleryStatus = 'error';
                if (!this._useBlessedUI) console.error(ansiColors.red(`ERROR pushing galleries: ${e.message}`));
                else logContainer?.log(ansiColors.red(`ERROR pushing galleries: ${e.message}`));
            }
            // Final update for Galleries step (sets 100% and color)
            updateProgress(galleryStepIndex, galleryStatus);

            // --- Assets --- 
            currentStep = 1;
            let assetStatus: 'success' | 'error' = 'success';
            try {
                if (!this._useBlessedUI) console.log('Pushing assets...'); // Log normally if no UI
                else logContainer?.log('Pushing assets...');
                // Define the progress callback for assets
                const assetProgressCallback = (processed: number, total: number, status?: 'success' | 'error') => {
                    const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
                    // Pass status through
                    updateProgress(currentStep, status || 'success', percentage);
                };
                await this.pushAssets(this._targetGuid, assetProgressCallback);
                if (!this._useBlessedUI) console.log('Assets pushed.');
                else logContainer?.log('Assets pushed.');
            } catch (e) {
                assetStatus = 'error';
                if (!this._useBlessedUI) console.error(ansiColors.red(`ERROR pushing assets: ${e.message}`));
                else logContainer?.log(ansiColors.red(`ERROR pushing assets: ${e.message}`));
            }
            updateProgress(currentStep, assetStatus);

            // --- Models --- 
            currentStep = 2;
            let modelStatus: 'success' | 'error' = 'success';
            const modelStepIndex = pushSteps.indexOf('Models');
            try {
                if (!this._useBlessedUI) console.log('Processing models...'); // Log normally if no UI
                else logContainer?.log('Processing models...');
                const models = await this.getModels();
                if (!models || models.length === 0) {
                    console.log('No models found to push');
                } else {
                    let totalModels = models.length;
                    let successfulModels = 0;
                    let failedModels = 0;
                    let modelExists = false;
                    const linkedModels = models.filter(model => this.isLinkedModel(model));
                    const normalModels = models.filter(model => !this.isLinkedModel(model));

                    // Process normal models first
                    let modelsProcessedCount = 0;

                    for (const model of normalModels) {
                        let apiClient = new mgmtApi.ApiClient(this._options);
                        let existingModel: mgmtApi.Model | null = null;
                        try {
                            // First try to get the model from the target instance
                            existingModel = await apiClient.modelMethods.getModelByReferenceName(model.referenceName, this._targetGuid);
                            if (existingModel) {
                                // Model exists in target, add it to reference mapper
                                this._referenceMapper.addRecord('model', model, existingModel);
                                console.log(`✓ Normal model ${ansiColors.underline(model.referenceName)} ${ansiColors.bold.gray('exists')} - ${ansiColors.green('Source')}: ${model.id} ${ansiColors.green(this._targetGuid)}: id:${existingModel.id}`);
                                modelExists = true;
                                successfulModels++;
                                continue;
                            }
                        } catch (error) {
                            if (error.response && error.response.status !== 404) {
                                console.error(`[Model] ✗ Error checking for existing model ${model.referenceName}: ${error.message}`);
                                failedModels++;
                                continue;
                            }
                            // 404 means model doesn't exist, which is fine - we'll create it
                        }

                        // Model doesn't exist in target, try to create it
                        try {
                            const modelPayload = {
                            ...model,
                            id: existingModel ? existingModel.id : 0
                            }
                        
                            let savedModel = await apiClient.modelMethods.saveModel(modelPayload, this._targetGuid);
                            this._referenceMapper.addRecord('model', model, savedModel);
                            console.log(`✓ Normal Model created - ${model.referenceName} - ${ansiColors.green('Source')}: ${model.id.toString()} ${ansiColors.green(this._targetGuid)}: ${savedModel.id.toString()}`);
                            successfulModels++;
                        } catch (error) {
                            console.error(`[Model] ✗ Error creating new model ${model.referenceName}: ${error.message}`);
                            failedModels++;
                            if (error.response && error.response.status === 409) {
                                // Conflict - model might have been created by another process
                                try {
                                    let existingModel = await apiClient.modelMethods.getModelByReferenceName(model.referenceName, this._targetGuid);
                                    if (existingModel) {
                                        this._referenceMapper.addRecord('model', model, existingModel);
                                        console.log(`✓ Normal Model - ${model.referenceName} - ${ansiColors.green('Source')}: ${model.referenceName}, ${ansiColors.green(this._targetGuid)}: ${existingModel.referenceName}`);
                                        successfulModels++;
                                    }
                                } catch (getError) {
                                    console.error(`[Model] Failed to get existing model: ${getError.message}`);
                                }
                            }
                        }
                        // Update progress for each model processed
                        const percentage = (successfulModels / totalModels) * 100;
                        updateProgress(currentStep, 'success', percentage);
                    }

                    // Then process linked models
                    for (const model of linkedModels) {
                        let apiClient = new mgmtApi.ApiClient(this._options);
                        let existingModel: mgmtApi.Model | null = null;
                        try {
                            // First try to get the model from the target instance
                            existingModel = await apiClient.modelMethods.getModelByReferenceName(model.referenceName, this._targetGuid);
                            if (existingModel) {
                                // Model exists in target, add it to reference mapper
                                this._referenceMapper.addRecord('model', model, existingModel);
                                console.log(`✓ Nested model ${ansiColors.underline(model.referenceName)} ${ansiColors.bold.gray('exists')} - ${ansiColors.green('Source')}: ${model.id} ${ansiColors.green('Target')}:  ${existingModel.id}`);
                                successfulModels++;
                                continue;
                            }
                        } catch (error) {
                            if (error.response && error.response.status !== 404) {
                                console.error(`[Model] ✗ Error checking for existing model ${model.referenceName}: ${error.message}`);
                                failedModels++;
                                continue;
                            }
                            // 404 means model doesn't exist, which is fine - we'll create it
                        }

                        // Process linked content fields before creating the model
                        for (const field of model.fields) {
                            if (field.type === 'Content' && field.settings['ContentDefinition']) {
                                const linkedModelRef = field.settings['ContentDefinition'];
                                // Check if the referenced model exists in the target
                                const referencedModel = await apiClient.modelMethods.getModelByReferenceName(linkedModelRef, this._targetGuid);
                                if (!referencedModel) {
                                    console.error(`[Model] ✗ Referenced model ${linkedModelRef} not found for linked model ${model.referenceName}`);
                                    failedModels++;
                                    continue;
                                }
                            }
                        }

                        // Model doesn't exist in target, try to create it
                        try {
                            const modelPayload = {
                            ...model,
                            id: existingModel ? existingModel.id : 0
                             }
                            let savedModel = await apiClient.modelMethods.saveModel(modelPayload, this._targetGuid);
                            this._referenceMapper.addRecord('model', model, savedModel);
                            console.log(`✓ Nested Model created - ${model.referenceName} - ${ansiColors.green('Source')}: ${model.referenceName} (ID: ${model.id.toString()}), ${ansiColors.green('Target')}: ${savedModel.referenceName} (ID: ${savedModel.id.toString()})`);
                            successfulModels++;
                        } catch (error) {
                            console.error(`[Model] ✗ Error creating new model ${model.referenceName}: ${error.message}`);
                            failedModels++;
                            if (error.response && error.response.status === 409) {
                                // Conflict - model might have been created by another process
                                try {
                                    let existingModel = await apiClient.modelMethods.getModelByReferenceName(model.referenceName, this._targetGuid);
                                    if (existingModel) {
                                        this._referenceMapper.addRecord('model', model, existingModel);
                                        console.log(`✓ Nested Model - ${model.referenceName} - ${ansiColors.green('Source')}: ${model.referenceName}, ${ansiColors.green('Target')}: ${existingModel.referenceName}`);
                                        successfulModels++;
                                    }
                                } catch (getError) {
                                    console.error(`[Model] Failed to get existing model: ${getError.message}`);
                                }
                            }
                        }
                        // Update progress for each linked model processed
                        const percentage = (successfulModels / totalModels) * 100;
                        updateProgress(currentStep, 'success', percentage);
                    }

                    // Final status update for Models step (sets color)
                    modelStatus = failedModels > 0 ? 'error' : 'success';
                    updateProgress(modelStepIndex, modelStatus); // Call without percentage to set final state
                    console.log(ansiColors.yellow(`Processed ${successfulModels}/${totalModels} models (${failedModels} failed)`));
                    if (!this._useBlessedUI) console.log('Models processed.');
                    else logContainer?.log('Models processed.');
                }
            } catch (e) {
                modelStatus = 'error';
                if (!this._useBlessedUI) console.error(ansiColors.red(`ERROR processing models: ${e.message}`));
                else logContainer?.log(ansiColors.red(`ERROR processing models: ${e.message}`));
            }
            updateProgress(currentStep, modelStatus);

            // --- Containers --- 
            currentStep = 3;
            let containerStatus: 'success' | 'error' = 'success';
            try{
                if (!this._useBlessedUI) console.log('Processing containers...'); // Log normally if no UI
                else logContainer?.log('Processing containers...');
                const containers = this.getBaseContainers();
                if (!containers || containers.length === 0) {
                    console.log('No containers found to push');
                } else {
                    const containerPusher = new ContainerPusher(
                        this._apiClient,
                        this._referenceMapper,
                        this._targetGuid,
                    );
                    // We need pushContainers to return success/fail status or check logs/mapper
                    const containerProgressCallback = (processed: number, total: number, status?: 'success' | 'error') => {
                        const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
                        updateProgress(currentStep, status || 'success', percentage);
                    };
                    // Pass the callback to pushContainers
                    await containerPusher.pushContainers(containers, containerProgressCallback);
                    // TODO: Determine actual success/failure from containerPusher if possible
                }
                if (!this._useBlessedUI) console.log('Containers pushed.');
                else logContainer?.log('Containers pushed.');
            } catch(e){
                containerStatus = 'error';
                if (!this._useBlessedUI) console.error(ansiColors.red(`ERROR processing containers: ${e.message}`));
                else logContainer?.log(ansiColors.red(`ERROR processing containers: ${e.message}`));
            }
            updateProgress(currentStep, containerStatus);

            // --- Content --- 
            currentStep = 4;
            let contentStatus: 'success' | 'error' = 'success';
            try{
                if (!this._useBlessedUI) console.log('Processing content items...'); // Log normally if no UI
                else logContainer?.log('Processing content items...');
                const allContentItems = await this.getBaseContentItems();
                if (!allContentItems || allContentItems.length === 0) {
                    console.log('No content items found to push');
                } else {
                    const contentPusher = new ContentPusher(
                        this._apiClient,
                        this._referenceMapper,
                        this._targetGuid,
                        this._locale
                    );
                    const contentProgressCallback = (processed: number, total: number, status?: 'success' | 'error') => {
                        const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
                        updateProgress(currentStep, status || 'success', percentage); 
                    };
                    const contentResult = await contentPusher.pushContentItems(allContentItems, contentProgressCallback);
                    const totalContentItems = allContentItems.length;
                    console.log(ansiColors.yellow(`Processed ${contentResult.successfulItems}/${totalContentItems} content items (${contentResult.failedItems} failed)`));
                    if(contentResult.failedItems > 0) contentStatus = 'error';
                }
                 if (!this._useBlessedUI) console.log('Content items pushed.');
                else logContainer?.log('Content items pushed.');
            } catch(e){
                contentStatus = 'error';
                if (!this._useBlessedUI) console.error(ansiColors.red(`ERROR processing content: ${e.message}`));
                else logContainer?.log(ansiColors.red(`ERROR processing content: ${e.message}`));
            }
            updateProgress(currentStep, contentStatus);

            // --- Templates --- 
            currentStep = 5;
            let templateStatus: 'success' | 'error' = 'success';
            try {
                if (!this._useBlessedUI) console.log('Processing templates...'); // Log normally if no UI
                else logContainer?.log('Processing templates...');
                const templates = await this.getBaseTemplates();
                if(!templates || templates.length === 0){
                    console.log('No templates found to push');
                } else {
                     const templateResult = await this.pushTemplates(templates, this._targetGuid, this._locale);
                     if(templateResult.failedCount > 0) templateStatus = 'error';
                }
                if (!this._useBlessedUI) console.log('Templates processed.');
                else logContainer?.log('Templates processed.');
            } catch(e) {
                templateStatus = 'error';
                if (!this._useBlessedUI) console.error(ansiColors.red(`ERROR processing templates: ${e.message}`));
                else logContainer?.log(ansiColors.red(`ERROR processing templates: ${e.message}`));
            }
             updateProgress(currentStep, templateStatus);

            // --- Pages --- 
            currentStep = 6;
            let pageStatus: 'success' | 'error' = 'success';
            const pageStepIndex = pushSteps.indexOf('Pages');
            try {
                if (!this._useBlessedUI) console.log('Processing pages...'); // Log normally if no UI
                else logContainer?.log('Processing pages...');
                const pages = await this.getBasePages(this._locale);
                if(!pages || pages.length === 0){
                     console.log('No pages found to push');
                } else {
                    // Define the progress callback for pages
                    const pageProgressCallback = (processed: number, total: number, status?: 'success' | 'error') => {
                        const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
                        updateProgress(pageStepIndex, status || 'success', percentage); 
                    };
                    // Pass callback to pushPages
                    await this.pushPages(this._targetGuid, this._locale, pages, pageProgressCallback);
                    // TODO: Check logs or modify pushPages to determine actual success/failure.
                    // For now, assume success unless error is thrown.
                }
                if (!this._useBlessedUI) console.log('Pages processed.');
                else logContainer?.log('Pages processed.');
             } catch(e){
                pageStatus = 'error';
                if (!this._useBlessedUI) console.error(ansiColors.red(`ERROR processing pages: ${e.message}`));
                else logContainer?.log(ansiColors.red(`ERROR processing pages: ${e.message}`));
            }
            // Final update for Pages step (sets 100% and color)
            // We need a way to determine status (e.g., from logs or modifying pushPages)
            // For now, assume success if no error was caught directly here.
            updateProgress(pageStepIndex, pageStatus);

            // Final Status Check
            const overallStatus = stepStatuses.includes(2) ? 'failed' : 'completed successfully';
            const finalMessage = `\nPush process ${overallStatus}!`;
            if (!this._useBlessedUI) {
                 console.log(finalMessage);
            } else {
                logContainer?.log(finalMessage);
            }

        } catch (error) {
             if (!this._useBlessedUI) {
                 console.error(`Unhandled error during push: ${error.message}`);
                 console.error(error.stack);
                 console.log(ansiColors.red('\nPush process failed!'));
             } else {
                logContainer?.log(ansiColors.red(`Unhandled error during push: ${error.message}`));
                logContainer?.log(ansiColors.red(error.stack));
                logContainer?.log(ansiColors.red('\nPush process failed!')); // Log final failure status
             }
        } finally {
             if (this._useBlessedUI) {
                // Keep screen alive briefly to show final status/errors
                logContainer?.log("\nPress ESC, q, or Ctrl+C to exit.");
                screen?.render();
                // Screen destroyed by keybind
             } else {
                 // Ensure console is restored if somehow redirection happened without UI flag
                 restoreConsole();
             }
        }
    }

    /////////////////////////////START: METHODS FOR DEBUG ONLY/////////////////////////////////////////////////////////////////
    createAllContent(){
        let fileOperation = new fileOperations();
        try{
            let files = fileOperation.readFile('agility-files/all/all.json');
            let contentItems = JSON.parse(files) as mgmtApi.ContentItem[];

            return contentItems;
        } catch(err){
            console.log(err);
        }
        
    }

    createLinkedContent(){
        let fileOperation = new fileOperations();
        try{
            let files = fileOperation.readFile('agility-files/linked/linked.json');
            let contentItems = JSON.parse(files) as mgmtApi.ContentItem[];

            return contentItems;
        } catch(err){
            console.log(err);
        }
        
    }

    createNonLinkedContent(){
        let fileOperation = new fileOperations();
        try{
            let files = fileOperation.readFile('agility-files/nonlinked/nonlinked.json');
            let contentItems = JSON.parse(files) as mgmtApi.ContentItem[];

            return contentItems;
        } catch(err){
            console.log(err);
        }
        
    }
    /////////////////////////////END: METHODS FOR DEBUG ONLY/////////////////////////////////////////////////////////////////

    private async getModels(): Promise<mgmtApi.Model[]> {
        const models = this.getBaseModels() || [];
        return models;
    }

    private getBaseModels(): mgmtApi.Model[] {
        const modelsPath = `agility-files/${this._guid}/${this._locale}/${this._isPreview ? 'preview':'live'}/models`;
        const modelFiles = fs.readdirSync(modelsPath);
        return modelFiles.map(file => {
            const modelData = JSON.parse(fs.readFileSync(`${modelsPath}/${file}`, 'utf8'));
            const model = modelData as mgmtApi.Model;
            // Add source model to reference mapper
            this._referenceMapper.addRecord('model', model, null);
            return model;
        });
    }

    private async getLinkedModels(): Promise<mgmtApi.Model[]> {
        const models = this.getBaseModels() || [];
        const linkedModels = models.filter(model => this.isLinkedModel(model));
        
        // Add linked models to specialized reference mapping
        for (const model of linkedModels) {
            // this._referenceMapper.addRecord('linked-model', model, null);
        }
        
        return linkedModels;
    }

    private async getNormalModels(): Promise<mgmtApi.Model[]> {
        const models = this.getBaseModels() || [];
        const normalModels = models.filter(model => !this.isLinkedModel(model));
        
        // Add normal models to specialized reference mapping
        for (const model of normalModels) {
            // this._referenceMapper.addRecord('normal-model', model, null);
        }
        
        return normalModels;
    }

    getBaseModel(modelId: string, baseFolder?: string){
        if(baseFolder === undefined || baseFolder === ''){
            baseFolder = 'agility-files';
        }
        let fileOperation = new fileOperations();
        try{
            let file = fileOperation.readFile(`${baseFolder}/models/${modelId}.json`);
            let model = JSON.parse(file) as mgmtApi.Model;
            return model;
        } catch {
            fileOperation.appendLogFile(`\n Model with ID ${modelId} was not found in the source Instance.`);
            return null;
        }
    }

    private getBaseGalleries(): mgmtApi.assetGalleries[] {
        let fileOperation = new fileOperations();
        try{
            let files = fileOperation.readDirectory(`${this._guid}/${this._locale}/${this._isPreview ? 'preview':'live'}/assets/galleries`);

            let assetGalleries: mgmtApi.assetGalleries[] = [];

            for(let i = 0; i < files.length; i++){
                let assetGallery = JSON.parse(files[i]) as mgmtApi.assetGalleries;
                // Add source gallery to reference mapper immediately
                this._referenceMapper.addRecord('gallery', assetGallery, null);
                assetGalleries.push(assetGallery);
            }
            return assetGalleries;
        } catch{
            fileOperation.appendLogFile(`\n No Galleries were found in the source Instance to process.`);
            return null;
        }
    }

    private getBaseAssets(): mgmtApi.AssetMediaList[] {
        let fileOperation = new fileOperations();
        try{
            let files = fileOperation.readDirectory(`${this._guid}/${this._locale}/${this._isPreview ? 'preview':'live'}/assets/json`);

            let assets: mgmtApi.AssetMediaList[] = [];

            for(let i = 0; i < files.length; i++){
                let file = JSON.parse(files[i]) as mgmtApi.AssetMediaList;
                // Add each media item individually to the reference mapper
                for (const media of file.assetMedias) {
                    this._referenceMapper.addRecord('asset', media, null);
                }
                assets.push(file);
            }
            return assets;
        } catch {
            fileOperation.appendLogFile(`\n No Assets were found in the source Instance to process.`);
            return null;
        }
    }

    private getBaseContainers(): mgmtApi.Container[] {
        const containersPath = `agility-files/${this._guid}/${this._locale}/${this._isPreview ? 'preview':'live'}/containers`;
        const containerFiles = fs.readdirSync(containersPath);
        const containers: mgmtApi.Container[] = [];

        for (const file of containerFiles) {
            const containerData = JSON.parse(fs.readFileSync(`${containersPath}/${file}`, 'utf8'));
            const container = containerData as mgmtApi.Container;
            // Add source container to reference mapper immediately
            this._referenceMapper.addRecord('container', container, null);
            containers.push(container);
        }

        return containers;
    }

    async getBaseTemplates(baseFolder?: string): Promise<mgmtApi.PageModel[]> {
        if(baseFolder === undefined || baseFolder === ''){
            baseFolder = 'agility-files';
        }
        let fileOperation = new fileOperations();
        try{
            let files = fileOperation.readDirectory(`${this._guid}/${this._locale}/${this._isPreview ? 'preview':'live'}/templates`, baseFolder);

            let pageModels : mgmtApi.PageModel[] = [];

            for(let i = 0; i < files.length; i++){
                let pageModel = JSON.parse(files[i]) as mgmtApi.PageModel;
                // Add source template to reference mapper immediately
                // this._referenceMapper.addRecord('template', pageModel, null);
                pageModels.push(pageModel);
            }
            return pageModels;
        } catch {
            fileOperation.appendLogFile(`\n No Page Templates were found in the source Instance to process.`);
            return null;
        }
    }

    async getBasePages(locale: string): Promise<mgmtApi.PageItem[]> {
        let fileOperation = new fileOperations();
        try{
            let files = fileOperation.readDirectory(`${this._guid}/${this._locale}/${this._isPreview ? 'preview':'live'}/pages`);

            let pages : mgmtApi.PageItem[] = [];

            for(let i = 0; i < files.length; i++){
                let page = JSON.parse(files[i]) as mgmtApi.PageItem;
                // Add source page to reference mapper immediately
                this._referenceMapper.addRecord('page', page, null);
                pages.push(page);
            }
            return pages;
        } catch{
            fileOperation.appendLogFile(`\n No Pages were found in the source Instance to process.`);
            return null;
        }
    }

    private async getBaseContentItems(): Promise<mgmtApi.ContentItem[]> {
        const contentPath = `agility-files/${this._guid}/${this._locale}/${this._isPreview ? 'preview':'live'}/item`;
        const contentFiles = fs.readdirSync(contentPath);
        const contentItems: mgmtApi.ContentItem[] = [];

        for (const file of contentFiles) {
            const contentItem = JSON.parse(fs.readFileSync(`${contentPath}/${file}`, 'utf8'));
            // Add source content to reference mapper
            this._referenceMapper.addRecord('content', contentItem, null);
            contentItems.push(contentItem);
        }

        return contentItems;
    }

    private isLinkedContent(contentItem: mgmtApi.ContentItem): boolean {
        // Check if content item has any linked content fields
        return Object.values(contentItem.fields).some(field => {
            if (typeof field === 'string') {
                return field.includes(',') && !isNaN(Number(field.split(',')[0]));
            }
            if (typeof field === 'object' && field !== null) {
                return 'contentid' in field;
            }
            return false;
        });
    }

    private async getLinkedContent(guid: string, contentItems: mgmtApi.ContentItem[]): Promise<mgmtApi.ContentItem[]> {
        let linkedContentItems: mgmtApi.ContentItem[] = [];
        let apiClient = new mgmtApi.ApiClient(this._options);

        let index = 1;

        for (let i = 0; i < contentItems.length; i++) {
            let contentItem = contentItems[i];
            index += 1;
            let containerRef = contentItem.properties.referenceName;
            try {
                let container = await this._referenceMapper.getMapping<mgmtApi.Container>('container', 'referenceName', containerRef);
                let model = await apiClient.modelMethods.getContentModel(container.target.contentDefinitionID, guid);
            
                model.fields.flat().find((field) => {
                    if (field.type === 'Content') {
                        // Add linked content to reference mapper
                        this._referenceMapper.addRecord('content', contentItem, null);
                        return linkedContentItems.push(contentItem);
                    }
                });
            } catch {
                continue;
            }
        }
        return linkedContentItems;
    }
        
    async getNormalContent(guid: string, baseContentItems: mgmtApi.ContentItem[], linkedContentItems: mgmtApi.ContentItem[]){
        let apiClient = new mgmtApi.ApiClient(this._options);
        let contentItems = baseContentItems.filter(contentItem => linkedContentItems.indexOf(contentItem) < 0);

        // Add normal content to reference mapper
        for (const contentItem of contentItems) {
            this._referenceMapper.addRecord('content', contentItem, null);
        }

        return contentItems;
    }

    async pushTemplates(templates: mgmtApi.PageModel[], guid: string, locale: string): Promise<{ createdTemplates: mgmtApi.PageModel[], failedCount: number }> {
        let apiClient = new mgmtApi.ApiClient(this._options);
        let createdTemplates: mgmtApi.PageModel[] = [];
        let failedCount = 0; // Initialize failure counter
        let index = 1;
        for(let i = 0; i < templates.length; i++){
            let template = templates[i];
            let payload = templates[i];
            let originalID = template.pageTemplateID;
            index += 1;
            try{
                let existingTemplate = await apiClient.pageMethods.getPageTemplateName(guid, locale, template.pageTemplateName);

                if(existingTemplate){
                    // template.pageTemplateID = existingTemplate.pageTemplateID;
                    let existingDefinitions = await apiClient.pageMethods.getPageItemTemplates(guid, locale, existingTemplate.pageTemplateID);

                    if(existingDefinitions){
                        for(const sourceDef of template.contentSectionDefinitions){
                            for(const targetDef of existingDefinitions){
                                if(sourceDef.pageItemTemplateReferenceName !== targetDef.pageItemTemplateReferenceName){
                                    sourceDef.pageItemTemplateID = -1;
                                    sourceDef.pageTemplateID = -1;
                                    sourceDef.contentViewID = 0;
                                    sourceDef.contentReferenceName = null;
                                    sourceDef.contentDefinitionID = 0;
                                    sourceDef.itemContainerID = 0;
                                    sourceDef.publishContentItemID = 0;
                                }
                            }
                        }
                    }

                   
                    this._referenceMapper.addRecord('template', template, existingTemplate);
                    console.log(`✓ Template ${ansiColors.underline(template.pageTemplateName)} ${ansiColors.bold.gray('exists')} - ${ansiColors.green('Source')}: ${originalID} ${ansiColors.green('Target')}: pageTemplateID:${existingTemplate.pageTemplateID}`);
                    createdTemplates.push(existingTemplate);
                    continue;
                }
            } catch{
                template.pageTemplateID = -1;
                for(let j = 0; j < template.contentSectionDefinitions.length; j++){
                    template.contentSectionDefinitions[j].pageItemTemplateID = -1;
                    template.contentSectionDefinitions[j].pageTemplateID = -1;
                    template.contentSectionDefinitions[j].contentViewID = 0;
                    template.contentSectionDefinitions[j].contentReferenceName = null;
                    template.contentSectionDefinitions[j].contentDefinitionID = 0;
                    template.contentSectionDefinitions[j].itemContainerID = 0;
                    template.contentSectionDefinitions[j].publishContentItemID = 0;
                }
           
            try{
                let createdTemplate =  await apiClient.pageMethods.savePageTemplate(guid, locale, template);
                createdTemplates.push(createdTemplate);
                this.processedTemplates[createdTemplate.pageTemplateName] = createdTemplate.pageTemplateID;
                // Add template to reference mapper
                console.log(`✓ Template created - ${ansiColors.green('Source')}: ${template.pageTemplateName} (ID: ${originalID}), ${ansiColors.green('Target')}: ${createdTemplate.pageTemplateName} (ID: ${createdTemplate.pageTemplateID})`);
            } catch{
                console.log(`✗ Failed to create template: ${template.pageTemplateName}`);
                failedCount++; // Increment failure counter
            }
        }
       }

       return { createdTemplates, failedCount }; // Return object with counts
    }

    async pushPages(guid: string, locale: string, pages: mgmtApi.PageItem[], onProgress?: (processed: number, total: number, status?: 'success' | 'error') => void) {
        let totalPages = pages.length;
        let processedPagesCount = 0; // Counter for callback
        let successfulPages = 0;
        let failedPages = 0;


        // First process all parent pages (pages without parentPageID)
        for (let page of pages) {
            if (page.parentPageID === -1) {
                let itemStatus: 'success' | 'error' = 'success'; // Track status for this item
                try {
                    await this.processPage(page, guid, locale, false);
                    successfulPages++;
                } catch (error) {
                    console.log(`✗ Failed to process parent page: ${page.name}`, error);
                    failedPages++;
                    itemStatus = 'error'; // Set status to error on catch
                }
                // Increment counter and call progress with itemStatus
                processedPagesCount++;
                if (onProgress) {
                    onProgress(processedPagesCount, totalPages, itemStatus);
                }
            }
        }

        // Then process all child pages (pages with parentPageID)
        for (let page of pages) {
            if (page.parentPageID !== -1) {
                let itemStatus: 'success' | 'error' = 'success'; // Track status for this item
                let parentProcessed = false;
                // Get the parent page reference
                let parentRef = this._referenceMapper.getMappingByKey<mgmtApi.PageItem>('page', 'pageID', page.parentPageID);
                if (!parentRef) {
                    console.log(`✗ Parent page not found for child page: ${page.name} (Parent ID: ${page.parentPageID})`);
                    failedPages++;
                    itemStatus = 'error'; // Error if parent not found
                } else {
                    const { source, target:targetParent } = parentRef;
                    if (!targetParent) {
                        console.log(`✗ Parent page not processed for child page: ${page.name} (Parent ID: ${page.parentPageID})`);
                        failedPages++;
                         itemStatus = 'error'; // Error if target parent not processed
                    } else {
                        try {
                            page.parentPageID = targetParent.pageID;
                            await this.processPage(page, guid, locale, true);
                            successfulPages++;
                            parentProcessed = true;
                        } catch (error) {
                            console.log(`✗ Failed to process child page: ${page.name}`, error);
                            failedPages++;
                            itemStatus = 'error'; // Set status to error on catch
                        }
                    }
                }
                // Increment counter and call progress with itemStatus
                processedPagesCount++;
                if (onProgress) {
                    onProgress(processedPagesCount, totalPages, itemStatus);
                }
            }
        }

        console.log(ansiColors.yellow(`Processed ${successfulPages}/${totalPages} pages (${failedPages} failed)`));
    }

    private async processPage(page: mgmtApi.PageItem, guid: string, locale: string, isChildPage: boolean) {
        let apiClient = new mgmtApi.ApiClient(this._options);

       

        try {
            // Get the sitemap first
            const sitemap = await apiClient.pageMethods.getSitemap(guid, locale);

            
            let correctPageID = -1;
            let channelID = -1;

            // Find the page in the sitemap
            if (sitemap && sitemap.length > 0) {
                const websiteChannel = sitemap.find(channel => channel.digitalChannelTypeName === 'Website');
                if (websiteChannel) {
                    channelID = websiteChannel.digitalChannelID;
                    const pageInSitemap = websiteChannel.pages.find(p => p.pageName === page.name);
                    if (pageInSitemap) {
                        correctPageID = pageInSitemap.pageID;
                        
                    }
                }
            }

            let templateRef = this._referenceMapper.getMappingByKey<mgmtApi.PageModel>('template', 'pageTemplateName', page.templateName);
            
            if (!templateRef) {
                console.log(`✗ Template not found in reference mapper for page: ${page.name} (Template: ${page.templateName})`);
                return;
            }

            const { source, target:targetTemplate } = templateRef;
            if (!targetTemplate) {
                console.log(`✗ Template not processed for page: ${page.name} (Template: ${page.templateName})`);
                return;
            }

            page.pageTemplateID = targetTemplate.pageTemplateID;
            

            // Get the page zones
            // let mappedZones = page.zones;

               // --- START: Map Content IDs in Zones ---
               let mappedZones = page.zones;

               // let payload = {
               //     ...page,
               // }
   
               // Process each zone *and* map content IDs directly on the page object
                   for (const [zoneName, zoneContent] of Object.entries(mappedZones)) {
                       // Process each module in the zone
                       for (const module of zoneContent) {
                           if ('contentId' in module.item) {
                               const contentRef = this._referenceMapper.getContentMappingById<mgmtApi.ContentItem>(module.item.contentId);
                               if (contentRef?.target) {
                                   module.item = {
                                        contentId: contentRef.target.contentID,
                                       //  referenceName: contentRef.target.properties.referenceName
                                   };
                               } else {
                                   console.log(` ✗ Content ${module.item.contentId} not found in reference mapper for page ${page.name}`); // Don't break here, log all missing items
                               }
                           }
                       }
                   }
              
            // Check if page already exists (using previously determined correctPageID)
            let existingPage;
            try {
                // Try to get the page by ID if we have it
                if (correctPageID > 0) {
                    existingPage = await apiClient.pageMethods.getPage(correctPageID, guid, locale);
                }
            } catch (error) {
                console.log(`\nNo existing page found for ID: ${correctPageID}`);
            }

       
             const parentIDArg = page.parentPageID || -1;
             const placeBeforeIDArg = page.placeBeforePageItemID || -1;

            const payload = {
                ...page,
                pageID: existingPage ? existingPage.pageID : -1,
                pageTemplateID: targetTemplate.pageTemplateID,
                channelID: existingPage ? existingPage.channelID : -1,
                zones: mappedZones
            }


            // this is the old code that works.

            const savePageResponse:any = await apiClient.pageMethods.savePage(payload, guid, locale, parentIDArg, placeBeforeIDArg);
            

            // Process the response (using the 6-arg response for details)
            if (Array.isArray(savePageResponse) || savePageResponse.length > 0) { // Type guard: If it's not an array, it must be a Batch
                if (savePageResponse && savePageResponse[0] > 0) {
                    const newPageID = savePageResponse[0];
                    // We need to create a *new* object to store in the mapper 
                    // to avoid potential side effects if 'page' is used elsewhere.
                    const createdPageData = { 
                      ...page, // Use the modified page data
                      pageID: newPageID // Set the correct new ID
                    } as mgmtApi.PageItem;

                    this._referenceMapper.addRecord('page', page, createdPageData); // Use original page for source key
                    console.log(`✓ ${isChildPage ? 'Child ' : ''}Page ${page.name} ${existingPage ? 'Updated' : 'Created'} - Target ID: ${newPageID}`);
                } else {
                    console.log(`✗ Failed to create/update page`);
                    // const errorData = savePageResponse?.errorData || 'No error data';
                    // const wrapAnsi = (await import('wrap-ansi')).default;
                    const wrapped = this.wrapLines(savePageResponse.errorData,  80);
                    console.log(ansiColors.red(`API Error: ${wrapped}`));
                    console.log('payload', JSON.stringify(payload, null, 2));
                }
            } else {
                console.log(`✗ Failed to create/update page`);

                // const errorData = savePageResponse?.errorData || 'No error data';
                // The dynamic import and wrapping is only needed in the other block
                const wrapped = this.wrapLines(savePageResponse.errorData,  80);
                console.log(ansiColors.red(`API Error: ${wrapped}`));
              
                
                console.log('payload', JSON.stringify(payload, null, 2));
            }
        } catch (error) {
            console.log(`\n✗ Error processing page ${page.name}:`, error);
            if (error.response) {
                console.log('API Response:', error.response.data);
            }
        }
    }

    private wrapLines(str: string, width: number = 80) {
        try {
        return str
          ?.split('\n')
          ?.map(line => {
            const result = [];
            while (line.length > width) {
              let sliceAt = line.lastIndexOf(' ', width);
              if (sliceAt === -1) sliceAt = width;
              result.push(line.slice(0, sliceAt));
              line = line.slice(sliceAt).trimStart();
            }
            result.push(line);
            return result.join('\n');
          })
          ?.join('\n');
        } catch (error) {
            return str;
        }
      }
    private updateAssetUrls(contentItem: mgmtApi.ContentItem) {
        const processValue = (value: any): any => {
            if (Array.isArray(value)) {
                return value.map(item => processValue(item));
            } else if (value && typeof value === 'object') {
                const processed = { ...value };
                for (const [key, val] of Object.entries(processed)) {
                    if (key === 'url' && typeof val === 'string') {
                        const assetRef = this._referenceMapper.getMapping<mgmtApi.Media>('asset', 'originUrl', val);
                        if (assetRef && assetRef?.target) {
                            processed[key] = assetRef.target.originUrl;
                        }
                    
                    } else {
                        processed[key] = processValue(val);
                    }
                }
                return processed;
            }
            return value;
        };

        // Process fields
        const processedFields: { [key: string]: any } = {};
        for (const [fieldName, fieldValue] of Object.entries(contentItem.fields)) {
            processedFields[fieldName] = processValue(fieldValue);
        }

        return {
            ...contentItem,
            fields: processedFields
        };
    }

    private isLinkedModel(model: mgmtApi.Model): boolean {
        return model.fields.some(field => field.type === 'Content');
    }

    private async pushGalleries(guid: string, onProgress?: (processed: number, total: number, status?: 'success' | 'error') => void): Promise<void> {
        const galleries = this.getBaseGalleries();
        if (!galleries || galleries.length === 0) {
            console.log('No galleries found to process.');
            return;
        }

        let totalGroupings = 0;
        // Calculate total groupings first
        for (const gallery of galleries) {
            totalGroupings += gallery.assetMediaGroupings.length;
        }
        let successfulGroupings = 0;
        let failedGroupings = 0;
        let processedCount = 0;

        for (const gallery of galleries) {
            try {
                for (const mediaGrouping of gallery.assetMediaGroupings) {
                    let groupingProcessedSuccessfully = false;
                    try {
                        const existingGallery = await this._apiClient.assetMethods.getGalleryByName(guid, mediaGrouping.name);
                        if (existingGallery) {
                            console.log(`✓ Gallery ${mediaGrouping.name} already exists, skipping creation...`);
                            successfulGroupings++;
                            groupingProcessedSuccessfully = true;
                            // continue; // Don't continue, need to call progress callback
                        }
                        if (!groupingProcessedSuccessfully) { // Only try to save if it doesn't exist
                            mediaGrouping.mediaGroupingID = 0;
                            const savedGallery = await this._apiClient.assetMethods.saveGallery(guid, mediaGrouping);
                            console.log(`✓ Gallery created: ${mediaGrouping.name}`);
                            successfulGroupings++;
                            groupingProcessedSuccessfully = true;
                        }
                    } catch (error) {
                        console.error(`✗ Error processing gallery grouping ${mediaGrouping.name}:`, error);
                        failedGroupings++;
                    }
                    // Call progress after attempt
                    processedCount++;
                    if(onProgress) {
                        onProgress(processedCount, totalGroupings, 'success');
                    }
                }
            } catch (error) {
                console.error(`✗ Unexpected error processing gallery file:`, error);
            }
        }
        console.log(ansiColors.yellow(`Processed ${successfulGroupings}/${totalGroupings} gallery groupings (${failedGroupings} failed)`));
    }

    private async pushAssets(guid: string, onProgress?: (processed: number, total: number, status?: 'success' | 'error') => void): Promise<void> {
        const assets = this.getBaseAssets();
        if (!assets) return;

        // Get default container for URL construction
        const defaultContainer = await this._apiClient.assetMethods.getDefaultContainer(this._targetGuid);
        
        let totalAssets = 0;
        let processedAssetsCount = 0;
        
        // First calculate total assets
        for (const asset of assets) {
            totalAssets += asset.assetMedias.length;
        }

        for (const asset of assets) {
            try {
                for (const media of asset.assetMedias) {
                    try {
                        // Construct proper file path and URL
                        const filePath = this.getFilePath(media.originUrl).replace(/%20/g, " ");
                        const folderPath = filePath.split("/").slice(0, -1).join("/") || '/';
                        const originUrl = `${defaultContainer.originUrl}/${filePath}`;

                        // Check if asset exists by URL using the reference mapper's checkExistingAsset method
                        const existingMedia = await this._referenceMapper.checkExistingAsset(originUrl, this._apiClient, this._targetGuid);

                        if (existingMedia) {
                            this._referenceMapper.addRecord('asset', media, existingMedia);
                            const sourcePath = media.originUrl.split('/').slice(3).join('/');
                            const targetPath = existingMedia.originUrl.split('/').slice(3).join('/');
                            console.log(`✓ Asset ${ansiColors.underline(sourcePath.split('/').filter(Boolean).pop())} ${ansiColors.bold.grey('exists')} - ${ansiColors.green(this._targetGuid)}: mediaID:${existingMedia.mediaID}`);
                            continue;
                        }

                        // Handle gallery if present
                        let mediaGroupingID = -1;
                        if (media.mediaGroupingID > 0) {
                            try {
                                const gallery = await this._apiClient.assetMethods.getGalleryByName(this._targetGuid, media.mediaGroupingName);
                                if (gallery) {
                                    mediaGroupingID = gallery.mediaGroupingID;
                                }
                            } catch (error) {
                                // Gallery not found, will upload without gallery
                            }
                        }

                        // Upload the asset
                        const form = new FormData();
                        const file = fs.readFileSync(`agility-files/${this._guid}/${this._locale}/${this._isPreview ? 'preview':'live'}/assets/${filePath}`, null);
                        form.append('files', file, media.fileName);
                        const uploadedMedia = await this._apiClient.assetMethods.upload(form, folderPath, this._targetGuid, mediaGroupingID);
                        this._referenceMapper.addRecord('asset', media, uploadedMedia);
                        console.log(`✓ Asset uploaded: ${media.fileName}`);
                    } catch (error) {
                        console.error(`Error processing asset ${media.fileName}:`, error);
                        if (onProgress) {
                            onProgress(processedAssetsCount, totalAssets, 'error');
                        }
                    } finally {
                        // Increment and call progress in finally block for each media item
                        processedAssetsCount++;
                        if (onProgress) {
                            onProgress(processedAssetsCount, totalAssets, 'success');
                        }
                    }
                }
            } catch (error) {
                console.error(`Error processing asset group:`, error);
            }
        }
        console.log(ansiColors.yellow(`Processed ${processedAssetsCount}/${totalAssets} assets`));
    }

    private getFilePath(originUrl: string): string {
        const url = new URL(originUrl);
        const pathName = url.pathname;
        const extractedStr = pathName.split("/")[1];
        return pathName.replace(`/${extractedStr}/`, "");
    }

    private camelize(str: string): string {
        return str.replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, function(match, index) {
            if (+match === 0) return ""; // or if (/\s+/.test(match)) for white space
            return index === 0 ? match.toLowerCase() : match.toUpperCase();
        });
    }

    async pushLinkedContentItems(contentItems: mgmtApi.ContentItem[], guid: string) {
        // REMOVED - Use ContentPusher class now
    }

    private async processLinkedContentFields(contentItem: mgmtApi.ContentItem, path: string): Promise<void> {
        // REMOVED - Use ContentPusher class now
    }
}
