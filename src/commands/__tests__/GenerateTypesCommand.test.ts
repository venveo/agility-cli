import { GenerateTypesCommand } from '../GenerateTypesCommand';
import { ZodSchemaGenerator } from '../../services/ZodSchemaGenerator';
import * as path from 'path';
import { jest } from '@jest/globals';

// Mock dependencies
jest.mock('../../services/ZodSchemaGenerator');
jest.mock('ansi-colors', () => ({
  cyan: jest.fn((str) => str),
  gray: jest.fn((str) => str),
  yellow: jest.fn((str) => str),
  red: jest.fn((str) => str),
  green: jest.fn((str) => str),
}));

// Mock inquirer
const mockPrompt = jest.fn() as jest.MockedFunction<any>;
jest.mock('inquirer', () => ({
  prompt: mockPrompt,
}));

const MockedZodSchemaGenerator = ZodSchemaGenerator as jest.MockedClass<typeof ZodSchemaGenerator>;

describe('GenerateTypesCommand', () => {
  let command: GenerateTypesCommand;
  let mockGenerator: jest.Mocked<ZodSchemaGenerator>;
  let mockContext: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock generator
    mockGenerator = {
      loadModels: jest.fn(),
      loadContainers: jest.fn(),
      generateContentTypeInterfaces: jest.fn(),
      generateContentZodSchemas: jest.fn(),
      generateContainerTypeMapping: jest.fn(),
      validateModelContainerRelationships: jest.fn(),
    } as any;

    MockedZodSchemaGenerator.mockImplementation(() => mockGenerator);

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
      const mockModels = [mockBlogPostModel];
      const mockContainers = [mockBlogPostsContainer];
      const mockValidation = { valid: true, errors: [], warnings: [] };

      mockGenerator.loadModels.mockReturnValue(mockModels);
      mockGenerator.loadContainers.mockReturnValue(mockContainers);
      mockGenerator.validateModelContainerRelationships.mockReturnValue(mockValidation);
      mockGenerator.generateContentTypeInterfaces.mockReturnValue('// TypeScript interfaces');
      mockGenerator.generateContainerTypeMapping.mockReturnValue('// Container mapping');

      await command.execute({
        folder: '.agility-files',
        output: './generated-types',
        format: 'typescript',
      });

      expect(mockGenerator.generateContentTypeInterfaces).toHaveBeenCalledWith(mockModels);
      expect(mockContext.fileOps.createFile).toHaveBeenCalledWith(
        path.join('./generated-types', 'content-types.ts'),
        '// TypeScript interfaces'
      );
      expect(mockGenerator.generateContentZodSchemas).not.toHaveBeenCalled();
    });

    it('should generate Zod schemas when format is "zod"', async () => {
      const mockModels = [mockBlogPostModel];
      const mockContainers = [mockBlogPostsContainer];
      const mockValidation = { valid: true, errors: [], warnings: [] };

      mockGenerator.loadModels.mockReturnValue(mockModels);
      mockGenerator.loadContainers.mockReturnValue(mockContainers);
      mockGenerator.validateModelContainerRelationships.mockReturnValue(mockValidation);
      mockGenerator.generateContentZodSchemas.mockReturnValue('// Zod schemas');
      mockGenerator.generateContainerTypeMapping.mockReturnValue('// Container mapping');

      await command.execute({
        folder: '.agility-files',
        output: './generated-types',
        format: 'zod',
      });

      expect(mockGenerator.generateContentZodSchemas).toHaveBeenCalledWith(mockModels);
      expect(mockContext.fileOps.createFile).toHaveBeenCalledWith(
        path.join('./generated-types', 'content-schemas.ts'),
        '// Zod schemas'
      );
      expect(mockGenerator.generateContentTypeInterfaces).not.toHaveBeenCalled();
    });

    it('should generate both TypeScript and Zod when format is "both"', async () => {
      const mockModels = [mockBlogPostModel];
      const mockContainers = [mockBlogPostsContainer];
      const mockValidation = { valid: true, errors: [], warnings: [] };

      mockGenerator.loadModels.mockReturnValue(mockModels);
      mockGenerator.loadContainers.mockReturnValue(mockContainers);
      mockGenerator.validateModelContainerRelationships.mockReturnValue(mockValidation);
      mockGenerator.generateContentTypeInterfaces.mockReturnValue('// TypeScript interfaces');
      mockGenerator.generateContentZodSchemas.mockReturnValue('// Zod schemas');
      mockGenerator.generateContainerTypeMapping.mockReturnValue('// Container mapping');

      await command.execute({
        folder: '.agility-files',
        output: './generated-types',
        format: 'both',
      });

      expect(mockGenerator.generateContentTypeInterfaces).toHaveBeenCalledWith(mockModels);
      expect(mockGenerator.generateContentZodSchemas).toHaveBeenCalledWith(mockModels);
      expect(mockContext.fileOps.createFile).toHaveBeenCalledWith(
        path.join('./generated-types', 'content-types.ts'),
        '// TypeScript interfaces'
      );
      expect(mockContext.fileOps.createFile).toHaveBeenCalledWith(
        path.join('./generated-types', 'content-schemas.ts'),
        '// Zod schemas'
      );
    });

    it('should use default values when no options provided', async () => {
      const mockModels = [mockBlogPostModel];
      const mockContainers = [mockBlogPostsContainer];
      const mockValidation = { valid: true, errors: [], warnings: [] };

      mockGenerator.loadModels.mockReturnValue(mockModels);
      mockGenerator.loadContainers.mockReturnValue(mockContainers);
      mockGenerator.validateModelContainerRelationships.mockReturnValue(mockValidation);
      mockGenerator.generateContentTypeInterfaces.mockReturnValue('// TypeScript interfaces');
      mockGenerator.generateContentZodSchemas.mockReturnValue('// Zod schemas');
      mockGenerator.generateContainerTypeMapping.mockReturnValue('// Container mapping');

      await command.execute({});

      expect(mockGenerator.loadModels).toHaveBeenCalledWith('.agility-files');
      expect(mockContext.fileOps.createBaseFolder).toHaveBeenCalledWith('./generated-types');
    });

    it('should handle no models found scenario', async () => {
      mockGenerator.loadModels.mockReturnValue([]);
      mockGenerator.loadContainers.mockReturnValue([]);

      mockPrompt.mockResolvedValue({ showPullHelp: false });

      await command.execute({});

      expect(mockGenerator.generateContentTypeInterfaces).not.toHaveBeenCalled();
      expect(mockGenerator.generateContentZodSchemas).not.toHaveBeenCalled();
    });

    it('should show pull help when user requests it', async () => {
      mockGenerator.loadModels.mockReturnValue([]);
      mockGenerator.loadContainers.mockReturnValue([]);

      mockPrompt.mockResolvedValue({ showPullHelp: true });

      const consoleSpy = jest.spyOn(console, 'log');

      await command.execute({});

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Pull Command Usage:'));
    });

    it('should handle validation errors', async () => {
      const mockModels = [mockBlogPostModel];
      const mockContainers = [mockBlogPostsContainer];
      const mockValidation = {
        valid: false,
        errors: ['Model-container mismatch'],
        warnings: [],
      };

      mockGenerator.loadModels.mockReturnValue(mockModels);
      mockGenerator.loadContainers.mockReturnValue(mockContainers);
      mockGenerator.validateModelContainerRelationships.mockReturnValue(mockValidation);

      mockPrompt.mockResolvedValue({ continue: false });

      await command.execute({});

      expect(mockGenerator.generateContentTypeInterfaces).not.toHaveBeenCalled();
    });

    it('should continue with validation errors if user confirms', async () => {
      const mockModels = [mockBlogPostModel];
      const mockContainers = [mockBlogPostsContainer];
      const mockValidation = {
        valid: false,
        errors: ['Model-container mismatch'],
        warnings: [],
      };

      mockGenerator.loadModels.mockReturnValue(mockModels);
      mockGenerator.loadContainers.mockReturnValue(mockContainers);
      mockGenerator.validateModelContainerRelationships.mockReturnValue(mockValidation);
      mockGenerator.generateContentTypeInterfaces.mockReturnValue('// TypeScript interfaces');
      mockGenerator.generateContentZodSchemas.mockReturnValue('// Zod schemas');
      mockGenerator.generateContainerTypeMapping.mockReturnValue('// Container mapping');

      mockPrompt.mockResolvedValue({ continue: true });

      await command.execute({});

      expect(mockGenerator.generateContentTypeInterfaces).toHaveBeenCalled();
      expect(mockGenerator.generateContentZodSchemas).toHaveBeenCalled();
    });

    it('should handle warnings without blocking generation', async () => {
      const mockModels = [mockBlogPostModel];
      const mockContainers = [mockBlogPostsContainer];
      const mockValidation = {
        valid: true,
        errors: [],
        warnings: ['System field warning'],
      };

      mockGenerator.loadModels.mockReturnValue(mockModels);
      mockGenerator.loadContainers.mockReturnValue(mockContainers);
      mockGenerator.validateModelContainerRelationships.mockReturnValue(mockValidation);
      mockGenerator.generateContentTypeInterfaces.mockReturnValue('// TypeScript interfaces');
      mockGenerator.generateContentZodSchemas.mockReturnValue('// Zod schemas');
      mockGenerator.generateContainerTypeMapping.mockReturnValue('// Container mapping');

      await command.execute({});

      expect(mockGenerator.generateContentTypeInterfaces).toHaveBeenCalled();
      expect(mockGenerator.generateContentZodSchemas).toHaveBeenCalled();
    });

    it('should generate summary report', async () => {
      const mockModels = [mockBlogPostModel];
      const mockContainers = [mockBlogPostsContainer];
      const mockValidation = { valid: true, errors: [], warnings: [] };

      mockGenerator.loadModels.mockReturnValue(mockModels);
      mockGenerator.loadContainers.mockReturnValue(mockContainers);
      mockGenerator.validateModelContainerRelationships.mockReturnValue(mockValidation);
      mockGenerator.generateContentTypeInterfaces.mockReturnValue('// TypeScript interfaces');
      mockGenerator.generateContentZodSchemas.mockReturnValue('// Zod schemas');
      mockGenerator.generateContainerTypeMapping.mockReturnValue('// Container mapping');

      await command.execute({});

      expect(mockContext.fileOps.createFile).toHaveBeenCalledWith(
        path.join('./generated-types', 'generation-report.md'),
        expect.stringContaining('# Agility CMS Type Generation Report')
      );
    });

    it('should handle execution errors gracefully', async () => {
      mockGenerator.loadModels.mockImplementation(() => {
        throw new Error('Failed to load models');
      });

      const consoleSpy = jest.spyOn(console, 'log');

      await command.execute({});

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Type generation failed:'),
        'Failed to load models'
      );
    });
  });

  describe('generateSummaryReport', () => {
    it('should generate a comprehensive summary report', () => {
      const mockModels = [mockBlogPostModel];
      const mockContainers = [mockBlogPostsContainer];
      const mockValidation = {
        valid: true,
        errors: [],
        warnings: ['System field warning'],
      };

      const report = command['generateSummaryReport'](mockModels, mockContainers, mockValidation);

      expect(report).toContain('# Agility CMS Type Generation Report');
      expect(report).toContain('**Models**: 1');
      expect(report).toContain('**Containers**: 1');
      expect(report).toContain('**Validation Status**: ✅ Valid');
      expect(report).toContain('**Warnings**: 1');
      expect(report).toContain('### Blog Post');
      expect(report).toContain('**Reference Name**: `BlogPost`');
      expect(report).toContain('⚠️ Warnings (System Fields):');
    });

    it('should handle validation errors in report', () => {
      const mockModels = [mockBlogPostModel];
      const mockContainers = [mockBlogPostsContainer];
      const mockValidation = {
        valid: false,
        errors: ['Model not found'],
        warnings: [],
      };

      const report = command['generateSummaryReport'](mockModels, mockContainers, mockValidation);

      expect(report).toContain('**Validation Status**: ❌ Errors Found');
      expect(report).toContain('❌ Validation errors found:');
      expect(report).toContain('- Model not found');
    });
  });
});

