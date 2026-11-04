import type { RawDiffEntry, ParseOptions } from "./types.js";

/**
 * Regular expression to match --name-status format:
 * Status code, optional similarity score, old path, optional new path
 * Examples:
 *   "M\tpath/to/file.ts"
 *   "R100\told/path.ts\tnew/path.ts"
 *   "A\tnew/file.ts"
 */
const NAME_STATUS_REGEX = /^([ACDMRTUX])(\d+)?\t(.+?)(?:\t(.+))?$/;

/**
 * Regular expression to match unified diff file headers:
 * "--- a/path/to/file" or "--- /dev/null"
 * "+++ b/path/to/file" or "+++ /dev/null"
 */
const UNIFIED_DIFF_HEADER_REGEX = /^(?:---|\+\+\+)\s+(?:a\/|b\/)?(.+)$/;

/**
 * Regular expression to match diff hunk headers:
 * "@@ -start,count +start,count @@"
 */
const HUNK_HEADER_REGEX = /^@@\s+[-+]\d+(?:,\d+)?\s+[-+]\d+(?:,\d+)?\s+@@/;

/**
 * Parse git diff output in --name-only format
 * Each line is just a file path
 */
function parseNameOnly(diffOutput: string): RawDiffEntry[] {
  const entries: RawDiffEntry[] = [];
  const lines = diffOutput.trim().split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    // In --name-only, we can't determine status, so we default to modified
    // This is a limitation, but --name-only doesn't provide status info
    entries.push({
      statusCode: "M",
      newPath: trimmed,
    });
  }

  return entries;
}

/**
 * Parse git diff output in --name-status format
 * Format: STATUS[SCORE]\tOLD_PATH\tNEW_PATH
 */
function parseNameStatus(diffOutput: string): RawDiffEntry[] {
  const entries: RawDiffEntry[] = [];
  const lines = diffOutput.trim().split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(NAME_STATUS_REGEX);
    if (!match) {
      // Skip malformed lines, but continue processing
      continue;
    }

    const [, statusCode, similarityStr, oldPath, newPath] = match;
    const similarity = similarityStr ? parseInt(similarityStr, 10) : undefined;

    // Handle different status codes
    switch (statusCode) {
      case "A": // Added
        entries.push({
          statusCode: "A",
          newPath: oldPath, // In --name-status, first path after A is the new file
        });
        break;

      case "M": // Modified
        entries.push({
          statusCode: "M",
          newPath: oldPath,
        });
        break;

      case "D": // Deleted
        entries.push({
          statusCode: "D",
          oldPath: oldPath,
          newPath: oldPath, // Deleted files keep the same path
        });
        break;

      case "R": // Renamed
      case "C": // Copied
        if (newPath) {
          entries.push({
            statusCode,
            oldPath,
            newPath,
            similarity,
          });
        } else {
          // Fallback if new path is missing
          entries.push({
            statusCode,
            oldPath,
            newPath: oldPath,
            similarity,
          });
        }
        break;

      case "T": // Type change
        entries.push({
          statusCode: "M", // Treat type changes as modifications
          newPath: oldPath,
        });
        break;

      case "U": // Unmerged
      case "X": // Unknown
        // Skip these statuses as they're not standard changes
        break;

      default:
        // Unknown status code, treat as modified
        entries.push({
          statusCode: "M",
          newPath: oldPath || newPath || "",
        });
    }
  }

  return entries;
}

/**
 * Parse git diff output in unified diff format
 * This is more complex as we need to track file pairs across multiple hunks
 */
