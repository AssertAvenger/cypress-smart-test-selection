import type { SafetyLevel, TestMapping } from "./types.js";
import { SAFETY_THRESHOLDS } from "./types.js";

/**
 * Get threshold for a safety level
 * @param safetyLevel - Safety level
 * @param customThreshold - Optional custom threshold to override
 * @returns Threshold value (0.0 to 1.0)
 */
export function getThreshold(
  safetyLevel: SafetyLevel,
  customThreshold?: number
): number {
  if (!(Object.hasOwn(SAFETY_THRESHOLDS, safetyLevel))) throw new Error("Invalid safety level");
  if (customThreshold !== undefined) {
    if (!Number.isFinite(customThreshold) || customThreshold < 0 || customThreshold > 1) {
      throw new Error("Threshold must be a finite number between 0 and 1");
    }
    return customThreshold;
  }
  return SAFETY_THRESHOLDS[safetyLevel];
}

/**
 * Filter test mappings based on safety level and threshold
 * @param mappings - Array of test mappings
 * @param threshold - Score threshold
 * @returns Array of selected test paths
 */
export function filterBySafety(
  mappings: TestMapping[],
  threshold: number
): string[] {
  return mappings
    .filter((mapping) => {
      // For high safety (threshold = 0.0), include all with score > 0
      if (threshold === 0.0) {
        return mapping.score > 0;
      }
      // For other levels, use >= threshold
      return mapping.score >= threshold;
    })
    .map((mapping) => mapping.testPath);
}

