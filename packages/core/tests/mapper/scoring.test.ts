import { describe, it, expect } from "vitest";
import { combineScores, normalizeScore } from "../../src/mapper/scoring.js";

describe("scoring", () => {
  describe("combineScores", () => {
    it("should return 0 for empty scores array", () => {
      const result = combineScores([]);
      expect(result).toBe(0.0);
    });

    it("should return the score for single score", () => {
      const result = combineScores([0.5]);
      expect(result).toBe(0.5);
    });

    it("should combine multiple scores multiplicatively", () => {
      // If h1=0.5, h2=0.5, h3=0.5
      // combined = 1 - (1-0.5) * (1-0.5) * (1-0.5)
      //          = 1 - 0.5 * 0.5 * 0.5
      //          = 1 - 0.125
      //          = 0.875
      const result = combineScores([0.5, 0.5, 0.5]);
      expect(result).toBeCloseTo(0.875, 3);
    });

    it("should return 1.0 if any score is 1.0", () => {
      const result = combineScores([0.2, 1.0, 0.3]);
      expect(result).toBe(1.0);
    });

    it("should handle weighted scores", () => {
      const scores = [0.5, 0.5];
      const weights = [2.0, 1.0]; // First score weighted 2x

      const result = combineScores(scores, weights);
      // Weighted: [1.0, 0.5] (clamped to 1.0)
      // combined = 1 - (1-1.0) * (1-0.5) = 1 - 0 * 0.5 = 1.0
      expect(result).toBe(1.0);
    });

    it("should clamp scores to [0, 1] range", () => {
      const result1 = combineScores([-0.5, 0.3]);
      const result2 = combineScores([1.5, 0.3]);

      expect(result1).toBeGreaterThanOrEqual(0.0);
      expect(result1).toBeLessThanOrEqual(1.0);
      expect(result2).toBeGreaterThanOrEqual(0.0);
      expect(result2).toBeLessThanOrEqual(1.0);
    });

    it("should handle all zeros", () => {
      const result = combineScores([0.0, 0.0, 0.0]);
      expect(result).toBe(0.0);
    });

    it("should handle all ones", () => {
      const result = combineScores([1.0, 1.0, 1.0]);
      expect(result).toBe(1.0);
    });
  });

  it("honours zero weights and rejects non-finite inputs", () => {
    expect(combineScores([1, 0.5], [0, 1])).toBe(0.5);
    expect(() => combineScores([NaN])).toThrow();
    expect(() => combineScores([1], [-1])).toThrow();
  });

  describe("normalizeScore", () => {
    it("should return score as-is if in [0, 1] range", () => {
      expect(normalizeScore(0.5)).toBe(0.5);
      expect(normalizeScore(0.0)).toBe(0.0);
      expect(normalizeScore(1.0)).toBe(1.0);
    });

    it("should clamp negative scores to 0", () => {
      expect(normalizeScore(-0.5)).toBe(0.0);
      expect(normalizeScore(-10)).toBe(0.0);
    });

    it("should clamp scores > 1 to 1", () => {
      expect(normalizeScore(1.5)).toBe(1.0);
      expect(normalizeScore(10)).toBe(1.0);
    });
  });
});

