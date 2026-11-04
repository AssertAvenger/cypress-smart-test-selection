/**
 * Normalized file change representation
 * This is the standard output format used throughout the application
 */
export interface ChangedFile {
  /** Original path (for renamed/deleted files) */
  oldPath?: string;
  /** Current/new path (always present) */
  newPath: string;
  /** Type of change */
  status: "added" | "modified" | "deleted" | "renamed";
}

/**
 * Raw diff entry parsed from git output
 * Represents the intermediate parsed state before normalization
 */
export interface RawDiffEntry {
  /** Git status code: A, M, D, R, C */
  statusCode: string;
  /** Original path (for renamed/copied files) */
  oldPath?: string;
  /** New path */
  newPath: string;
  /** Similarity score for renames/copies (0-100) */
  similarity?: number;
}

/**
 * Options for parsing git diff output
 */
export interface ParseOptions {
  /** Explicit machine format used by the CLI; preferred over legacy auto-detection. */
  format?: "name-status-z";
  /** Whether to include binary files (default: false) */
  includeBinary?: boolean;
  /** Whether to include untracked files (default: false) */
  includeUntracked?: boolean;
}

/**
 * Result of parsing a git diff
 */
export interface ParseResult {
  /** Array of normalized changed files */
  files: ChangedFile[];
  /** Any warnings encountered during parsing */
  warnings: string[];
}

