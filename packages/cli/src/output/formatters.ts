import type { MappingResult } from "cypress-smart-test-selection-core/mapper";

export function formatHuman(result: MappingResult, verbose = false): string {
  const lines = [
    result.status + ": " + result.selected.length + " of " + result.totalTests + " specs selected",
    "Mode: " + result.mode,
    ...result.fallbackReasons.map((reason) => "Full-suite fallback: " + reason),
    ...result.selected.map((path) => "  " + path),
  ];
  if (verbose) {
    for (const mapping of result.mappings) {
      lines.push(mapping.testPath + ": " + mapping.reason + " (score " + mapping.score.toFixed(3) + ")");
    }
  }
  return lines.join("\n");
}

export function formatJson(result: MappingResult, context?: { projectRoot: string; baseRef: string }): string {
  return JSON.stringify({ schemaVersion: 1, ...result, count: result.selected.length, ...context }, null, 2);
}