// Mock data (properly typed versions)
const mockBlogPostModel = {
  id: 1,
  lastModifiedDate: '2023-01-01T00:00:00Z',
  displayName: 'Blog Post',
  referenceName: 'BlogPost',
  lastModifiedBy: 'test@example.com',
  lastModifiedAuthorID: 1,
  description: 'A blog post content type',
  allowTagging: true,
  contentDefinitionTypeName: 'Content',
  isPublished: true,
  wasUnpublished: false,
  fields: [
    {
      name: 'Title',
      label: 'Title',
      type: 'Text',
      settings: {},
      labelHelpDescription: '',
      itemOrder: 0,
      designerOnly: false,
      isDataField: true,
      editable: true,
      hiddenField: false,
      fieldID: '1',
      description: 'Blog post title',
    },
    {
      name: 'Content',
      label: 'Content',
      type: 'HTML',
      settings: {},
      labelHelpDescription: '',
      itemOrder: 1,
      designerOnly: false,
      isDataField: true,
      editable: true,
      hiddenField: false,
      fieldID: '2',
      description: 'Blog post content',
    },
  ],
};

const mockBlogPostsContainer = {
  columns: [
    {
      fieldName: 'Title',
      label: 'Title',
      sortOrder: 1,
      isDefaultSort: false,
      sortDirection: 'ASC' as const,
      typeName: 'Text',
    },
  ],
  contentViewID: 1,
  contentDefinitionID: 1,
  contentDefinitionName: 'BlogPost',
  referenceName: 'BlogPosts',
  contentViewName: 'Blog Posts',
  contentDefinitionType: 2,
  requiresApproval: false,
  lastModifiedDate: '2023-01-01T00:00:00Z',
  lastModifiedOn: '2023-01-01T00:00:00Z',
  lastModifiedBy: 'test@example.com',
  isShared: false,
  isDynamicPageList: false,
  disablePublishFromList: false,
  contentViewCategoryID: null,
  contentViewCategoryReferenceName: null,
  contentViewCategoryName: null,
  title: 'Blog Posts',
  defaultPage: null,
  isPublished: true,
  schemaTitle: 'Blog Posts',
  allowClientSideSave: false,
  defaultSortColumn: 'Title',
  defaultSortDirection: 'ASC',
  usageCount: 0,
  isDeleted: false,
  enableRSSOutput: false,
  enableAPIOutput: true,
  commentsRecordTypeName: null,
  numRowsInListing: 25,
  contentDefinitionTypeID: 2,
  fullSyncModDate: '2023-01-01T00:00:00Z',
  confirmSharingOnPublish: false,
  contentTemplateName: null,
  currentUserCanDelete: true,
  currentUserCanEdit: true,
  currentUserCanDesign: true,
  currentUserCanManage: true,
  currentUserCanContribute: true,
  currentUserCanPublish: true,
  defaultListingPage: null,
  defaultDetailsPage: null,
  defaultDetailsPageQueryString: '',
  isListItem: false,
};
