# Type Generation Documentation

The Agility CLI type generation utility creates TypeScript interfaces and Zod schemas from your Agility CMS content models, with enhanced support for shallow and deep content references.

## Overview

The type generator analyzes your `.agility-files/models/` and `.agility-files/containers/` directories to produce:

- **TypeScript interfaces** for type-safe content access
- **Zod schemas** for runtime validation
- **Container mappings** for querying specific content types

## Key Features

### Shallow vs Deep Content Reference Support

Content fields in Agility CMS can return data in two formats depending on the content link depth:

#### Shallow References (Default)
When content link depth is 1 (default), related content returns as a reference:
```json
{
  "featuredProducts": {
    "referencename": "home_ourproducts_imagecard",
    "fulllist": true
  }
}
```

#### Deep References
When content link depth is greater than 1, related content returns as full objects:
```json
{
  "featuredProducts": [
    {
      "contentID": 42,
      "fields": {
        "title": "Product Title",
        "image": { "url": "...", "fileName": "..." }
      }
    }
  ]
}
```

## Usage

### Basic Type Generation

```bash
# Generate both TypeScript and Zod schemas
agility generate-types

# Generate only TypeScript interfaces
agility generate-types --format typescript

# Generate only Zod schemas
agility generate-types --format zod

# Specify custom output directory
agility generate-types --output ./types
```

### Generated Output Structure

The generator creates three main files:

1. **content-types.ts** - TypeScript interfaces
2. **content-schemas.ts** - Zod schemas
3. **container-mapping.ts** - Container-to-content-type mappings

## Type Generation Examples

### Input Model
```json
{
  "referenceName": "SectionOurProducts",
  "displayName": "Section Our Products",
  "fields": [
    {
      "name": "sectionTitle",
      "type": "Text",
      "isDataField": true
    },
    {
      "name": "featuredProducts",
      "type": "Content",
      "isDataField": true,
      "settings": {
        "ContentDefinition": "ImageCard",
        "LinkedContentType": "list"
      }
    }
  ]
}
```

### Generated TypeScript Interface
```typescript
export interface AgilityContentReference {
  referencename: string;
  fulllist?: boolean;
}

export interface SectionOurProductsContent {
  sectionTitle: string;
  // Union type handles both shallow and deep references
  featuredProducts: ImageCardContent[] | AgilityContentReference[];
}

export interface ImageCardContent {
  title: string;
  image: AgilityImage;
}
```

### Generated Zod Schema
```typescript
export const AgilityContentReferenceSchema = z.object({
  referencename: z.string(),
  fulllist: z.boolean().optional(),
});

export const SectionOurProductsContentSchema = z.object({
  sectionTitle: z.string(),
  // Union schema validates both formats
  featuredProducts: z.union([
    z.array(z.lazy(() => ImageCardContentSchema)),
    z.array(AgilityContentReferenceSchema)
  ]),
});
```

## Working with Generated Types

### Type Guards for Content References

Use type guards to differentiate between shallow and deep references:

```typescript
import { SectionOurProductsContent, AgilityContentReference, ImageCardContent } from './generated-types/content-types';

function isContentReference(item: any): item is AgilityContentReference {
  return typeof item === 'object' && 'referencename' in item;
}

function isImageCardArray(items: any): items is ImageCardContent[] {
  return Array.isArray(items) && items.length > 0 && 'title' in items[0];
}

// Usage in your code
function processProducts(content: SectionOurProductsContent) {
  if (isContentReference(content.featuredProducts)) {
    // Handle shallow reference
    console.log('Reference name:', content.featuredProducts.referencename);
    // Fetch full content using Agility SDK if needed
  } else if (isImageCardArray(content.featuredProducts)) {
    // Handle deep reference - full content loaded
    content.featuredProducts.forEach(product => {
      console.log('Product title:', product.title);
      console.log('Image URL:', product.image.url);
    });
  }
}
```

### Runtime Validation with Zod

```typescript
import { SectionOurProductsContentSchema } from './generated-types/content-schemas';

async function validateContent(rawData: unknown) {
  try {
    const validatedContent = SectionOurProductsContentSchema.parse(rawData);
    // Content is now type-safe and validated
    return validatedContent;
  } catch (error) {
    console.error('Content validation failed:', error);
    throw error;
  }
}
```

### Handling Both Reference Types

