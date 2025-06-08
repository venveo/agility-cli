# Development Guide

This guide covers the development workflow for the Agility CLI project.

## Prerequisites

- Node.js (v18 or higher)
- Yarn (v4.9.2 or higher)
- TypeScript knowledge

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   yarn install
   ```

## Development Workflow

### Building the Project

The project uses TypeScript and compiles to the `dist/` directory.

```bash
# Clean and build
yarn build

# Clean only
yarn clean
```

**Important**: The `prebuild` script automatically cleans the `dist/` directory before building to prevent TypeScript compilation conflicts.

### Type Generation

The CLI includes a type generation feature that creates TypeScript interfaces and Zod schemas from Agility CMS models.

```bash
# Generate types (requires built project)
yarn generate-types

# Build and generate types in one command
yarn generate-types:dev

# Full development workflow
yarn dev
```

### Testing

```bash
# Run all tests
yarn test

# Run tests in watch mode
yarn test:watch

# Run tests with coverage
yarn test:coverage
```

### Code Quality

```bash
# Lint TypeScript files
yarn lint

# Fix linting issues
yarn lint:fix

# Format code
yarn format

# Check formatting
yarn format:check
```

## Project Structure

```
src/
├── commands/           # CLI command implementations
├── services/          # Business logic services
├── models/           # Type definitions
├── base/             # Base classes
└── __tests__/        # Test files

generated-types/      # Generated TypeScript/Zod files
dist/                # Compiled JavaScript output
docs/                # Documentation
```

## Common Issues

### Build Errors

**"Cannot write file because it would overwrite input file"**
- This occurs when the `dist/` directory contains files that conflict with TypeScript compilation
- Solution: Run `yarn clean` before building, or use `yarn build` (which includes prebuild cleaning)

**TypeScript compilation errors**
- Ensure you're using the correct TypeScript version (^5.8.3)
- Check that `tsconfig.json` includes/excludes are properly configured
- Verify that generated types are excluded from compilation

### Type Generation Issues

**No models found**
- Ensure you have run `agility pull` to download models from your Agility CMS instance
- Check that `.agility-files/models/` directory exists and contains JSON files
- Verify your Agility CMS authentication

**Generated types are outdated**
- Run `yarn generate-types:dev` to rebuild and regenerate types
- Check the generation timestamp in generated files

## Development Scripts Reference

| Script | Description |
|--------|-------------|
| `yarn clean` | Remove dist directory |
| `yarn build` | Clean and compile TypeScript |
| `yarn generate-types` | Generate types from models |
| `yarn generate-types:dev` | Build and generate types |
| `yarn dev` | Full development workflow |
| `yarn test` | Run tests |
| `yarn lint` | Check code quality |
| `yarn format` | Format code |

## Contributing

1. Follow the existing code style
2. Add tests for new features
3. Update documentation as needed
4. Ensure all scripts pass before submitting PR

## Troubleshooting

If you encounter issues:

1. Clean and rebuild: `yarn clean && yarn build`
2. Check TypeScript version compatibility
3. Verify Node.js version (v18+)
4. Check for conflicting global packages
5. Review the error logs for specific issues

For type generation issues, see [TYPE_GENERATION.md](./TYPE_GENERATION.md).
