import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { mapDiffToTests } from "../../src/mapper/index.js";
import type { ChangedFile } from "../../src/diff/types.js";
import type { DiscoveredTestFile } from "../../src/discovery/types.js";

describe("Smoke suite always included", () => {
  it("should include smoke tests in tag-based runs", async () => {
    const diff: ChangedFile[] = [
      {
        newPath: "src/components/CartButton.tsx",
        status: "modified",
      },
    ];

    const tests: DiscoveredTestFile[] = [
      {
        file: resolve("/project", "cypress/e2e/cart/add-item.spec.ts"),
        tags: ["cart"],
        titles: [],
        tokens: [],
      },
      {
        file: resolve("/project", "cypress/e2e/cart/remove-item.spec.ts"),
        tags: ["cart"],
        titles: [],
        tokens: [],
      },
      {
        file: resolve("/project", "cypress/e2e/smoke/login.spec.ts"),
        tags: ["smoke"],
        titles: [],
        tokens: [],
      },
      {
        file: resolve("/project", "cypress/e2e/smoke/checkout.spec.ts"),
        tags: ["smoke"],
        titles: [],
        tokens: [],
      },
    ];

    const result = await mapDiffToTests(diff, tests, { safetyLevel: "high" });

    // Should include cart-tagged tests
    expect(result.selected).toContain(
      resolve("/project", "cypress/e2e/cart/add-item.spec.ts")
    );
    expect(result.selected).toContain(
      resolve("/project", "cypress/e2e/cart/remove-item.spec.ts")
    );

    // Should ALWAYS include smoke tests
    expect(result.selected).toContain(
      resolve("/project", "cypress/e2e/smoke/login.spec.ts")
    );
    expect(result.selected).toContain(
      resolve("/project", "cypress/e2e/smoke/checkout.spec.ts")
    );

    // Verify smoke tests are in the selected list (they may have been selected via tags or as smoke tests)
    expect(result.selected.length).toBeGreaterThanOrEqual(4);
  });

  it("should include smoke tests in module-based runs", async () => {
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
        file: resolve("/project", "cypress/e2e/components/input.spec.ts"),
        tags: [],
        titles: [],
        tokens: [],
      },
      {
        file: resolve("/project", "cypress/smoke/basic-flow.spec.ts"),
        tags: [],
        titles: [],
        tokens: [],
      },
    ];

    const result = await mapDiffToTests(diff, tests, { safetyLevel: "medium" });

    // Should include button test (module-based match)
    expect(result.selected).toContain(
      resolve("/project", "cypress/e2e/components/button.spec.ts")
    );

    // Should ALWAYS include smoke test (even though it's in smoke/ path, not tagged)
    expect(result.selected).toContain(
      resolve("/project", "cypress/smoke/basic-flow.spec.ts")
    );
  });

  it("should include smoke tests in single-spec runs", async () => {
    const diff: ChangedFile[] = [
      {
        newPath: "src/features/auth/LoginForm.tsx",
        status: "modified",
      },
    ];

    const tests: DiscoveredTestFile[] = [
      {
        file: resolve("/project", "cypress/e2e/auth/login.spec.ts"),
        tags: ["auth"],
        titles: [],
        tokens: [],
      },
      {
        file: resolve("/project", "cypress/e2e/smoke/smoke-suite.spec.ts"),
        tags: ["smoke"],
        titles: [],
        tokens: [],
      },
    ];

    const result = await mapDiffToTests(diff, tests, { safetyLevel: "low" });

    // Should include auth test (tag match)
    expect(result.selected).toContain(
      resolve("/project", "cypress/e2e/auth/login.spec.ts")
    );

    // Should ALWAYS include smoke test (even with low safety level)
    expect(result.selected).toContain(
      resolve("/project", "cypress/e2e/smoke/smoke-suite.spec.ts")
    );
  });

  it("should include smoke tests in empty-diff fallback runs", async () => {
    const diff: ChangedFile[] = []; // Empty diff

    const tests: DiscoveredTestFile[] = [
      {
        file: resolve("/project", "cypress/e2e/components/button.spec.ts"),
        tags: [],
        titles: [],
        tokens: [],
      },
      {
        file: resolve("/project", "cypress/e2e/smoke/smoke.spec.ts"),
        tags: ["smoke"],
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

    const result = await mapDiffToTests(diff, tests, { safetyLevel: "high" });

    // With empty diff, no regular tests should be selected
    expect(result.selected).not.toContain(
      resolve("/project", "cypress/e2e/components/button.spec.ts")
    );

    // But smoke tests should ALWAYS be included
    expect(result.selected).toContain(
      resolve("/project", "cypress/e2e/smoke/smoke.spec.ts")
    );
    expect(result.selected).toContain(
      resolve("/project", "cypress/smoke/health-check.spec.ts")
    );
  });

  it("should include smoke tests identified by path (cypress/smoke)", async () => {
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
        file: resolve("/project", "cypress/smoke/smoke-test.spec.ts"),
        tags: [], // No smoke tag, but in smoke/ path
        titles: [],
        tokens: [],
      },
    ];

    const result = await mapDiffToTests(diff, tests, { safetyLevel: "medium" });

    // Should include button test
    expect(result.selected).toContain(
      resolve("/project", "cypress/e2e/components/button.spec.ts")
    );

    // Should include smoke test by path
    expect(result.selected).toContain(
      resolve("/project", "cypress/smoke/smoke-test.spec.ts")
    );
  });

  it("should include smoke tests identified by @smoke tag", async () => {
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
        file: resolve("/project", "cypress/e2e/features/smoke-test.spec.ts"),
        tags: ["smoke"], // Has smoke tag, but not in smoke/ path
        titles: [],
        tokens: [],
      },
    ];

    const result = await mapDiffToTests(diff, tests, { safetyLevel: "medium" });

    // Should include button test
    expect(result.selected).toContain(
      resolve("/project", "cypress/e2e/components/button.spec.ts")
    );

    // Should include smoke test by tag
    expect(result.selected).toContain(
      resolve("/project", "cypress/e2e/features/smoke-test.spec.ts")
    );
  });

  it("should not duplicate smoke tests if already selected", async () => {
    const diff: ChangedFile[] = [
      {
        newPath: "src/components/CartButton.tsx",
        status: "modified",
      },
    ];

    const tests: DiscoveredTestFile[] = [
      {
        file: resolve("/project", "cypress/e2e/cart/add-item.spec.ts"),
        tags: ["cart"],
        titles: [],
        tokens: [],
      },
      {
        file: resolve("/project", "cypress/e2e/smoke/cart-smoke.spec.ts"),
        tags: ["smoke", "cart"], // Both smoke and cart tags
        titles: [],
        tokens: [],
      },
    ];

    const result = await mapDiffToTests(diff, tests, { safetyLevel: "high" });

    // Should include cart test
    expect(result.selected).toContain(
      resolve("/project", "cypress/e2e/cart/add-item.spec.ts")
    );

    // Should include smoke test (only once, even though it matches both criteria)
    const smokeTestCount = result.selected.filter(
      (path) => path === resolve("/project", "cypress/e2e/smoke/cart-smoke.spec.ts")
    ).length;
    expect(smokeTestCount).toBe(1);
  });

  it("should append smoke tests at the end of selection", async () => {
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
        file: resolve("/project", "cypress/e2e/smoke/smoke.spec.ts"),
        tags: ["smoke"],
        titles: [],
        tokens: [],
      },
    ];

    const result = await mapDiffToTests(diff, tests, { safetyLevel: "high" });

    // Smoke test should be at the end
    const buttonIndex = result.selected.indexOf(
      resolve("/project", "cypress/e2e/components/button.spec.ts")
    );
    const smokeIndex = result.selected.indexOf(
      resolve("/project", "cypress/e2e/smoke/smoke.spec.ts")
    );

    expect(smokeIndex).toBeGreaterThan(buttonIndex);
  });
});

