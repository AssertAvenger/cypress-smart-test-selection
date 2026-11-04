import { describe, it, expect } from "vitest";
import { getThreshold, filterBySafety } from "../../src/mapper/safety.js";
import type { TestMapping } from "../../src/mapper/types.js";

describe("safety", () => {
  describe("getThreshold", () => {
    it("should return correct threshold for high safety", () => {
      const threshold = getThreshold("high");
      expect(threshold).toBe(0.0);
    });

    it("should return correct threshold for moderate safety", () => {
      const threshold = getThreshold("moderate");
      expect(threshold).toBe(0.2);
    });

    it("should return correct threshold for medium safety", () => {
      const threshold = getThreshold("medium");
      expect(threshold).toBe(0.4);
    });

    it("should return correct threshold for low safety", () => {
      const threshold = getThreshold("low");
      expect(threshold).toBe(0.7);
    });

    it("should use custom threshold when provided", () => {
      const threshold = getThreshold("high", 0.5);
      expect(threshold).toBe(0.5);
    });

    it("should reject invalid thresholds", () => {
      expect(() => getThreshold("high", -0.5)).toThrow();
      expect(() => getThreshold("high", 1.5)).toThrow();
    });
  });

  describe("filterBySafety", () => {
    const createMapping = (testPath: string, score: number): TestMapping => ({
      testPath,
      score,
      heuristics: {
        directory: score,
        similarity: score,
        importGraph: score,
        tags: score,
        titles: score,
      },
    });

    it("should include all tests with score > 0 for high safety (threshold 0.0)", () => {
      const mappings: TestMapping[] = [
        createMapping("test1.spec.ts", 0.1),
        createMapping("test2.spec.ts", 0.5),
        createMapping("test3.spec.ts", 0.9),
      ];

      const selected = filterBySafety(mappings, 0.0);

      expect(selected).toHaveLength(3);
      expect(selected).toContain("test1.spec.ts");
      expect(selected).toContain("test2.spec.ts");
      expect(selected).toContain("test3.spec.ts");
    });

    it("should exclude tests with score 0 for high safety", () => {
      const mappings: TestMapping[] = [
        createMapping("test1.spec.ts", 0.0),
        createMapping("test2.spec.ts", 0.1),
      ];

      const selected = filterBySafety(mappings, 0.0);

      expect(selected).toHaveLength(1);
      expect(selected).not.toContain("test1.spec.ts");
      expect(selected).toContain("test2.spec.ts");
    });

    it("should filter by threshold for moderate safety", () => {
      const mappings: TestMapping[] = [
        createMapping("test1.spec.ts", 0.1), // Below threshold
        createMapping("test2.spec.ts", 0.2), // At threshold
        createMapping("test3.spec.ts", 0.3), // Above threshold
      ];

      const selected = filterBySafety(mappings, 0.2);

      expect(selected).toHaveLength(2);
      expect(selected).not.toContain("test1.spec.ts");
      expect(selected).toContain("test2.spec.ts");
      expect(selected).toContain("test3.spec.ts");
    });

    it("should filter by threshold for medium safety", () => {
      const mappings: TestMapping[] = [
        createMapping("test1.spec.ts", 0.3), // Below threshold
        createMapping("test2.spec.ts", 0.4), // At threshold
        createMapping("test3.spec.ts", 0.5), // Above threshold
      ];

      const selected = filterBySafety(mappings, 0.4);

      expect(selected).toHaveLength(2);
      expect(selected).not.toContain("test1.spec.ts");
      expect(selected).toContain("test2.spec.ts");
      expect(selected).toContain("test3.spec.ts");
    });

    it("should filter by threshold for low safety", () => {
      const mappings: TestMapping[] = [
        createMapping("test1.spec.ts", 0.6), // Below threshold
        createMapping("test2.spec.ts", 0.7), // At threshold
        createMapping("test3.spec.ts", 0.8), // Above threshold
      ];

      const selected = filterBySafety(mappings, 0.7);

      expect(selected).toHaveLength(2);
      expect(selected).not.toContain("test1.spec.ts");
      expect(selected).toContain("test2.spec.ts");
      expect(selected).toContain("test3.spec.ts");
    });

    it("should return empty array when no tests meet threshold", () => {
      const mappings: TestMapping[] = [
        createMapping("test1.spec.ts", 0.1),
        createMapping("test2.spec.ts", 0.2),
      ];

      const selected = filterBySafety(mappings, 0.9);

      expect(selected).toHaveLength(0);
    });
  });
});

