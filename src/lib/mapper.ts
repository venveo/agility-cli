import * as path from 'path';
import * as fs from 'fs/promises';
import ansiColors from 'ansi-colors';

interface ReferenceRecord {
    type: 'model' | 'container' | 'content' | 'asset' | 'gallery' | 'template' | 'page' | 'url';
    source: any;
    target: any | null;
    sourceGUID: string;
    targetGUID: string;
}

interface ReferenceResult<T> {
    source: T;
    target: T | null;
    sourceGUID: string;
    targetGUID: string;
}

export class ReferenceMapper {
    private records: ReferenceRecord[] = [];
    private mappingsDir: string;
    private sourceGUID: string;
    private targetGUID: string;

    constructor(sourceGUID: string, targetGUID: string) {
        this.sourceGUID = sourceGUID;
        this.targetGUID = targetGUID;
        // Store in agility-files/{targetGUID}/mappings/
        this.mappingsDir = path.join(process.cwd(), 'agility-files', targetGUID, 'mappings');
        // Load existing mappings
        this.loadMappings().catch(err => {
            console.error('Failed to load mappings:', err);
        });
    }

    private async ensureDirectory(): Promise<void> {
        await fs.mkdir(this.mappingsDir, { recursive: true });
    }

    private getMappingFilePath(type: ReferenceRecord['type']): string {
        return path.join(this.mappingsDir, `${type}-mappings.json`);
    }

    async loadMappings(): Promise<void> {
        try {
            await this.ensureDirectory();
            this.records = [];

            // Get all possible types from the ReferenceRecord type
            const types: ReferenceRecord['type'][] = [
                'model', 'container', 'content', 'asset', 'gallery', 
                'template', 'page', 'url'
            ];

            // Load each type's mappings
            for (const type of types) {
                const filePath = this.getMappingFilePath(type);
                try {
                    const data = await fs.readFile(filePath, 'utf-8');
                    const typeRecords = JSON.parse(data) as ReferenceRecord[];
                    // Filter out any records that don't match our source/target GUIDs
                    const filteredRecords = typeRecords.filter(record => 
                        record.sourceGUID === this.sourceGUID && 
                        record.targetGUID === this.targetGUID
                    );
                    this.records.push(...filteredRecords);
                } catch (error) {
                    // File doesn't exist or other error - skip this type
                    continue;
                }
            }
        } catch (error) {
            // If there's an error, start with empty records
            this.records = [];
            console.error('Error loading mappings:', error);
        }
    }

    private async saveMappingsByType(type: ReferenceRecord['type']): Promise<void> {
        await this.ensureDirectory();
        const filePath = this.getMappingFilePath(type);
        const typeRecords = this.records.filter(r => r.type === type);
        
        if (typeRecords.length > 0) {
            await fs.writeFile(filePath, JSON.stringify(typeRecords, null, 2), 'utf-8');
        } else {
            // If no records of this type, remove the file if it exists
            try {
                await fs.unlink(filePath);
            } catch {
                // File doesn't exist, ignore error
            }
        }
    }

    /**
     * 
     * The reference mapper is the memory behind the content pushing operations
     * since we generally end up with new ID's and reference names when we create content
     * we need to use that content in subsequent content and page pushes
     * 
     * 
     * Add or update a reference record
     * @param type - The type of the reference record
     * @param source - The source object of the reference record
     * @param target - The target object of the reference record
     * 
     * Both source and target should be pushed together, so that the reference is always consistent.
     */
    addRecord(type: ReferenceRecord['type'], source: any, target: any | null = null): void {
        const existingIndex = this.records.findIndex(r => {
            if (r.type !== type) return false;
            
            // Add specific ID check for content items
            if (type === 'content' && source.contentID) {
                return r.source.contentID === source.contentID;
            }

            // Special handling for templates
            if (type === 'template' && source.pageTemplateName) {
                return r.source.pageTemplateName === source.pageTemplateName;
            }

            // *** RE-ADDED: Special handling for pages ***
            if (type === 'page' && source.pageID) {
                return r.source.pageID === source.pageID;
            }

            // Default comparison
            return r.source === source;
        });
        
        // --- DEBUG: Log findIndex result ---
       
        // --- END DEBUG ---

        if (existingIndex >= 0) {
            // Update existing record
            // --- DEBUG: Log update action ---
           
            // --- END DEBUG ---
            this.records[existingIndex] = {
                type,
                source,
                target: target || this.records[existingIndex].target,
                sourceGUID: this.sourceGUID,
                targetGUID: this.targetGUID
            };
        } else {
            // Add new record
            // --- DEBUG: Log add action ---
           
             // --- END DEBUG ---
            this.records.push({
                type,
                source,
                target,
                sourceGUID: this.sourceGUID,
                targetGUID: this.targetGUID
            });
        }

        // Save the specific type's mappings
        this.saveMappingsByType(type).catch(err => {
            console.error(`Failed to save ${type} mappings:`, err);
        });
    }

