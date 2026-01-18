import type { MappingResult, TestMapping } from "cypress-smart-test-selection-core/mapper";
import type { DiscoveredTestFile } from "cypress-smart-test-selection-core/discovery";

/**
 * Format mapping result as human-readable output
 */
export function formatHuman(
  result: MappingResult,
  verbose: boolean = false,
  discoveredTests?: DiscoveredTestFile[]
): string {
  const lines: string[] = [];

  if (result.selected.length === 0) {
    lines.push("No tests selected.");
    lines.push(`\nSafety level: ${result.safetyLevel} (threshold: ${result.threshold})`);
    return lines.join("\n");
  }

  lines.push(`Selected ${result.selected.length} test${result.selected.length === 1 ? "" : "s"}:`);
  lines.push("");

  if (verbose) {
    // Show detailed scoring breakdown
    for (const mapping of result.mappings) {
      if (result.selected.includes(mapping.testPath)) {
        const testMetadata = discoveredTests?.find((t) => t.file === mapping.testPath);
        lines.push(formatMappingVerbose(mapping, testMetadata));
      }
    }
  } else {
    // Show simple list
    for (const testPath of result.selected) {
      lines.push(`  ${testPath}`);
    }
  }

  lines.push("");
  lines.push(`Safety level: ${result.safetyLevel} (threshold: ${result.threshold})`);
  lines.push(`Total mappings evaluated: ${result.mappings.length}`);

  return lines.join("\n");
}

/**
 * Format a single mapping with verbose scoring details
 */
function formatMappingVerbose(
  mapping: TestMapping,
  testMetadata?: DiscoveredTestFile
): string {
  const lines: string[] = [];
  const fileName = mapping.testPath.split("/").pop() || mapping.testPath;

  lines.push(`  ${fileName}`);
  lines.push(`    Path: ${mapping.testPath}`);
  lines.push("");

  // Show extracted metadata (tags and titles)
  if (testMetadata) {
    if (testMetadata.tags.length > 0) {
      lines.push(`    Tags: ${testMetadata.tags.join(", ")}`);
    } else {
      lines.push(`    Tags: (none)`);
    }

    if (testMetadata.titles.length > 0) {
      const titlesDisplay = testMetadata.titles.length > 3
        ? `${testMetadata.titles.slice(0, 3).join(", ")}, ... (+${testMetadata.titles.length - 3} more)`
        : testMetadata.titles.join(", ");
      lines.push(`    Titles: ${titlesDisplay}`);
    } else {
      lines.push(`    Titles: (none)`);
    }
    lines.push("");
  }

  // Show combined score
  lines.push(`    Combined Score: ${(mapping.score * 100).toFixed(1)}%`);
  lines.push("");

  // Show all individual heuristic scores
  lines.push(`    Heuristic Scores:`);
  lines.push(`      - Directory:      ${(mapping.heuristics.directory * 100).toFixed(1)}%`);
  lines.push(`      - Similarity:     ${(mapping.heuristics.similarity * 100).toFixed(1)}%`);
  lines.push(`      - Import Graph:   ${(mapping.heuristics.importGraph * 100).toFixed(1)}%`);
  lines.push(`      - Tags:           ${(mapping.heuristics.tags * 100).toFixed(1)}%`);
  lines.push(`      - Titles:         ${(mapping.heuristics.titles * 100).toFixed(1)}%`);

  if (mapping.reason) {
    lines.push("");
    lines.push(`    Reason: ${mapping.reason}`);
  }

  return lines.join("\n");
}

/**
 * Format mapping result as JSON output
 */
export function formatJson(result: MappingResult): string {
  const output = {
    selected: result.selected,
    count: result.selected.length,
    safetyLevel: result.safetyLevel,
    threshold: result.threshold,
    mappings: result.mappings.map((m: TestMapping) => ({
      testPath: m.testPath,
      score: m.score,
      heuristics: m.heuristics,
      reason: m.reason,
    })),
  };

  return JSON.stringify(output, null, 2);
}

