import { parseDiff } from "cypress-smart-test-selection-core/diff";
import { discoverTests } from "cypress-smart-test-selection-core/discovery";
import type { DiscoveredTestFile } from "cypress-smart-test-selection-core/discovery";
import { mapDiffToTests } from "cypress-smart-test-selection-core/mapper";
import type { DiffCommandOptions, MergedConfig } from "../types.js";
import { getGitDiff, isGitRepository } from "../git/getDiff.js";
import { Logger } from "../output/logger.js";
import { formatHuman, formatJson } from "../output/formatters.js";

/**
 * Execute the diff command
 *
 * This is the main entry point for the `cy-select diff` command.
 * It orchestrates:
 * 1. Loading configuration
 * 2. Getting git diff
 * 3. Parsing diff
 * 4. Discovering tests
 * 5. Mapping diff to tests
 * 6. Formatting and outputting results
 */
export async function executeDiffCommand(
  config: MergedConfig,
  options: DiffCommandOptions
): Promise<number> {
  const logger = new Logger(options.logLevel || "normal");

  try {
    // Validate git repository
    const isGit = await isGitRepository();
    if (!isGit) {
      logger.error("Not a git repository. Please run this command from a git repository.");
      return 1;
    }

    logger.debug(`Project root: ${config.projectRoot}`);
    logger.debug(`Safety level: ${config.safetyLevel}`);

    // Step 1: Get git diff
    logger.verbose("Fetching git diff...");
    const rawDiff = await getGitDiff(options.base, logger);

    if (!rawDiff || !rawDiff.trim()) {
      logger.info("No changes detected. No tests to run.");
      return 0;
    }

    // Step 2: Parse diff
    logger.verbose("Parsing git diff...");
    const diffResult = parseDiff(rawDiff);
    if (diffResult.warnings.length > 0) {
      for (const warning of diffResult.warnings) {
        logger.warn(warning);
      }
    }

    if (diffResult.files.length === 0) {
      logger.info("No changed files detected.");
      return 0;
    }

    logger.debug(`Found ${diffResult.files.length} changed file(s)`);
    if (logger.setLevel.name === "debug") {
      // Only log file list in debug mode
      for (const file of diffResult.files) {
        logger.debug(`  - ${file.newPath} (${file.status})`);
      }
    }

    // Step 3: Discover tests (with metadata extraction)
    logger.verbose("Discovering test files...");
    const testPatterns = options.patterns || config.testPatterns;
    const discoveredTests = await discoverTests({
      projectRoot: config.projectRoot,
      testPatterns: testPatterns.length > 0 ? testPatterns : undefined,
      exclude: config.exclude.length > 0 ? config.exclude : undefined,
      extractMetadata: true,
    });

    // Normalize to DiscoveredTestFile[] format
    const tests: DiscoveredTestFile[] = Array.isArray(discoveredTests) && discoveredTests.length > 0
      ? (typeof discoveredTests[0] === "string" 
          ? (discoveredTests as string[]).map((t) => ({ file: t, tags: [], titles: [], tokens: [] }))
          : (discoveredTests as DiscoveredTestFile[]))
      : [];

    if (tests.length === 0) {
      logger.warn("No test files found in project.");
      return 0;
    }

    logger.debug(`Found ${tests.length} test file(s)`);

    // Step 4: Map diff to tests
    logger.verbose("Mapping changed files to tests...");
    const mappingResult = await mapDiffToTests(diffResult.files, tests, {
      safetyLevel: config.safetyLevel,
      threshold: config.threshold,
      config: {
        mappings: config.mappings,
        smoke: config.smoke,
      },
    });

    logger.debug(
      `Mapped to ${mappingResult.selected.length} test(s) out of ${mappingResult.mappings.length} evaluated`
    );

    // Step 5: Format and output
    if (options.format === "json") {
      console.log(formatJson(mappingResult));
    } else {
      const output = formatHuman(
        mappingResult,
        options.verbose || false,
        tests
      );
      console.log(output);
    }

    // Return exit code: 0 if tests selected, 1 if none
    return mappingResult.selected.length > 0 ? 0 : 1;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error(`Error executing diff command: ${errorMessage}`, error);
    return 1;
  }
}
