import { TypeGenerationService } from '../TypeGenerationService';
import { GenerationConfig } from '../types';
import { fileOperations } from '../../../fileOperations';
import { createMockModel, createMockContainer, createMockModelField } from '../../../__tests__/test-helpers';
import { jest } from '@jest/globals';

// Mock the file operations
jest.mock('../../../fileOperations', () => ({
  fileOperations: jest.fn().mockImplementation(() => ({
    readDirectory: jest.fn(),
    createBaseFolder: jest.fn(),
    createFile: jest.fn(),
  })),
}));

// Mock all the generator services
jest.mock('../ModelLoader');
jest.mock('../ValidationService');
jest.mock('../TypeScriptInterfaceGenerator');
jest.mock('../ZodSchemaGenerator');
jest.mock('../ContentModuleGenerator');
jest.mock('../ContainerMappingGenerator');

describe('TypeGenerationService', () => {
  let service: TypeGenerationService;
  let mockFileOps: jest.Mocked<fileOperations>;
  let mockConfig: GenerationConfig;

  beforeEach(() => {
    mockFileOps = {
      readDirectory: jest.fn(),
      createBaseFolder: jest.fn(),
      createFile: jest.fn(),
    } as any;

    mockConfig = {
      format: 'both',
      outputDir: './test-output',
      sourceFolder: './test-source',
      includeDepthAware: true,
      includeContentModules: true,
    };

    service = new TypeGenerationService(mockFileOps);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateTypes', () => {
    it('should successfully generate types with valid data', async () => {
      const mockModels = [
        createMockModel({
          id: 1,
          referenceName: 'BlogPost',
          fields: [createMockModelField({ name: 'title', type: 'Text', isDataField: true })],
        }),
      ];

      const mockContainers = [
        createMockContainer({
          referenceName: 'BlogPosts',
          contentDefinitionID: 1,
        }),
      ];

      // Mock successful data loading
      const { ModelLoader } = require('../ModelLoader');
      const mockLoader = {
        loadAll: jest.fn<any, any>().mockResolvedValue({
          models: { items: mockModels, errors: [], warnings: [] },
          containers: { items: mockContainers, errors: [], warnings: [] },
          contentModules: { items: [], errors: [], warnings: [] },
        }),
      } as any;
      ModelLoader.mockImplementation(() => mockLoader);

      // Mock successful validation
      const { ValidationService } = require('../ValidationService');
      const mockValidator = {
        validateModelContainerRelationships: jest.fn().mockReturnValue({
          valid: true,
          errors: [],
          warnings: [],
        }),
        validateContentReferences: jest.fn().mockReturnValue({
          valid: true,
          errors: [],
          warnings: [],
        }),
        validateGenerationRequirements: jest.fn().mockReturnValue({
          valid: true,
          errors: [],
          warnings: [],
        }),
      };
      ValidationService.mockImplementation(() => mockValidator);

      // Mock generators
      const { TypeScriptInterfaceGenerator } = require('../TypeScriptInterfaceGenerator');
      const mockTsGenerator = {
        generate: jest.fn().mockReturnValue([
          { path: 'content-types.ts', content: 'export interface BlogPost {}', type: 'typescript' },
        ]),
      };
      TypeScriptInterfaceGenerator.mockImplementation(() => mockTsGenerator);

      const { ZodSchemaGenerator } = require('../ZodSchemaGenerator');
      const mockZodGenerator = {
        generate: jest.fn().mockReturnValue([
          { path: 'content-schemas.ts', content: 'export const BlogPostSchema = z.object({});', type: 'zod' },
        ]),
      };
      ZodSchemaGenerator.mockImplementation(() => mockZodGenerator);

      const { ContainerMappingGenerator } = require('../ContainerMappingGenerator');
      const mockMappingGenerator = {
        generate: jest.fn().mockReturnValue([
          { path: 'container-mapping.ts', content: 'export const mapping = {};', type: 'mapping' },
        ]),
      };
      ContainerMappingGenerator.mockImplementation(() => mockMappingGenerator);

      const { ContentModuleGenerator } = require('../ContentModuleGenerator');
      const mockModuleGenerator = {
        generate: jest.fn().mockReturnValue([]),
      };
      ContentModuleGenerator.mockImplementation(() => mockModuleGenerator);

      const result = await service.generateTypes(mockConfig);

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.filesGenerated).toHaveLength(4); // 3 generated files + 1 report
      expect(result.summary.modelsCount).toBe(1);
      expect(result.summary.containersCount).toBe(1);
      expect(result.summary.validationResult.valid).toBe(true);

      // Verify file operations
      expect(mockFileOps.createBaseFolder).toHaveBeenCalledWith('./test-output');
      expect(mockFileOps.createFile).toHaveBeenCalledWith(
        expect.stringContaining('content-types.ts'),
        expect.any(String)
      );
    });

    it('should handle case with no models found', async () => {
      // Mock empty data loading
      const { ModelLoader } = require('../ModelLoader');
      const mockLoader = {
        loadAll: jest.fn<any, any>().mockResolvedValue({
          models: { items: [], errors: [], warnings: [] },
          containers: { items: [], errors: [], warnings: [] },
          contentModules: { items: [], errors: [], warnings: [] },
        }),
      } as any;
      ModelLoader.mockImplementation(() => mockLoader);

      const result = await service.generateTypes(mockConfig);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('No models found in the specified folder');
      expect(result.summary.modelsCount).toBe(0);
    });

    it('should handle validation errors gracefully', async () => {
      const mockModels = [
        createMockModel({
          id: 1,
          referenceName: 'BlogPost',
        }),
      ];

      // Mock data loading with models
      const { ModelLoader } = require('../ModelLoader');
      const mockLoader = {
        loadAll: jest.fn<any, any>().mockResolvedValue({
          models: { items: mockModels, errors: [], warnings: [] },
          containers: { items: [], errors: [], warnings: [] },
          contentModules: { items: [], errors: [], warnings: [] },
        }),
      } as any;
      ModelLoader.mockImplementation(() => mockLoader);

      // Mock validation with errors
      const { ValidationService } = require('../ValidationService');
      const mockValidator = {
        validateModelContainerRelationships: jest.fn().mockReturnValue({
          valid: false,
          errors: ['Container references non-existent model'],
          warnings: [],
        }),
        validateContentReferences: jest.fn().mockReturnValue({
          valid: true,
          errors: [],
          warnings: [],
        }),
        validateGenerationRequirements: jest.fn().mockReturnValue({
          valid: true,
          errors: [],
          warnings: [],
        }),
      };
      ValidationService.mockImplementation(() => mockValidator);

      // Mock generators
      const { TypeScriptInterfaceGenerator } = require('../TypeScriptInterfaceGenerator');
      TypeScriptInterfaceGenerator.mockImplementation(() => ({
        generate: jest.fn().mockReturnValue([]),
      }));

      const { ZodSchemaGenerator } = require('../ZodSchemaGenerator');
      ZodSchemaGenerator.mockImplementation(() => ({
        generate: jest.fn().mockReturnValue([]),
      }));

      const { ContainerMappingGenerator } = require('../ContainerMappingGenerator');
      ContainerMappingGenerator.mockImplementation(() => ({
        generate: jest.fn().mockReturnValue([]),
      }));

      const { ContentModuleGenerator } = require('../ContentModuleGenerator');
      ContentModuleGenerator.mockImplementation(() => ({
        generate: jest.fn().mockReturnValue([]),
      }));

      const result = await service.generateTypes(mockConfig);

      expect(result.success).toBe(true); // Should still succeed
      expect(result.summary.validationResult.valid).toBe(false);
      expect(result.summary.validationResult.errors).toContain('Container references non-existent model');
    });

    it('should handle TypeScript-only generation', async () => {
      const configTypescriptOnly: GenerationConfig = {
        ...mockConfig,
        format: 'typescript',
      };

      const mockModels = [
        createMockModel({
          id: 1,
          referenceName: 'BlogPost',
        }),
      ];

      // Mock data loading
      const { ModelLoader } = require('../ModelLoader');
      const mockLoader = {
        loadAll: jest.fn<any, any>().mockResolvedValue({
          models: { items: mockModels, errors: [], warnings: [] },
          containers: { items: [], errors: [], warnings: [] },
          contentModules: { items: [], errors: [], warnings: [] },
        }),
      } as any;
      ModelLoader.mockImplementation(() => mockLoader);

      // Mock validation
      const { ValidationService } = require('../ValidationService');
      ValidationService.mockImplementation(() => ({
        validateModelContainerRelationships: jest.fn().mockReturnValue({ valid: true, errors: [], warnings: [] }),
        validateContentReferences: jest.fn().mockReturnValue({ valid: true, errors: [], warnings: [] }),
        validateGenerationRequirements: jest.fn().mockReturnValue({ valid: true, errors: [], warnings: [] }),
      }));

      // Mock TypeScript generator
      const { TypeScriptInterfaceGenerator } = require('../TypeScriptInterfaceGenerator');
      const mockTsGenerator = {
        generate: jest.fn().mockReturnValue([
          { path: 'content-types.ts', content: 'export interface BlogPost {}', type: 'typescript' },
        ]),
      };
      TypeScriptInterfaceGenerator.mockImplementation(() => mockTsGenerator);

      // Mock other generators (should not be called)
      const { ZodSchemaGenerator } = require('../ZodSchemaGenerator');
      const mockZodGenerator = {
        generate: jest.fn().mockReturnValue([]),
      };
      ZodSchemaGenerator.mockImplementation(() => mockZodGenerator);

      const { ContainerMappingGenerator } = require('../ContainerMappingGenerator');
      ContainerMappingGenerator.mockImplementation(() => ({
        generate: jest.fn().mockReturnValue([]),
      }));

      const { ContentModuleGenerator } = require('../ContentModuleGenerator');
      ContentModuleGenerator.mockImplementation(() => ({
        generate: jest.fn().mockReturnValue([]),
      }));

      const result = await service.generateTypes(configTypescriptOnly);

      expect(result.success).toBe(true);
      expect(mockTsGenerator.generate).toHaveBeenCalled();
      expect(mockZodGenerator.generate).not.toHaveBeenCalled();
    });

    it('should handle errors during generation', async () => {
      // Mock data loading that throws an error
      const { ModelLoader } = require('../ModelLoader');
      const mockLoader = {
        loadAll: jest.fn<any, any>().mockRejectedValue(new Error('Failed to load data')),
      } as any;
      ModelLoader.mockImplementation(() => mockLoader);

      const result = await service.generateTypes(mockConfig);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Type generation failed: Failed to load data');
    });

    it('should generate content modules when present', async () => {
      const mockModels = [
        createMockModel({
          id: 1,
          referenceName: 'BlogPost',
        }),
      ];

      const mockContentModules = [
        createMockModel({
          id: 2,
          referenceName: 'HeroSection',
          contentDefinitionTypeName: 'Module',
        }),
      ];

      // Mock data loading with content modules
      const { ModelLoader } = require('../ModelLoader');
      const mockLoader = {
        loadAll: jest.fn<any, any>().mockResolvedValue({
          models: { items: mockModels, errors: [], warnings: [] },
          containers: { items: [], errors: [], warnings: [] },
          contentModules: { items: mockContentModules, errors: [], warnings: [] },
        }),
      } as any;
      ModelLoader.mockImplementation(() => mockLoader);

      // Mock validation
      const { ValidationService } = require('../ValidationService');
      ValidationService.mockImplementation(() => ({
        validateModelContainerRelationships: jest.fn().mockReturnValue({ valid: true, errors: [], warnings: [] }),
        validateContentReferences: jest.fn().mockReturnValue({ valid: true, errors: [], warnings: [] }),
        validateGenerationRequirements: jest.fn().mockReturnValue({ valid: true, errors: [], warnings: [] }),
      }));

      // Mock generators
      const { TypeScriptInterfaceGenerator } = require('../TypeScriptInterfaceGenerator');
      TypeScriptInterfaceGenerator.mockImplementation(() => ({
        generate: jest.fn().mockReturnValue([]),
      }));

      const { ZodSchemaGenerator } = require('../ZodSchemaGenerator');
      ZodSchemaGenerator.mockImplementation(() => ({
        generate: jest.fn().mockReturnValue([]),
      }));

      const { ContainerMappingGenerator } = require('../ContainerMappingGenerator');
      ContainerMappingGenerator.mockImplementation(() => ({
        generate: jest.fn().mockReturnValue([]),
      }));

      const { ContentModuleGenerator } = require('../ContentModuleGenerator');
      const mockModuleGenerator = {
        generate: jest.fn().mockReturnValue([
          { path: 'content-modules.ts', content: 'export interface HeroSectionProps {}', type: 'typescript' },
        ]),
      };
      ContentModuleGenerator.mockImplementation(() => mockModuleGenerator);

      const result = await service.generateTypes(mockConfig);

      expect(result.success).toBe(true);
      expect(result.summary.contentModulesCount).toBe(1);
      expect(mockModuleGenerator.generate).toHaveBeenCalled();
    });
  });
});