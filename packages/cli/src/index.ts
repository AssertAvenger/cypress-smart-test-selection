#!/usr/bin/env node

/**
 * CLI entry point for cypress-test-selector
 *
 * This module bootstraps the CLI and routes commands to their handlers.
 * Currently supports:
 * - diff: Map git diff to Cypress tests
 *
 * Future commands:
 * - run: Run Cypress with filtered tests
 * - debug: Show scoring breakdown
 */

import { parseArgs } from "node:util";
import { loadConfig } from "./config/loadConfig.js";
import { executeDiffCommand } from "./commands/diff.js";
import type { DiffCommandOptions } from "./types.js";

/**
 * Parse CLI arguments
 */
function parseCliArgs(): {
  command: string;
  options: DiffCommandOptions;
  configOverrides: Record<string, unknown>;
  values: Record<string, unknown>;
} {
  const { values, positionals } = parseArgs({
    options: {
      base: {
        type: "string",
        short: "b",
        description: "Git base reference (branch, commit, etc.)",
      },
      json: {
        type: "boolean",
        short: "j",
        description: "Output in JSON format",
      },
      verbose: {
        type: "boolean",
        short: "v",
        description: "Verbose output with scoring breakdown",
      },
      pattern: {
        type: "string",
        multiple: true,
        short: "p",
        description: "Custom test file patterns",
      },
      "log-level": {
        type: "string",
        description: "Logging level: silent, normal, verbose, debug",
      },
      help: {
        type: "boolean",
        short: "h",
        description: "Show help",
      },
    },
    allowPositionals: true,
    strict: true,
  });

  const command = positionals[0] || "diff";

  const options: DiffCommandOptions = {
    base: values.base,
    format: values.json ? "json" : "human",
    verbose: values.verbose || false,
    patterns: values.pattern ? (Array.isArray(values.pattern) ? values.pattern : [values.pattern]) : undefined,
    logLevel: (values["log-level"] as DiffCommandOptions["logLevel"]) || "normal",
  };

  return { command, options, configOverrides: {}, values };
}

/**
 * Show help message
 */
function showHelp(): void {
  console.log(`
cy-select - Intelligent Cypress test selection based on git diffs

Usage:
  cy-select <command> [options]

Commands:
  diff    Map git diff to Cypress tests (default)

Options:
  -b, --base <ref>        Git base reference (default: auto-detect)
  -j, --json              Output in JSON format
  -v, --verbose           Verbose output with scoring breakdown
  -p, --pattern <pattern> Custom test file patterns (can be used multiple times)
  --log-level <level>     Logging level: silent, normal, verbose, debug
  -h, --help              Show this help message

Examples:
  cy-select diff
  cy-select diff --base origin/main
  cy-select diff --json
  cy-select diff --verbose
  cy-select diff --pattern "**/*.spec.ts" --pattern "**/*.test.ts"

Configuration:
  The CLI reads configuration from (in order of priority):
  1. CLI arguments
  2. cypress-test-selector.config.ts (or .js)
  3. package.json "cypress-test-selector" key
  4. Defaults

For more information, visit: https://github.com/AssertAvenger/cypress-smart-test-selection
`);
}

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  try {
    const { command, options, configOverrides, values } = parseCliArgs();

    // Show help if requested
    if (values.help || command === "help") {
      showHelp();
      process.exit(0);
    }

    // Load configuration
    const config = await loadConfig(process.cwd(), configOverrides);

    // Route to command handler
    let exitCode: number;
    switch (command) {
      case "diff":
        exitCode = await executeDiffCommand(config, options);
        break;
      case "help":
        showHelp();
        exitCode = 0;
        break;
      default:
        console.error(`Unknown command: ${command}`);
        console.error("Run 'cy-select --help' for usage information.");
        exitCode = 1;
    }

    process.exit(exitCode);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`Fatal error: ${errorMessage}`);
    if (process.env.DEBUG) {
      console.error(error);
    }
    process.exit(1);
  }
}

export { main };

