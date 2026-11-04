import type { MappingConfig, SafetyLevel } from "cypress-smart-test-selection-core/mapper";

export interface CliConfig extends MappingConfig {
  projectRoot?: string;
  testPatterns?: string[];
  exclude?: string[];
  safetyLevel?: SafetyLevel;
  threshold?: number;
  defaultBase?: string;
  mode?: "conservative" | "heuristic";
}

export interface DiffCommandOptions {
  base?: string;
  format?: "human" | "json";
  verbose?: boolean;
  patterns?: string[];
  logLevel?: "silent" | "normal" | "verbose" | "debug";
}

export interface MergedConfig extends CliConfig {
  projectRoot: string;
  testPatterns: string[];
  exclude: string[];
  safetyLevel: SafetyLevel;
  mode: "conservative" | "heuristic";
}
