import type { ChangedFile } from "../diff/types.js";
import type { DiscoveredTestFile } from "../discovery/types.js";
import { tokenizeFilename } from "./similarity-heuristic.js";

export function extractMatchingTags(changedFiles: ChangedFile[]): Set<string> {
  return new Set(changedFiles.flatMap((file) =>
    [file.oldPath, file.newPath].filter((p): p is string => Boolean(p)).flatMap((path) => path.split("/").flatMap(tokenizeFilename))));
}

export function hasMatchingTag(test: DiscoveredTestFile, tokens: Set<string>): boolean {
  return test.tags.some((tag) => tag.toLowerCase().trim().split(/[-_]/).some((part) => tokens.has(part)));
}

/** Tags are a heuristic signal, never a dependency or coverage guarantee. */
export function calculateTagScore(change: ChangedFile, test: DiscoveredTestFile): number {
  const tokens = extractMatchingTags([change]);
  if (test.tags.some((tag) => tokens.has(tag.toLowerCase().trim()))) return 1;
  return hasMatchingTag(test, tokens) ? 0.5 : 0;
}
