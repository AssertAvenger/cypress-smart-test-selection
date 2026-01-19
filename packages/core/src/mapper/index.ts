import type { ChangedFile } from "../diff/types.js";
import type {
  MappingResult,
  MappingOptions,
  SafetyLevel,
  TestMapping,
  MappingConfig,
  SmokeConfig,
} from "./types.js";
import type { DiscoveredTestFile } from "../discovery/types.js";
import { calculateDirectoryScore } from "./directory-heuristic.js";
import { calculateSimilarityScore } from "./similarity-heuristic.js";
import { calculateTagScore, extractMatchingTags, hasMatchingTag } from "./tag-heuristic.js";
import { combineScores } from "./scoring.js";
import { getThreshold, filterBySafety } from "./safety.js";
import { SAFETY_THRESHOLDS, DEFAULT_WEIGHTS } from "./types.js";

/**
 * Check if a test file is a smoke test based on explicit config
 */
function isSmokeTest(testFile: DiscoveredTestFile, smokeConfig?: SmokeConfig): boolean {
  if (!smokeConfig) {
    return false;
  }

  if (smokeConfig.patterns && smokeConfig.patterns.length > 0) {
    const testPathLower = testFile.file.toLowerCase().replace(/\\/g, "/");
    for (const pattern of smokeConfig.patterns) {
      const normalizedPattern = pattern.toLowerCase().replace(/\\/g, "/").replace(/\*\*/g, "").replace(/\*/g, "");
      if (testPathLower.includes(normalizedPattern.replace(/^\/+|\/+$/g, ""))) {
        return true;
      }
    }
  }

  if (smokeConfig.tags && smokeConfig.tags.length > 0) {
    const testTagsLower = testFile.tags.map((t) => t.toLowerCase().trim());
    const smokeTagsLower = smokeConfig.tags.map((t) => t.toLowerCase().trim());

    for (const smokeTag of smokeTagsLower) {
      if (testTagsLower.includes(smokeTag)) {
        return true;
      }
    }
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
    tagWeight = DEFAULT_WEIGHTS.tagWeight,
    config,
  } = options;

  const threshold = getThreshold(safetyLevel, customThreshold);

  const testFiles: DiscoveredTestFile[] = tests.map((test) => {
    if (typeof test === "string") {
      return {
        file: test,
        tags: [],
        titles: [],
        tokens: [],
      };
    }
    return test;
  });

  const smokeTestPaths = new Set<string>();
  const smokeMappings: TestMapping[] = [];

  for (const testFile of testFiles) {
    if (isSmokeTest(testFile, config?.smoke)) {
      smokeTestPaths.add(testFile.file);
      smokeMappings.push({
        testPath: testFile.file,
        score: 1.0,
        heuristics: { directory: 0, similarity: 0, tags: 0 },
        reason: "smoke test (always included)",
      });
    }
  }

  const matchingTags = extractMatchingTags(diff);

  const tagMatchedTests = new Set<string>();
  const tagMatchedMappings: TestMapping[] = [];

  for (const testFile of testFiles) {
    if (smokeTestPaths.has(testFile.file)) {
      continue;
    }

    if (hasMatchingTag(testFile, matchingTags)) {
      tagMatchedTests.add(testFile.file);

      const testPath = testFile.file;
      let maxDirectoryScore = 0.0;
      let maxSimilarityScore = 0.0;
      let maxTagScore = 0.0;

      for (const changedFile of diff) {
        maxDirectoryScore = Math.max(maxDirectoryScore, calculateDirectoryScore(changedFile, testPath, config?.mappings));
        maxSimilarityScore = Math.max(maxSimilarityScore, calculateSimilarityScore(changedFile, testPath));
        maxTagScore = Math.max(maxTagScore, calculateTagScore(changedFile, testFile));
      }

      tagMatchedMappings.push({
        testPath,
        score: 1.0,
        heuristics: {
          directory: maxDirectoryScore,
          similarity: maxSimilarityScore,
          tags: maxTagScore,
        },
        reason: "tag match (100% inclusive)",
      });
    }
  }

  const mappings: TestMapping[] = [];

  for (const testFile of testFiles) {
    if (smokeTestPaths.has(testFile.file) || tagMatchedTests.has(testFile.file)) {
      continue;
    }

    const testPath = testFile.file;
    let maxScore = 0.0;
    let maxDirectoryScore = 0.0;
    let maxSimilarityScore = 0.0;
    let maxTagScore = 0.0;
    let bestReason = "";

    for (const changedFile of diff) {
      const dirScore = calculateDirectoryScore(changedFile, testPath, config?.mappings);
      maxDirectoryScore = Math.max(maxDirectoryScore, dirScore);

      const simScore = calculateSimilarityScore(changedFile, testPath);
      maxSimilarityScore = Math.max(maxSimilarityScore, simScore);

      const tagScore = calculateTagScore(changedFile, testFile);
      maxTagScore = Math.max(maxTagScore, tagScore);

      const combined = combineScores(
        [dirScore, simScore, tagScore],
        [directoryWeight, similarityWeight, tagWeight]
      );

      if (combined > maxScore) {
        maxScore = combined;
        const reasons: string[] = [];
        if (dirScore > 0.5) reasons.push("directory match");
        if (simScore > 0.5) reasons.push("filename similarity");
        if (tagScore > 0.5) reasons.push("tag match");
        bestReason = reasons.join(", ") || "low confidence match";
      }
    }

    if (maxScore > 0) {
      mappings.push({
        testPath,
        score: maxScore,
        heuristics: {
          directory: maxDirectoryScore,
          similarity: maxSimilarityScore,
          tags: maxTagScore,
        },
        reason: bestReason,
      });
    }
  }

  const allMappings = [...smokeMappings, ...tagMatchedMappings, ...mappings];
  allMappings.sort((a, b) => b.score - a.score);

  const filteredPaths = filterBySafety(allMappings, threshold);

  const selectedSet = new Set(filteredPaths);
  for (const smokePath of smokeTestPaths) {
    selectedSet.add(smokePath);
  }

  const smokeFirst = [...smokeTestPaths];
  const others = [...selectedSet].filter((p) => !smokeTestPaths.has(p));
  const finalSelected = [...smokeFirst, ...others];

  return {
    mappings: allMappings,
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
  MappingConfig,
  SmokeConfig,
};

// Export safety thresholds and default weights
export { SAFETY_THRESHOLDS, DEFAULT_WEIGHTS };

// Export individual heuristics for testing/advanced use
export {
  calculateDirectoryScore,
  calculateSimilarityScore,
  extractMatchingTags,
  hasMatchingTag,
};
