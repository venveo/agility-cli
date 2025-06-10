import { ValidationService } from '../ValidationService';
import { createMockModel, createMockContainer, createMockModelField, createMockContentViewColumn } from '../../../__tests__/test-helpers';

describe('ValidationService', () => {
  let validationService: ValidationService;

  beforeEach(() => {
    validationService = new ValidationService();
  });

  describe('validateModelContainerRelationships', () => {
    it('should validate correct relationships successfully', () => {
      const models = [
        createMockModel({
          id: 1,
          referenceName: 'BlogPost',
          fields: [
            createMockModelField({ name: 'title', type: 'Text', isDataField: true }),
            createMockModelField({ name: 'content', type: 'HTML', isDataField: true }),
          ],
        }),
      ];

      const containers = [
        createMockContainer({
          referenceName: 'BlogPosts',
          contentDefinitionID: 1,
          columns: [
            createMockContentViewColumn({ fieldName: 'title' }),
            createMockContentViewColumn({ fieldName: 'content' }),
          ],
        }),
      ];

      const result = validationService.validateModelContainerRelationships(models, containers);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should detect invalid model references', () => {
      const models = [
        createMockModel({ id: 1, referenceName: 'BlogPost' }),
      ];

      const containers = [
        createMockContainer({
          referenceName: 'BlogPosts',
          contentDefinitionID: 999, // Non-existent model ID
        }),
      ];

      const result = validationService.validateModelContainerRelationships(models, containers);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('references non-existent model ID: 999');
    });

    it('should detect invalid field references', () => {
      const models = [
        createMockModel({
          id: 1,
          referenceName: 'BlogPost',
          fields: [
            createMockModelField({ name: 'title', type: 'Text', isDataField: true }),
          ],
        }),
      ];

      const containers = [
        createMockContainer({
          referenceName: 'BlogPosts',
          contentDefinitionID: 1,
          columns: [
            createMockContentViewColumn({ fieldName: 'title' }), // Valid
            createMockContentViewColumn({ fieldName: 'nonExistentField' }), // Invalid
          ],
        }),
      ];

      const result = validationService.validateModelContainerRelationships(models, containers);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('references non-existent field: nonExistentField');
    });

    it('should handle system fields as warnings', () => {
      const models = [
        createMockModel({
          id: 1,
          referenceName: 'BlogPost',
          fields: [
            createMockModelField({ name: 'title', type: 'Text', isDataField: true }),
          ],
        }),
      ];

      const containers = [
        createMockContainer({
          referenceName: 'BlogPosts',
          contentDefinitionID: 1,
          columns: [
            createMockContentViewColumn({ fieldName: 'title' }), // Valid field
            createMockContentViewColumn({ fieldName: 'state' }), // System field
            createMockContentViewColumn({ fieldName: 'createdDate' }), // System field
          ],
        }),
      ];

      const result = validationService.validateModelContainerRelationships(models, containers);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(2);
      expect(result.warnings[0]).toContain('uses system field: state');
      expect(result.warnings[1]).toContain('uses system field: createdDate');
    });

    it('should handle containers without model reference', () => {
      const models = [
        createMockModel({ id: 1, referenceName: 'BlogPost' }),
      ];

      const containers = [
        createMockContainer({
          referenceName: 'BlogPosts',
          contentDefinitionID: undefined, // No model reference
        }),
      ];

      const result = validationService.validateModelContainerRelationships(models, containers);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('validateContentReferences', () => {
    it('should validate correct content references', () => {
      const blogPostModel = createMockModel({
        id: 1,
        referenceName: 'BlogPost',
        fields: [
          createMockModelField({
            name: 'relatedPosts',
            type: 'Content',
            settings: { ContentDefinition: 'BlogPost' },
          }),
        ],
      });

      const models = [blogPostModel];
      const modelsByReferenceName = new Map([['BlogPost', blogPostModel]]);

      const result = validationService.validateContentReferences(models, modelsByReferenceName);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid content references', () => {
      const models = [
        createMockModel({
          id: 1,
          referenceName: 'BlogPost',
          fields: [
            createMockModelField({
              name: 'relatedPosts',
              type: 'Content',
              settings: { ContentDefinition: 'NonExistentModel' },
            }),
          ],
        }),
      ];

      const modelsByReferenceName = new Map();

      const result = validationService.validateContentReferences(models, modelsByReferenceName);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('references non-existent content type: NonExistentModel');
    });

    it('should handle models without fields', () => {
      const models = [
        createMockModel({
          id: 1,
          referenceName: 'BlogPost',
          fields: undefined,
        }),
      ];

      const modelsByReferenceName = new Map();

      const result = validationService.validateContentReferences(models, modelsByReferenceName);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('validateGenerationRequirements', () => {
    it('should pass validation for well-formed data', () => {
      const models = [
        createMockModel({
          id: 1,
          referenceName: 'BlogPost',
          fields: [createMockModelField({ name: 'title' })],
        }),
      ];

      const containers = [
        createMockContainer({
          referenceName: 'BlogPosts',
          contentDefinitionID: 1,
        }),
      ];

      const contentModules = [
        createMockModel({
          id: 2,
          referenceName: 'HeroSection',
          contentDefinitionTypeName: 'Module',
        }),
      ];

      const result = validationService.validateGenerationRequirements(models, containers, contentModules);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should warn about models without reference names', () => {
      const models = [
        createMockModel({
          id: 1,
          referenceName: 'BlogPost',
          fields: [createMockModelField({ name: 'title' })],
        }),
        createMockModel({
          id: 2,
          referenceName: undefined, // Missing reference name
          fields: [createMockModelField({ name: 'title' })],
        }),
      ];

      const result = validationService.validateGenerationRequirements(models, [], []);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('models without reference names will be skipped');
    });

    it('should warn about models without fields', () => {
      const models = [
        createMockModel({
          id: 1,
          referenceName: 'BlogPost',
          fields: [], // No fields
        }),
      ];

      const result = validationService.validateGenerationRequirements(models, [], []);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('models have no fields');
    });

    it('should detect duplicate reference names', () => {
      const models = [
        createMockModel({
          id: 1,
          referenceName: 'BlogPost',
          fields: [createMockModelField({ name: 'title' })],
        }),
        createMockModel({
          id: 2,
          referenceName: 'BlogPost', // Duplicate reference name
          fields: [createMockModelField({ name: 'content' })],
        }),
      ];

      const result = validationService.validateGenerationRequirements(models, [], []);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Duplicate model reference names found: BlogPost');
    });

    it('should warn about containers without reference names', () => {
      const containers = [
        createMockContainer({
          referenceName: 'BlogPosts',
          contentDefinitionID: 1,
        }),
        createMockContainer({
          referenceName: undefined, // Missing reference name
          contentDefinitionID: 2,
        }),
      ];

      const result = validationService.validateGenerationRequirements([], containers, []);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('containers without reference names will be skipped');
    });
  });
});