function parseUnifiedDiff(diffOutput: string): RawDiffEntry[] {
  const entries: RawDiffEntry[] = [];
  const lines = diffOutput.split("\n");

  let currentOldPath: string | undefined;
  let currentNewPath: string | undefined;
  let hasChanges = false;
  let inHunk = false;

  // Helper to finalize and save current entry
  const finalizeEntry = () => {
    if (!hasChanges) return;

    if (currentOldPath !== undefined && currentNewPath !== undefined) {
      if (currentOldPath === currentNewPath) {
        entries.push({
          statusCode: "M",
          newPath: currentNewPath,
        });
      } else {
        entries.push({
          statusCode: "R",
          oldPath: currentOldPath,
          newPath: currentNewPath,
        });
      }
    } else if (currentOldPath === undefined && currentNewPath !== undefined) {
      entries.push({
        statusCode: "A",
        newPath: currentNewPath,
      });
    } else if (currentOldPath !== undefined && currentNewPath === undefined) {
      entries.push({
        statusCode: "D",
        oldPath: currentOldPath,
        newPath: currentOldPath,
      });
    }

    // Reset for next file
    currentOldPath = undefined;
    currentNewPath = undefined;
    hasChanges = false;
    inHunk = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for new diff marker - finalize previous entry first
    if (line.startsWith("diff --git ")) {
      finalizeEntry();

      // Extract paths from "diff --git a/path b/path" format
      const diffMatch = line.match(/^diff --git (?:a\/(.+?)|"a\/(.+?)") (?:b\/(.+?)|"b\/(.+?)")$/);
      if (diffMatch) {
        const oldPathRaw = diffMatch[1] || diffMatch[2];
        const newPathRaw = diffMatch[3] || diffMatch[4];
        currentOldPath = oldPathRaw;
        currentNewPath = newPathRaw;
        hasChanges = true;
      }
      continue;
    }

    // Content inside a hunk may resemble file headers; never parse it as metadata.
    if (HUNK_HEADER_REGEX.test(line)) { inHunk = true; continue; }
    if (inHunk) continue;

    // Check for file header (--- or +++)
    const headerMatch = line.match(UNIFIED_DIFF_HEADER_REGEX);
    if (headerMatch) {
      const path = headerMatch[1];

      if (line.startsWith("---")) {
        // Old file
        if (path === "/dev/null") {
          currentOldPath = undefined;
        } else {
          // Remove a/ prefix if present
          currentOldPath = path.replace(/^a\//, "");
        }
        hasChanges = true;
      } else if (line.startsWith("+++")) {
        // New file
        if (path === "/dev/null") {
          currentNewPath = undefined;
        } else {
          // Remove b/ prefix if present
          currentNewPath = path.replace(/^b\//, "");
        }
        hasChanges = true;
      }
      continue;
    }

    // Check for diff metadata (index, similarity, etc.)
    if (line.startsWith("index ") || line.startsWith("similarity index ")) {
      continue;
    }

    // Check for binary file indicators
    if (line.startsWith("Binary files ") || line.startsWith("GIT binary patch")) {
      // Binary file detected, but we still have the file paths from headers
      continue;
    }

    // Check for rename/copy similarity
    if (line.startsWith("rename from ") || line.startsWith("copy from ")) {
      const fromMatch = line.match(/^(?:rename|copy) from (.+)$/);
      if (fromMatch) {
        currentOldPath = fromMatch[1];
        hasChanges = true;
      }
      continue;
    }

    if (line.startsWith("rename to ") || line.startsWith("copy to ")) {
      const toMatch = line.match(/^(?:rename|copy) to (.+)$/);
      if (toMatch) {
        currentNewPath = toMatch[1];
        hasChanges = true;
      }
      continue;
    }
  }

  // Finalize last entry
  finalizeEntry();

  return entries;
}

/**
 * Auto-detect the format of git diff output and parse accordingly
 */
function autoDetectAndParse(diffOutput: string): RawDiffEntry[] {
  const trimmed = diffOutput.trim();
  if (!trimmed) {
    return [];
  }

  const lines = trimmed.split("\n");

  // Check for unified diff format (has "diff --git" or "---" headers)
  if (trimmed.includes("diff --git") || trimmed.includes("--- ") || trimmed.includes("+++ ")) {
    return parseUnifiedDiff(diffOutput);
  }

  // Check for --name-status format (has status codes like A, M, D, R)
  if (NAME_STATUS_REGEX.test(lines[0])) {
    return parseNameStatus(diffOutput);
  }

  // Default to --name-only format (just file paths)
  return parseNameOnly(diffOutput);
}

/**
 * Parse git diff output into raw diff entries
 * Supports --name-only, --name-status, and unified diff formats
 */
export function parseRawDiff(
  diffOutput: string,
  options: ParseOptions = {}
): RawDiffEntry[] {
  if (!diffOutput || !diffOutput.trim()) {
    return [];
  }

  if (options.format === "name-status-z" || diffOutput.includes("\0")) {
    const fields = diffOutput.split("\0");
    if (fields.pop() !== "") throw new Error("Truncated NUL-delimited Git diff");
    const entries: RawDiffEntry[] = [];
    for (let i = 0; i < fields.length;) {
      const status = fields[i++];
      if (!/^(?:[AMDT]|[RC]\d{1,3})$/.test(status)) {
        throw new Error("Unsupported Git status: " + status);
      }
      const first = fields[i++];
      const second = /^[RC]/.test(status) ? fields[i++] : undefined;
      if (!first || (/^[RC]/.test(status) && !second)) throw new Error("Missing Git path");
      entries.push({
        statusCode: status[0],
        newPath: second ?? first,
        oldPath: second || status === "D" ? first : undefined,
        similarity: status.length > 1 ? Number(status.slice(1)) : undefined,
      });
    }
    return entries;
  }

  // Auto-detect format and parse
  const entries = autoDetectAndParse(diffOutput);

  // Filter out binary files if not included
  if (!options.includeBinary) {
    // Binary files are typically not included in standard git diff output
    // unless explicitly requested, so this is mostly a placeholder
    return entries;
  }

  return entries;
}

