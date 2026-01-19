import { describe, it, expect } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mapDiffToTests } from "../../src/mapper/index.js";
import type { ChangedFile } from "../../src/diff/types.js";
import type { DiscoveredTestFile } from "../../src/discovery/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES_ROOT = resolve(__dirname, "../fixtures/mapping");

describe("mapDiffToTests", () => {
  it("should map changed files to test files using similarity", async () => {
    const diff: ChangedFile[] = [
      {
        newPath: "src/components/Button.tsx",
        status: "modified",
      },
    ];

    const tests = [
      resolve(FIXTURES_ROOT, "test-files/cypress/e2e/components/button.spec.ts"),
      resolve(FIXTURES_ROOT, "test-files/cypress/e2e/components/input.cy.ts"),
      resolve(FIXTURES_ROOT, "test-files/cypress/e2e/unrelated.spec.ts"),
    ];

    const result = await mapDiffToTests(diff, tests, {
      safetyLevel: "high",
    });

    expect(result.mappings.length).toBeGreaterThan(0);
    expect(result.selected.length).toBeGreaterThan(0);
    expect(result.safetyLevel).toBe("high");
    expect(result.threshold).toBe(0.0);
  });

  it("should select tests based on safety level", async () => {
    const diff: ChangedFile[] = [
      {
        newPath: "src/components/Button.tsx",
        status: "modified",
      },
    ];

    const tests = [
      resolve(FIXTURES_ROOT, "test-files/cypress/e2e/components/button.spec.ts"),
      resolve(FIXTURES_ROOT, "test-files/cypress/e2e/components/input.cy.ts"),
    ];

    const highResult = await mapDiffToTests(diff, tests, {
      safetyLevel: "high",
    });
    const mediumResult = await mapDiffToTests(diff, tests, {
      safetyLevel: "medium",
    });
    const lowResult = await mapDiffToTests(diff, tests, {
      safetyLevel: "low",
    });

    // High safety should select more tests
    expect(highResult.selected.length).toBeGreaterThanOrEqual(
      mediumResult.selected.length
    );
    expect(mediumResult.selected.length).toBeGreaterThanOrEqual(
      lowResult.selected.length
    );
  });

  it("should use custom threshold when provided", async () => {
    const diff: ChangedFile[] = [
      {
        newPath: "src/components/Button.tsx",
        status: "modified",
      },
    ];

    const tests = [
      resolve(FIXTURES_ROOT, "test-files/cypress/e2e/components/button.spec.ts"),
    ];

    const result = await mapDiffToTests(diff, tests, {
      safetyLevel: "high",
      threshold: 0.8,
    });

    expect(result.threshold).toBe(0.8);
  });

  it("should include heuristic scores in mappings", async () => {
    const diff: ChangedFile[] = [
      {
        newPath: "src/components/Button.tsx",
        status: "modified",
      },
    ];

    const tests = [
      resolve(FIXTURES_ROOT, "test-files/cypress/e2e/components/button.spec.ts"),
    ];

    const result = await mapDiffToTests(diff, tests);

    expect(result.mappings.length).toBeGreaterThan(0);
    const mapping = result.mappings[0];
    expect(mapping.heuristics).toBeDefined();
    expect(mapping.heuristics.directory).toBeGreaterThanOrEqual(0.0);
    expect(mapping.heuristics.similarity).toBeGreaterThanOrEqual(0.0);
    expect(mapping.heuristics.tags).toBeGreaterThanOrEqual(0.0);
  });

  it("should sort mappings by score (descending)", async () => {
    const diff: ChangedFile[] = [
      {
        newPath: "src/components/Button.tsx",
        status: "modified",
      },
    ];

    const tests = [
      resolve(FIXTURES_ROOT, "test-files/cypress/e2e/components/button.spec.ts"),
      resolve(FIXTURES_ROOT, "test-files/cypress/e2e/unrelated.spec.ts"),
    ];

    const result = await mapDiffToTests(diff, tests);

    if (result.mappings.length > 1) {
      for (let i = 0; i < result.mappings.length - 1; i++) {
        expect(result.mappings[i].score).toBeGreaterThanOrEqual(
          result.mappings[i + 1].score
        );
      }
    }
  });

  it("should handle empty diff", async () => {
    const diff: ChangedFile[] = [];
    const tests = [
      resolve(FIXTURES_ROOT, "test-files/cypress/e2e/components/button.spec.ts"),
    ];

    const result = await mapDiffToTests(diff, tests);

    expect(result.mappings).toHaveLength(0);
    expect(result.selected).toHaveLength(0);
  });

  it("should handle empty tests array", async () => {
    const diff: ChangedFile[] = [
      {
        newPath: "src/components/Button.tsx",
        status: "modified",
      },
    ];
    const tests: string[] = [];

    const result = await mapDiffToTests(diff, tests);

    expect(result.mappings).toHaveLength(0);
    expect(result.selected).toHaveLength(0);
  });

  it("should handle multiple changed files", async () => {
    const diff: ChangedFile[] = [
      {
        newPath: "src/components/Button.tsx",
        status: "modified",
      },
      {
        newPath: "src/components/Input.tsx",
        status: "modified",
      },
    ];

    const tests = [
      resolve(FIXTURES_ROOT, "test-files/cypress/e2e/components/button.spec.ts"),
      resolve(FIXTURES_ROOT, "test-files/cypress/e2e/components/input.cy.ts"),
    ];

    const result = await mapDiffToTests(diff, tests);

    expect(result.mappings.length).toBeGreaterThan(0);
    // Should find matches for both changed files
    expect(result.selected.length).toBeGreaterThan(0);
  });

  it("should use explicit directory mappings from config", async () => {
    const diff: ChangedFile[] = [
      {
        newPath: "src/features/auth/LoginForm.tsx",
        status: "modified",
      },
    ];

    const tests: DiscoveredTestFile[] = [
      {
        file: resolve("/project", "cypress/e2e/auth/login.spec.ts"),
        tags: [],
        titles: [],
        tokens: [],
      },
      {
        file: resolve("/project", "cypress/e2e/components/button.spec.ts"),
        tags: [],
        titles: [],
        tokens: [],
      },
    ];

    const result = await mapDiffToTests(diff, tests, {
      safetyLevel: "high",
      config: {
        mappings: [
          { src: "src/features/auth", test: "cypress/e2e/auth" },
        ],
      },
    });

    // Should match auth test via directory mapping
    const authMapping = result.mappings.find((m) => m.testPath.includes("auth"));
    expect(authMapping).toBeDefined();
    expect(authMapping?.heuristics.directory).toBe(1.0);
  });

  it("should always include smoke tests from config", async () => {
    const diff: ChangedFile[] = [
      {
        newPath: "src/components/Button.tsx",
        status: "modified",
      },
    ];

    const tests: DiscoveredTestFile[] = [
      {
        file: resolve("/project", "cypress/e2e/components/button.spec.ts"),
        tags: [],
        titles: [],
        tokens: [],
      },
      {
        file: resolve("/project", "cypress/e2e/smoke/critical.spec.ts"),
        tags: ["smoke"],
        titles: [],
        tokens: [],
      },
      {
        file: resolve("/project", "cypress/e2e/unrelated.spec.ts"),
        tags: [],
        titles: [],
        tokens: [],
      },
    ];

    const result = await mapDiffToTests(diff, tests, {
      safetyLevel: "low", // Even with low safety, smoke tests should be included
      config: {
        smoke: {
          tags: ["smoke"],
        },
      },
    });

    // Smoke test should always be included
    expect(result.selected).toContain(
      resolve("/project", "cypress/e2e/smoke/critical.spec.ts")
    );
  });

  it("should include smoke tests by pattern", async () => {
    const diff: ChangedFile[] = [
      {
        newPath: "src/components/Button.tsx",
        status: "modified",
      },
    ];

    const tests: DiscoveredTestFile[] = [
      {
        file: resolve("/project", "cypress/e2e/components/button.spec.ts"),
        tags: [],
        titles: [],
        tokens: [],
      },
      {
        file: resolve("/project", "cypress/smoke/health-check.spec.ts"),
        tags: [],
        titles: [],
        tokens: [],
      },
    ];

    const result = await mapDiffToTests(diff, tests, {
      safetyLevel: "medium",
      config: {
        smoke: {
          patterns: ["cypress/smoke"],
        },
      },
    });

    // Smoke test should be included by pattern
    expect(result.selected).toContain(
      resolve("/project", "cypress/smoke/health-check.spec.ts")
    );
  });
});
