import fg from "fast-glob";
import { realpath, stat } from "node:fs/promises";
import { relative, resolve } from "node:path";
import type { DiscoverOptions, DiscoveredTestFile } from "./types.js";
import { DEFAULT_TEST_PATTERNS, DEFAULT_EXCLUDE_PATTERNS } from "./patterns.js";
import { extractTestMetadata } from "./metadata.js";
import { compilePathPattern, toPosix } from "../paths.js";

export function discoverTests(options: DiscoverOptions & { extractMetadata: false }): Promise<string[]>;
export function discoverTests(options: DiscoverOptions & { extractMetadata?: true }): Promise<DiscoveredTestFile[]>;
export function discoverTests(options: DiscoverOptions): Promise<string[] | DiscoveredTestFile[]>;
export async function discoverTests(options: DiscoverOptions): Promise<string[] | DiscoveredTestFile[]> {
  const { projectRoot, testPatterns, exclude = [], extractMetadata = true } = options;
  const root = resolve(projectRoot);
  if (!(await stat(root)).isDirectory()) throw new Error("projectRoot must be a directory");
  const realRoot = await realpath(root);
  const patterns = [...testPatterns ?? DEFAULT_TEST_PATTERNS];
  const ignore = [...DEFAULT_EXCLUDE_PATTERNS, ...exclude];
  for (const pattern of [...patterns, ...ignore]) compilePathPattern(pattern);
  const files = [...new Set(await fg(patterns, {
    cwd: root, absolute: true, ignore, onlyFiles: true, unique: true,
    caseSensitiveMatch: true, followSymbolicLinks: false,
  }))].map(toPosix).sort();

  const discovered: DiscoveredTestFile[] = [];
  // Bound open files on large suites; a missing/unreadable spec is an error.
  for (let offset = 0; offset < files.length; offset += 32) {
    const batch = await Promise.all(files.slice(offset, offset + 32).map(async (file) => {
      const resolved = toPosix(relative(realRoot, await realpath(file)));
      if (resolved === ".." || resolved.startsWith("../")) throw new Error("Spec points outside projectRoot: " + file);
      const metadata = extractMetadata ? await extractTestMetadata(file) : { tags: [], titles: [], tokens: [] };
      return { file, ...metadata };
    }));
    discovered.push(...batch);
  }
  return extractMetadata ? discovered : files;
}
