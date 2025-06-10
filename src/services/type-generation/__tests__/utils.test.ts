import { StringUtils, FieldTypeResolver, CodeGenerationUtils } from '../utils';
import { createMockModel, createMockModelField } from '../../../__tests__/test-helpers';

describe('StringUtils', () => {
  describe('camelize', () => {
    it('should convert strings to camelCase', () => {
      expect(StringUtils.camelize('hello world')).toBe('helloWorld');
      expect(StringUtils.camelize('Hello World')).toBe('helloWorld');
      expect(StringUtils.camelize('HELLO_WORLD')).toBe('hELLO_WORLD');
      expect(StringUtils.camelize('hello-world')).toBe('hello-World'); // Capitalizes after dashes
    });

    it('should handle single words', () => {
      expect(StringUtils.camelize('hello')).toBe('hello');
      expect(StringUtils.camelize('Hello')).toBe('hello');
      expect(StringUtils.camelize('HELLO')).toBe('hELLO');
    });

    it('should handle empty strings', () => {
      expect(StringUtils.camelize('')).toBe('');
    });
  });

  describe('pascalCase', () => {
    it('should convert strings to PascalCase', () => {
      expect(StringUtils.pascalCase('hello world')).toBe('HelloWorld');
      expect(StringUtils.pascalCase('Hello World')).toBe('HelloWorld');
      expect(StringUtils.pascalCase('hello-world')).toBe('Hello-World');
    });

    it('should handle single words', () => {
      expect(StringUtils.pascalCase('hello')).toBe('Hello');
      expect(StringUtils.pascalCase('Hello')).toBe('Hello');
    });
  });

  describe('escapeDescription', () => {
    it('should escape special characters for JSDoc', () => {
      expect(StringUtils.escapeDescription('Simple text')).toBe('Simple text');
      expect(StringUtils.escapeDescription('Text with "quotes"')).toBe('Text with \\"quotes\\"');
      expect(StringUtils.escapeDescription("Text with 'quotes'")).toBe("Text with \\'quotes\\'");
      expect(StringUtils.escapeDescription('Text with */ end comment')).toBe('Text with *\\/ end comment');
    });

    it('should normalize whitespace', () => {
      expect(StringUtils.escapeDescription('Text\nwith\nnewlines')).toBe('Text with newlines');
      expect(StringUtils.escapeDescription('Text\twith\ttabs')).toBe('Text with tabs');
      expect(StringUtils.escapeDescription('Text   with   spaces')).toBe('Text with spaces');
    });

    it('should handle empty descriptions', () => {
      expect(StringUtils.escapeDescription('')).toBe('');
      expect(StringUtils.escapeDescription(null as any)).toBe('');
      expect(StringUtils.escapeDescription(undefined as any)).toBe('');
    });
  });
});

