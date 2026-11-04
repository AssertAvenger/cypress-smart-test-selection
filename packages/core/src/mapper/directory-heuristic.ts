import type { ChangedFile } from "../diff/types.js";
import type { DirectoryMapping } from "./types.js";
import { compilePatterns } from "../paths.js";

export function compileMappings(mappings: DirectoryMapping[] = []) {
  return mappings.map(({ src, test }) => ({
    sourceMatches: compilePatterns(Array.isArray(src) ? src : [src]),
    testMatches: compilePatterns(Array.isArray(test) ? test : [test]),
  }));
}

/** Both inputs must be project-relative. mapDiffToTests handles absolute paths. */
export function calculateDirectoryScore(
  changedFile: ChangedFile,
  testPath: string,
  mappings?: DirectoryMapping[],
): number {
  return compileMappings(mappings).some(({ sourceMatches, testMatches }) =>
    [changedFile.oldPath, changedFile.newPath].some((path) => path && sourceMatches(path)) &&
    testMatches(testPath)
  ) ? 1 : 0;
}
