import * as mgmtApi  from '@agility/management-sdk';
import { fileOperations } from './fileOperations';
import * as fs from 'fs';
const FormData = require('form-data');
import * as cliProgress from 'cli-progress';
import ansiColors from 'ansi-colors';
import { homePrompt } from './prompts/home-prompt';
import { Auth } from './auth';
import { ReferenceMapper } from './mappers/mapper';
import { container } from 'container';
import { mapContentItem } from './mappers/content-item-mapper';
import { findContainerInTargetInstance } from './mappers/finders/container-finder';
import { ContainerPusher } from './mappers/pushers/container-pusher';
import { ContentPusher } from './mappers/pushers/content-item-pusher';
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
    processedContentIds : {[key: number]: number;}; //format Key -> Old ContentId, Value New ContentId.
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

    constructor(options: mgmtApi.Options, multibar: cliProgress.MultiBar, guid: string, targetGuid:string, locale:string, isPreview: boolean){
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
    }

    async initialize() {
        let auth = new Auth();
        this._options.token = await auth.getToken();
    }

    async pushInstance(): Promise<void> {
        try {
            // Push galleries and assets first
            await this.pushGalleries(this._targetGuid);
            await this.pushAssets(this._targetGuid);

            // Get models
            const models = await this.getModels();
            if (!models || models.length === 0) {
                console.log('No models found to push');
                return;
            }

            let totalModels = models.length;
            let successfulModels = 0;
            let failedModels = 0;
            let modelExists = false;
            // Separate normal and linked models
            const linkedModels = models.filter(model => this.isLinkedModel(model));
            const normalModels = models.filter(model => !this.isLinkedModel(model));

            // Process normal models first
            // console.log(ansiColors.yellow(`Processing ${normalModels.length} normal models...`));
            for (const model of normalModels) {
                let apiClient = new mgmtApi.ApiClient(this._options);
                let existingModel: mgmtApi.Model | null = null;
                try {
                    // First try to get the model from the target instance
                    existingModel = await apiClient.modelMethods.getModelByReferenceName(model.referenceName, this._targetGuid);
                    if (existingModel) {
                        // Model exists in target, add it to reference mapper
                        this._referenceMapper.addRecord('model', model, existingModel);
                        console.log(`✓ Normal model ${ansiColors.underline(model.referenceName)} ${ansiColors.bold.gray('exists')} - ${ansiColors.green('Source')}: ${model.id} ${ansiColors.green(this._targetGuid)}: ${existingModel.id}`);
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
            }

            // Then process linked models
            // console.log(ansiColors.yellow(`Processing ${linkedModels.length} linked models...`));
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
            }

            console.log(ansiColors.yellow(`Processed ${successfulModels}/${totalModels} models (${failedModels} failed)`));

            // Get containers
            const containers = this.getBaseContainers();
            if (!containers || containers.length === 0) {
                console.log('No containers found to push');
                return;
            }

            // Push containers using the new ContainerPusher
            const containerPusher = new ContainerPusher(
                this._apiClient,
                this._referenceMapper,
                this._targetGuid,
            );
            await containerPusher.pushContainers(containers);

            // Get content items
            const allContentItems = await this.getBaseContentItems();
            if (!allContentItems || allContentItems.length === 0) {
                console.log('No content items found to push');
                return;
            }

            // Restore original content pusher logic
           const contentPusher = new ContentPusher(
            this._apiClient,
            this._referenceMapper,
            this._targetGuid,
            this._locale
           );
           
           const contentResult = await contentPusher.pushContentItems(allContentItems);
           const totalContentItems = allContentItems.length;
           console.log(ansiColors.yellow(`Processed ${contentResult.successfulItems}/${totalContentItems} content items (${contentResult.failedItems} failed)`));

            
            // Push templates
            const templates = await this.getBaseTemplates();
            const templateResult = await this.pushTemplates(templates, this._targetGuid, this._locale);
            const totalTemplates = templates?.length || 0;
            const successfulTemplates = templateResult.createdTemplates.length;
            console.log(ansiColors.yellow(`Processed ${successfulTemplates}/${totalTemplates} templates (${templateResult.failedCount} failed)`));

            // then push the pages
            const pages = await this.getBasePages(this._locale);
            await this.pushPages(this._targetGuid, this._locale, pages);

        } catch (error) {
            console.error('Error in pushInstance:', error);
            throw error;
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
        // console.log(`Found ${models.length} models to process`);
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

                    // Add template to reference mapper using both name and ID as keys
                    // console.log(`Adding template to reference mapper - Name: ${template.pageTemplateName}, ID: ${template.pageTemplateID}`);
                    // console.log('template', template);
                    // console.log('existingTemplate', existingTemplate);
                   
                    this._referenceMapper.addRecord('template', template, existingTemplate);
                    console.log(`✓ Template ${ansiColors.underline(template.pageTemplateName)} ${ansiColors.bold.gray('exists')} - ${ansiColors.green('Source')}: ${originalID} ${ansiColors.green('Target')}: ${existingTemplate.pageTemplateID}`);
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
                console.log(`Adding new template to reference mapper - Name: ${template.pageTemplateName}, ID: ${template.pageTemplateID}`);
                this._referenceMapper.addRecord('template', template, createdTemplate);
                console.log(`✓ Template created - ${ansiColors.green('Source')}: ${template.pageTemplateName} (ID: ${originalID}), ${ansiColors.green('Target')}: ${createdTemplate.pageTemplateName} (ID: ${createdTemplate.pageTemplateID})`);
            } catch{
                console.log(`✗ Failed to create template: ${template.pageTemplateName}`);
                failedCount++; // Increment failure counter
            }
        }
       }

       return { createdTemplates, failedCount }; // Return object with counts
    }

    async pushPages(guid: string, locale: string, pages: mgmtApi.PageItem[]) {
        let totalPages = pages.length;
        let processedPages = 0;
        let failedPages = 0;


        // First process all parent pages (pages without parentPageID)
        for (let page of pages) {
            if (page.parentPageID === -1) {
                try {
                    await this.processPage(page, guid, locale, false);
                    processedPages++;
                } catch (error) {
                    console.log(`✗ Failed to process parent page: ${page.name}`, error);
                    failedPages++;
                }
            }
        }

        // Then process all child pages (pages with parentPageID)
        for (let page of pages) {
            if (page.parentPageID !== -1) {
                // Get the parent page reference
                let parentRef = this._referenceMapper.getMappingByKey<mgmtApi.PageItem>('page', 'pageID', page.parentPageID);
                if (!parentRef) {
                    console.log(`✗ Parent page not found for child page: ${page.name} (Parent ID: ${page.parentPageID})`);
                    failedPages++;
                    continue;
                }

                const { source, target:targetParent } = parentRef;
                if (!targetParent) {
                    console.log(`✗ Parent page not processed for child page: ${page.name} (Parent ID: ${page.parentPageID})`);
                    failedPages++;
                    continue;
                }

                try {
                    page.parentPageID = targetParent.pageID;
                    await this.processPage(page, guid, locale, true);
                    processedPages++;
                } catch (error) {
                    console.log(`✗ Failed to process child page: ${page.name}`, error);
                    failedPages++;
                }
            }
        }

        console.log(ansiColors.yellow(`Processed ${processedPages}/${totalPages} pages (${failedPages} failed)`));
    }

    private async processPage(page: mgmtApi.PageItem, guid: string, locale: string, isChildPage: boolean) {
        let apiClient = new mgmtApi.ApiClient(this._options);

       

        try {
            // Get the sitemap first
            const sitemap = await apiClient.pageMethods.getSitemap(guid, locale);

            // console.log('sitemap', sitemap);
            let correctPageID = -1;
            let channelID = -1;

            // Find the page in the sitemap
            if (sitemap && sitemap.length > 0) {
                const websiteChannel = sitemap.find(channel => channel.digitalChannelTypeName === 'Website');
                if (websiteChannel) {
                    channelID = websiteChannel.digitalChannelID;
                    // console.log('channelID', channelID);
                    const pageInSitemap = websiteChannel.pages.find(p => p.pageName === page.name);
                    if (pageInSitemap) {
                        correctPageID = pageInSitemap.pageID;
                        // console.log(`✓ Found page in sitemap - ID: ${correctPageID}, Channel ID: ${channelID}`);
                    }
                }
            }

            // Get the page template from reference mapper
            // console.log(`Looking up template in reference mapper - Template Name: ${page.templateName}`);
            let templateRef = this._referenceMapper.getMappingByKey<mgmtApi.PageModel>('template', 'pageTemplateName', page.templateName);
            // console.log('Template reference lookup result:', templateRef);
            
            if (!templateRef) {
                console.log(`✗ Template not found in reference mapper for page: ${page.name} (Template: ${page.templateName})`);
                // Log all available template mappings for debugging
                // const allTemplateMappings = this._referenceMapper.getRecordsByType('template');
                // console.log('Available template mappings:', allTemplateMappings);
                return;
            }

            const { source, target:targetTemplate } = templateRef;
            if (!targetTemplate) {
                console.log(`✗ Template not processed for page: ${page.name} (Template: ${page.templateName})`);
                return;
            }

            page.pageTemplateID = targetTemplate.pageTemplateID;
            // console.log(`✓ Template found and mapped - ID: ${page.pageTemplateID}`);

            // Get the page zones
            let zones = page.zones;
            let mappingSuccessful = true; // Flag to track content mapping
            if (!zones) {
                console.log(`✗ No zones found for page: ${page.name}`);
                mappingSuccessful = false; // Or handle as needed
            }

            // Process each zone *and* map content IDs directly on the page object
            if (mappingSuccessful) {
                for (const [zoneName, zoneContent] of Object.entries(zones)) {
                    // Process each module in the zone
                    for (const module of zoneContent) {
                        
                        if ('contentID' in module.item || 'contentId' in module.item) {
                            const originalContentId = module.item.contentId || module.item.contentID;
                            // console.log(`\nModule:`, module);
                            // console.log(`Original Content ID: ${originalContentId}`);
                            
                            const contentRef = this._referenceMapper.getContentMappingById<mgmtApi.ContentItem>(originalContentId);
                            
                            if (contentRef?.target) {
                                // Set module.item to an object containing both contentId and referenceName
                                module.item = {
                                     contentId: contentRef.target.contentID,
                                     referenceName: contentRef.target.properties.referenceName // Add referenceName
                                };
                                // Optionally remove the uppercase one if it exists from the source JSON
                                // (We replaced the whole item, so this might not be needed, but keep for safety)
                                delete module.item.contentID;
                                // console.log(` ✓ Mapped Item: contentId=${contentRef.target.contentID}, refName=${contentRef.target.properties.referenceName}`);
                            } else {
                                console.log(` ✗ Content ${originalContentId} not found in reference mapper for page ${page.name}`);
                                mappingSuccessful = false;
                                // Don't break here, log all missing items
                            }
                        }
                    }
                }
            }

            // If any content mapping failed, abort processing this page
            if (!mappingSuccessful) {
                console.log(` ✗ Aborting page ${page.name} due to missing content item mappings.`);
                return; 
            }

            // Check if page already exists (using previously determined correctPageID)
            let existingPage;
            try {
                // Try to get the page by ID if we have it
                if (correctPageID > 0) {
                    existingPage = await apiClient.pageMethods.getPage(correctPageID, guid, locale);

                    if(existingPage && existingPage.visible.sitemap !== null){
                        // console.log(`✓ Page exists - ${ansiColors.green('Source')}: ${page.name} (ID: ${page.pageID}), ${ansiColors.green('Target')}: ${existingPage.name} (ID: ${existingPage.pageID})`);
                    }
                }
            } catch (error) {
                console.log(`\nNo existing page found for ID: ${correctPageID}`);
            }

            // --- Modify the page object directly, like the old code ---
            const originalPageSource = { ...page };
 
            // --- Modify the page object directly, like the old code ---
            // page.channelID = -1; // FORCE -1 like old implementation
            // Set pageID for creation/update
            // page.pageID = pageExists ? existingPage.pageID : -1;
            // Ensure the mapped template ID is set *from the target template*
            // page.pageTemplateID = targetTemplate.pageTemplateID; 
            
            // Parent/PlaceBefore are handled by arguments, not needed in payload obj

            // Create the page payload using the *modified* page object
            // const pagePayload: mgmtApi.PageItem = { ... }; // No longer creating a separate payload

             // Extract values to pass as arguments
             const parentIDArg = page.parentPageID || -1;
             const placeBeforeIDArg = page.placeBeforePageItemID || -1;

            // console.log('\n--- Sending Page Payload ---');
            // console.log(JSON.stringify(page, null, 2)); // Log the payload
            // console.log('--------------------------\n');

            // Save the page (5 args - pass modified page object directly)
            const payload = {
                ...page,
                pageID: existingPage ? existingPage.pageID : -1,
                pageTemplateID: targetTemplate.pageTemplateID,
                channelID: -1,
            }




            const savePageResponse:any = await apiClient.pageMethods.savePage(payload, guid, locale, parentIDArg, placeBeforeIDArg);
            // console.log('Save Page (5 args)->', savePageResponse);
            
            // Save the page (6 args - pass modified page object directly)
            // const savePageResponse2 = await apiClient.pageMethods.savePage(page, guid, locale, parentIDArg, placeBeforeIDArg);
            // console.log('Save Page (6 args)->', savePageResponse2);

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
              
                // console.log(errorData); 
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

    // async pushNormalContentItems(contentItems: mgmtApi.ContentItem[], guid: string) {
    //     let totalContent = contentItems.length;
    //     let processedContent = 0;
    //     let failedContent = 0;

    //     for (const contentItem of contentItems) {
    //         let apiClient = new mgmtApi.ApiClient(this._options);
    //         try {
    //             const referenceName = contentItem.properties.referenceName;
                
    //             // Get the processed container using the reference mapper
    //             let refMap = this._referenceMapper.getMapping<mgmtApi.Container>('container', 'referenceName', referenceName);
                
    //             if (!refMap) {
    //                 console.log(`✗ Container not found in reference mapper for: ${referenceName}`);
    //                 failedContent++;
    //                 continue;
    //             }

    //             const { target:targetContainer } = refMap;

    //             // Update asset URLs in content fields
    //             let processedContentItem = this.updateAssetUrls(contentItem);

    //             // console.log('processedContentItem', processedContentItem);
    //             // First try to get the content item from the target instance
    //             let existingContentItem;

    //             try {
    //                 existingContentItem = await apiClient.contentMethods.getContentItem(contentItem.contentID, this._targetGuid, this._locale);
    //                 // processedContentItem = existingContentItem;
    //                 // processedContentItem.contentID = existingContentItem.contentID;
    //             } catch (error) {
    //                 // Content item doesn't exist, we'll create it
    //             }

    //             // Create or update content item
    //             let contentPayload;
    //             try {
    //                 // Ensure we're using the processed content item with updated URLs
    //                 contentPayload = {
    //                     ...existingContentItem ? processedContentItem : processedContentItem,
    //                     contentID: existingContentItem ? existingContentItem.contentID : -1,
    //                     properties: {
    //                         ...existingContentItem ? existingContentItem.properties : processedContentItem.properties,
    //                         referenceName: existingContentItem ? existingContentItem.properties.referenceName : targetContainer.referenceName
    //                     }
    //                 };



    //                 // console.log('contentPayload', contentPayload);


    //                 const contentIdArray = await apiClient.contentMethods.saveContentItem(contentPayload, guid, this._locale);
                    
                    
    //                 if (contentIdArray && contentIdArray[0] > 0) {

    //                     const newContentItem = {
    //                         ...contentPayload,
    //                         contentID: contentIdArray[0]
    //                     } as mgmtApi.ContentItem;
    //                     // Update both base and specialized reference mappings
    //                     this._referenceMapper.addRecord('content', contentItem, newContentItem);
    //                     console.log(`✓ Normal Content Item ${existingContentItem ? 'Updated' : 'Created'} ${ansiColors.green('Source:')} ${contentItem.properties.referenceName} (ID: ${contentItem.contentID}) ${ansiColors.green('Target:')} ${newContentItem.properties.referenceName} (ID: ${contentIdArray[0]})`);
    //                     processedContent++;
    //                 } else {
    //                     console.log(`✗ Failed to ${existingContentItem ? 'update' : 'create'} normal content item ${contentItem.properties.referenceName}`);
    //                     failedContent++;
    //                 }
    //             } catch (error) {
    //                 console.log(`✗ Error ${existingContentItem ? 'updating' : 'creating'} normal content item ${contentItem.properties.referenceName}:`, error);
    //                 if (error.response) {
    //                     console.log('API Response:', error.response.data);
    //                 }
    //                 failedContent++;
    //             }
    //         } catch (error) {
    //             console.log(`✗ Error processing normal content item ${contentItem.properties.referenceName}:`, error);
    //             if (error.response) {
    //                 console.log('API Response:', error.response.data);
    //             }
    //             failedContent++;
    //         }
    //     }
    //     console.log(ansiColors.yellow(`✓ Processed ${processedContent}/${totalContent} normal content items (${failedContent} failed)`));
    // }

    private isLinkedModel(model: mgmtApi.Model): boolean {
        return model.fields.some(field => field.type === 'Content');
    }

    private async pushGalleries(guid: string): Promise<void> {
        const galleries = this.getBaseGalleries();
        if (!galleries || galleries.length === 0) {
            console.log('No galleries found to process.');
            return;
        }

        let totalGroupings = 0;
        let successfulGroupings = 0;
        let failedGroupings = 0;

        for (const gallery of galleries) {
            try {
                for (const mediaGrouping of gallery.assetMediaGroupings) {
                    totalGroupings++;
                    try {
                        const existingGallery = await this._apiClient.assetMethods.getGalleryByName(guid, mediaGrouping.name);
                        if (existingGallery) {
                            console.log(`✓ Gallery ${mediaGrouping.name} already exists, skipping creation...`);
                            successfulGroupings++;
                            continue;
                        }
                        mediaGrouping.mediaGroupingID = 0;
                        const savedGallery = await this._apiClient.assetMethods.saveGallery(guid, mediaGrouping);
                        console.log(`✓ Gallery created: ${mediaGrouping.name}`);
                        successfulGroupings++;
                    } catch (error) {
                        console.error(`✗ Error processing gallery grouping ${mediaGrouping.name}:`, error);
                        failedGroupings++;
                    }
                }
            } catch (error) {
                console.error(`✗ Unexpected error processing gallery file:`, error);
            }
        }
        console.log(ansiColors.yellow(`Processed ${successfulGroupings}/${totalGroupings} gallery groupings (${failedGroupings} failed)`));
    }

    private async pushAssets(guid: string): Promise<void> {
        const assets = this.getBaseAssets();
        if (!assets) return;

        // Get default container for URL construction
        const defaultContainer = await this._apiClient.assetMethods.getDefaultContainer(this._targetGuid);
        
        let totalAssets = 0;
        let processedAssets = 0;
        
        for (const asset of assets) {
            try {
                for (const media of asset.assetMedias) {
                    totalAssets++;
                    try {
                        // Construct proper file path and URL
                        const filePath = this.getFilePath(media.originUrl).replace(/%20/g, " ");
                        const folderPath = filePath.split("/").slice(0, -1).join("/") || '/';
                        const originUrl = `${defaultContainer.originUrl}/${filePath}`;

                        // Check if asset exists by URL using the reference mapper's checkExistingAsset method
                        const existingMedia = await this._referenceMapper.checkExistingAsset(originUrl, this._apiClient, this._targetGuid);

                        if (existingMedia) {
                            // Store the mapping between source and target asset URLs using reference mapper
                            this._referenceMapper.addRecord('asset', media, existingMedia);
                            // Extract just the path after the domain
                            const sourcePath = media.originUrl.split('/').slice(3).join('/');
                            const targetPath = existingMedia.originUrl.split('/').slice(3).join('/');
                            console.log(`✓ Asset ${ansiColors.underline(sourcePath.split('/').filter(Boolean).pop())} ${ansiColors.bold.grey('exists')} - ${ansiColors.green(this._targetGuid)}: ${existingMedia.mediaID}`);
                            
                            processedAssets++;
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
                        
                        // Store the mapping between source and target asset using reference mapper
                        this._referenceMapper.addRecord('asset', media, uploadedMedia);
                        console.log(`✓ Asset uploaded: ${media.fileName}`);
                        processedAssets++;
                    } catch (error) {
                        console.error(`Error processing asset ${media.fileName}:`, error);
                    }
                }
            } catch (error) {
                console.error(`Error processing asset group:`, error);
            }
        }
        console.log(ansiColors.yellow(`Processed ${processedAssets}/${totalAssets} assets`));
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
        let totalContent = contentItems.length;
        let processedContent = 0;
        let failedContent = 0;
        let fileOperation = new fileOperations();

        for (let contentItem of contentItems) {

            const mappedContentItem = await mapContentItem(contentItem, this._referenceMapper);
            console.log('mappedContentItem', mappedContentItem);

            let apiClient = new mgmtApi.ApiClient(this._options);
            try {
                const referenceName = contentItem.properties.referenceName;
                
                // Get the processed container using the reference mapper
                let containerRef = this._referenceMapper.getMapping<mgmtApi.Container>('container', 'referenceName', referenceName);
                
                if (!containerRef) {
                    console.log(`✗ Container not found in reference mapper for: ${referenceName}`);
                    failedContent++;
                    continue;
                }

                const { source, target:targetContainer } = containerRef;
                // contentItem.contentID = targetContainer.contentDefinitionID;

                // Process content item URLs and fetch any missing assets
                contentItem = this.updateAssetUrls(contentItem);

                // Get the model to process linked content fields
                let model;
                try {
                    model = await apiClient.modelMethods.getContentModel(targetContainer.contentDefinitionID, this._targetGuid);
                } catch (error) {
                    console.log(`✗ Error getting model for content item ${referenceName}:`, error);
                    failedContent++;
                    continue;
                }

                // Process linked content fields
                for (const field of model.fields) {
                    const fieldName = this.camelize(field.name);
                    const fieldVal = contentItem.fields[fieldName];
                    
                    if (fieldVal && field.type === 'Content') {
                        const settings = field.settings || {};

                        // Handle LinkeContentDropdownValueField
                        if (settings['LinkeContentDropdownValueField'] && settings['LinkeContentDropdownValueField'] !== 'CREATENEW') {
                            const linkedField = this.camelize(settings['LinkeContentDropdownValueField']);
                            const linkedContentIds = contentItem.fields[linkedField];
                            let newLinkedContentIds = '';

                            if (linkedContentIds) {
                                const splitIds = linkedContentIds.split(',');
                                for (const id of splitIds) {
                                    if (this.skippedContentItems[id]) {
                                        this.skippedContentItems[contentItem.contentID] = contentItem.properties.referenceName;
                                        fileOperation.appendLogFile(`\n Unable to process content item for referenceName ${contentItem.properties.referenceName} with contentId ${contentItem.contentID}.`);
                                        continue;
                                    }
                                    if (this.processedContentIds[id]) {
                                        const newSortId = this.processedContentIds[id].toString();
                                        newLinkedContentIds = newLinkedContentIds ? `${newLinkedContentIds},${newSortId}` : newSortId;
                                    } else {
                                        try {
                                            const file = fileOperation.readFile(`agility-files/${this._locale}/item/${id}.json`);
                                            contentItem = null;
                                            break;
                                        } catch {
                                            this.skippedContentItems[contentItem.contentID] = contentItem.properties.referenceName;
                                            this.skippedContentItems[id] = 'OrphanRef';
                                            fileOperation.appendLogFile(`\n Unable to process content item for referenceName ${contentItem.properties.referenceName} with contentId ${contentItem.contentID} as the content is orphan. Orphan ID ${id}.`);
                                            continue;
                                        }
                                    }
                                }
                                if (newLinkedContentIds) {
                                    contentItem.fields[linkedField] = newLinkedContentIds;
                                }
                            }
                        }

                        // Handle SortIDFieldName
                        if (settings['SortIDFieldName'] && settings['SortIDFieldName'] !== 'CREATENEW') {
                            const sortField = this.camelize(settings['SortIDFieldName']);
                            const sortContentIds = contentItem.fields[sortField];
                            let newSortContentIds = '';

                            if (sortContentIds) {
                                const splitIds = sortContentIds.split(',');
                                for (const id of splitIds) {
                                    if (this.skippedContentItems[id]) {
                                        this.skippedContentItems[contentItem.contentID] = contentItem.properties.referenceName;
                                        fileOperation.appendLogFile(`\n Unable to process content item for referenceName ${contentItem.properties.referenceName} with contentId ${contentItem.contentID}.`);
                                        continue;
                                    }
                                    if (this.processedContentIds[id]) {
                                        const newSortId = this.processedContentIds[id].toString();
                                        newSortContentIds = newSortContentIds ? `${newSortContentIds},${newSortId}` : newSortId;
                                    } else {
                                        try {
                                            const file = fileOperation.readFile(`agility-files/${this._locale}/item/${id}.json`);
                                            contentItem = null;
                                            break;
                                        } catch {
                                            this.skippedContentItems[contentItem.contentID] = contentItem.properties.referenceName;
                                            this.skippedContentItems[id] = 'OrphanRef';
                                            fileOperation.appendLogFile(`\n Unable to process content item for referenceName ${contentItem.properties.referenceName} with contentId ${contentItem.contentID} as the content is orphan. Orphan ID ${id}.`);
                                            continue;
                                        }
                                    }
                                }
                                if (newSortContentIds) {
                                    contentItem.fields[sortField] = newSortContentIds;
                                }
                            }
                        }

                        // Handle contentid and referencename
                        if (typeof fieldVal === 'object') {
                            if ('contentid' in fieldVal) {
                                const linkedContentId = fieldVal.contentid;
                                if (this.skippedContentItems[linkedContentId]) {
                                    this.skippedContentItems[contentItem.contentID] = contentItem.properties.referenceName;
                                    fileOperation.appendLogFile(`\n Unable to process content item for referenceName ${contentItem.properties.referenceName} with contentId ${contentItem.contentID}.`);
                                    continue;
                                }
                                if (this.processedContentIds[linkedContentId]) {
                                    try {
                                        const file = fileOperation.readFile(`agility-files/${this._locale}/item/${linkedContentId}.json`);
                                        const extractedContent = JSON.parse(file) as mgmtApi.ContentItem;
                                        contentItem.fields[fieldName] = extractedContent.properties.referenceName;
                                    } catch {
                                        contentItem = null;
                                        break;
                                    }
                                }
                            }
                            if ('referencename' in fieldVal) {
                                const refName = fieldVal.referencename;
                                try {
                                    const container = await apiClient.containerMethods.getContainerByReferenceName(refName, this._targetGuid);
                                    if (!container) {
                                        this.skippedContentItems[contentItem.contentID] = contentItem.properties.referenceName;
                                        fileOperation.appendLogFile(`\n Unable to find a container for content item referenceName ${contentItem.properties.referenceName} with contentId ${contentItem.contentID}.`);
                                        continue;
                                    }
                                    if ('sortids' in fieldVal) {
                                        contentItem.fields[fieldName].referencename = fieldVal.referencename;
                                    } else {
                                        contentItem.fields[fieldName] = fieldVal.referencename;
                                    }
                                } catch {
                                    this.skippedContentItems[contentItem.contentID] = contentItem.properties.referenceName;
                                    fileOperation.appendLogFile(`\n Unable to process content item for referenceName ${contentItem.properties.referenceName} with contentId ${contentItem.contentID}.`);
                                    continue;
                                }
                            }
                        }
                    }
                }

                if (!contentItem) {
                    continue;
                }




                // console.log('Content Item:',contentItem)
                // Create or update content item
                let contentPayload;



/// this won't ever work because the contentID is not the same as the contentID in the payload
// what we need to do is lookup the container this is going into, and get a list of the contentIDs


                // const existingContentItem = await this._apiClient.contentMethods.getContentItem(contentItem.contentID, this._targetGuid, this._locale);
                // console.log('existingContentItem:',existingContentItem)


                try {
                    // Update asset URLs in content fields
                    const processedContentItem = this.updateAssetUrls(contentItem);


                    // console.log('Processed Content Item:',processedContentItem)
                    contentPayload = {
                        ...processedContentItem,
                        // contentID: existingContentItem ? existingContentItem.contentID : -1,
                        properties: {
                            ...processedContentItem.properties,
                            referenceName: targetContainer.referenceName
                        }
                    };

                    // Update any remaining URLs in the payload
                    contentPayload = this.updateAssetUrls(contentPayload);


                    // theres a couple issues I see in the payload, which is in fields > category > contentid
                    // this needs to be mapped back to what the new contentID
                    // for example 110 is actually  453 of the normal content items

                    // there is also a categoryID, which is another normal content item, but as a string
                    // 109 is actually 471

                    console.log('Content Payload:',contentPayload)

                    const contentIdArray = await apiClient.contentMethods.saveContentItem(contentPayload, this._targetGuid, this._locale);
                    console.log('Content ID Array:',contentIdArray)
                    if (contentIdArray && contentIdArray[0] > 0) {
                        const newContentItem = {
                            ...contentPayload,
                            contentID: contentIdArray[0]
                        } as mgmtApi.ContentItem;
                        // Update both base and specialized reference mappings
                        this._referenceMapper.addRecord('content', contentItem, newContentItem);
                        console.log(`✓ Nested content item created - Source: ${contentItem.properties.referenceName} (ID: ${contentItem.contentID}), Target: ${newContentItem.properties.referenceName} (ID: ${newContentItem.contentID})`);
                        processedContent++;
                    } else {
                        console.log(`✗ Failed to create linked content item ${contentItem.properties.referenceName}`);
                        failedContent++;
                    }
                } catch (error) {
                    console.log(`✗ Error creating/updating linked content item ${contentItem.properties.referenceName}:`, error);
                    if (error.response) {
                        console.log('API Response:', error.response.data);
                    }
                    failedContent++;
                }
            } catch (error) {
                console.log(`✗ Error processing linked content item ${contentItem.properties.referenceName}:`, error);
                if (error.response) {
                    console.log('API Response:', error.response.data);
                }
                failedContent++;
            }
        }
        console.log(ansiColors.yellow(`Processed ${processedContent}/${totalContent} linked content items (${failedContent} failed)`));
    }

    private async processLinkedContentFields(contentItem: mgmtApi.ContentItem, path: string): Promise<void> {
        // Get all linked content items
        const linkedContentItems: mgmtApi.ContentItem[] = [];
        
        // Check each field for linked content
        Object.entries(contentItem.fields).forEach(([fieldName, fieldValue]) => {
            if (typeof fieldValue === 'string' && fieldValue.includes(',')) {
                const contentIds = fieldValue.split(',').map(id => id.trim());
                contentIds.forEach(contentId => {
                    if (!isNaN(Number(contentId))) {
                        const contentRef = this._referenceMapper.getMapping<mgmtApi.ContentItem>('content', 'contentID', Number(contentId));
                        if (contentRef?.source) {
                            linkedContentItems.push(contentRef.source);
                        }
                    }
                });
            } else if (typeof fieldValue === 'object' && fieldValue !== null && 'contentid' in fieldValue) {
                const contentRef = this._referenceMapper.getMapping<mgmtApi.ContentItem>('content', 'contentID', fieldValue.contentid);
                if (contentRef?.source) {
                    linkedContentItems.push(contentRef.source);
                }
            }
        });

        // Add linked content items to reference mapper
        for (const linkedContentItem of linkedContentItems) {
            this._referenceMapper.addRecord('content', linkedContentItem, null);
        }
    }
}