describe('FieldTypeResolver', () => {
  let resolver: FieldTypeResolver;

  beforeEach(() => {
    const mockModels = new Map([
      ['BlogPost', createMockModel({ referenceName: 'BlogPost' })],
      ['Category', createMockModel({ referenceName: 'Category' })],
    ]);
    resolver = new FieldTypeResolver(mockModels);
  });

  describe('resolveFieldType', () => {
    it('should resolve basic field types', () => {
      const textField = createMockModelField({ type: 'Text' });
      const result = resolver.resolveFieldType(textField);

      expect(result.baseType).toBe('string');
      expect(result.zodType).toBe('z.string()');
      expect(result.isArray).toBe(false);
      expect(result.isContentReference).toBe(false);
    });

    it('should resolve number field types', () => {
      const numberField = createMockModelField({ type: 'Number' });
      const result = resolver.resolveFieldType(numberField);

      expect(result.baseType).toBe('number');
      expect(result.zodType).toBe('z.number()');
      expect(result.isArray).toBe(false);
      expect(result.isContentReference).toBe(false);
    });

    it('should resolve boolean field types', () => {
      const booleanField = createMockModelField({ type: 'Boolean' });
      const result = resolver.resolveFieldType(booleanField);

      expect(result.baseType).toBe('boolean');
      expect(result.zodType).toBe('z.boolean()');
      expect(result.isArray).toBe(false);
      expect(result.isContentReference).toBe(false);
    });

    it('should resolve image attachment field types', () => {
      const imageField = createMockModelField({ type: 'ImageAttachment' });
      const result = resolver.resolveFieldType(imageField);

      expect(result.baseType).toBe('AgilityImage');
      expect(result.zodType).toBe('AgilityImageSchema');
      expect(result.isArray).toBe(false);
      expect(result.isContentReference).toBe(false);
    });

    it('should resolve attachment list field types', () => {
      const attachmentListField = createMockModelField({ type: 'AttachmentList' });
      const result = resolver.resolveFieldType(attachmentListField);

      expect(result.baseType).toBe('AgilityFile[]');
      expect(result.zodType).toBe('z.array(AgilityFileSchema)');
      expect(result.isArray).toBe(true);
      expect(result.isContentReference).toBe(false);
    });

    it('should resolve content reference field types', () => {
      const contentField = createMockModelField({
        type: 'Content',
        settings: { ContentDefinition: 'BlogPost' },
      });
      const result = resolver.resolveFieldType(contentField);

      expect(result.baseType).toBe('BlogPostContent');
      expect(result.zodType).toBe('BlogPostContentSchema');
      expect(result.isArray).toBe(false);
      expect(result.isContentReference).toBe(true);
      expect(result.referencedModel).toBe('BlogPost');
    });

    it('should detect array content reference fields', () => {
      const contentField = createMockModelField({
        type: 'Content',
        name: 'relatedItems', // Name suggests array
        settings: { 
          ContentDefinition: 'BlogPost',
          LinkedContentType: 'list', // Explicit list setting
        },
      });
      const result = resolver.resolveFieldType(contentField);

      expect(result.baseType).toBe('BlogPostContent[]');
      expect(result.zodType).toBe('z.array(BlogPostContentSchema)');
      expect(result.isArray).toBe(true);
      expect(result.isContentReference).toBe(true);
    });

    it('should handle content fields with unknown references', () => {
      const contentField = createMockModelField({
        type: 'Content',
        settings: { ContentDefinition: 'UnknownModel' },
      });
      const result = resolver.resolveFieldType(contentField);

      expect(result.baseType).toBe('AgilityContentReference');
      expect(result.zodType).toBe('AgilityContentReferenceSchema');
      expect(result.isArray).toBe(false);
      expect(result.isContentReference).toBe(true);
      expect(result.referencedModel).toBeUndefined();
    });

    it('should handle unknown field types', () => {
      const unknownField = createMockModelField({ type: 'UnknownType' as any });
      const result = resolver.resolveFieldType(unknownField);

      expect(result.baseType).toBe('any');
      expect(result.zodType).toBe('z.any()');
      expect(result.isArray).toBe(false);
      expect(result.isContentReference).toBe(false);
    });
  });
});

describe('CodeGenerationUtils', () => {
  describe('generateTypeHeader', () => {
    it('should generate header with timestamp', () => {
      const header = CodeGenerationUtils.generateTypeHeader();
      
      expect(header).toContain('Generated TypeScript interfaces for Agility CMS content');
      expect(header).toContain('Generated on:');
      expect(header).toContain('Common Agility CMS types');
    });

    it('should generate header without imports when specified', () => {
      const header = CodeGenerationUtils.generateTypeHeader(false);
      
      expect(header).toContain('Generated TypeScript interfaces for Agility CMS content');
      expect(header).not.toContain('Common Agility CMS types');
    });
  });

  describe('generateSchemaHeader', () => {
    it('should generate Zod schema header', () => {
      const header = CodeGenerationUtils.generateSchemaHeader();
      
      expect(header).toContain("import { z } from 'zod/v4';");
      expect(header).toContain('Generated Zod schemas for Agility CMS content');
      expect(header).toContain('Generated on:');
    });
  });

  describe('generateFieldComment', () => {
    it('should generate JSDoc comment for field with description', () => {
      const field = createMockModelField({
        description: 'This is a test field',
      });
      
      const comment = CodeGenerationUtils.generateFieldComment(field);
      
      expect(comment).toBe('  /** This is a test field */\n');
    });

    it('should generate JSDoc comment for field with label when no description', () => {
      const field = createMockModelField({
        description: '',
        label: 'Test Label',
      });
      
      const comment = CodeGenerationUtils.generateFieldComment(field);
      
      expect(comment).toBe('  /** Test Label */\n');
    });

    it('should return empty string when no description or label', () => {
      const field = createMockModelField({
        description: '',
        label: '',
      });
      
      const comment = CodeGenerationUtils.generateFieldComment(field);
      
      expect(comment).toBe('');
    });

    it('should escape special characters in comments', () => {
      const field = createMockModelField({
        description: 'Field with "quotes" and */ comment end',
      });
      
      const comment = CodeGenerationUtils.generateFieldComment(field);
      
      expect(comment).toContain('\\"quotes\\"');
      expect(comment).toContain('*\\/');
    });
  });
});