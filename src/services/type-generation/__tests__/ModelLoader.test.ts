import { ModelLoader } from '../ModelLoader';
import { fileOperations } from '../../../fileOperations';
import { jest } from '@jest/globals';

// Mock file operations
jest.mock('../../../fileOperations', () => ({
  fileOperations: jest.fn().mockImplementation(() => ({
    readDirectory: jest.fn(),
  })),
}));

describe('ModelLoader', () => {
  let loader: ModelLoader;
  let mockFileOps: jest.Mocked<fileOperations>;

  beforeEach(() => {
    mockFileOps = {
      readDirectory: jest.fn(),
    } as any;
    
    loader = new ModelLoader(mockFileOps);
  });

  describe('loadModels', () => {
    it('should load and validate models successfully', async () => {
      const mockModels = [
        {
          id: 1,
          referenceName: 'BlogPost',
          displayName: 'Blog Post',
          fields: [
            {
              name: 'title',
              label: 'Title',
              type: 'Text',
              isDataField: true,
              settings: {},
            },
          ],
        },
        {
          id: 2,
          referenceName: 'Page',
          displayName: 'Page',
          fields: [],
        },
      ];

      mockFileOps.readDirectory.mockReturnValue([
        JSON.stringify(mockModels[0]),
        JSON.stringify(mockModels[1]),
      ]);

      const result = await loader.loadModels();

      expect(result.items).toHaveLength(2);
      expect(result.items[0].referenceName).toBe('BlogPost');
      expect(result.items[1].referenceName).toBe('Page');
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should handle invalid JSON gracefully', async () => {
      const validModel = {
        id: 1,
        referenceName: 'BlogPost',
        displayName: 'Blog Post',
        fields: [],
      };

      mockFileOps.readDirectory.mockReturnValue([
        JSON.stringify(validModel),
        'invalid json content',
      ]);

      const result = await loader.loadModels();

      expect(result.items).toHaveLength(1);
      expect(result.items[0].referenceName).toBe('BlogPost');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Invalid JSON in model file');
    });

    it('should handle validation errors gracefully', async () => {
      const validModel = {
        id: 1,
        referenceName: 'BlogPost',
        displayName: 'Blog Post',
        fields: [],
      };

      const invalidModel = {
        // Missing required fields
        invalidField: 'invalid',
      };

      mockFileOps.readDirectory.mockReturnValue([
        JSON.stringify(validModel),
        JSON.stringify(invalidModel),
      ]);

      const result = await loader.loadModels();

      expect(result.items).toHaveLength(2); // Both models are loaded due to .passthrough()
      expect(result.items[0].referenceName).toBe('BlogPost');
      expect(result.errors).toHaveLength(0); // No validation errors with .passthrough()
    });

    it('should handle missing directory gracefully', async () => {
      mockFileOps.readDirectory.mockImplementation(() => {
        throw new Error('Directory not found');
      });

      const result = await loader.loadModels();

      expect(result.items).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('No models found');
    });
  });

  describe('loadContainers', () => {
    it('should load and validate containers successfully', async () => {
      const mockContainers = [
        {
          referenceName: 'BlogPosts',
          contentDefinitionID: 1,
          title: 'Blog Posts',
          columns: [
            {
              fieldName: 'title',
              label: 'Title',
              sortOrder: 1,
            },
          ],
        },
      ];

      mockFileOps.readDirectory.mockReturnValue([
        JSON.stringify(mockContainers[0]),
      ]);

      const result = await loader.loadContainers();

      expect(result.items).toHaveLength(1);
      expect(result.items[0].referenceName).toBe('BlogPosts');
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should handle container validation errors', async () => {
      const invalidContainer = {
        // Missing required fields
        invalidField: 'invalid',
      };

      mockFileOps.readDirectory.mockReturnValue([
        JSON.stringify(invalidContainer),
      ]);

      const result = await loader.loadContainers();

      expect(result.items).toHaveLength(1); // Container is loaded due to .passthrough()
      expect(result.errors).toHaveLength(0); // No validation errors with .passthrough()
    });
  });

  describe('loadContentModules', () => {
    it('should load content modules and filter by type', async () => {
      const mockModels = [
        {
          id: 1,
          referenceName: 'HeroSection',
          displayName: 'Hero Section',
          contentDefinitionTypeName: 'Module',
          fields: [],
        },
        {
          id: 2,
          referenceName: 'HomePage',
          displayName: 'Home Page',
          contentDefinitionTypeName: 'Page',
          fields: [],
        },
      ];

      mockFileOps.readDirectory.mockReturnValue([
        JSON.stringify(mockModels[0]),
        JSON.stringify(mockModels[1]),
      ]);

      const result = await loader.loadContentModules();

      // Should only return modules, not pages
      expect(result.items).toHaveLength(1);
      expect(result.items[0].referenceName).toBe('HeroSection');
      expect(result.items[0].contentDefinitionTypeName).toBe('Module');
    });

    it('should return empty array when no modules found', async () => {
      const mockModels = [
        {
          id: 1,
          referenceName: 'HomePage',
          displayName: 'Home Page',
          contentDefinitionTypeName: 'Page',
          fields: [],
        },
      ];

      mockFileOps.readDirectory.mockReturnValue([
        JSON.stringify(mockModels[0]),
      ]);

      const result = await loader.loadContentModules();

      expect(result.items).toHaveLength(0);
    });
  });

  describe('loadAll', () => {
    it('should load all data types concurrently', async () => {
      const mockModel = {
        id: 1,
        referenceName: 'BlogPost',
        displayName: 'Blog Post',
        fields: [],
      };

      const mockContainer = {
        referenceName: 'BlogPosts',
        contentDefinitionID: 1,
        title: 'Blog Posts',
        columns: [],
      };

      const mockModule = {
        id: 3,
        referenceName: 'HeroSection',
        displayName: 'Hero Section',
        contentDefinitionTypeName: 'Module',
        fields: [],
      };

      // Mock different responses for different directories
      mockFileOps.readDirectory
        .mockReturnValueOnce([JSON.stringify(mockModel)])
        .mockReturnValueOnce([JSON.stringify(mockContainer)])
        .mockReturnValueOnce([JSON.stringify(mockModule)]);

      const result = await loader.loadAll();

      expect(result.models.items).toHaveLength(1);
      expect(result.containers.items).toHaveLength(1);
      expect(result.contentModules.items).toHaveLength(1);
      
      expect(result.models.items[0].referenceName).toBe('BlogPost');
      expect(result.containers.items[0].referenceName).toBe('BlogPosts');
      expect(result.contentModules.items[0].referenceName).toBe('HeroSection');
    });

    it('should handle mixed success and failure scenarios', async () => {
      const mockModel = {
        id: 1,
        referenceName: 'BlogPost',
        displayName: 'Blog Post',
        fields: [],
      };

      // First call (models) succeeds
      // Second call (containers) fails
      // Third call (contentModules) succeeds but empty
      mockFileOps.readDirectory
        .mockReturnValueOnce([JSON.stringify(mockModel)])
        .mockImplementationOnce(() => {
          throw new Error('Containers directory not found');
        })
        .mockReturnValueOnce([]);

      const result = await loader.loadAll();

      expect(result.models.items).toHaveLength(1);
      expect(result.containers.items).toHaveLength(0);
      expect(result.contentModules.items).toHaveLength(0);
      
      expect(result.models.errors).toHaveLength(0);
      expect(result.containers.warnings).toHaveLength(1);
      expect(result.containers.warnings[0]).toContain('No containers found');
    });
  });
});