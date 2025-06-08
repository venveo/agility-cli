import { ZodSchemaGenerator } from '../ZodSchemaGenerator';
import { createMockModel, createMockModelField, createMockContainer, createMockContentViewColumn } from '../../__tests__/test-helpers';
import * as mgmtApi from '@agility/management-sdk';
import { jest } from '@jest/globals';

// Mock file operations
jest.mock('../../fileOperations', () => ({
  fileOperations: jest.fn().mockImplementation(() => ({
    readDirectory: jest.fn(),
  })),
}));

describe('ZodSchemaGenerator', () => {
  let generator: ZodSchemaGenerator;

  beforeEach(() => {
    generator = new ZodSchemaGenerator();
  });

  describe('loadModels', () => {
    it('should load and validate models from .agility-files/models directory', () => {
      const mockModel1 = createMockModel({ id: 1, referenceName: 'BlogPost', displayName: 'Blog Post' });
      const mockModel2 = createMockModel({ id: 2, referenceName: 'RichTextArea', displayName: 'Rich Text Area' });
      
      const mockFileOps = generator['fileOps'] as any;
      mockFileOps.readDirectory = jest.fn().mockReturnValue([
        JSON.stringify(mockModel1),
        JSON.stringify(mockModel2),
      ]);

      const models = generator.loadModels();

      expect(models).toHaveLength(2);
      expect(models[0].referenceName).toBe('BlogPost');
      expect(models[1].referenceName).toBe('RichTextArea');
    });

    it('should skip invalid model files', () => {
      const mockModel1 = createMockModel({ id: 1, referenceName: 'BlogPost', displayName: 'Blog Post' });
      
      const mockFileOps = generator['fileOps'] as any;
      mockFileOps.readDirectory = jest.fn().mockReturnValue([
        JSON.stringify(mockModel1),
        'invalid json', // Invalid JSON that will fail parsing
      ]);

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const models = generator.loadModels();

      expect(models).toHaveLength(1);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping invalid model file'));

      consoleSpy.mockRestore();
    });

    it('should handle empty models directory', () => {
      const mockFileOps = generator['fileOps'] as any;
      mockFileOps.readDirectory = jest.fn().mockImplementation(() => {
        throw new Error('Directory not found');
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const models = generator.loadModels();

      expect(models).toHaveLength(0);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('No models found'));

      consoleSpy.mockRestore();
    });
  });

  describe('loadContainers', () => {
    it('should load and validate containers from .agility-files/containers directory', () => {
      const mockContainer = createMockContainer({ referenceName: 'BlogPosts', contentDefinitionID: 1 });
      
      const mockFileOps = generator['fileOps'] as any;
      mockFileOps.readDirectory = jest.fn().mockReturnValue([
        JSON.stringify(mockContainer),
      ]);

      const containers = generator.loadContainers();

      expect(containers).toHaveLength(1);
      expect(containers[0].referenceName).toBe('BlogPosts');
    });

    it('should skip invalid container files', () => {
      const mockContainer = createMockContainer({ referenceName: 'BlogPosts', contentDefinitionID: 1 });
      
      const mockFileOps = generator['fileOps'] as any;
      mockFileOps.readDirectory = jest.fn().mockReturnValue([
        JSON.stringify(mockContainer),
        'invalid json', // Invalid JSON that will fail parsing
      ]);

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const containers = generator.loadContainers();

      expect(containers).toHaveLength(1);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping invalid container file'));

      consoleSpy.mockRestore();
    });
  });

  describe('generateContentTypeInterfaces', () => {
    it('should generate TypeScript interfaces for models', () => {
      const models = [
        createMockModel({ id: 1, referenceName: 'BlogPost', displayName: 'Blog Post' }),
        createMockModel({ id: 2, referenceName: 'RichTextArea', displayName: 'Rich Text Area' })
      ];
      const interfaces = generator.generateContentTypeInterfaces(models);

      expect(interfaces).toContain('export interface BlogPostContentBase');
      expect(interfaces).toContain('export interface RichTextAreaContentBase');
      expect(interfaces).toContain('title: string;');
      expect(interfaces).toContain('content: string;');
      expect(interfaces).toContain('textBlob: string;');
    });

    it('should generate depth-aware interfaces', () => {
      const models = [createMockModel({ id: 1, referenceName: 'BlogPost', displayName: 'Blog Post' })];
      const interfaces = generator.generateContentTypeInterfaces(models);

      expect(interfaces).toContain('export interface BlogPostContent<D extends ContentLinkDepth = 1>');
      expect(interfaces).toContain('ContentLinkDepth');
    });

    it('should include common Agility types', () => {
      const models = [createMockModel({ id: 1, referenceName: 'BlogPost', displayName: 'Blog Post' })];
      const interfaces = generator.generateContentTypeInterfaces(models);

      expect(interfaces).toContain('export interface AgilityImage');
      expect(interfaces).toContain('export interface AgilityFile');
      expect(interfaces).toContain('export interface AgilityLink');
      expect(interfaces).toContain('export interface AgilityContentReference');
      expect(interfaces).toContain('export interface AgilityContentItem');
    });
  });

  describe('generateContentZodSchemas', () => {
    it('should generate Zod schemas for models', () => {
      const models = [
        createMockModel({ id: 1, referenceName: 'BlogPost', displayName: 'Blog Post' }),
        createMockModel({ id: 2, referenceName: 'RichTextArea', displayName: 'Rich Text Area' })
      ];
      const schemas = generator.generateContentZodSchemas(models);

      expect(schemas).toContain("import { z } from 'zod/v4';");
      expect(schemas).toContain('export const BlogPostContentBaseSchema');
      expect(schemas).toContain('export const RichTextAreaContentBaseSchema');
      expect(schemas).toContain('title: z.string()');
      expect(schemas).toContain('content: z.string()');
      expect(schemas).toContain('textBlob: z.string()');
    });

    it('should generate depth-aware schema factories', () => {
      const models = [createMockModel({ id: 1, referenceName: 'BlogPost', displayName: 'Blog Post' })];
      const schemas = generator.generateContentZodSchemas(models);

      expect(schemas).toContain('export const BlogPostContentSchemaFactory');
      expect(schemas).toContain('export const BlogPostContentSchema');
      expect(schemas).toContain('export const BlogPostContentDepth0Schema');
      expect(schemas).toContain('export const BlogPostContentDepth2Schema');
    });

    it('should generate generic types with depth parameter for Zod schemas', () => {
      const models = [createMockModel({ id: 1, referenceName: 'BlogPost', displayName: 'Blog Post' })];
      const schemas = generator.generateContentZodSchemas(models);

      // Check that the main type export includes the generic depth parameter
      expect(schemas).toContain('export type BlogPostContent<D extends ContentLinkDepth = 1>');
      // Check that specific depth types are also generated
      expect(schemas).toContain('export type BlogPostContentDepth0');
      expect(schemas).toContain('export type BlogPostContentDepth2');
      // Verify the generic type uses the factory with proper type inference
      expect(schemas).toContain('z.infer<ReturnType<typeof BlogPostContentSchemaFactory<z.ZodLiteral<D>>>>');
    });

    it('should include common Zod schemas', () => {
      const models = [createMockModel({ id: 1, referenceName: 'BlogPost', displayName: 'Blog Post' })];
      const schemas = generator.generateContentZodSchemas(models);

      expect(schemas).toContain('export const AgilityImageSchema');
      expect(schemas).toContain('export const AgilityFileSchema');
      expect(schemas).toContain('export const AgilityLinkSchema');
      expect(schemas).toContain('export const AgilityContentReferenceSchema');
      expect(schemas).toContain('export const AgilityContentItemSchema');
    });
  });

  describe('generateContainerTypeMapping', () => {
    it('should generate container-to-content-type mapping', () => {
      const models = [createMockModel({ id: 1, referenceName: 'BlogPost', displayName: 'Blog Post' })];
      const containers = [createMockContainer({ referenceName: 'BlogPosts', contentDefinitionID: 1 })];
      const mapping = generator.generateContainerTypeMapping(models, containers);

      expect(mapping).toContain('export const ContainerTypeMapping');
      expect(mapping).toContain('"blogposts": "BlogPostContent"');
      expect(mapping).toContain('export type ContainerContentType');
    });

    it('should generate depth-aware mapping', () => {
      const models = [createMockModel({ id: 1, referenceName: 'BlogPost', displayName: 'Blog Post' })];
      const containers = [createMockContainer({ referenceName: 'BlogPosts', contentDefinitionID: 1 })];
      const mapping = generator.generateContainerTypeMapping(models, containers);

      expect(mapping).toContain('export interface DepthAwareContainerMapping');
      expect(mapping).toContain('depth0: ContentAtDepth');
      expect(mapping).toContain('depth1: ContentAtDepth');
      expect(mapping).toContain('export function getContainerContentTypeAtDepth');
    });
  });

  describe('validateModelContainerRelationships', () => {
    it('should validate correct model-container relationships', () => {
      const models = [createMockModel({ id: 1, referenceName: 'BlogPost', displayName: 'Blog Post' })];
      const containers = [createMockContainer({ referenceName: 'BlogPosts', contentDefinitionID: 1 })];

      const validation = generator.validateModelContainerRelationships(models, containers);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid model references', () => {
      const models = [createMockModel({ id: 1, referenceName: 'BlogPost', displayName: 'Blog Post' })];
      const invalidContainer = createMockContainer({
        referenceName: 'BlogPosts',
        contentDefinitionID: 999, // Non-existent model ID
      });

      const validation = generator.validateModelContainerRelationships(models, [invalidContainer]);

      expect(validation.valid).toBe(false);
      expect(validation.errors[0]).toContain('references non-existent model ID: 999');
    });

    it('should detect invalid field references', () => {
      const models = [createMockModel({ id: 1, referenceName: 'BlogPost', displayName: 'Blog Post' })];
      const invalidContainer = createMockContainer({
        referenceName: 'BlogPosts',
        contentDefinitionID: 1,
        columns: [createMockContentViewColumn({
          fieldName: 'nonExistentField',
          label: 'Non-existent Field',
          sortOrder: 1,
          isDefaultSort: false,
          sortDirection: 'ASC',
          typeName: 'Text',
        })],
      });

      const validation = generator.validateModelContainerRelationships(models, [invalidContainer]);

      expect(validation.valid).toBe(false);
      expect(validation.errors[0]).toContain('references non-existent field: nonExistentField');
    });

    it('should handle system fields as warnings', () => {
      const models = [createMockModel({ id: 1, referenceName: 'BlogPost', displayName: 'Blog Post' })];
      const containerWithSystemField = createMockContainer({
        referenceName: 'BlogPosts',
        contentDefinitionID: 1,
        columns: [createMockContentViewColumn({
          fieldName: 'state',
          label: 'State',
          sortOrder: 1,
          isDefaultSort: false,
          sortDirection: 'ASC',
          typeName: 'Text',
        })],
      });

      const validation = generator.validateModelContainerRelationships(models, [containerWithSystemField]);

      expect(validation.valid).toBe(true);
      expect(validation.warnings[0]).toContain('uses system field: state');
    });
  });
});