```typescript
import { getClient } from '@agility/content-sync';

async function getFullProducts(
  content: SectionOurProductsContent,
  client: any
): Promise<ImageCardContent[]> {
  
  // If we have full content, return it directly
  if (isImageCardArray(content.featuredProducts)) {
    return content.featuredProducts;
  }
  
  // If we have a reference, fetch the full content
  if (isContentReference(content.featuredProducts)) {
    const referenceName = content.featuredProducts.referencename;
    
    // Fetch the full content list using Agility SDK
    const fullContent = await client.getContentList({
      referenceName,
      depth: 2 // Increase depth to get full nested content
    });
    
    return fullContent.items;
  }
  
  return [];
}
```

## Best Practices

### 1. Handle Both Reference Types
Always account for both shallow and deep references in your code:

```typescript
// ✅ Good - handles both cases
function renderProducts(products: ImageCardContent[] | AgilityContentReference[]) {
  if (isContentReference(products)) {
    return <LoadingProducts referenceName={products.referencename} />;
  }
  return products.map(product => <ProductCard key={product.title} {...product} />);
}

// ❌ Bad - assumes full content is always loaded
function renderProducts(products: ImageCardContent[]) {
  return products.map(product => <ProductCard key={product.title} {...product} />);
}
```

### 2. Use Zod for API Responses
Validate content from the Agility API to catch data inconsistencies:

```typescript
import { z } from 'zod';
import { SectionOurProductsContentSchema } from './generated-types/content-schemas';

const ApiResponseSchema = z.object({
  items: z.array(z.object({
    fields: SectionOurProductsContentSchema,
    contentID: z.number(),
    properties: z.object({
      referenceName: z.string(),
      definitionName: z.string(),
    }),
  })),
});

async function fetchAndValidateContent(client: any, referenceName: string) {
  const response = await client.getContentList({ referenceName });
  return ApiResponseSchema.parse(response);
}
```

### 3. Leverage Container Mappings
Use generated container mappings for type-safe queries:

```typescript
import { ContainerTypeMapping, getContainerContentType } from './generated-types/container-mapping';

// Type-safe container querying
async function getTypedContent<T extends keyof typeof ContainerTypeMapping>(
  containerRef: T,
  client: any
) {
  const contentType = getContainerContentType(containerRef);
  const response = await client.getContentList({ referenceName: containerRef });
  
  // Response is now typed based on the container
  return response as { items: Array<{ fields: ContainerContentType<T> }> };
}

// Usage
const heroContent = await getTypedContent('home_hero', client);
// heroContent.items[0].fields is now typed as HeroHomepageContent
```

## Troubleshooting

### Common Issues

1. **Missing content types**: Ensure your models are properly synced in `.agility-files/models/`
2. **Validation errors**: Check that your content structure matches the generated schemas
3. **Reference resolution**: Verify that content definition names in field settings match model reference names

### Debugging Type Generation

```bash
# Verbose output to see what models are being processed
agility generate-types --verbose

# Check model validation
node -e "
const { ZodSchemaGenerator } = require('./dist/src/services/ZodSchemaGenerator.js');
const generator = new ZodSchemaGenerator();
const models = generator.loadModels();
console.log('Loaded models:', models.map(m => m.referenceName));
"
```

## Integration Examples

### Next.js Integration
```typescript
// lib/agility-types.ts
export * from '../generated-types/content-types';
export * from '../generated-types/content-schemas';

// components/ProductSection.tsx
import { SectionOurProductsContent } from '@/lib/agility-types';

interface Props {
  content: SectionOurProductsContent;
}

export function ProductSection({ content }: Props) {
  // Component implementation with full type safety
}
```

### React Query Integration
```typescript
import { useQuery } from '@tanstack/react-query';
import { SectionOurProductsContentSchema } from './generated-types/content-schemas';

function useProductSection(referenceName: string) {
  return useQuery({
    queryKey: ['content', referenceName],
    queryFn: async () => {
      const response = await agilityClient.getContentItem({ referenceName });
      return SectionOurProductsContentSchema.parse(response.fields);
    },
  });
}
```

## Advanced Configuration

### Custom Type Generation
For advanced use cases, you can extend the `ZodSchemaGenerator` class:

```typescript
import { ZodSchemaGenerator } from '@agility/cli/dist/src/services/ZodSchemaGenerator';

class CustomTypeGenerator extends ZodSchemaGenerator {
  // Override methods to customize type generation
  protected getTypeScriptType(field: any): string {
    if (field.type === 'Custom') {
      return 'MyCustomType';
    }
    return super.getTypeScriptType(field);
  }
}
```

This documentation provides comprehensive guidance for using the improved type generation utility with support for both shallow and deep content references.