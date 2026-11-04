import { posix } from "node:path";

function stem(path: string): string {
  return posix.basename(path.replace(/\\/g, "/")).replace(/\.[^.]+$/, "").replace(/\.(spec|test|cy)$/i, "");
}

function tokenize(value: string): string[] {
  return [...new Set(value
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase().split(/[^a-z0-9]+/).filter(Boolean))];
}

export function tokenizeFilename(path: string): string[] {
  return tokenize(stem(path));
}

export function diceCoefficient(a: string[], b: string[]): number {
  const left = new Set(a), right = new Set(b);
  if (!left.size || !right.size) return left.size === right.size ? 1 : 0;
  return 2 * [...left].filter((token) => right.has(token)).length / (left.size + right.size);
}

/** Token overlap avoids arbitrary substring matches such as cart -> chart. */
export function calculateSimilarityScore(
  change: import("../diff/types.js").ChangedFile, testPath: string,
): number {
  const paths = [change.oldPath, change.newPath].filter((p): p is string => Boolean(p));
  return Math.max(0, ...paths.map((path) => {
    const source = tokenizeFilename(path), test = tokenizeFilename(testPath);
    return source.length && test.length ? diceCoefficient(source, test) : 0;
  }));
}
