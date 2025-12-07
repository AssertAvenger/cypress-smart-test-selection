import type { ChangedFile } from "../diff/types.js";
import type { DiscoveredTestFile } from "../discovery/types.js";
import { tokenizeFilename } from "./similarity-heuristic.js";

/**
 * Extract all tags that match tokens from changed files
 * This identifies which tags should trigger 100% inclusive selection
 *
 * @param changedFiles - Array of changed files
 * @returns Set of matching tag names (lowercase)
 */
export function extractMatchingTags(changedFiles: ChangedFile[]): Set<string> {
  const matchingTags = new Set<string>();
  
  for (const changedFile of changedFiles) {
    const sourcePath = changedFile.newPath || changedFile.oldPath || "";
    if (!sourcePath) continue;
    
    const sourceTokens = tokenizeFilename(sourcePath);
    const sourceTokensLower = sourceTokens.map((t) => t.toLowerCase());
    
    // Add all tokens as potential tag matches
    for (const token of sourceTokensLower) {
      matchingTags.add(token);
    }
  }
  
  return matchingTags;
}

/**
 * Check if a test file has any tags that match the changed files
 * This is used for 100% inclusive tag-based selection
 *
 * @param testFile - Test file with metadata
 * @param matchingTags - Set of matching tag names (from extractMatchingTags)
 * @returns true if test has any matching tag
 */
export function hasMatchingTag(
  testFile: DiscoveredTestFile,
  matchingTags: Set<string>
): boolean {
  if (testFile.tags.length === 0 || matchingTags.size === 0) {
    return false;
  }
  
  const testTagsLower = testFile.tags.map((t) => t.toLowerCase().trim());
  
  // Check for exact tag match
  for (const tag of testTagsLower) {
    if (matchingTags.has(tag)) {
      return true;
    }
    
    // Also check if tag parts match (for hyphenated tags like "user-profile")
    const tagParts = tag.split(/[-_]/);
    for (const part of tagParts) {
      if (matchingTags.has(part)) {
        return true;
      }
    }
    
    // Check if any matching tag is contained in the test tag or vice versa
    for (const matchingTag of matchingTags) {
      if (tag.includes(matchingTag) || matchingTag.includes(tag)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Calculate tag-based similarity score
 *
 * @param changedFile - Changed file
 * @param testFile - Test file with metadata
 * @returns Score from 0.0 to 1.0
 */
export function calculateTagScore(
  changedFile: ChangedFile,
  testFile: DiscoveredTestFile
): number {
  // Use newPath for added/modified, oldPath for deleted/renamed
  const sourcePath = changedFile.newPath || changedFile.oldPath || "";
  if (!sourcePath || testFile.tags.length === 0) {
    return 0.0;
  }

  // Extract tokens from changed file name
  const sourceTokens = tokenizeFilename(sourcePath);

  // Check for exact tag matches
  const testTagsLower = testFile.tags.map((t) => t.toLowerCase());
  const sourceTokensLower = sourceTokens.map((t) => t.toLowerCase());

  // Exact tag match (any tag matches any token) → 1.0
  for (const tag of testTagsLower) {
    if (sourceTokensLower.includes(tag)) {
      return 1.0;
    }
  }

  // Partial overlap (token match) → 0.4-0.7
  // Also tokenize tags to match individual parts
  const tagTokens = new Set<string>();
  for (const tag of testTagsLower) {
    // Split tag on hyphens/underscores and add all parts
    tag.split(/[-_]/).forEach((part) => tagTokens.add(part));
    // Also add the full tag
    tagTokens.add(tag);
  }

  let matches = 0;
  for (const tagToken of tagTokens) {
    if (sourceTokensLower.includes(tagToken)) {
      matches++;
    }
  }
  
  // Also check if any source token is contained in any tag
  for (const token of sourceTokensLower) {
    for (const tag of testTagsLower) {
      if (tag.includes(token) || token.includes(tag)) {
        matches++;
        break; // Count each token only once
      }
    }
  }

  if (matches > 0) {
    // Calculate overlap ratio
    const maxLength = Math.max(testTagsLower.length, sourceTokensLower.length);
    const overlapRatio = matches / maxLength;

    // Map to 0.4-0.7 range
    if (overlapRatio >= 0.5) {
      return 0.7;
    } else if (overlapRatio >= 0.3) {
      return 0.5;
    } else {
      return 0.4;
    }
  }

  // No match → 0
  return 0.0;
}

