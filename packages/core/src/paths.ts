import { isAbsolute, relative, resolve, sep } from "node:path";
import picomatch from "picomatch";

export function toPosix(path: string): string {
  return sep === "\\" ? path.replace(/\\/g, "/") : path;
}

export function relativePath(path: string, projectRoot: string): string {
  return toPosix(relative(projectRoot, resolve(projectRoot, path)));
}

/** Root-anchored globs, or literal file/directory prefixes. Never substring matching. */
export function compilePathPattern(pattern: string): (path: string) => boolean {
  if (!pattern || isAbsolute(pattern) || /^[A-Za-z]:/.test(pattern) ||
      pattern.split("/").includes("..") || pattern.startsWith("!") || pattern.includes("\\")) {
    throw new Error("Invalid project-relative pattern: " + JSON.stringify(pattern) +
      ". Use forward slashes and positive patterns.");
  }
  const normalized = pattern.replace(/^\.\//, "").replace(/\/+$/, "");
  if (!normalized) throw new Error("Path patterns cannot be empty");
  const isGlob = picomatch.scan(normalized).isGlob;
  const match = picomatch(normalized, { dot: true, strictBrackets: true });
  return isGlob
    ? match
    : (path) => path === normalized || path.startsWith(normalized + "/");
}

export function compilePatterns(patterns: readonly string[]): (path: string) => boolean {
  const matchers = patterns.map(compilePathPattern);
  return (path) => matchers.some((match) => match(path));
}
