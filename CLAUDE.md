# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Build and Development
- `yarn build` - Compile TypeScript to JavaScript in dist/ folder
- `tsc` - Direct TypeScript compilation
- `yarn prepare` - Runs build automatically before publishing

### Code Quality
- `yarn lint` - Run ESLint to check for code issues
- `yarn lint:fix` - Auto-fix linting issues where possible
- `yarn format` - Format code with Prettier
- `yarn format:check` - Check if code is properly formatted

### Type Generation
- `agility generate-types` - Generate TypeScript types and Zod schemas from models
- `agility generate-types --format typescript` - Generate only TypeScript interfaces
- `agility generate-types --format zod` - Generate only Zod schemas
- `agility generate-types --output ./types` - Specify custom output directory

### CLI Testing
- Install locally: `npm link` or `yarn link` to test CLI commands
- Global install: `npm i @agility/cli -g` or `yarn global add @agility/cli`

## Architecture Overview

This is the Agility CMS Management CLI - a Node.js/TypeScript tool for synchronizing content, models, and assets between Agility CMS instances. The CLI implements a sophisticated content migration system with dependency resolution and multi-region support.

### Core Architecture Pattern

The CLI follows a **phased deployment pattern**:
1. **Authentication** - OAuth device flow with multi-region endpoint detection
2. **Sync/Pull** - Download source instance data to `.agility-files/` directory  
3. **Push** - Deploy to target instance in dependency order: assets → models → containers → content → templates → pages

### Key Classes and Responsibilities

#### Core Infrastructure
- **BaseCommand** (`src/base/BaseCommand.ts`) - Base class for all CLI commands with shared authentication and validation
- **ConfigService** (`src/config.ts`) - Centralized configuration management for API endpoints and settings

#### Business Logic
- **Auth** (`src/auth.ts`) - OAuth flow, user permissions, multi-region API endpoints
- **Sync** (`src/sync.ts`) - Downloads content using Agility content-sync SDK
- **Push** (`src/push.ts`) - Complex deployment logic with dependency resolution and ID mapping
- **Model** (`src/model.ts`) - Content model operations and validation
- **FileOperations** (`src/fileOperations.ts`) - File system operations and JSON serialization
- **ModelSync** (`src/modelSync.ts`) - Model-specific synchronization operations

#### Services
- **ZodSchemaGenerator** (`src/services/ZodSchemaGenerator.ts`) - Generates TypeScript types and Zod schemas from Agility models and containers

#### Command Layer
- **LoginCommand** (`src/commands/LoginCommand.ts`) - Handles user authentication with instance validation
- **PullCommand** (`src/commands/PullCommand.ts`) - Implements instance pull functionality
- **PushCommand** (`src/commands/PushCommand.ts`) - Implements instance push functionality
- **GenerateTypesCommand** (`src/commands/GenerateTypesCommand.ts`) - Generates TypeScript types and Zod schemas

### Data Flow and Dependencies

The Push class manages complex dependency resolution:
- Models must exist before containers
- Containers before content items
- Content items before templates
- Templates before pages
- Linked content requires ID remapping after initial content creation

### Multi-Region Support

Authentication automatically detects API endpoints based on GUID suffixes:
- Default: `https://mgmt.aglty.io`
- Dev: `https://mgmt-dev.aglty.io`  
- Canada: `https://mgmt-ca.aglty.io`
- Europe: `https://mgmt-eu.aglty.io`
- Australia: `https://mgmt-aus.aglty.io`

### File Structure

The CLI creates a `.agility-files/` directory with:
- `assets/` - Downloaded media files and metadata
- `containers/` - Container definitions
- `models/` - Content model definitions  
- `templates/` - Page template definitions
- `{locale}/` - Locale-specific content and pages
- `logs/` - Operation logs and error tracking

### Error Handling

The codebase implements comprehensive error handling:
- Graceful degradation with skip tracking
- Detailed logging in `.agility-files/logs/instancelog.txt`
- Dry-run capabilities for validation
- Progress tracking with `cli-progress` multibar

### Dependencies

- `@agility/management-sdk` - Core API client
- `@agility/content-sync` - Specialized sync operations  
- `yargs` - CLI argument parsing
- `inquirer` - Interactive prompts
- `cli-progress` - Progress bars
- `axios` - HTTP requests for assets