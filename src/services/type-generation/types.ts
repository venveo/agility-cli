import * as mgmtApi from '@agility/management-sdk';

/**
 * Core domain types for type generation
 */

export interface GenerationConfig {
  format: 'typescript' | 'zod' | 'both';
  outputDir: string;
  sourceFolder: string;
  includeDepthAware: boolean;
  includeContentModules: boolean;
}

export interface TypeGenerationContext {
  models: mgmtApi.Model[];
  containers: mgmtApi.Container[];
  contentModules: mgmtApi.Model[];
  config: GenerationConfig;
  modelsByReferenceName: Map<string, mgmtApi.Model>;
  containersByReferenceName: Map<string, mgmtApi.Container>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface GenerationResult {
  success: boolean;
  filesGenerated: string[];
  errors: string[];
  warnings: string[];
  summary: GenerationSummary;
}

export interface GenerationSummary {
  modelsCount: number;
  containersCount: number;
  contentModulesCount: number;
  validationResult: ValidationResult;
  timestamp: string;
}

export interface GeneratedFile {
  path: string;
  content: string;
  type: 'typescript' | 'zod' | 'mapping' | 'report';
}

export type ContentLinkDepth = 0 | 1 | 2 | 3 | 4 | 5;

export interface FieldTypeInfo {
  baseType: string;
  zodType: string;
  isArray: boolean;
  isContentReference: boolean;
  referencedModel?: string;
}

/**
 * Common type definitions used across generators
 */
export const COMMON_TYPES = {
  Image: 'AgilityImage',
  File: 'AgilityFile',
  Link: 'AgilityLink',
  Gallery: 'AgilityGallery',
  ContentReference: 'AgilityContentReference',
  ContentItem: 'AgilityContentItem',
} as const;

export const COMMON_ZOD_TYPES = {
  Image: 'AgilityImageSchema',
  File: 'AgilityFileSchema',
  Link: 'AgilityLinkSchema',
  Gallery: 'AgilityGallerySchema',
  ContentReference: 'AgilityContentReferenceSchema',
  ContentItem: 'AgilityContentItemSchema',
} as const;

/**
 * System fields that Agility CMS adds automatically
 */
export const SYSTEM_FIELDS = new Set([
  'state',
  'createdDate',
  'userName',
  'modifiedDate',
  'modifiedBy',
  'contentID',
  'languageCode',
  'versionID',
  'releaseDate',
  'pullDate',
]);
