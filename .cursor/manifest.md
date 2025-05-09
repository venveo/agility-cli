# Project Refactoring: Centralize Pull Logic

**Objective:** Refactor instance data pulling logic to be centralized, modular, and proactive in fetching data if local copies are missing.

---

## Phase 1: Establish Central Pull Service (`pull.ts`)

- [x] **Task 1.1:** Create `src/lib/services/pull.ts`.
    - [x] **Sub-task 1.1.1:** Define a `Pull` class within `pull.ts`.
    - [x] **Sub-task 1.1.2:** Define a `pullInstance(guid, apiKey, locale, channel, isPreview, rootPath, options, multibar)` method in the `Pull` class. This will be the main entry point for pulling an entire instance.
- [x] **Task 1.2:** Identify core pulling logic.
    - [x] **Sub-task 1.2.1:** Read `src/lib/prompts/push-prompt.ts` to understand the `downloadFiles` function's logic. (Noted: `push-prompt.ts` contains `pushFiles`, primary pull logic seems to be in `sync.ts`)
    - [x] **Sub-task 1.2.2:** Read `src/index.ts` to understand its instance pulling logic. (Noted: `index.ts` orchestrates calls, `sync.ts` contains pull methods)
    - [x] **Sub-task 1.2.3:** Consolidate the general structure of instance pulling (e.g., initial sync, then fetching specific items) into a high-level flow within `pullInstance`. (High-level flow defined based on `sync.ts`'s `pullFiles`, `getPages`, `getPageTemplates`)

---

## Phase 2: Modularize Item-Specific Download Logic

- [ ] **Task 2.1: Refactor `sync.ts` for Templates & Pages**
    - [x] **Sub-task 2.1.1:** Create `src/lib/downloaders/download-templates.ts`.
        - [x] Move `getPageTemplates` logic from `src/lib/services/sync.ts` here.
        - [x] Rename/refactor it to a function like `downloadAllTemplates(guid, locale, isPreview, options, multibar, basePath)`.
        - [x] Implement a check: if the target template folder is empty, then execute the download.
    - [x] **Sub-task 2.1.2:** Create `src/lib/downloaders/download-pages.ts`.
        - [x] Move `getPages` logic from `src/lib/services/sync.ts` here.
        - [x] Rename/refactor it to a function like `downloadAllPages(guid, locale, isPreview, options, multibar, basePath)`.
        - [x] Implement a check: if the target page folder is empty, then execute the download.
    - [x] **Sub-task 2.1.3:** Modify `src/lib/services/sync.ts`'s `sync` method. It should still perform the `agilitySync.runSync()`. The calls to `this.getPages()` and `this.getPageTemplates()` have been removed. The `pullFiles` method has been refactored, its dependencies on getPages/Templates removed, and its file operations simplified/commented for future refactoring by the Pull service.

- [ ] **Task 2.2: Create/Update Downloaders for Assets, Containers, Content, Models**
    - **Assets:**
        - [x] **Sub-task 2.2.A.1:** Create `src/lib/downloaders/download-assets.ts`. (Now split into galleries and asset-files)
        - [x] **Sub-task 2.2.A.2:** Reviewed `src/lib/services/assets.ts`; it contains rich logic for fetching and saving (getAssets, getGalleries).
        - [x] **Sub-task 2.2.A.3:** `downloadAllAssets` uses the existing service methods from `assets.ts`. (Now split)
        - [x] **Sub-task 2.2.A.4:** Implemented folder check in `downloadAllAssets` before calling service methods. (Now split)
    - **Galleries (from Assets):**
        - [x] **Sub-task 2.2.G.1:** Create `src/lib/downloaders/download-galleries.ts`.
        - [x] **Sub-task 2.2.G.2:** Uses `AssetsService.getGalleries`.
        - [x] **Sub-task 2.2.G.3:** Implemented folder check for `assets/galleries`.
    - **Asset Files (from Assets):**
        - [x] **Sub-task 2.2.AF.1:** Create `src/lib/downloaders/download-asset-files.ts`.
        - [x] **Sub-task 2.2.AF.2:** Uses `AssetsService.getAssets`.
        - [x] **Sub-task 2.2.AF.3:** Implemented folder check for `assets/json` or general asset content.
    - **Containers:**
        - [x] **Sub-task 2.2.C.1:** Create `src/lib/downloaders/download-containers.ts`.
        - [x] **Sub-task 2.2.C.2:** Reviewed `src/lib/services/containers.ts`; it contains `getContainers` for fetching and saving.
        - [x] **Sub-task 2.2.C.3:** `downloadAllContainers` uses the existing `getContainers` method from `containers.ts`.
        - [x] **Sub-task 2.2.C.4:** Implemented folder check in `downloadAllContainers` before calling `getContainers`.
    - **Content Items:**
        - [x] **Sub-task 2.2.CI.1:** Create `src/lib/downloaders/download-content.ts`.
        - [x] **Sub-task 2.2.CI.2:** Reviewed `src/lib/services/content.ts`; it lacks a "download all" method. Assumed syncSDK handles raw content file downloads.
        - [x] **Sub-task 2.2.CI.3:** `downloadAllContent` checks for pre-existing content folders (e.g., `content`, `items`) populated by the main sync process. It does not make new API calls for content.
        - [x] **Sub-task 2.2.CI.4:** Implemented folder check in `downloadAllContent` and reports status.
    - **Models:**
        - [x] **Sub-task 2.2.M.1:** Create `src/lib/downloaders/download-models.ts`.
        - [x] **Sub-task 2.2.M.2:** Reviewed `src/lib/services/models.ts`; it contains `getModels` for fetching and saving content and page models.
        - [x] **Sub-task 2.2.M.3:** `downloadAllModels` uses the existing `getModels` method from `models.ts`, passing `basePath` as `baseFolder`.
        - [x] **Sub-task 2.2.M.4:** Implemented folder check in `downloadAllModels` before calling `getModels`.

---

## Phase 3: Integrate Downloaders into `Pull` Service

- [x] **Task 3.1:** Update `pullInstance` in `src/lib/services/pull.ts`.
    - [x] **Sub-task 3.1.1:** Call `agilitySync.getSyncClient(...).runSync()` as the first step. Relies on `storeInterfaceFileSystem` for correct file placement, omitting previous complex file move/delete logic from `sync.ts`.
    - [x] **Sub-task 3.1.2:** After the base sync, call the respective `downloadAll[ItemType]s` functions from each of the `src/lib/downloaders/` modules.

---

## Phase 4: Update Call Sites & Cleanup

- [x] **Task 4.1:** Refactor `src/lib/prompts/push-prompt.ts`.
    - No direct pull logic was found in `push-prompt.ts` that required replacement. It instructs the user to pull if needed.
- [x] **Task 4.2:** Refactor `src/index.ts` & other pull initiation points.
    - Refactored `src/lib/prompts/pull-prompt.ts` (downloadFiles function) to use `new Pull().pullInstance()`.
    - Refactored the `pull` command handler in `src/index.ts` to use `new Pull().pullInstance()`.
- [x] **Task 4.3:** Remove redundant/old pulling logic from `sync.ts` (`getPages`, `getPageTemplates`, parts of `pullFiles` if fully superseded).
    - `getPages` and `getPageTemplates` methods were removed from `sync.ts` in Phase 2.
    - `sync.pullFiles()` was heavily simplified to be a thin wrapper around `sync.sync()` with a deprecation note; its complex pulling logic is superseded by the `Pull` service.

---

## Phase 5: Testing and Conventions

- [ ] **Task 5.1:** Test the new `pullInstance` functionality thoroughly for different scenarios (new instance, existing instance, preview/live).
- [ ] **Task 5.2:** Ensure all file paths use the `agility-files/{guid}/{locale}/${isPreview ? 'preview':'live'}` structure consistently (or user-defined main directory name).
- [ ] **Task 5.3:** Verify strong typing, no `any` types in new interfaces (especially in new code), and `keytar` usage for tokens (via Auth service).
- [ ] **Task 5.4:** Review and ensure all `cliProgress` multibar instances are correctly passed and utilized by downloaders and services. Ensure the top-level `multibar` instance created by prompts/commands is stopped after the entire pull operation completes.

# Pull Command UI and Progress Callback Implementation

## Phase 1: Blessed UI Setup for Pull Command (Completed)

- [x] Import `blessed` and `blessed-contrib` in `src/lib/services/pull.ts`.
- [x] Add `_useBlessedUI` parameter to `Pull` class constructor.
- [x] Initialize Blessed screen, grid, header, progress container, and log container in `pullInstance`.
- [x] Redirect `console.log` and `console.error` to the Blessed log container.
- [x] Implement `restoreConsole` and screen cleanup.
- [x] Add progress bars shell in `progressContainerBox` based on selected elements.
- [x] Implement `updateProgress` function in `pull.ts` to manage progress bar state (percentage, color, label).

## Phase 2: Integrate Progress Callbacks

- [x] Define `ProgressCallbackType` in `src/lib/services/pull.ts`.
- [x] For each `downloadAll...` function call in `pull.ts`:
    - [x] Create a specific `progressCallback` instance.
    - [x] Wrap the `downloadAll...` call in a `try/catch` block for granular error reporting to the UI.
    - [x] Pass the `progressCallback` as the new last argument to the `downloadAll...` function.
- **Update Downloader Signatures and Implement Callback Logic**:
    - For each downloader file in `src/lib/downloaders/`:
        - `download-all-templates.ts`
            - [x] Modify function signature to accept `progressCallback?: ProgressCallbackType`.
            - [x] Call `progressCallback` incrementally after each template is processed.
            - [x] Log start, each item processed, and completion/error.
            - [x] Call `progressCallback` with `(total, total, 'success')` on successful completion or `(processedAtError, total, 'error')` on error.
        - `download-all-pages.ts`
            - [x] Modify function signature to accept `progressCallback?: ProgressCallbackType`.
            - [x] Call `progressCallback` incrementally after each page reference is processed.
            - [x] Log start, each item processed, and completion/error.
            - [x] Call `progressCallback` with `(total, total, 'success')` on successful completion or `(processedAtError, total, 'error')` on error.
        - `download-all-galleries.ts`
            - [x] Modify function signature to accept `progressCallback?: ProgressCallbackType`.
            - [x] Call `progressCallback` at start (0%) and end (100% or error) of `AssetsService.getGalleries()` call.
            - [x] Log start and completion/error of the overall gallery download operation.
            - [ ] *Further item-by-item progress/logging requires `AssetsService.getGalleries` refactor.*
        - `download-all-assets.ts`
            - [x] Modify function signature to accept `progressCallback?: ProgressCallbackType`.
            - [x] Call `progressCallback` at start (0%) and end (100% or error) of `AssetsService.getAssets()` call.
            - [x] Log start and completion/error of the overall asset download operation.
            - [ ] *Further item-by-item progress/logging requires `AssetsService.getAssets` refactor.*
        - `download-all-containers.ts`
            - [x] Modify function signature to accept `progressCallback?: ProgressCallbackType`.
            - [x] Call `progressCallback` at start (0%) and end (100% or error) of `ContainersService.getContainers()` call.
            - [x] Log start and completion/error of the overall container download operation.
            - [ ] *Further item-by-item progress/logging requires `ContainersService.getContainers` refactor.*
        - `download-all-content.ts`
            - [x] Modify function signature to accept `progressCallback?: ProgressCallbackType`.
            - [x] Call `progressCallback` to indicate completion (this step checks for existing content, doesn't loop items).
            - [x] Log the outcome of the content check.
        - `download-all-models.ts`
            - [x] Modify function signature to accept `progressCallback?: ProgressCallbackType`.
            - [x] Call `progressCallback` at start (0%) and end (100% or error) of `ModelsService.getModels()` call.
            - [x] Log start and completion/error of the overall model download operation.
            - [ ] *Further item-by-item progress/logging requires `ModelsService.getModels` refactor.*
- [x] Verify linter errors in `pull.ts` are resolved.
- [x] Test pull functionality with the Blessed UI and ensure progress bars update correctly.
- [x] Ensure Blessed UI remains open after completion until manually closed (Ctrl+C).

## Phase 3: Refinements (Future)
- [ ] Consider replacing `cli-progress` (`this._multibar`) entirely with Blessed UI logging.
- [ ] Implement item-by-item progress and logging in service methods (Assets, Containers, Models services) if desired.
- [ ] More granular error reporting within downloaders and services.
- [ ] UI styling improvements.
