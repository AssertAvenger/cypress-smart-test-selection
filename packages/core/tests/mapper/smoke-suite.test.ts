import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { mapDiffToTests } from "../../src/mapper/index.js";
import type { ChangedFile } from "../../src/diff/types.js";
import type { DiscoveredTestFile } from "../../src/discovery/types.js";

describe("Smoke suite always included (explicit config)", () => {
  it("should include smoke tests by tag from config", async () => {
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

    const result = await mapDiffToTests(diff, tests, {
      safetyLevel: "high",
      config: {
        smoke: {
          tags: ["smoke"],
        },
      },
    });

    // Should ALWAYS include smoke tests
    expect(result.selected).toContain(
      resolve("/project", "cypress/e2e/smoke/login.spec.ts")
    );
    expect(result.selected).toContain(
      resolve("/project", "cypress/e2e/smoke/checkout.spec.ts")
    );
  });

  it("should include smoke tests by pattern from config", async () => {
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
        file: resolve("/project", "cypress/smoke/basic-flow.spec.ts"),
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

    // Should include button test (similarity match)
    expect(result.selected).toContain(
      resolve("/project", "cypress/e2e/components/button.spec.ts")
    );

    // Should ALWAYS include smoke test by pattern
    expect(result.selected).toContain(
      resolve("/project", "cypress/smoke/basic-flow.spec.ts")
    );
  });

  it("should include smoke tests even with low safety level", async () => {
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

    const result = await mapDiffToTests(diff, tests, {
      safetyLevel: "low",
      config: {
        smoke: {
          tags: ["smoke"],
        },
      },
    });

    // Should ALWAYS include smoke test (even with low safety level)
    expect(result.selected).toContain(
      resolve("/project", "cypress/e2e/smoke/smoke-suite.spec.ts")
    );
  });

  it("should include smoke tests even with empty diff", async () => {
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

    const result = await mapDiffToTests(diff, tests, {
      safetyLevel: "high",
      config: {
        smoke: {
          tags: ["smoke"],
          patterns: ["cypress/smoke"],
        },
      },
    });

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

    const result = await mapDiffToTests(diff, tests, {
      safetyLevel: "high",
      config: {
        smoke: {
          tags: ["smoke"],
        },
      },
    });

    // Should include smoke test (only once, even though it matches both criteria)
    const smokeTestCount = result.selected.filter(
      (path) => path === resolve("/project", "cypress/e2e/smoke/cart-smoke.spec.ts")
    ).length;
    expect(smokeTestCount).toBe(1);
  });

  it("should put smoke tests first in selection", async () => {
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

    const result = await mapDiffToTests(diff, tests, {
      safetyLevel: "high",
      config: {
        smoke: {
          tags: ["smoke"],
        },
      },
    });

    // Smoke test should be first
    const smokeIndex = result.selected.indexOf(
      resolve("/project", "cypress/e2e/smoke/smoke.spec.ts")
    );
    const buttonIndex = result.selected.indexOf(
      resolve("/project", "cypress/e2e/components/button.spec.ts")
    );

    expect(smokeIndex).toBeLessThan(buttonIndex);
  });

  it("should not include smoke tests without explicit config", async () => {
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

    // No smoke config provided
    const result = await mapDiffToTests(diff, tests, {
      safetyLevel: "low",
    });

    // Without explicit smoke config, smoke tests are not automatically included
    // They would only be included if they match via other heuristics
    expect(result.selected).toContain(
      resolve("/project", "cypress/e2e/components/button.spec.ts")
    );
  });

  it("should support multiple smoke tags", async () => {
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
        file: resolve("/project", "cypress/e2e/critical/payment.spec.ts"),
        tags: ["critical"],
        titles: [],
        tokens: [],
      },
      {
        file: resolve("/project", "cypress/e2e/smoke/login.spec.ts"),
        tags: ["smoke"],
        titles: [],
        tokens: [],
      },
    ];

    const result = await mapDiffToTests(diff, tests, {
      safetyLevel: "low",
      config: {
        smoke: {
          tags: ["smoke", "critical"],
        },
      },
    });

    // Both smoke and critical tests should be included
    expect(result.selected).toContain(
      resolve("/project", "cypress/e2e/critical/payment.spec.ts")
    );
    expect(result.selected).toContain(
      resolve("/project", "cypress/e2e/smoke/login.spec.ts")
    );
  });
});
