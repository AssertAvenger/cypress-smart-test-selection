import { resolve, relative, sep } from "node:path";
import { parseDiff } from "cypress-smart-test-selection-core/diff";
import { discoverTests } from "cypress-smart-test-selection-core/discovery";
import { mapDiffToTests } from "cypress-smart-test-selection-core/mapper";
import type { DiffCommandOptions, MergedConfig } from "../types.js";
import { getGitDiff } from "../git/getDiff.js";
import { Logger } from "../output/logger.js";
import { formatHuman, formatJson } from "../output/formatters.js";

export async function executeDiffCommand(config: MergedConfig, options: DiffCommandOptions): Promise<number> {
  const logger = new Logger(options.logLevel ?? "normal");
  try {
    const { rawDiff, repoRoot, baseRef } = await getGitDiff(options.base ?? config.defaultBase, logger, config.projectRoot);
    const diff = parseDiff(rawDiff, { format: "name-status-z" });
    if (diff.warnings.length) throw new Error(diff.warnings.join("; "));
    const tests = await discoverTests({
      projectRoot: config.projectRoot,
      testPatterns: options.patterns ?? (config.testPatterns.length ? config.testPatterns : undefined),
      exclude: config.exclude,
      extractMetadata: true,
    });
    const result = await mapDiffToTests(diff.files.map((file) => ({
      ...file, newPath: resolve(repoRoot, file.newPath),
      oldPath: file.oldPath ? resolve(repoRoot, file.oldPath) : undefined,
    })), tests, {
      projectRoot: config.projectRoot, mode: config.mode,
      safetyLevel: config.safetyLevel, threshold: config.threshold, config,
    });
    // Portable paths for CI artifacts; the library preserves caller-supplied paths.
    const portable = (path: string) => relative(config.projectRoot, path).split(sep).join("/");
    const output = {
      ...result, selected: result.selected.map(portable),
      mappings: result.mappings.map((m) => ({ ...m, testPath: portable(m.testPath) })),
    };
    if (options.format === "json") console.log(formatJson(output, { projectRoot: config.projectRoot, baseRef }));
    else console.log(formatHuman(output, options.verbose));
    if (result.status === "no-tests") {
      logger.error("Changes detected but no specs discovered. Check projectRoot, testPatterns and exclude.");
      return 2;
    }
    return 0;
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
