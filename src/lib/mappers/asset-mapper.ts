import * as mgmtApi from '@agility/management-sdk';
import { ReferenceMapper } from '../mapper';

export class AssetMapper {
    private referenceMapper: ReferenceMapper;

    constructor(referenceMapper: ReferenceMapper) {
        this.referenceMapper = referenceMapper;
    }

    async map(source: mgmtApi.Media): Promise<mgmtApi.Media> {
        // Check if we already have a mapping for this asset
        const existingMapping = this.referenceMapper.getMapping<mgmtApi.Media>(
            'asset',
            'originUrl',
            source.originUrl
        );

        if (existingMapping?.target) {
            return existingMapping.target;
        }

        // Create a deep copy of the asset
        const mappedAsset = JSON.parse(JSON.stringify(source));

        // Map any nested asset references
        if (mappedAsset.url) {
            const assetRef = this.referenceMapper.getMapping<mgmtApi.Media>(
                'asset',
                'originUrl',
                mappedAsset.url
            );
            if (assetRef?.target) {
                mappedAsset.url = assetRef.target.originUrl;
            }
        }

        // Map any nested gallery references
        if (mappedAsset.mediaGroupingID) {
            const galleryRef = this.referenceMapper.getMapping<mgmtApi.assetGalleries>(
                'gallery',
                'mediaGroupingID',
                mappedAsset.mediaGroupingID.toString()
            );
            if (galleryRef?.target) {
                mappedAsset.mediaGroupingID = galleryRef.target.assetMediaGroupings[0]?.mediaGroupingID;
            }
        }

        return mappedAsset;
    }

    async mapGallery(source: mgmtApi.assetGalleries): Promise<mgmtApi.assetGalleries> {
        // Check if we already have a mapping for this gallery
        const existingMapping = this.referenceMapper.getMapping<mgmtApi.assetGalleries>(
            'gallery',
            'mediaGroupingID',
            source.assetMediaGroupings[0]?.mediaGroupingID.toString()
        );

        if (existingMapping?.target) {
            return existingMapping.target;
        }

        // Create a deep copy of the gallery
        const mappedGallery = JSON.parse(JSON.stringify(source));

        // Map all assets in the gallery
        if (mappedGallery.assetMediaGroupings && Array.isArray(mappedGallery.assetMediaGroupings)) {
            for (const grouping of mappedGallery.assetMediaGroupings) {
                if (grouping.assets && Array.isArray(grouping.assets)) {
                    grouping.assets = await Promise.all(
                        grouping.assets.map(async (asset) => {
                            const mappedAsset = await this.map(asset);
                            return mappedAsset;
                        })
                    );
                }
            }
        }

        return mappedGallery;
    }

    getSourceId(source: mgmtApi.Media): string {
        return source.originUrl;
    }

    getTargetId(target: mgmtApi.Media): string {
        return target.originUrl;
    }

    getTypeName(): string {
        return 'asset';
    }
} 