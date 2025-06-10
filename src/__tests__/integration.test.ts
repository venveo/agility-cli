import { ZodSchemaGenerator } from '../services/ZodSchemaGenerator';
import { GenerateTypesCommand } from '../commands/GenerateTypesCommand';
import {
  createMockModel,
  createMockModelField,
  createMockContainer,
  createMockContentViewColumn,
} from './test-helpers';
import * as fs from 'fs';
import * as path from 'path';
import { jest } from '@jest/globals';

describe('Type Generation Integration Tests', () => {
  const testOutputDir = './test-generated-types';
  let generator: ZodSchemaGenerator;
  let command: GenerateTypesCommand;

  beforeAll(() => {
    generator = new ZodSchemaGenerator();
    command = new GenerateTypesCommand();

    // Mock the context for the command
    command['context'] = {
      auth: {} as any,
      options: {} as any,
      multibar: {} as any,
      config: {} as any,
      fileOps: {
        createBaseFolder: jest.fn(),
        createFile: jest.fn(),
        exportFiles: jest.fn(),
        appendFiles: jest.fn(),
        createLogFile: jest.fn(),
        appendLogFile: jest.fn(),
        readDirectory: jest.fn().mockReturnValue([]) as any,
        readFile: jest.fn().mockReturnValue('') as any,
        checkFileExists: jest.fn().mockReturnValue(true) as any,
        fileExists: jest.fn().mockReturnValue(true) as any,
        deleteFile: jest.fn(),
        renameFile: jest.fn(),
        createFolder: jest.fn(),
        folderExists: jest.fn().mockReturnValue(true) as any,
        checkBaseFolderExists: jest.fn().mockReturnValue(true) as any,
        cliFolderExists: jest.fn().mockReturnValue(true) as any,
        codeFileExists: jest.fn().mockReturnValue(true) as any,
        cleanup: jest.fn(),
        downloadFile: jest.fn().mockImplementation(() => Promise.resolve()) as any,
        createTempFile: jest.fn().mockReturnValue('') as any,
        readTempFile: jest.fn().mockReturnValue('') as any,
      },
    };
  });

  afterAll(() => {
    // Clean up test files if they exist
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true, force: true });
    }
  });

  describe('End-to-End Type Generation', () => {
    it('should generate valid TypeScript interfaces from sample models', () => {
      const sampleModels = [
        createMockModel({
          id: 1,
          referenceName: 'BlogPost',
          displayName: 'Blog Post',
          fields: [
            createMockModelField({ name: 'Title', type: 'Text', fieldID: '1' }),
            createMockModelField({ name: 'Content', type: 'HTML', fieldID: '2' }),
            createMockModelField({ name: 'FeaturedImage', type: 'ImageAttachment', fieldID: '3' }),
            createMockModelField({ name: 'PublishedDate', type: 'DateTime', fieldID: '4' }),
            createMockModelField({ name: 'IsPublished', type: 'Boolean', fieldID: '5' }),
          ],
          description: 'A blog post content type',
        }),
      ];

      const interfaces = generator.generateContentTypeInterfaces(sampleModels);

      // Verify basic structure
      expect(interfaces).toContain('export interface BlogPostContentBase');
      expect(interfaces).toContain(
        'export interface BlogPostContent<D extends ContentLinkDepth = 1>'
      );

      // Verify field types
      expect(interfaces).toContain('title: string;');
      expect(interfaces).toContain('content: string;');
      expect(interfaces).toContain('featuredImage: AgilityImage;');
      expect(interfaces).toContain('publishedDate: string;');
      expect(interfaces).toContain('isPublished: boolean;');

      // Verify common types are included
      expect(interfaces).toContain('export interface AgilityImage');
      expect(interfaces).toContain('export interface AgilityContentItem');
    });

    it('should generate valid Zod schemas from sample models', () => {
      const sampleModels = [
        createMockModel({
          id: 1,
          referenceName: 'BlogPost',
          displayName: 'Blog Post',
          fields: [
            createMockModelField({ name: 'Title', type: 'Text', fieldID: '1' }),
            createMockModelField({ name: 'Content', type: 'HTML', fieldID: '2' }),
          ],
          description: 'A blog post content type',
        }),
      ];

      const schemas = generator.generateContentZodSchemas(sampleModels);

      // Verify import statement
      expect(schemas).toContain("import { z } from 'zod/v4';");

      // Verify schema generation
      expect(schemas).toContain('export const BlogPostContentBaseSchema');
      expect(schemas).toContain('export const BlogPostContentSchemaFactory');

      // Verify field schemas
      expect(schemas).toContain('title: z.string()');
      expect(schemas).toContain('content: z.string()');

      // Verify common schemas
      expect(schemas).toContain('export const AgilityImageSchema');
      expect(schemas).toContain('export const AgilityContentItemSchema');
    });

    it('should generate container mapping with proper type relationships', () => {
      const sampleModels = [
        createMockModel({
          id: 1,
          referenceName: 'BlogPost',
          displayName: 'Blog Post',
          fields: [createMockModelField({ name: 'Title', type: 'Text', fieldID: '1' })],
        }),
      ];

      const sampleContainers = [
        createMockContainer({
          contentDefinitionID: 1,
          referenceName: 'BlogPosts',
          title: 'Blog Posts',
          columns: [
            createMockContentViewColumn({ fieldName: 'Title', label: 'Title', sortOrder: 1 }),
          ],
        }),
      ];

      const mapping = generator.generateContainerTypeMapping(sampleModels, sampleContainers);

      // Verify mapping structure
      expect(mapping).toContain('export const ContainerTypeMapping');
      expect(mapping).toContain('"blogposts": "BlogPostContent"');

      // Verify depth-aware types
      expect(mapping).toContain('export interface DepthAwareContainerMapping');
      expect(mapping).toContain('depth0: ContentAtDepth');
      expect(mapping).toContain('depth1: ContentAtDepth');
    });

    it('should validate model-container relationships correctly', () => {
      const validModels = [
        createMockModel({
          id: 1,
          referenceName: 'BlogPost',
          fields: [
            createMockModelField({ name: 'Title', type: 'Text', fieldID: '1' }),
            createMockModelField({ name: 'Content', type: 'HTML', fieldID: '2' }),
          ],
        }),
      ];

      const validContainers = [
        createMockContainer({
          contentDefinitionID: 1,
          referenceName: 'BlogPosts',
          columns: [
            createMockContentViewColumn({ fieldName: 'Title', label: 'Title' }),
            createMockContentViewColumn({ fieldName: 'Content', label: 'Content' }),
          ],
        }),
      ];

      const validation = generator.validateModelContainerRelationships(
        validModels,
        validContainers
      );

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid relationships', () => {
      const models = [
        createMockModel({
          id: 1,
          referenceName: 'BlogPost',
          fields: [createMockModelField({ name: 'Title', type: 'Text', fieldID: '1' })],
        }),
      ];

      const invalidContainers = [
        createMockContainer({
          contentDefinitionID: 999, // Non-existent model
          referenceName: 'BlogPosts',
          columns: [
            createMockContentViewColumn({ fieldName: 'NonExistentField', label: 'Invalid Field' }),
          ],
        }),
      ];

      const validation = generator.validateModelContainerRelationships(models, invalidContainers);

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors[0]).toContain('references non-existent model ID: 999');
    });
  });

  describe('Complex Field Types', () => {
    it('should handle content reference fields', () => {
      const modelWithContentRef = createMockModel({
        id: 1,
        referenceName: 'Article',
        fields: [
          createMockModelField({
            name: 'RelatedPosts',
            type: 'Content',
            fieldID: '1',
            settings: {
              ContentDefinition: 'BlogPost',
              LinkedContentType: 'list',
            },
          }),
        ],
      });

      const interfaces = generator.generateContentTypeInterfaces([modelWithContentRef]);

      // Should generate content reference types
      expect(interfaces).toContain('relatedPosts:');
      expect(interfaces).toContain('AgilityContentReference');
    });

    it('should handle different field types correctly', () => {
      const modelWithVariousFields = createMockModel({
        id: 1,
        referenceName: 'ComplexModel',
        fields: [
          createMockModelField({ name: 'TextField', type: 'Text', fieldID: '1' }),
          createMockModelField({ name: 'NumberField', type: 'Number', fieldID: '2' }),
          createMockModelField({ name: 'BooleanField', type: 'Boolean', fieldID: '3' }),
          createMockModelField({ name: 'DateField', type: 'DateTime', fieldID: '4' }),
          createMockModelField({ name: 'ImageField', type: 'ImageAttachment', fieldID: '5' }),
          createMockModelField({ name: 'FileField', type: 'FileAttachment', fieldID: '6' }),
          createMockModelField({ name: 'LinkField', type: 'Link', fieldID: '7' }),
        ],
      });

      const interfaces = generator.generateContentTypeInterfaces([modelWithVariousFields]);

      expect(interfaces).toContain('textField: string;');
      expect(interfaces).toContain('numberField: number;');
      expect(interfaces).toContain('booleanField: boolean;');
      expect(interfaces).toContain('dateField: string;');
      expect(interfaces).toContain('imageField: AgilityImage;');
      expect(interfaces).toContain('fileField: AgilityFile;');
      expect(interfaces).toContain('linkField: AgilityLink;');
    });
  });
});
