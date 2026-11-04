import { readFile, stat, realpath } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import type { CliConfig, MergedConfig } from "../types.js";

function object(value: unknown, name: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(name + " must be an object");
}
function strings(value: unknown, name: string, allowEmpty = true): void {
  if (!Array.isArray(value) || (!allowEmpty && !value.length) ||
      value.some((v) => typeof v !== "string" || !v.trim())) {
    throw new Error(name + " must be an array of non-empty strings");
  }
}
function validate(value: unknown): asserts value is CliConfig {
  object(value, "Config");
  const allowed = new Set(["projectRoot", "testPatterns", "exclude", "safetyLevel", "threshold",
    "defaultBase", "mappings", "smoke", "mode", "fullSuiteOnChange", "ignoreChanges"]);
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw new Error("Unknown config option: " + key);
  for (const key of ["projectRoot", "defaultBase"]) {
    if (value[key] !== undefined && (typeof value[key] !== "string" || !value[key].trim())) {
      throw new Error(key + " must be a non-empty string");
    }
  }
  for (const key of ["testPatterns", "exclude", "fullSuiteOnChange", "ignoreChanges"]) {
    if (value[key] !== undefined) strings(value[key], key);
  }
  if (value.mode !== undefined && (typeof value.mode !== "string" || !["conservative", "heuristic"].includes(value.mode))) throw new Error("Invalid mode");
  if (value.safetyLevel !== undefined && (typeof value.safetyLevel !== "string" || !["high", "moderate", "medium", "low"].includes(value.safetyLevel))) {
    throw new Error("Invalid safetyLevel");
  }
  if (value.threshold !== undefined && (typeof value.threshold !== "number" ||
      !Number.isFinite(value.threshold) || value.threshold < 0 || value.threshold > 1)) {
    throw new Error("threshold must be a finite number between 0 and 1");
  }
  if (value.mappings !== undefined) {
    if (!Array.isArray(value.mappings)) throw new Error("mappings must be an array");
    for (const mapping of value.mappings) {
      object(mapping, "Mapping");
      if (Object.keys(mapping).some((k) => k !== "src" && k !== "test")) throw new Error("Unknown mapping option");
      for (const key of ["src", "test"]) {
        strings(typeof mapping[key] === "string" ? [mapping[key]] : mapping[key], "mapping." + key, false);
      }
    }
  }
  if (value.smoke !== undefined) {
    object(value.smoke, "smoke");
    for (const [key, val] of Object.entries(value.smoke)) {
      if (key !== "patterns" && key !== "tags") throw new Error("Unknown smoke option: " + key);
      strings(val, "smoke." + key);
    }
  }
}

async function exists(path: string): Promise<boolean> {
  try { await stat(path); return true; } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export async function loadConfig(directory = process.cwd(), overrides: CliConfig = {}): Promise<MergedConfig> {
  const configRoot = resolve(directory);
  const layers: CliConfig[] = [];
  const packagePath = join(configRoot, "package.json");
  if (await exists(packagePath)) {
    const pkg = JSON.parse(await readFile(packagePath, "utf8"));
    if (pkg["cypress-test-selector"] !== undefined) {
      validate(pkg["cypress-test-selector"]);
      layers.push(pkg["cypress-test-selector"]);
    }
  }
  const candidates = ["js", "mjs", "cjs", "json", "ts"].map((ext) =>
    join(configRoot, "cypress-test-selector.config." + ext));
  const present: string[] = [];
  for (const file of candidates) if (await exists(file)) present.push(file);
  if (present.length > 1) throw new Error("Multiple selector config files found; keep exactly one.");
  if (present.length) {
    const file = present[0];
    if (file.endsWith(".ts")) throw new Error("TypeScript config is not supported. Use .mjs, .cjs, .js or .json.");
    const config = file.endsWith(".json")
      ? JSON.parse(await readFile(file, "utf8"))
      : (await import(pathToFileURL(file).href)).default;
    validate(config);
    layers.push(config);
  }
  validate(overrides);
  const merged = Object.assign({
    projectRoot: configRoot, testPatterns: [], exclude: [], safetyLevel: "medium", mode: "conservative",
  }, ...layers, overrides) as MergedConfig;
  merged.projectRoot = await realpath(resolve(configRoot, merged.projectRoot));
  if (!(await stat(merged.projectRoot)).isDirectory()) throw new Error("projectRoot must be a directory");
  return merged;
}