    /**
     * Get a mapping by type and any property of the source object
     * @param type - The type of record to find
     * @param key - The property name to search by
     * @param value - The value to match
     * @returns The source and target objects, or null if not found
     */
    getMapping<T>(type: ReferenceRecord['type'], key: string, value: any): ReferenceResult<T> | null {
        if(type === 'asset' && key === 'originUrl') {
            // For asset originUrl lookups, we need to handle both direct matches and path matches
            const record = this.records.find(r => 
                r.type === type && 
                (typeof value === 'string' 
                    ? r.source[key]?.toLowerCase() === value.toLowerCase() ||
                      r.source[key]?.toLowerCase().endsWith(value.toLowerCase().split('/').pop())
                    : r.source[key] === value)
            );
            return record ? { 
                source: record.source, 
                target: record.target,
                sourceGUID: record.sourceGUID,
                targetGUID: record.targetGUID
            } : null;
        }

        // Default lookup for other types
        const record = this.records.find(r => 
            r.type === type && 
            (typeof value === 'string' && typeof r.source[key] === 'string'
                ? r.source[key].toLowerCase() === value.toLowerCase()
                : r.source[key] === value)
        );
        return record ? { 
            source: record.source, 
            target: record.target,
            sourceGUID: record.sourceGUID,
            targetGUID: record.targetGUID
        } : null;
    }

    /**
     * Get a mapping by type and a specific key-value pair
     * @param type - The type of record to find
     * @param key - The property name to search by
     * @param value - The value to match
     * @returns The source and target objects, or null if not found
     */
    getMappingByKey<T>(type: ReferenceRecord['type'], key: string, value: any): ReferenceResult<T> | null {
        const record = this.records.find(r => 
            r.type === type && 
            r.source && 
            r.source[key] !== undefined &&
            (typeof value === 'string' && typeof r.source[key] === 'string'
                ? r.source[key].toLowerCase() === value.toLowerCase()
                : r.source[key] === value)
        );
        
        // --- DEBUG: Log find result ---
        if(type === 'page') {
             console.log(ansiColors.yellow(`[Mapper Debug getMappingByKey] Searching for type=${type}, key=${key}, value=${value}`));
             console.log(ansiColors.yellow(`[Mapper Debug getMappingByKey] Found record: ${record ? `SourceID: ${record.source?.pageID}, TargetID: ${record.target?.pageID}` : 'null'}`));
        }
        // --- END DEBUG ---

        return record ? { 
            source: record.source, 
            target: record.target,
            sourceGUID: record.sourceGUID,
            targetGUID: record.targetGUID
        } : null;
    }

    /**
     * Get a content mapping by content ID
     * @param contentId - The content ID to look up
     * @returns The source and target content items, or null if not found
     */
    getContentMappingById<T>(contentId: number | string): ReferenceResult<T> | null {
       
        const record = this.records.find(r => 
            r.type === 'content' 
            && r.source.contentID === contentId
        );

        return record ? { 
            source: record.source, 
            target: record.target,
            sourceGUID: record.sourceGUID,
            targetGUID: record.targetGUID
        } : null;
    }

    /**
     * Get all records of a specific type
     */
    getRecordsByType(type: ReferenceRecord['type']): ReferenceResult<any>[] {
        return this.records
            .filter(r => r.type === type)
            .map(r => ({ 
                source: r.source, 
                target: r.target,
                sourceGUID: r.sourceGUID,
                targetGUID: r.targetGUID
            }));
    }

    /**
     * Clear all records
     */
    clear(): void {
        this.records = [];
        // Clear all mapping files
        this.ensureDirectory().then(() => {
            const types: ReferenceRecord['type'][] = [
                'model', 'container', 'content', 'asset', 'gallery', 
                'template', 'page', 'url'
            ];
            
            types.forEach(type => {
                this.saveMappingsByType(type).catch(err => {
                    console.error(`Failed to clear ${type} mappings:`, err);
                });
            });
        });
    }

    /**
     * Add a URL mapping between source and target URLs
     * @param sourceUrl - The source URL
     * @param targetUrl - The target URL
     */
    addUrlMapping(sourceUrl: string, targetUrl: string): void {
        this.addRecord('url', { url: sourceUrl }, { url: targetUrl });
    }

    /**
     * Get the target URL for a source URL
     * @param sourceUrl - The source URL to look up
     * @returns The target URL or null if not found
     */
    getTargetUrl(sourceUrl: string): string | null {
        const mapping = this.getMapping<{ url: string }>('url', 'url', sourceUrl);
        return mapping?.target?.url || null;
    }

    /**
     * Check if an asset exists in the target instance by URL
     * @param sourceUrl - The source URL to check
     * @param apiClient - The API client to use
     * @param guid - The instance GUID
     * @returns The existing asset if found, null if not found
     */
    public async checkExistingAsset(sourceUrl: string, apiClient: any, guid: string): Promise<any | null> {
        try {
            // Try unencoded URL first
            const existingAsset = await apiClient.assetMethods.getAssetByUrl(sourceUrl, guid);
            if (existingAsset) return existingAsset;

            // If not found, try encoded URL
            const urlParts = sourceUrl.split('/');
            const encodedParts = urlParts.map(part => encodeURIComponent(part));
            const encodedUrl = encodedParts.join('/');
            
            return await apiClient.assetMethods.getAssetByUrl(encodedUrl, guid) || null;
        } catch (error) {
            // If we get any error, treat it as asset not found
            return null;
        }
    }

