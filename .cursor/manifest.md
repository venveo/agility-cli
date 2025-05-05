# Agility CLI Content Pushing Analysis

## Current Situation

The content pushing system is designed to handle two types of content items:
1. Normal Content Items - These are standalone content items without nested content references
2. Nested/Linked Content Items - These are content items that reference other content items

The system follows a two-phase approach:
1. First, it processes all normal content items
2. Then, it processes nested/linked content items that depend on the normal content items

The content item creation process:
- Uses `contentID: -1` in the payload for new content items
- Returns a new contentID if successful
- Returns -1 if the creation fails

## Known Issues

1. **Linked Content Creation Failures**
   - Despite normal content items being created successfully, linked content items are failing
   - Example failures from logs:
     - `posts_postslisting` (ID: 13)
     - `home_postslisting` (ID: 23)
     - `blog_featuredpost` (ID: 108)
   - All failures show `contentID: -1` in the response

2. **Content Mapping Investigation Needed**
   - Need to verify if the content mappings are being properly maintained between normal and linked content
   - The `handleContentId` function in content-item-mapper.ts may need review
   - Need to confirm if the reference mapper is properly tracking all created content items

3. **Error Response Analysis**
   - The error responses from the API need to be analyzed to understand why the linked content items are failing
   - Current error handling may not be capturing enough detail about the failure reasons

## Next Steps

1. Add detailed logging for the content mapping process
2. Verify the reference mapper state after normal content creation
3. Analyze the API error responses for linked content failures
4. Review the content item mapping logic for potential issues with nested references

## Task: Fix Page Push Functionality (July 24, 2024)

**Goal:** Resolve errors preventing pages from being created or updated during the push process.

**Identified Issues:**
1.  **Missing `referenceName`:** API error `Cannot insert the value NULL into column 'referenceName', table '...ContentViews'` indicates the `referenceName` for the `ContentView` associated with a page module instance is missing when the backend tries to create it.
2.  **Dynamic Page Constraint:** API error `You may only have one Dynamic Page at the current sitemap level` occurs when pushing dynamic pages under a parent that might already have one on the target.

**Plan:**

-   [x] Analyze backend C# `BatchInsertPageItem` function to understand payload requirements (`.cursor/rules/functions/BatchProcessing.cs`).
-   [x] Create example page payload structure (`.cursor/page-payload.md`).
-   [x] **Investigate CLI Payload Generation:** Examine `src/push_new.ts` (`processPage` function) to find where the page save payload is constructed.
-   [x] **Fix `referenceName` Issue:** Modified `src/push_new.ts` to ensure the `item` object within the `zones` payload includes the `referenceName` (source content item reference name) alongside the mapped `contentId`.
-   [ ] **Address Dynamic Page Constraint (Investigation):** Verify parent page ID mapping in `page-pusher.ts`. The constraint itself might be valid due to target instance state or a backend rule. The CLI fix will focus on ensuring correct data is sent. If the constraint error persists after fixing the `referenceName`, it might require manual intervention or different handling (e.g., skipping, warning).
-   [ ] **Test:** Rerun the push process with the fixes to confirm errors are resolved.
-   [ ] **Update Manifest:** Mark tasks as complete.

## Push Command UI Enhancement (Blessed/Blessed-Contrib)

- [ ] **Phase 1: Setup & Basic Layout**
    - [x] Read `src/push_new.ts` to understand current logic.
    - [x] Initialize `blessed` screen.
    - [x] Implement a two-column layout using `blessed-contrib` Grid.
    - [x] Create placeholder boxes for the left (progress) and right (logs) columns.
- [x] **Phase 2: Progress Bar Integration**
    - [x] Identify points in the push logic where progress can be tracked (e.g., file processing, API calls).
    - [x] Implement `blessed-contrib` ProgressBar or similar widget(s) in the left column.
    - [x] Hook progress updates from the push logic into the UI.
- [x] **Phase 3: Logging Integration**
    - [x] Implement a `blessed` Log widget or scrollable Box in the right column.
    - [x] Capture or redirect application logs to the logging widget.
- [ ] **Phase 4: Refinement & Testing**
    - [ ] Ensure smooth UI updates and rendering.
    - [ ] Test error handling and edge cases.
    - [ ] Refine layout and appearance.
    - [x] Refine layout and appearance (Horizontal progress bars, color coding, log scrolling verification).
