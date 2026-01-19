import { normalize } from "node:path";
import type { ChangedFile } from "../diff/types.js";
import type { DirectoryMapping } from "./types.js";

/**
 * Normalize a path to POSIX style for consistent comparison
 * @param path - Path to normalize
 * @returns Normalized path with forward slashes
 */
function normalizePath(path: string): string {
  return normalize(path).replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

/**
 * Check if a path contains a pattern
 */
function pathContainsPattern(path: string, pattern: string): boolean {
  const normalizedPath = normalizePath(path);
  const normalizedPattern = normalizePath(pattern);

  if (normalizedPath === normalizedPattern) {
    return true;
  }

  if (normalizedPath.startsWith(normalizedPattern + "/")) {
    return true;
  }

  const patternWithSlashes = "/" + normalizedPattern + "/";
  const pathWithSlashes = "/" + normalizedPath + "/";

  if (pathWithSlashes.includes(patternWithSlashes)) {
    return true;
  }

  if (normalizedPath.endsWith("/" + normalizedPattern) ||
      normalizedPath.includes("/" + normalizedPattern + "/")) {
    return true;
  }

  return false;
}

/**
 * Calculate directory score based on explicit config mappings
 *
 * @param changedFile - Changed file from git diff
 * @param testPath - Test file path to check
 * @param mappings - Explicit directory mappings from config
 * @returns Score: 1.0 for match, 0.0 otherwise
 */
export function calculateDirectoryScore(
  changedFile: ChangedFile,
  testPath: string,
  mappings?: DirectoryMapping[]
): number {
  if (!mappings || mappings.length === 0) {
    return 0.0;
  }

  const sourcePath = changedFile.newPath || changedFile.oldPath || "";
  if (!sourcePath) {
    return 0.0;
  }

  for (const mapping of mappings) {
    const srcPatterns = Array.isArray(mapping.src) ? mapping.src : [mapping.src];
    const testPatterns = Array.isArray(mapping.test) ? mapping.test : [mapping.test];

    const sourceMatches = srcPatterns.some((pattern) =>
      pathContainsPattern(sourcePath, pattern)
    );

    if (!sourceMatches) {
      continue;
    }

    const testMatches = testPatterns.some((pattern) =>
      pathContainsPattern(testPath, pattern)
    );

    if (testMatches) {
      return 1.0;
    }
  }

  return 0.0;
}
