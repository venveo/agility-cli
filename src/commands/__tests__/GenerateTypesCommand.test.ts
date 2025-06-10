import { GenerateTypesCommand } from '../GenerateTypesCommand';
import { TypeGenerationService } from '../../services/type-generation';
import * as path from 'path';
import { jest } from '@jest/globals';

// Mock dependencies
jest.mock('../../services/type-generation');
jest.mock('ansi-colors', () => ({
  cyan: jest.fn(str => str),
  gray: jest.fn(str => str),
  yellow: jest.fn(str => str),
  red: jest.fn(str => str),
  green: jest.fn(str => str),
}));

// Mock inquirer
const mockPrompt = jest.fn() as jest.MockedFunction<any>;
jest.mock('inquirer', () => ({
  prompt: mockPrompt,
}));

const MockedTypeGenerationService = TypeGenerationService as jest.MockedClass<typeof TypeGenerationService>;

describe('GenerateTypesCommand', () => {
  let command: GenerateTypesCommand;
  let mockTypeGenerationService: jest.Mocked<TypeGenerationService>;
  let mockContext: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock type generation service
    mockTypeGenerationService = {
      generateTypes: jest.fn(),
    } as any;

    MockedTypeGenerationService.mockImplementation(() => mockTypeGenerationService);

    // Mock context with file operations
    mockContext = {
      fileOps: {
        createBaseFolder: jest.fn(),
        createFile: jest.fn(),
        exportFiles: jest.fn(),
        appendFiles: jest.fn(),
        createLogFile: jest.fn(),
        appendLogFile: jest.fn(),
        readDirectory: jest.fn(),
        readFile: jest.fn(),
        writeFile: jest.fn(),
        directoryExists: jest.fn(),
        fileExists: jest.fn(),
        deleteFile: jest.fn(),
        deleteDirectory: jest.fn(),
        copyFile: jest.fn(),
        moveFile: jest.fn(),
        ensureDirectoryExists: jest.fn(),
        getFileStats: jest.fn(),
        listFiles: jest.fn(),
      },
    };

    command = new GenerateTypesCommand();
    command['context'] = mockContext;

    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('execute', () => {
    it('should generate TypeScript interfaces when format is "typescript"', async () => {
      const mockResult = {
        success: true,
        filesGenerated: ['./generated-types/content-types.ts', './generated-types/container-mapping.ts'],
        errors: [],
        warnings: [],
        summary: {
          modelsCount: 1,
          containersCount: 1,
          contentModulesCount: 0,
          validationResult: { valid: true, errors: [], warnings: [] },
          timestamp: '2023-01-01T00:00:00.000Z',
        },
      };

      mockTypeGenerationService.generateTypes.mockResolvedValue(mockResult);

      await command.execute({
        folder: '.agility-files',
        output: './generated-types',
        format: 'typescript',
      });

      expect(mockTypeGenerationService.generateTypes).toHaveBeenCalledWith({
        format: 'typescript',
        outputDir: './generated-types',
        sourceFolder: '.agility-files',
        includeDepthAware: true,
        includeContentModules: true,
      });
    });

    it('should generate Zod schemas when format is "zod"', async () => {
      const mockResult = {
        success: true,
        filesGenerated: ['./generated-types/content-schemas.ts', './generated-types/container-mapping.ts'],
        errors: [],
        warnings: [],
        summary: {
          modelsCount: 1,
          containersCount: 1,
          contentModulesCount: 0,
          validationResult: { valid: true, errors: [], warnings: [] },
          timestamp: '2023-01-01T00:00:00.000Z',
        },
      };

      mockTypeGenerationService.generateTypes.mockResolvedValue(mockResult);

      await command.execute({
        folder: '.agility-files',
        output: './generated-types',
        format: 'zod',
      });

      expect(mockTypeGenerationService.generateTypes).toHaveBeenCalledWith({
        format: 'zod',
        outputDir: './generated-types',
        sourceFolder: '.agility-files',
        includeDepthAware: true,
        includeContentModules: true,
      });
    });

    it('should generate both TypeScript and Zod when format is "both"', async () => {
      const mockResult = {
        success: true,
        filesGenerated: [
          './generated-types/content-types.ts',
          './generated-types/content-schemas.ts',
          './generated-types/container-mapping.ts',
        ],
        errors: [],
        warnings: [],
        summary: {
          modelsCount: 1,
          containersCount: 1,
          contentModulesCount: 0,
          validationResult: { valid: true, errors: [], warnings: [] },
          timestamp: '2023-01-01T00:00:00.000Z',
        },
      };

      mockTypeGenerationService.generateTypes.mockResolvedValue(mockResult);

      await command.execute({
        folder: '.agility-files',
        output: './generated-types',
        format: 'both',
      });

      expect(mockTypeGenerationService.generateTypes).toHaveBeenCalledWith({
        format: 'both',
        outputDir: './generated-types',
        sourceFolder: '.agility-files',
        includeDepthAware: true,
        includeContentModules: true,
      });
    });

    it('should use default values when no options provided', async () => {
      const mockResult = {
        success: true,
        filesGenerated: ['./generated-types/content-types.ts'],
        errors: [],
        warnings: [],
        summary: {
          modelsCount: 1,
          containersCount: 0,
          contentModulesCount: 0,
          validationResult: { valid: true, errors: [], warnings: [] },
          timestamp: '2023-01-01T00:00:00.000Z',
        },
      };

      mockTypeGenerationService.generateTypes.mockResolvedValue(mockResult);

      await command.execute({});

      expect(mockTypeGenerationService.generateTypes).toHaveBeenCalledWith({
        format: 'both',
        outputDir: './generated-types',
        sourceFolder: '.agility-files',
        includeDepthAware: true,
        includeContentModules: true,
      });
    });

    it('should handle no models found scenario', async () => {
      const mockResult = {
        success: false,
        filesGenerated: [],
        errors: ['No models found in the specified folder'],
        warnings: [],
        summary: {
          modelsCount: 0,
          containersCount: 0,
          contentModulesCount: 0,
          validationResult: { valid: false, errors: ['No models found'], warnings: [] },
          timestamp: '2023-01-01T00:00:00.000Z',
        },
      };

      mockTypeGenerationService.generateTypes.mockResolvedValue(mockResult);
      mockPrompt.mockResolvedValue({ showPullHelp: false });

      await command.execute({});

      expect(mockTypeGenerationService.generateTypes).toHaveBeenCalled();
    });

    it('should show pull help when user requests it', async () => {
      const mockResult = {
        success: false,
        filesGenerated: [],
        errors: ['No models found in the specified folder'],
        warnings: [],
        summary: {
          modelsCount: 0,
          containersCount: 0,
          contentModulesCount: 0,
          validationResult: { valid: false, errors: ['No models found'], warnings: [] },
          timestamp: '2023-01-01T00:00:00.000Z',
        },
      };

      mockTypeGenerationService.generateTypes.mockResolvedValue(mockResult);
      mockPrompt.mockResolvedValue({ showPullHelp: true });

      const consoleSpy = jest.spyOn(console, 'log');

      await command.execute({});

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Pull Command Usage:'));
    });

    it('should handle validation errors', async () => {
      const mockResult = {
        success: true,
        filesGenerated: ['./generated-types/content-types.ts'],
        errors: [],
        warnings: [],
        summary: {
          modelsCount: 1,
          containersCount: 1,
          contentModulesCount: 0,
          validationResult: {
            valid: false,
            errors: ['Model-container mismatch'],
            warnings: [],
          },
          timestamp: '2023-01-01T00:00:00.000Z',
        },
      };

      mockTypeGenerationService.generateTypes.mockResolvedValue(mockResult);
      mockPrompt.mockResolvedValue({ continue: false });

      await command.execute({});

      expect(mockTypeGenerationService.generateTypes).toHaveBeenCalled();
    });

    it('should handle warnings without blocking generation', async () => {
      const mockResult = {
        success: true,
        filesGenerated: ['./generated-types/content-types.ts'],
        errors: [],
        warnings: ['System field warning'],
        summary: {
          modelsCount: 1,
          containersCount: 1,
          contentModulesCount: 0,
          validationResult: {
            valid: true,
            errors: [],
            warnings: ['System field warning'],
          },
          timestamp: '2023-01-01T00:00:00.000Z',
        },
      };

      mockTypeGenerationService.generateTypes.mockResolvedValue(mockResult);

      await command.execute({});

      expect(mockTypeGenerationService.generateTypes).toHaveBeenCalled();
    });

    it('should handle execution errors gracefully', async () => {
      mockTypeGenerationService.generateTypes.mockRejectedValue(new Error('Failed to load models'));

      const consoleSpy = jest.spyOn(console, 'log');

      await command.execute({});

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Type generation failed:'),
        'Failed to load models'
      );
    });
  });
});
