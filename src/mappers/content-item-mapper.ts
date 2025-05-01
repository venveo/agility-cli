import * as mgmtApi from "@agility/management-sdk";
import { ReferenceMapper } from "./mapper";
import ansiColors from "ansi-colors";

function handleImage(value: any, referenceMapper: ReferenceMapper): any {
  const assetRef = referenceMapper.getMapping<mgmtApi.Media>("asset", "originUrl", value);
  if (assetRef?.target) {
    return assetRef.target.originUrl;
  } else {
    return null;
  }
}

function handleContentId(fieldName: string, value: any, referenceMapper: ReferenceMapper): any {

  const contentRef = referenceMapper.getContentMappingById<mgmtApi.ContentItem>(value);

  if (contentRef?.target) {
    return contentRef.target.contentID;
  } else {
    // console.log("Couldn't find content ID mapping for key:", fieldName, " - value:", value, " maintaining original value");
  }

  return value;
}

function handleLinkedContentDropdownValue(value: any, referenceMapper: ReferenceMapper): any {
  if (typeof value === "string") {
    const splitIds = value.split(",");
    const newLinkedContentIds = splitIds
      .map((id) => {
        const contentRef = referenceMapper.getMapping<mgmtApi.ContentItem>("content", "contentID", id.trim());
        return contentRef?.target?.contentID?.toString() || id;
      })
      .filter(Boolean)
      .join(",");

    if (newLinkedContentIds) {
      return newLinkedContentIds;
    }
  }
  return value;
}

function handleSortID(value: any, referenceMapper: ReferenceMapper): any {
  if (typeof value === "string") {
    const splitIds = value.split(",");
    const newSortContentIds = splitIds
      .map((id) => {
        const contentRef = referenceMapper.getMapping<mgmtApi.ContentItem>("content", "contentID", id.trim());
        return contentRef?.target?.contentID?.toString() || id;
      })
      .filter(Boolean)
      .join(",");

    if (newSortContentIds) {
      return newSortContentIds;
    }
  }
  return value;
}


function handleCategoryId(fieldName: string, value: any, referenceMapper: ReferenceMapper): any {
    const contentRef = referenceMapper.getMapping<mgmtApi.ContentItem>("content", "contentID", Number(value));
    if (contentRef?.target) {
        return contentRef.target.contentID.toString();
    } else {
        return value;
    }
}


function handleReferenceName(value: any, referenceMapper: ReferenceMapper): any {
  if (typeof value === "object" && value !== null) {
    if ("referencename" in value) {
      if ("sortids" in value) {
        // Keep the reference name in the object if it has sortids
        return value;
      } else {
        // Otherwise just use the reference name directly
        return value.referencename;
      }
    }
  }
  return value;
}

function handleSortIds(value: any, referenceMapper: ReferenceMapper): any {
  if (typeof value === "object" && value !== null && "sortids" in value) {
    const sortids = value.sortids.split(",");
    const newSortIds = sortids
      .map((id) => {
        const contentRef = referenceMapper.getMapping<mgmtApi.ContentItem>("content", "contentID", id.trim());
        return contentRef?.target?.contentID?.toString() || id;
      })
      .filter(Boolean)
      .join(",");

    if (newSortIds) {
      value.sortids = newSortIds;
    }
  }
  return value;
}

function processValue(value: any, referenceMapper: ReferenceMapper, fieldName?: string): any {
  // 1. Handle primitives first (using handleSpecialFields)
  if (value === null || typeof value !== "object") {
    return handleSpecialFields(value, referenceMapper, fieldName);
  }

  // 2. Handle arrays
  if (Array.isArray(value)) {
    // Recursively process each item in the array
    return value.map((item) => processValue(item, referenceMapper, fieldName)); // Pass fieldName for context if needed
  }

  // 3. Handle objects (Recursive Step + Final Handling)
  const processedObj = { ...value }; // Work on a shallow copy

  // Recursively process all child properties first
  for (const key in processedObj) {
      if (Object.prototype.hasOwnProperty.call(processedObj, key)) {
          // Pass the key as the fieldName for the recursive call
          processedObj[key] = processValue(processedObj[key], referenceMapper, key); 
      }
  }

  // After recursion, let handleSpecialFields process the object itself
  return handleSpecialFields(processedObj, referenceMapper, fieldName);
}