    /**
     * Process a content item's fields to update any URLs, fetching missing assets if needed
     * @param contentItem - The content item to process
     * @param apiClient - The API client to use for fetching
     * @param guid - The instance GUID
     * @returns The processed content item with updated URLs
     */
    async processContentItemUrls(contentItem: any, apiClient: any, guid: string): Promise<any> {
        // Process fields
        for (const [fieldName, fieldValue] of Object.entries(contentItem.fields)) {
            if (typeof fieldValue === 'object') {
                if (Array.isArray(fieldValue)) {
                    for (let i = 0; i < fieldValue.length; i++) {
                        const item = fieldValue[i];
                        if (item && typeof item === 'object' && 'url' in item) {
                            const sourceUrl = item.url as string;
                            
                            // First check if we already have a URL mapping
                            let targetUrl = this.getTargetUrl(sourceUrl);
                            
                            if (!targetUrl) {
                                // Check asset mappings first (from initial asset push)
                                const assetRecords = this.getRecordsByType('asset');
                                const assetMapping = assetRecords.find(record => 
                                    record.source.originUrl === sourceUrl || 
                                    record.target?.originUrl === sourceUrl
                                );
                                
                                if (assetMapping?.target) {
                                    targetUrl = assetMapping.target.originUrl;
                                    this.addUrlMapping(sourceUrl, targetUrl);
                                } else {
                                    // If not in mappings, check if asset exists in target instance
                                    const existingAsset = await this.checkExistingAsset(sourceUrl, apiClient, guid);
                                    if (existingAsset) {
                                        targetUrl = existingAsset.originUrl;
                                        this.addUrlMapping(sourceUrl, targetUrl);
                                    } else {
                                        console.log(`✗ Asset not found in mappings or target instance: ${sourceUrl}`);
                                        console.log(targetUrl);
                                    }
                                }
                            }
                            
                            if (targetUrl) {
                                contentItem.fields[fieldName][i].url = targetUrl;
                            }
                        }
                    }
                } else if (fieldValue && typeof fieldValue === 'object' && 'url' in fieldValue) {
                    const sourceUrl = fieldValue.url as string;
                    let targetUrl = this.getTargetUrl(sourceUrl);
                    
                    if (!targetUrl) {
                        // Check asset mappings first (from initial asset push)
                        const assetRecords = this.getRecordsByType('asset');
                        const assetMapping = assetRecords.find(record => 
                            record.source.originUrl === sourceUrl || 
                            record.target?.originUrl === sourceUrl
                        );
                        
                        if (assetMapping?.target) {
                            targetUrl = assetMapping.target.originUrl;
                            this.addUrlMapping(sourceUrl, targetUrl);
                        } else {
                            // If not in mappings, check if asset exists in target instance
                            const existingAsset = await this.checkExistingAsset(sourceUrl, apiClient, guid);
                            if (existingAsset) {
                                targetUrl = existingAsset.originUrl;
                                this.addUrlMapping(sourceUrl, targetUrl);
                            } else {
                                console.log(`✗ Asset not found in mappings or target instance: ${sourceUrl}`);
                                console.log(targetUrl);
                            }
                        }
                    }
                    
                    if (targetUrl) {
                        contentItem.fields[fieldName].url = targetUrl;
                    }
                }
            }
        }
        
        return contentItem;
    }

    /**
     * Validate URLs in a content item against our asset mappings
     * @param contentItem - The content item to validate
     * @returns An array of missing URLs
     */
    validateContentItemUrls(contentItem: any): string[] {
        const missingUrls: string[] = [];
        
        // Process fields
        for (const [fieldName, fieldValue] of Object.entries(contentItem.fields)) {
            if (typeof fieldValue === 'object') {
                if (Array.isArray(fieldValue)) {
                    for (let i = 0; i < fieldValue.length; i++) {
                        const item = fieldValue[i];
                        if (item && typeof item === 'object' && 'url' in item) {
                            const url = item.url as string;
                            if (url && !this.getTargetUrl(url)) {
                                missingUrls.push(url);
                            }
                        }
                    }
                } else if (fieldValue && typeof fieldValue === 'object' && 'url' in fieldValue) {
                    const url = fieldValue.url as string;
                    if (url && !this.getTargetUrl(url)) {
                        missingUrls.push(url);
                    }
                }
            }
        }
        
        return missingUrls;
    }

    /**
     * Get all URL mappings
     * @returns Array of source and target URL mappings
     */
    getAllUrlMappings(): { source: string; target: string }[] {
        return this.getRecordsByType('url')
            .map(mapping => ({
                source: mapping.source.url,
                target: mapping.target.url
            }));
    }
} 