import { resolve } from "node:path";
import type { ChangedFile } from "../diff/types.js";
import type { DiscoveredTestFile } from "../discovery/types.js";
import type { MappingOptions, MappingResult, TestMapping } from "./types.js";
import { DEFAULT_WEIGHTS } from "./types.js";
import { compileMappings } from "./directory-heuristic.js";
import { calculateSimilarityScore } from "./similarity-heuristic.js";
import { calculateTagScore } from "./tag-heuristic.js";
import { combineScores } from "./scoring.js";
import { getThreshold } from "./safety.js";
import { compilePatterns, relativePath } from "../paths.js";

// Add project-specific shared dependencies through fullSuiteOnChange.
// These defaults cannot be disabled by ignoreChanges.
export const DEFAULT_FULL_SUITE_PATTERNS = [
  "**/package.json", "**/{package-lock.json,pnpm-lock.yaml,yarn.lock,bun.lock,bun.lockb,npm-shrinkwrap.json}",
  "**/cypress.config.*", "**/cypress.json", "**/cypress-test-selector.config.*",
  "**/cypress/{support,fixtures,plugins}/**", "**/tsconfig*.json",
  "**/{vite,webpack,rollup,babel}.config.*",
  "**/.github/workflows/**", "**/.circleci/**",
] as const;

/**
 * Select from an already discovered suite. No Git or filesystem I/O.
 * Conservative mode trusts explicit mappings, not inferred dependencies.
 */
export async function mapDiffToTests(
  diff: ChangedFile[],
  tests: string[] | DiscoveredTestFile[],
  options: MappingOptions = {},
): Promise<MappingResult> {
  const {
    projectRoot = process.cwd(), mode = "conservative", safetyLevel = "medium",
    config = {}, directoryWeight = DEFAULT_WEIGHTS.directoryWeight,
    similarityWeight = DEFAULT_WEIGHTS.similarityWeight, tagWeight = DEFAULT_WEIGHTS.tagWeight,
  } = options;
  if (mode !== "conservative" && mode !== "heuristic") throw new Error("Invalid selection mode");
  const threshold = getThreshold(safetyLevel, options.threshold);
  const weights = [directoryWeight, similarityWeight, tagWeight];
  combineScores([0, 0, 0], weights); // Validate even when there is no diff.
  const root = resolve(projectRoot);
  const rules = compileMappings(config.mappings);
  const smokeMatches = compilePatterns(config.smoke?.patterns ?? []);
  const smokeTags = new Set((config.smoke?.tags ?? []).map((t) => t.toLowerCase().trim()));
  const fullSuiteMatches = compilePatterns([...DEFAULT_FULL_SUITE_PATTERNS, ...(config.fullSuiteOnChange ?? [])]);
  const ignored = compilePatterns(config.ignoreChanges ?? []);

  const inventory = new Map<string, DiscoveredTestFile>();
  for (const test of tests) {
    const metadata = typeof test === "string" ? { file: test, tags: [], titles: [], tokens: [] } : test;
    const path = relativePath(metadata.file, root);
    if (path === ".." || path.startsWith("../")) throw new Error("Test is outside projectRoot: " + metadata.file);
    inventory.set(path, metadata);
  }
  const indexedRules = rules.map((rule) => ({
    ...rule, targets: new Set([...inventory.keys()].filter(rule.testMatches)),
  }));
  const paths = [...new Set(diff.flatMap((f) => [f.oldPath, f.newPath])
    .filter((p): p is string => Boolean(p)).map((p) => relativePath(p, root)))]
    .filter((p) => fullSuiteMatches(p) || !ignored(p)).sort();
  const result: MappingResult = {
    status: paths.length ? (inventory.size ? "selected" : "no-tests") : "no-changes",
    mode, totalTests: inventory.size, fallbackReasons: [], unmappedFiles: [],
    safetyLevel, threshold, mappings: [], selected: [],
  };
  if (!paths.length || !inventory.size) return result;

  const records = new Map<string, TestMapping>();
  const selected = new Set<string>();
  const smokePaths = new Set<string>();
  for (const [path, test] of [...inventory].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    const smoke = smokeMatches(path) || test.tags.some((t) => smokeTags.has(t.toLowerCase().trim()));
    records.set(path, {
      testPath: test.file, score: smoke ? 1 : 0,
      heuristics: { directory: 0, similarity: 0, tags: 0 },
      reason: smoke ? "smoke test (always included for changes)" : "not selected",
    });
    if (smoke) { selected.add(path); smokePaths.add(test.file); }
  }
  for (const path of paths) {
    if (fullSuiteMatches(path)) {
      result.fallbackReasons.push("Shared configuration or dependency changed: " + path);
      continue;
    }
    const matchingRules = indexedRules.filter((rule) => rule.sourceMatches(path));
    if (matchingRules.some((rule) => !rule.targets.size)) {
      result.fallbackReasons.push("Mapping has no discovered target specs for: " + path);
    }
    if (mode === "conservative" && !matchingRules.length && !inventory.has(path)) {
      result.unmappedFiles.push(path);
      continue;
    }
    let covered = false;
    const change: ChangedFile = { newPath: path, status: "modified" };
    for (const [testPath, test] of inventory) {
      const record = records.get(testPath)!;
      const direct = testPath === path;
      const directory = matchingRules.some((rule) => rule.targets.has(testPath)) ? 1 : 0;
      const similarity = mode === "heuristic" ? calculateSimilarityScore(change, testPath) : 0;
      const tags = mode === "heuristic" ? calculateTagScore(change, test) : 0;
      const score = direct || directory ? 1 : mode === "heuristic" ? combineScores([directory, similarity, tags], weights) : 0;
      const heuristicMatch = mode === "heuristic" && score > 0 && score >= threshold;
      if (direct || directory || heuristicMatch) {
        covered = true;
        selected.add(testPath);
        if (score >= record.score) {
          record.score = score;
          record.heuristics = { directory, similarity, tags };
          record.reason = direct ? "spec changed directly" : directory ? "explicit mapping: " + path : "heuristic match: " + path;
        }
      }
    }
    // Smoke tests alone do not establish coverage of an unrelated change.
    if (!covered) result.unmappedFiles.push(path);
  }
  if (result.unmappedFiles.length) {
    result.fallbackReasons.push("No applicable tests mapped for: " + result.unmappedFiles.join(", "));
  }
  if (result.fallbackReasons.length) {
    result.status = "full-suite";
    for (const [path, record] of records) {
      if (!selected.has(path)) record.reason = "full-suite fallback";
      selected.add(path);
    }
  }
  result.mappings = [...records.values()].sort((a, b) => Number(smokePaths.has(b.testPath)) - Number(smokePaths.has(a.testPath)) || b.score - a.score ||
    (a.testPath < b.testPath ? -1 : a.testPath > b.testPath ? 1 : 0));
  result.selected = result.mappings.filter((m) => selected.has(relativePath(m.testPath, root))).map((m) => m.testPath);
  return result;
}

export type {
  MappingResult, MappingOptions, SafetyLevel, TestMapping, MappingConfig, SmokeConfig, DirectoryMapping,
} from "./types.js";
export { SAFETY_THRESHOLDS, DEFAULT_WEIGHTS } from "./types.js";
export { calculateDirectoryScore } from "./directory-heuristic.js";
export { calculateSimilarityScore } from "./similarity-heuristic.js";
export { extractMatchingTags, hasMatchingTag } from "./tag-heuristic.js";
