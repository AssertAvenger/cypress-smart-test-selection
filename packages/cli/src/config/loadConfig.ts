import { readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import type { CliConfig, MergedConfig } from "../types.js";

/**
 * Default configuration
 */
const DEFAULT_CONFIG: MergedConfig = {
  projectRoot: process.cwd(),
  testPatterns: [],
  exclude: [],
  safetyLevel: "medium",
  defaultBase: "origin/main",
};

/**
 * Validate configuration structure
 */
function validateConfig(config: unknown, source: string): void {
  if (config === null || typeof config !== "object") {
    throw new Error(`Invalid config from ${source}: expected an object`);
  }

  const cfg = config as Record<string, unknown>;

  if (cfg.mappings !== undefined) {
    if (!Array.isArray(cfg.mappings)) {
      throw new Error(`Invalid config from ${source}: 'mappings' must be an array`);
    }
    for (let i = 0; i < cfg.mappings.length; i++) {
      const mapping = cfg.mappings[i] as Record<string, unknown>;
      if (!mapping || typeof mapping !== "object") {
        throw new Error(`Invalid config from ${source}: mappings[${i}] must be an object`);
      }
      if (mapping.src === undefined) {
        throw new Error(`Invalid config from ${source}: mappings[${i}].src is required`);
      }
      if (mapping.test === undefined) {
        throw new Error(`Invalid config from ${source}: mappings[${i}].test is required`);
      }
      if (typeof mapping.src !== "string" && !Array.isArray(mapping.src)) {
        throw new Error(`Invalid config from ${source}: mappings[${i}].src must be a string or array of strings`);
      }
      if (Array.isArray(mapping.src) && !mapping.src.every((s) => typeof s === "string")) {
        throw new Error(`Invalid config from ${source}: mappings[${i}].src must be a string or array of strings`);
      }
      if (typeof mapping.test !== "string" && !Array.isArray(mapping.test)) {
        throw new Error(`Invalid config from ${source}: mappings[${i}].test must be a string or array of strings`);
      }
      if (Array.isArray(mapping.test) && !mapping.test.every((s) => typeof s === "string")) {
        throw new Error(`Invalid config from ${source}: mappings[${i}].test must be a string or array of strings`);
      }
    }
  }

  if (cfg.smoke !== undefined) {
    if (cfg.smoke === null || typeof cfg.smoke !== "object") {
      throw new Error(`Invalid config from ${source}: 'smoke' must be an object`);
    }
    const smoke = cfg.smoke as Record<string, unknown>;
    if (smoke.patterns !== undefined) {
      if (!Array.isArray(smoke.patterns)) {
        throw new Error(`Invalid config from ${source}: smoke.patterns must be an array`);
      }
      if (!smoke.patterns.every((p) => typeof p === "string")) {
        throw new Error(`Invalid config from ${source}: smoke.patterns must be an array of strings`);
      }
    }
    if (smoke.tags !== undefined) {
      if (!Array.isArray(smoke.tags)) {
        throw new Error(`Invalid config from ${source}: smoke.tags must be an array`);
      }
      if (!smoke.tags.every((t) => typeof t === "string")) {
        throw new Error(`Invalid config from ${source}: smoke.tags must be an array of strings`);
      }
    }
  }

  if (cfg.safetyLevel !== undefined) {
    const validLevels = ["high", "moderate", "medium", "low"];
    if (!validLevels.includes(cfg.safetyLevel as string)) {
      throw new Error(`Invalid config from ${source}: safetyLevel must be one of: ${validLevels.join(", ")}`);
    }
  }

  if (cfg.threshold !== undefined) {
    if (typeof cfg.threshold !== "number" || cfg.threshold < 0 || cfg.threshold > 1) {
      throw new Error(`Invalid config from ${source}: threshold must be a number between 0 and 1`);
    }
  }
}

/**
 * Load configuration from cypress-test-selector.config.js
 */
async function loadConfigFile(projectRoot: string): Promise<CliConfig | null> {
  const jsConfigPath = join(projectRoot, "cypress-test-selector.config.js");
  try {
    const config = await import(jsConfigPath);
    const loadedConfig = config.default || config;
    validateConfig(loadedConfig, jsConfigPath);
    return loadedConfig;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Invalid config")) {
      throw error;
    }
    return null;
  }
}

/**
 * Load configuration from package.json
 */
async function loadPackageJsonConfig(
  projectRoot: string
): Promise<CliConfig | null> {
  const packageJsonPath = join(projectRoot, "package.json");
  try {
    const content = await readFile(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(content);
    const config = packageJson["cypress-test-selector"];
    if (config) {
      validateConfig(config, `${packageJsonPath} ["cypress-test-selector"]`);
    }
    return config || null;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Invalid config")) {
      throw error;
    }
    return null;
  }
}

/**
 * Load and merge configuration from all sources
 */
export async function loadConfig(
  projectRoot: string = process.cwd(),
  cliOverrides: Partial<CliConfig> = {}
): Promise<MergedConfig> {
  const config: MergedConfig = { ...DEFAULT_CONFIG };

  const configFile = await loadConfigFile(projectRoot);
  if (configFile) {
    Object.assign(config, configFile);
  }

  const packageJsonConfig = await loadPackageJsonConfig(projectRoot);
  if (packageJsonConfig) {
    Object.assign(config, packageJsonConfig);
  }

  Object.assign(config, cliOverrides);

  if (config.projectRoot) {
    config.projectRoot = resolve(config.projectRoot);
  }

  return config;
}
