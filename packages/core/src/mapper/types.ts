/**
 * Safety level for test selection
 */
export type SafetyLevel = "high" | "moderate" | "medium" | "low";

/**
 * Directory mapping configuration
 * Links source paths to test paths for explicit mapping
 */
export interface DirectoryMapping {
  /** Project-relative source files, directories or globs (e.g., "src/components", "src/features/auth") */
  src: string | string[];
  /** Project-relative spec files, directories or globs (e.g., "cypress/e2e/components", "cypress/e2e/auth") */
  test: string | string[];
}

/**
 * Smoke test configuration
 * Defines specs to include whenever there are relevant changes
 */
export interface SmokeConfig {
  /** Glob patterns for smoke test files (e.g., "cypress/e2e/smoke/") */
  patterns?: string[];
  /** Tags that identify smoke tests (e.g., ["smoke", "critical"]) */
  tags?: string[];
}

/**
 * Mapping configuration from cypress-test-selector.config.js
 */
export interface MappingConfig {
  /** Explicit directory mappings from source to test paths */
  mappings?: DirectoryMapping[];
  /** Smoke test configuration - always included */
  smoke?: SmokeConfig;
  /** Additional shared files/directories/globs that require the full suite. */
  fullSuiteOnChange?: string[];
  /** Explicitly ignore non-runtime paths. Empty by default. */
  ignoreChanges?: string[];
}

/**
 * Mapping score for a test file
 * Scores range from 0.0 to 1.0
 */
export interface TestMapping {
  /** Test path as supplied to mapDiffToTests */
  testPath: string;
  /** Combined score from all heuristics (0.0 to 1.0) */
  score: number;
  /** Individual heuristic scores */
  heuristics: {
    directory: number;
    similarity: number;
    tags: number;
  };
  /** Reason for selection (for debugging/logging) */
  reason?: string;
}

/**
 * Result of mapping changed files to test files
 */
export interface MappingResult {
  status: "no-changes" | "selected" | "full-suite" | "no-tests";
  mode: "conservative" | "heuristic";
  totalTests: number;
  fallbackReasons: string[];
  unmappedFiles: string[];
  /** Array of test mappings with scores */
  mappings: TestMapping[];
  /** Selected test paths based on safety level */
  selected: string[];
  /** Safety level used */
  safetyLevel: SafetyLevel;
  /** Threshold used for selection */
  threshold: number;
}

/**
 * Options for mapping changed files to tests
 */
export interface MappingOptions {
  /** Root for source paths, spec paths and all configuration patterns. */
  projectRoot?: string;
  /** Conservative requires explicit coverage for every changed path. */
  mode?: "conservative" | "heuristic";
  /** Safety level for test selection */
  safetyLevel?: SafetyLevel;
  /** Custom threshold (overrides safety level if provided) */
  threshold?: number;
  /** @deprecated Scores are always included. */
  includeScores?: boolean;
  /** @deprecated Explicit mappings are mandatory and are not weighted. */
  directoryWeight?: number;
  /** Custom similarity weight (default: DEFAULT_WEIGHTS.similarityWeight) */
  similarityWeight?: number;
  /** Custom tag heuristic weight (default: DEFAULT_WEIGHTS.tagWeight) */
  tagWeight?: number;
  /** Mapping configuration with explicit directory mappings and smoke tests */
  config?: MappingConfig;
}

/**
 * Safety level thresholds
 */
export const SAFETY_THRESHOLDS: Record<SafetyLevel, number> = {
  high: 0.0, // Heuristic mode: any positive score
  moderate: 0.2, // Select tests with score >= 0.2 (between high and medium)
  medium: 0.4, // Select tests with score >= 0.4
  low: 0.7, // Select only tests with score >= 0.7
};

/**
 * Default weights for heuristic scoring
 * These weights control the relative importance of each heuristic in the combined score.
 * Higher weights mean the heuristic has more influence on the final score.
 */
export const DEFAULT_WEIGHTS = {
  /** Directory mapping weight - matches based on explicit config mappings */
  directoryWeight: 1.0,
  /** Filename similarity weight - matches based on token similarity */
  similarityWeight: 1.0,
  /** Tag heuristic weight - matches based on test tags */
  tagWeight: 0.5,
} as const;
