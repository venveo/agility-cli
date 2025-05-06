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
import { pushAssets } from './lib/pushers/asset-pusher';
import { pushGalleries } from './lib/pushers/gallery-pusher';
import { pushModels } from './lib/pushers/model-pusher';
import { pushTemplates } from './lib/pushers/template-pusher';
import { pushPages } from './lib/pushers/page-pusher';
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
    private elements: any;
    constructor(options: mgmtApi.Options, multibar: cliProgress.MultiBar, guid: string, targetGuid:string, locale:string, isPreview: boolean, useBlessedUI?: boolean, elements?: any){
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
        this.elements = elements ?? [];
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
        
        // Filter push steps based on selected elements
        const availableSteps = [ 'Galleries', 'Assets', 'Models', 'Containers', 'Content', 'Templates', 'Pages' ];
        const pushSteps = availableSteps.filter(step => this.elements.includes(step));
        
        if (pushSteps.length === 0) {
            console.log(ansiColors.yellow("No elements selected to push."));
            if (this._useBlessedUI) restoreConsole();
            return; // Nothing to do
        }

        const totalSteps = pushSteps.length;
        let stepStatuses = new Array(totalSteps).fill(0); // Status array based on filtered steps
        let originalConsoleLog = console.log;
        let originalConsoleError = console.error;

        // Define restoreConsole early using function keyword for hoisting
        function restoreConsole() {
            console.log = originalConsoleLog;
            console.error = originalConsoleError;
        };

        // Declare galleries variable outside the conditional block
        let galleries: mgmtApi.assetGalleries[] = [];

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

            // Initialize Grid layout - Covers full screen, 13 rows to leave space for header
            const grid = new contrib.grid({
                rows: 13,       // Use 13 rows
                cols: 12,
                screen: screen
                // Remove top/bottom offsets, let it cover screen
            });

            // Left Column Container (Box) - Start at Grid Row 1
            progressContainerBox = grid.set(1, 0, 12, 4, blessed.box, { // Start Row 1, Height 12
                label: ' Progress ',
                border: { type: 'line' },
                style: {
                    border: { fg: 'cyan' },
                 }
                 // Remove padding: { top: 1 }
            });

            // Create individual progress bars (positioning remains relative to parent)
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

            // Logs (Right Column) - Start at Grid Row 1
            logContainer = grid.set(1, 4, 12, 8, blessed.log, { // Start Row 1, Height 12
                label: ' Logs ',
                border: { type: 'line' },
                style: { border: { fg: 'green' } },
                padding: { left: 2, right: 1, top: 1, bottom: 1 },
                scrollable: true,
                alwaysScroll: true,
                scrollbar: {
                    ch: ' ',
                    inverse: true
                },
                keys: true, // Enable scrolling with keys
                vi: true    // Enable vi keys for scrolling
            });

            // --- Header (Drawn After Grid) ---
            // Header Left Column ("Push")
            const pushHeaderLeft = blessed.box({
                parent: screen, // Attach directly to screen
                width: '20%',
                height: 1,
                top: 0,
                left: 0,
                content: ' ',
                tags: true,
                style: { fg: 'cyan', bold: true }
            });

            // Header Right Column (GUIDs)
            const pushHeaderRight = blessed.box({
                parent: screen, // Attach directly to screen
                width: '80%',
                height: 1,
                top: 0,
                left: '20%', // Start after the left column
                content: `Source: ${this._guid} -> Target: ${this._targetGuid} `,
                tags: true,
                align: 'right',
                style: { fg: 'white' }
            });
            // --- End Header ---

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
                return homePrompt();
                // return process.exit(0);
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
            if (this.elements.includes('Galleries')) {
                currentStep = pushSteps.indexOf('Galleries');
                let galleryStatus: 'success' | 'error' = 'success';
                const galleryStepIndex = currentStep;
                try {
                    const galleryProgressCallback = (processed: number, total: number, status?: 'success' | 'error') => {
                        const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
                        updateProgress(galleryStepIndex, status || 'success', percentage); 
                    };
                    galleries = this.getBaseGalleries();
                    const galleryResult = await pushGalleries(
                        galleries, 
                        this._targetGuid, 
                        this._apiClient,
                        this._referenceMapper,
                        galleryProgressCallback
                    );
                    galleryStatus = galleryResult.status;
                 } catch (e: any) {
                    galleryStatus = 'error';
                    if (!this._useBlessedUI) console.error(ansiColors.red(`ERROR pushing galleries: ${e.message}`));
                    else logContainer?.log(ansiColors.red(`ERROR pushing galleries: ${e.message}`));
                }
                updateProgress(galleryStepIndex, galleryStatus); 
            }

            // --- Assets --- 
            if (this.elements.includes('Assets')) {
                currentStep = pushSteps.indexOf('Assets');
                let assetStatus: 'success' | 'error' = 'success';
                const assetStepIndex = currentStep;
                try {
                    const assetProgressCallback = (processed: number, total: number, status?: 'success' | 'error') => {
                        const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
                        updateProgress(assetStepIndex, status || 'success', percentage);
                    };
                    const assets = this.getBaseAssets(); 
                    const assetResult = await pushAssets(
                        assets, 
                        galleries,
                        this._guid,
                        this._targetGuid, 
                        this._locale, 
                        this._isPreview, 
                        this._apiClient, 
                        this._referenceMapper, 
                        assetProgressCallback
                    );
                    assetStatus = assetResult.status;
                } catch (e: any) {
                    assetStatus = 'error';
                    if (!this._useBlessedUI) console.error(ansiColors.red(`ERROR pushing assets: ${e.message}`));
                    else logContainer?.log(ansiColors.red(`ERROR pushing assets: ${e.message}`));
                }
                updateProgress(assetStepIndex, assetStatus); 
            }

            // --- Models --- 
            if (this.elements.includes('Models')) {
                currentStep = pushSteps.indexOf('Models');
                let modelStatus: 'success' | 'error' = 'success';
                const modelStepIndex = currentStep;
                try {
                    const models = await this.getModels();
                    
                    const modelProgressCallback = (processed: number, total: number, status?: 'success' | 'error') => {
                        const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
                        updateProgress(modelStepIndex, status || 'success', percentage); 
                    };

                    const modelResult = await pushModels(
                        models,
                        this._options,
                        this._targetGuid,
                        this._referenceMapper,
                        modelProgressCallback
                    );
                    modelStatus = modelResult.status;

                } catch (e: any) {
                    modelStatus = 'error';
                    if (!this._useBlessedUI) console.error(ansiColors.red(`ERROR processing models: ${e.message}`));
                    else logContainer?.log(ansiColors.red(`ERROR processing models: ${e.message}`));
                }
                updateProgress(modelStepIndex, modelStatus);
            }

            // --- Containers --- 
            if (this.elements.includes('Containers')) {
                currentStep = pushSteps.indexOf('Containers');
                let containerStatus: 'success' | 'error' = 'success';
                const containerStepIndex = currentStep;
                try{
                    const containers = this.getBaseContainers();
                    if (!containers || containers.length === 0) {
                        console.log('No containers found to push');
                    } else {
                        const containerPusher = new ContainerPusher(
                            this._apiClient,
                            this._referenceMapper,
                            this._targetGuid,
                        );
                        const containerProgressCallback = (processed: number, total: number, status?: 'success' | 'error') => {
                            const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
                            updateProgress(containerStepIndex, status || 'success', percentage);
                        };
                        await containerPusher.pushContainers(containers, containerProgressCallback);
                    }
                } catch(e: any){
                    containerStatus = 'error';
                    if (!this._useBlessedUI) console.error(ansiColors.red(`ERROR processing containers: ${e.message}`));
                    else logContainer?.log(ansiColors.red(`ERROR processing containers: ${e.message}`));
                }
                updateProgress(containerStepIndex, containerStatus);
            }

            // --- Content --- 
            if (this.elements.includes('Content')) {
                currentStep = pushSteps.indexOf('Content');
                let contentStatus: 'success' | 'error' = 'success';
                const contentStepIndex = currentStep;
                try{
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
                            updateProgress(contentStepIndex, status || 'success', percentage); 
                        };
                        const contentResult = await contentPusher.pushContentItems(allContentItems, contentProgressCallback);
                        const totalContentItems = allContentItems.length;
                        console.log(ansiColors.yellow(`Processed ${contentResult.successfulItems}/${totalContentItems} content items (${contentResult.failedItems} failed)`));
                        if(contentResult.failedItems > 0) contentStatus = 'error';
                    }
                     if (!this._useBlessedUI) console.log('Content items pushed.');
                    else logContainer?.log('Content items pushed.');
                } catch(e: any){
                    contentStatus = 'error';
                    if (!this._useBlessedUI) console.error(ansiColors.red(`ERROR processing content: ${e.message}`));
                    else logContainer?.log(ansiColors.red(`ERROR processing content: ${e.message}`));
                }
                updateProgress(contentStepIndex, contentStatus);
            }

            // --- Templates --- 
            if (this.elements.includes('Templates')) {
                currentStep = pushSteps.indexOf('Templates');
                let templateStatus: 'success' | 'error' = 'success';
                const templateStepIndex = currentStep;
                try {
                    if (!this._useBlessedUI) console.log('Processing templates...'); 
                    else logContainer?.log('Processing templates...');
                    
                    const templates = await this.getBaseTemplates();
                    
                    if(!templates || templates.length === 0){
                        console.log('No templates found to push');
                    } else {
                        const templateProgressCallback = (processed: number, total: number, status?: 'success' | 'error') => {
                            const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
                            updateProgress(templateStepIndex, status || 'success', percentage); 
                        };

                        const templateResult = await pushTemplates(
                            templates,
                            this._targetGuid,
                            this._locale,
                            this._apiClient,
                            this._referenceMapper,
                            templateProgressCallback
                        );
                        templateStatus = templateResult.status; 
                    }
                    if (!this._useBlessedUI) console.log('Templates processed.');
                    else logContainer?.log('Templates processed.');
                } catch(e: any) {
                    templateStatus = 'error';
                    if (!this._useBlessedUI) console.error(ansiColors.red(`ERROR processing templates: ${e.message}`));
                    else logContainer?.log(ansiColors.red(`ERROR processing templates: ${e.message}`));
                }
                 updateProgress(templateStepIndex, templateStatus);
            }

            // --- Pages --- 
            if (this.elements.includes('Pages')) {
                currentStep = pushSteps.indexOf('Pages');
                let pageStatus: 'success' | 'error' = 'success';
                const pageStepIndex = currentStep;
                try {
                    if (!this._useBlessedUI) console.log('Processing pages...');
                    else logContainer?.log('Processing pages...');
                    
                    const pages = await this.getBasePages(this._locale); 
                    
                    if(!pages || pages.length === 0){
                         console.log('No pages found to push');
                    } else {
                        const pageProgressCallback = (processed: number, total: number, status?: 'success' | 'error') => {
                            const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;
                            updateProgress(pageStepIndex, status || 'success', percentage); 
                        };

                        const pageResult = await pushPages(
                            pages,
                            this._targetGuid,
                            this._locale,
                            this._apiClient,
                            this._referenceMapper,
                            pageProgressCallback
                        );
                        pageStatus = pageResult.status; 
                    }

                 } catch(e: any){
                    pageStatus = 'error';
                    if (!this._useBlessedUI) console.error(ansiColors.red(`ERROR processing pages: ${e.message}`));
                    else logContainer?.log(ansiColors.red(`ERROR processing pages: ${e.message}`));
                }
                updateProgress(pageStepIndex, pageStatus);
            }

            // Final Status Check
            const overallStatus = stepStatuses.includes(2) ? 'failed' : 'completed successfully';
            const finalMessage = `Push process ${overallStatus}!`;
            if (!this._useBlessedUI) {
                 console.log(finalMessage);
                 process.exit(0);
            } else {
                logContainer?.log(finalMessage);
            }

            if (this._useBlessedUI) {
                screen?.key(['escape', 'q', 'C-c'], function() {
                    restoreConsole();
                    screen?.destroy();
                    process.exit(0);
                });
                screen?.render();
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
