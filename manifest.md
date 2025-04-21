# Project Manifest

## Current Tasks

### Update Pull Command to Match New Implementation
**Status**: In Progress

#### Phases
1. Planning
   - [x] Analyze current pull command implementation
   - [x] Review new pull-prompt implementation
   - [x] Identify key differences and required changes
   - [x] Document required updates

2. Implementation
   - [x] Update yargs command structure
   - [x] Add new parameters (preview, elements)
   - [x] Remove old cleanup code
   - [x] Update sync process to use new classes
   - [x] Implement parallel downloads
   - [x] Add new file structure support
   - [x] Fix import paths
   - [x] Update auth handling to use checkAuthorization()

3. Testing
   - [ ] Verify command works with all parameters
   - [ ] Test preview/live mode switching
   - [ ] Test element selection
   - [ ] Verify file structure
   - [ ] Test error handling
   - [ ] Test auth flow

#### Key Changes
1. File Structure
   - Remove old cleanup code
   - Use new GUID-based directory structure

2. Parameters
   - Add preview mode flag
   - Add element selection
   - Keep backward compatibility

3. Implementation
   - Use new *_new classes
   - Implement parallel downloads
   - Update progress tracking
   - Improve success messaging
   - Update auth to use checkAuthorization()

4. Auth
   - Remove old codeFileStatus check
   - Use new checkAuthorization() method
   - Follow default command auth pattern

#### Dependencies
- sync_new.ts
- asset_new.ts
- container_new.ts
- model_new.ts

#### Notes
- Maintain backward compatibility with required parameters
- Follow new file structure conventions
- Ensure proper error handling
- Add clear success messaging
- Update auth to match new pattern 