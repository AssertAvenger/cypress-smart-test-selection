import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { mapDiffToTests } from "../../src/mapper/index.js";
import type { ChangedFile } from "../../src/diff/types.js";
import type { DiscoveredTestFile } from "../../src/discovery/types.js";

describe("Tag-based 100% inclusive selection", () => {
  it("should include ALL tests with @cart tag when cart module is changed", async () => {
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
        file: resolve("/project", "cypress/e2e/cart/checkout.spec.ts"),
        tags: ["cart", "checkout"],
        titles: [],
        tokens: [],
      },
      {
        file: resolve("/project", "cypress/e2e/login.spec.ts"),
        tags: ["login"],
        titles: [],
        tokens: [],
      },
    ];

    const result = await mapDiffToTests(diff, tests, { safetyLevel: "high" });

    // All cart-tagged tests should be included (3 tests) - 100% inclusive
    const cartTests = result.selected.filter((path) =>
      path.includes("cart")
    );
    expect(cartTests.length).toBeGreaterThanOrEqual(3);
    
    // Verify all cart-tagged tests are in the selected list
    expect(result.selected).toContain(
      resolve("/project", "cypress/e2e/cart/add-item.spec.ts")
    );
    expect(result.selected).toContain(
      resolve("/project", "cypress/e2e/cart/remove-item.spec.ts")
    );
    expect(result.selected).toContain(
      resolve("/project", "cypress/e2e/cart/checkout.spec.ts")
    );
  });

  it("should include ALL tests with @checkout tag when checkout module is changed", async () => {
    const diff: ChangedFile[] = [
      {
        newPath: "src/features/checkout/PaymentForm.tsx",
        status: "modified",
      },
    ];

    const tests: DiscoveredTestFile[] = [
      {
        file: resolve("/project", "cypress/e2e/checkout/payment.spec.ts"),
        tags: ["checkout"],
        titles: [],
        tokens: [],
      },
      {
        file: resolve("/project", "cypress/e2e/checkout/shipping.spec.ts"),
        tags: ["checkout"],
        titles: [],
        tokens: [],
      },
      {
        file: resolve("/project", "cypress/e2e/cart/add-item.spec.ts"),
        tags: ["cart"],
        titles: [],
        tokens: [],
      },
    ];

    const result = await mapDiffToTests(diff, tests, { safetyLevel: "high" });

    // All checkout-tagged tests should be included (2 tests) - 100% inclusive
    const checkoutTests = result.selected.filter((path) =>
      path.includes("checkout")
    );
    expect(checkoutTests.length).toBeGreaterThanOrEqual(2);
    
    // Verify all checkout-tagged tests are in the selected list
    expect(result.selected).toContain(
      resolve("/project", "cypress/e2e/checkout/payment.spec.ts")
    );
    expect(result.selected).toContain(
      resolve("/project", "cypress/e2e/checkout/shipping.spec.ts")
    );
  });

  it("should aggregate multiple tag matches properly", async () => {
    const diff: ChangedFile[] = [
      {
        newPath: "src/components/CartButton.tsx",
        status: "modified",
      },
      {
        newPath: "src/features/checkout/PaymentForm.tsx",
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
        file: resolve("/project", "cypress/e2e/checkout/payment.spec.ts"),
        tags: ["checkout"],
        titles: [],
        tokens: [],
      },
      {
        file: resolve("/project", "cypress/e2e/checkout/shipping.spec.ts"),
        tags: ["checkout"],
        titles: [],
        tokens: [],
      },
      {
        file: resolve("/project", "cypress/e2e/cart/checkout.spec.ts"),
        tags: ["cart", "checkout"], // Has both tags
        titles: [],
        tokens: [],
      },
      {
        file: resolve("/project", "cypress/e2e/login.spec.ts"),
        tags: ["login"],
        titles: [],
        tokens: [],
      },
    ];

    const result = await mapDiffToTests(diff, tests, { safetyLevel: "high" });

    // Should include all cart-tagged tests (3 tests) - 100% inclusive
    const cartTests = result.selected.filter((path) =>
      path.includes("cart")
    );
    expect(cartTests.length).toBeGreaterThanOrEqual(3);
    
    // Should include all checkout-tagged tests (3 tests - including the one with both tags) - 100% inclusive
    const checkoutTests = result.selected.filter((path) =>
      path.includes("checkout")
    );
    expect(checkoutTests.length).toBeGreaterThanOrEqual(3);
    
    // Verify specific cart-tagged tests are included
    expect(result.selected).toContain(
      resolve("/project", "cypress/e2e/cart/add-item.spec.ts")
    );
    expect(result.selected).toContain(
      resolve("/project", "cypress/e2e/cart/remove-item.spec.ts")
    );
    
    // Verify specific checkout-tagged tests are included
    expect(result.selected).toContain(
      resolve("/project", "cypress/e2e/checkout/payment.spec.ts")
    );
    expect(result.selected).toContain(
      resolve("/project", "cypress/e2e/checkout/shipping.spec.ts")
    );
    
    // Verify the test with both tags is included
    expect(result.selected).toContain(
      resolve("/project", "cypress/e2e/cart/checkout.spec.ts")
    );
    
    // Total should be at least 5 (3 cart + 3 checkout - 1 duplicate = 5)
    expect(result.selected.length).toBeGreaterThanOrEqual(5);
  });

  it("should bypass threshold for tag-matched tests", async () => {
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
        file: resolve("/project", "cypress/e2e/unrelated.spec.ts"),
        tags: [],
        titles: [],
        tokens: [],
      },
    ];

    // Use high safety level (threshold = 0.0, but tag-matched should still be included)
    const result = await mapDiffToTests(diff, tests, { safetyLevel: "high" });

    // Cart test should be included regardless of threshold
    expect(result.selected).toContain(
      resolve("/project", "cypress/e2e/cart/add-item.spec.ts")
    );
    
    // Check that tag-matched test has score = 1.0
    const cartMapping = result.mappings.find(
      (m) => m.testPath === resolve("/project", "cypress/e2e/cart/add-item.spec.ts")
    );
    expect(cartMapping?.score).toBe(1.0);
    expect(cartMapping?.reason).toContain("tag match");
  });

  it("should handle hyphenated tags correctly", async () => {
    const diff: ChangedFile[] = [
      {
        newPath: "src/components/UserProfile.tsx",
        status: "modified",
      },
    ];

    const tests: DiscoveredTestFile[] = [
      {
        file: resolve("/project", "cypress/e2e/user-profile.spec.ts"),
        tags: ["user-profile"],
        titles: [],
        tokens: [],
      },
      {
        file: resolve("/project", "cypress/e2e/user-settings.spec.ts"),
        tags: ["user-settings"],
        titles: [],
        tokens: [],
      },
    ];

    const result = await mapDiffToTests(diff, tests, { safetyLevel: "high" });

    // user-profile tag should match "user" and "profile" tokens
    expect(result.selected).toContain(
      resolve("/project", "cypress/e2e/user-profile.spec.ts")
    );
  });

  it("should not regress other selection logic", async () => {
    const diff: ChangedFile[] = [
      {
        newPath: "src/components/Button.tsx",
        status: "modified",
      },
    ];

    const tests: DiscoveredTestFile[] = [
      {
        file: resolve("/project", "cypress/e2e/components/button.spec.ts"),
        tags: [], // No tags, but should match via directory/filename
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

    const result = await mapDiffToTests(diff, tests, { safetyLevel: "medium" });

    // Button test should still be selected via directory/filename matching
    expect(result.selected).toContain(
      resolve("/project", "cypress/e2e/components/button.spec.ts")
    );
  });
});