// handleSpecialFields now handles primitives AND checks/modifies objects AFTER recursion
function handleSpecialFields(value: any, referenceMapper: ReferenceMapper, fieldName?: string): any {

    // Handle null values immediately
    if (value === null) {
        return null;
    }

    // Handle known primitive fields first
    if (typeof value !== 'object') { 
        if (fieldName === "url") {
            const image = handleImage(value, referenceMapper);
            // Optional: Log mapping details
            // if(image === value || image === null) { ... } else { ... }
            return image;
        }
        // Handle string categoryID (like in Post items)
        if((fieldName === "categoryid" || fieldName === "categoryID") && typeof value === 'string') {
            // console.log(ansiColors.blue("MAP CATEGORY ID STRING"));
            const originalId = parseInt(value, 10);
            if (!isNaN(originalId)) {
                const targetId = handleContentId(fieldName, originalId, referenceMapper);
                 if (targetId !== originalId) {
                    //  console.log(ansiColors.magenta(`Mapping string field ${fieldName}: ${originalId} -> ${targetId}`));
                     return targetId.toString(); // Return target ID as string
                 }
            }
            return value; // Return original if not mapped
         }
         // Handle fields like featuredPost_ValueField
         if(fieldName === 'featuredPost_ValueField' && typeof value === 'string') {
             const originalId = parseInt(value, 10);
             if (!isNaN(originalId)) {
                const targetId = handleContentId(fieldName, originalId, referenceMapper);
                 if (targetId !== originalId) {
                    //  console.log(ansiColors.magenta(`Mapping value field ${fieldName}: ${originalId} -> ${targetId}`));
                     return targetId.toString(); // Return target ID as string
                 }
             }
             return value; // Return original if not mapped
         }
         // Handle comma-separated ID lists (like for dropdowns/sortids)
         if ((fieldName === "linkedContentDropdownValueField" || fieldName === "sortIds") && typeof value === 'string') {
             // Assuming handleLinkedContentDropdownValue/handleSortIds return the mapped string
             console.log(ansiColors.blue(`MAP COMMA-SEP ${fieldName}`));
             return handleLinkedContentDropdownValue(value, referenceMapper); // Reuse this logic for now
         }

        return value; // Return unmodified primitive if no rule matches
    }

    // Handle objects AFTER their children have been processed by processValue
    if (typeof value === 'object') {

        // *** Specific Handling for PostsListing.posts START ***
        // Check if we are processing the 'fields' object of a 'PostsListing'
        // Note: Need context about the parent object/definitionName here.
        // We'll assume `fieldName` holds the key ('posts') and we need a way to check
        // if the *parent* object being processed is a PostsListing's `fields`.
        // THIS IS DIFFICULT WITHOUT PARENT CONTEXT.
        // --- A SIMPLER, LESS SAFE APPROACH (applied directly to the object `value`): ---
        if (fieldName === 'posts' && 'referencename' in value && 'fulllist' in value && value.referencename === 'posts') {
            // console.log(ansiColors.magenta(`Simplifying PostsListing field '${fieldName}' to referenceName: ${value.referencename}`));
            return value.referencename; // Simplify to just the string "posts"
        }
        // *** Specific Handling for PostsListing.posts END ***

        // Check for nested contentID (like in category: { contentid: 109, ... })
        // If found, replace the *entire object* with the *referenceName* of the target item.
        if (('contentID' in value || 'contentid' in value) && (typeof value.contentID === 'number' || typeof value.contentid === 'number')) {
             const originalId = value.contentID || value.contentid;
             const contentRef = referenceMapper.getContentMappingById<mgmtApi.ContentItem>(originalId);
             
             if (contentRef?.target?.properties?.referenceName) {
                 const targetRefName = contentRef.target.properties.referenceName;
                //  console.log(ansiColors.magenta(`Mapping object field ${fieldName} (ID: ${originalId}) to referenceName: ${targetRefName}`));
                 return targetRefName; // Replace object with target reference name string
             } else {
                //  console.log(ansiColors.red(`✗ Could not find target mapping or referenceName for object field ${fieldName} with source ID ${originalId}`));
                 // Decide how to handle failure: return null, original value, or throw?
                 return null; // Returning null might be safest to indicate failure downstream
             }
        }
         // Add checks/modifications for other fields within the object if needed
         // (No other specific object field modifications needed based on old code analysis)

    }

    // Return the (potentially modified) object or the original primitive
    return value;
}

export function mapContentItem(
  contentItem: mgmtApi.ContentItem,
  referenceMapper: ReferenceMapper
): mgmtApi.ContentItem {
  // Create a deep copy of the content item
  const mappedContentItem = JSON.parse(JSON.stringify(contentItem));

  // Process the entire content item recursively
  for (const [key, value] of Object.entries(mappedContentItem)) {
    mappedContentItem[key] = processValue(value, referenceMapper, key);
  }

  return mappedContentItem;
}
