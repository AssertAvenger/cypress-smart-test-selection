import type { RawDiffEntry, ChangedFile } from "./types.js";

/**
 * Convert a raw diff entry to a normalized ChangedFile
 */
function normalizeEntry(entry: RawDiffEntry): ChangedFile {
  const { statusCode, oldPath, newPath } = entry;

  switch (statusCode) {
    case "A": // Added
      return {
        newPath: newPath || "",
        status: "added",
      };

    case "M": // Modified
    case "T": // Type change (treated as modified)
      return {
        newPath: newPath || "",
        status: "modified",
      };

    case "D": // Deleted
      return {
        oldPath: oldPath || newPath,
        newPath: oldPath || newPath || "",
        status: "deleted",
      };

    case "R": // Renamed
      return {
        oldPath: oldPath,
        newPath: newPath || oldPath || "",
        status: "renamed",
      };

    case "C": // Copied (treat as added since it's a new file)
      return {
        oldPath: oldPath, // Keep old path for reference
        newPath: newPath || "",
        status: "added",
      };

    default:
      // Unknown status, default to modified
      return {
        newPath: newPath || "",
        status: "modified",
      };
  }
}

/**
 * Normalize an array of raw diff entries to ChangedFile format
 * Deduplicates entries and handles edge cases
 */
export function normalizeDiff(entries: RawDiffEntry[]): ChangedFile[] {
  const normalized: ChangedFile[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    // Skip entries without paths
    if (!entry.newPath && !entry.oldPath) {
      continue;
    }

    const changedFile = normalizeEntry(entry);

    // Create a unique key for deduplication
    // For renamed files, use both paths; for others, use newPath
    const key = JSON.stringify([changedFile.oldPath ?? null, changedFile.newPath]);

    // Skip duplicates
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(changedFile);
  }

  return normalized;
}

