import { dirname } from "node:path";
import type { ChangedFile } from "../diff/types.js";
import type {
  MappingResult,
  MappingOptions,
  SafetyLevel,
  TestMapping,
} from "./types.js";
import type { DiscoveredTestFile } from "../discovery/types.js";
import { calculateDirectoryScore } from "./directory-heuristic.js";
import { calculateSimilarityScore } from "./similarity-heuristic.js";
import { calculateImportGraphScore } from "./import-graph-heuristic.js";
import { calculateTagScore, extractMatchingTags, hasMatchingTag } from "./tag-heuristic.js";
import { calculateTitleScore } from "./title-heuristic.js";
import { combineScores } from "./scoring.js";
import { getThreshold, filterBySafety } from "./safety.js";
import { SAFETY_THRESHOLDS, DEFAULT_WEIGHTS } from "./types.js";

/**
 * Check if a test file is a smoke test
 * Smoke tests are identified by:
 * 1. Tests tagged with @smoke
 * 2. Tests in a path containing "smoke" (e.g., cypress/smoke)
 *
 * @param testFile - Test file to check
 * @returns true if the test is a smoke test
 */
function isSmokeTest(testFile: DiscoveredTestFile): boolean {
  // Check for @smoke tag
  const testTagsLower = testFile.tags.map((t) => t.toLowerCase().trim());
  if (testTagsLower.includes("smoke")) {
    return true;
  }

  // Check if path contains "smoke" (case-insensitive)
  const testPathLower = testFile.file.toLowerCase();
  if (testPathLower.includes("/smoke/") || testPathLower.includes("\\smoke\\")) {
    return true;
  }

  return false;
}

/**
 * Map changed files to test files using multiple heuristics
 *
 * @param diff - Array of changed files from git diff
 * @param tests - Array of absolute test file paths or DiscoveredTestFile[]
 * @param options - Mapping options
 * @returns Mapping result with scores and selected tests
 */
export async function mapDiffToTests(
  diff: ChangedFile[],
  tests: string[] | DiscoveredTestFile[],
  options: MappingOptions = {}
): Promise<MappingResult> {
  const {
    safetyLevel = "medium",
    threshold: customThreshold,
    directoryWeight = DEFAULT_WEIGHTS.directoryWeight,
    similarityWeight = DEFAULT_WEIGHTS.similarityWeight,
    importGraphWeight = DEFAULT_WEIGHTS.importGraphWeight,
    tagWeight = DEFAULT_WEIGHTS.tagWeight,
    titleWeight = DEFAULT_WEIGHTS.titleWeight,
  } = options;

  // Get threshold based on safety level
  const threshold = getThreshold(safetyLevel, customThreshold);

  // Normalize tests to DiscoveredTestFile format
  const testFiles: DiscoveredTestFile[] = tests.map((test) => {
    if (typeof test === "string") {
      // Simple string path - create minimal metadata
      return {
        file: test,
        tags: [],
        titles: [],
        tokens: [],
      };
    }
    return test;
  });

  // Get project root from first test file (assume all tests are in same project)
  // Try to find common ancestor that contains "cypress" directory
  let projectRoot = ".";
  if (testFiles.length > 0) {
    const firstTest = testFiles[0].file;
    // Find the directory containing "cypress"
    const cypressIndex = firstTest.indexOf("/cypress");
    if (cypressIndex > 0) {
      projectRoot = firstTest.substring(0, cypressIndex);
    } else {
      // Fallback: use parent of test file directory
      projectRoot = dirname(dirname(firstTest));
    }
  }

  // STEP 1: Extract matching tags from changed files for 100% inclusive selection
  const matchingTags = extractMatchingTags(diff);
  
  // STEP 2: Identify all tests with matching tags (100% inclusive - bypass threshold)
  const tagMatchedTests = new Set<string>();
  const tagMatchedMappings: TestMapping[] = [];
  
  for (const testFile of testFiles) {
    if (hasMatchingTag(testFile, matchingTags)) {
      tagMatchedTests.add(testFile.file);
      
      // Calculate scores for tag-matched tests (for reporting)
      const testPath = testFile.file;
      let maxDirectoryScore = 0.0;
      let maxSimilarityScore = 0.0;
      let maxImportScore = 0.0;
      let maxTagScore = 0.0;
      let maxTitleScore = 0.0;
      
      for (const changedFile of diff) {
        maxDirectoryScore = Math.max(maxDirectoryScore, calculateDirectoryScore(changedFile, testPath));
        maxSimilarityScore = Math.max(maxSimilarityScore, calculateSimilarityScore(changedFile, testPath));
        maxImportScore = Math.max(maxImportScore, await calculateImportGraphScore(changedFile, testPath, projectRoot));
        maxTagScore = Math.max(maxTagScore, calculateTagScore(changedFile, testFile));
        maxTitleScore = Math.max(maxTitleScore, calculateTitleScore(changedFile, testFile));
      }
      
      // Tag-matched tests get guaranteed inclusion with high score
      tagMatchedMappings.push({
        testPath,
        score: 1.0, // Guaranteed high score to bypass threshold
        heuristics: {
          directory: maxDirectoryScore,
          similarity: maxSimilarityScore,
          importGraph: maxImportScore,
          tags: maxTagScore,
          titles: maxTitleScore,
        },
        reason: "tag match (100% inclusive)",
      });
    }
  }

  // STEP 3: Calculate scores for remaining tests (normal selection logic)
  const mappings: TestMapping[] = [];

  for (const testFile of testFiles) {
    // Skip tests already included via tag matching
    if (tagMatchedTests.has(testFile.file)) {
      continue;
    }
    const testPath = testFile.file;
    let maxScore = 0.0;
    let maxDirectoryScore = 0.0;
    let maxSimilarityScore = 0.0;
    let maxImportScore = 0.0;
    let maxTagScore = 0.0;
    let maxTitleScore = 0.0;
    let bestReason = "";

    // Check against each changed file
    for (const changedFile of diff) {
      // Calculate directory score
      const dirScore = calculateDirectoryScore(changedFile, testPath);
      maxDirectoryScore = Math.max(maxDirectoryScore, dirScore);

      // Calculate similarity score
      const simScore = calculateSimilarityScore(changedFile, testPath);
      maxSimilarityScore = Math.max(maxSimilarityScore, simScore);

      // Calculate import graph score
      const importScore = await calculateImportGraphScore(
        changedFile,
        testPath,
        projectRoot
      );
      maxImportScore = Math.max(maxImportScore, importScore);

      // Calculate tag score
      const tagScore = calculateTagScore(changedFile, testFile);
      maxTagScore = Math.max(maxTagScore, tagScore);

      // Calculate title score
      const titleScore = calculateTitleScore(changedFile, testFile);
      maxTitleScore = Math.max(maxTitleScore, titleScore);

      // Combine scores
      const combined = combineScores(
        [dirScore, simScore, importScore, tagScore, titleScore],
        [
          directoryWeight,
          similarityWeight,
          importGraphWeight,
          tagWeight,
          titleWeight,
        ]
      );

      if (combined > maxScore) {
        maxScore = combined;
        // Generate reason
        const reasons: string[] = [];
        if (dirScore > 0.5) reasons.push("directory match");
        if (simScore > 0.5) reasons.push("filename similarity");
        if (importScore > 0.5) reasons.push("import dependency");
        if (tagScore > 0.5) reasons.push("tag match");
        if (titleScore > 0.5) reasons.push("title match");
        bestReason = reasons.join(", ") || "low confidence match";
      }
    }

    // Only include if score > 0
    if (maxScore > 0) {
      mappings.push({
        testPath,
        score: maxScore,
        heuristics: {
          directory: maxDirectoryScore,
          similarity: maxSimilarityScore,
          importGraph: maxImportScore,
          tags: maxTagScore,
          titles: maxTitleScore,
        },
        reason: bestReason,
      });
    }
  }

  // STEP 4: Combine tag-matched tests with normally scored tests
  const allMappings = [...tagMatchedMappings, ...mappings];
  
  // Sort by score (descending)
  allMappings.sort((a, b) => b.score - a.score);

  // STEP 5: Filter by safety level
  // Tag-matched tests are already included (score = 1.0), so they bypass threshold
  const selected = filterBySafety(allMappings, threshold);

  // STEP 6: Always include smoke tests (append at the end)
  const selectedSet = new Set(selected);
  const smokeTests: string[] = [];
  const smokeMappings: TestMapping[] = [];

  for (const testFile of testFiles) {
    if (isSmokeTest(testFile) && !selectedSet.has(testFile.file)) {
      smokeTests.push(testFile.file);
      selectedSet.add(testFile.file);

      // Create mapping for smoke test (for reporting)
      const testPath = testFile.file;
      let maxDirectoryScore = 0.0;
      let maxSimilarityScore = 0.0;
      let maxImportScore = 0.0;
      let maxTagScore = 0.0;
      let maxTitleScore = 0.0;

      // Calculate scores for smoke tests (for reporting, even if not needed for selection)
      for (const changedFile of diff) {
        maxDirectoryScore = Math.max(maxDirectoryScore, calculateDirectoryScore(changedFile, testPath));
        maxSimilarityScore = Math.max(maxSimilarityScore, calculateSimilarityScore(changedFile, testPath));
        maxImportScore = Math.max(maxImportScore, await calculateImportGraphScore(changedFile, testPath, projectRoot));
        maxTagScore = Math.max(maxTagScore, calculateTagScore(changedFile, testFile));
        maxTitleScore = Math.max(maxTitleScore, calculateTitleScore(changedFile, testFile));
      }

      smokeMappings.push({
        testPath,
        score: 1.0, // High score for reporting
        heuristics: {
          directory: maxDirectoryScore,
          similarity: maxSimilarityScore,
          importGraph: maxImportScore,
          tags: maxTagScore,
          titles: maxTitleScore,
        },
        reason: "smoke test (always included)",
      });
    }
  }

  // Append smoke tests to selected list and mappings
  const finalSelected = [...selected, ...smokeTests];
  const finalMappings = [...allMappings, ...smokeMappings];

  return {
    mappings: finalMappings,
    selected: finalSelected,
    safetyLevel,
    threshold,
  };
}

// Export types
export type {
  MappingResult,
  MappingOptions,
  SafetyLevel,
  TestMapping,
};

// Export safety thresholds and default weights
export { SAFETY_THRESHOLDS, DEFAULT_WEIGHTS };

// Export individual heuristics for testing/advanced use
export {
  calculateDirectoryScore,
  calculateSimilarityScore,
  calculateImportGraphScore,
  extractMatchingTags,
  hasMatchingTag,
};

