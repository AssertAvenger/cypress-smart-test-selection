import { describe, it, expect } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { discoverTests } from "../../src/discovery/discoverTests.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES_ROOT = resolve(__dirname, "../fixtures/projects");

describe("discoverTests", () => {
  describe("default patterns", () => {
    it("should discover all test file types with default patterns", async () => {
      const projectRoot = resolve(FIXTURES_ROOT, "simple");
      const files = await discoverTests({ projectRoot, extractMetadata: false });

      // Should find: button.spec.ts, input.cy.ts, auth.test.tsx, login.spec.js
      expect(files.length).toBeGreaterThanOrEqual(4);

      const fileNames = (files as string[]).map((f) => f.split("/").pop() || "");
      expect(fileNames).toContain("button.spec.ts");
      expect(fileNames).toContain("input.cy.ts");
      expect(fileNames).toContain("auth.test.tsx");
      expect(fileNames).toContain("login.spec.js");
    });

    it("should return absolute paths", async () => {
      const projectRoot = resolve(FIXTURES_ROOT, "simple");
      const files = await discoverTests({ projectRoot, extractMetadata: false });

      expect(files.length).toBeGreaterThan(0);
      (files as string[]).forEach((file) => {
        expect(file).toMatch(/^\//); // Unix absolute path
        expect(file).not.toContain(".."); // No relative paths
      });
    });

    it("should return POSIX-style paths", async () => {
      const projectRoot = resolve(FIXTURES_ROOT, "simple");
      const files = await discoverTests({ projectRoot, extractMetadata: false });

      expect(files.length).toBeGreaterThan(0);
      (files as string[]).forEach((file) => {
        expect(file).not.toContain("\\"); // No Windows backslashes
        expect(file).toContain("/"); // Forward slashes only
      });
    });

    it("should deduplicate paths", async () => {
      const projectRoot = resolve(FIXTURES_ROOT, "simple");
      const files = await discoverTests({ projectRoot, extractMetadata: false });

      const uniqueFiles = new Set(files as string[]);
      expect((files as string[]).length).toBe(uniqueFiles.size);
    });

    it("should return sorted paths", async () => {
      const projectRoot = resolve(FIXTURES_ROOT, "simple");
      const files = await discoverTests({ projectRoot, extractMetadata: false });

      const sorted = [...(files as string[])].sort();
      expect(files).toEqual(sorted);
    });
  });

  describe("custom patterns", () => {
    it("should respect custom test patterns", async () => {
      const projectRoot = resolve(FIXTURES_ROOT, "simple");
      const files = await discoverTests({
        projectRoot,
        testPatterns: ["cypress/e2e/**/*.spec.ts"],
        extractMetadata: false,
      });

      // Should only find .spec.ts files
      (files as string[]).forEach((file) => {
        expect(file).toMatch(/\.spec\.ts$/);
      });

      const fileNames = (files as string[]).map((f) => f.split("/").pop() || "");
      expect(fileNames).toContain("button.spec.ts");
      expect(fileNames).not.toContain("input.cy.ts");
    });

    it("should handle multiple custom patterns", async () => {
      const projectRoot = resolve(FIXTURES_ROOT, "simple");
      const files = await discoverTests({
        projectRoot,
        testPatterns: [
          "cypress/e2e/**/*.spec.ts",
          "cypress/e2e/**/*.cy.ts",
        ],
        extractMetadata: false,
      });

      const fileNames = (files as string[]).map((f) => f.split("/").pop() || "");
      expect(fileNames).toContain("button.spec.ts");
      expect(fileNames).toContain("input.cy.ts");
      expect(fileNames).not.toContain("auth.test.tsx");
    });

    it("should handle patterns with different extensions", async () => {
      const projectRoot = resolve(FIXTURES_ROOT, "simple");
      const files = await discoverTests({
        projectRoot,
        testPatterns: ["cypress/e2e/**/*.{ts,tsx}"],
        extractMetadata: false,
      });

      // Should find TypeScript files but not JavaScript
      const fileNames = (files as string[]).map((f) => f.split("/").pop() || "");
      expect(fileNames).toContain("button.spec.ts");
      expect(fileNames).toContain("auth.test.tsx");
      expect(fileNames).not.toContain("login.spec.js");
    });
  });

  describe("monorepo layout", () => {
    it("should discover tests in monorepo structure", async () => {
      const projectRoot = resolve(FIXTURES_ROOT, "monorepo");
      // Use default patterns that match the monorepo structure
      const files = await discoverTests({ 
        projectRoot,
        testPatterns: ["**/cypress/e2e/**/*.{spec,cy,test}.{ts,tsx,js,jsx}"],
        extractMetadata: false,
      });

      // Should find tests in both app1 and app2
      expect(files.length).toBeGreaterThanOrEqual(2);

      const fileNames = (files as string[]).map((f) => f.split("/").pop() || "");
      expect(fileNames).toContain("app1.spec.ts");
      expect(fileNames).toContain("app2.cy.ts");
    });

    it("should handle nested cypress folders in monorepo", async () => {
      const projectRoot = resolve(FIXTURES_ROOT, "monorepo");
      const files = await discoverTests({ 
        projectRoot,
        testPatterns: ["**/cypress/e2e/**/*.{spec,cy,test}.{ts,tsx,js,jsx}"],
        extractMetadata: false,
      });

      // Verify paths include the app directories
      const app1Files = (files as string[]).filter((f) => f.includes("app1"));
      const app2Files = (files as string[]).filter((f) => f.includes("app2"));

      expect(app1Files.length).toBeGreaterThan(0);
      expect(app2Files.length).toBeGreaterThan(0);
    });
  });

  describe("nested cypress folders", () => {
    it("should discover tests in deeply nested directories", async () => {
      const projectRoot = resolve(FIXTURES_ROOT, "nested");
      const files = await discoverTests({ projectRoot, extractMetadata: false });

      expect(files.length).toBeGreaterThanOrEqual(2);

      // Should find nested.spec.ts in level1/level2
      const hasNested = (files as string[]).some((f) => f.includes("nested.spec.ts"));
      expect(hasNested).toBe(true);

      // Should find deep.cy.ts in deep/nested/tests
      const hasDeep = (files as string[]).some((f) => f.includes("deep.cy.ts"));
      expect(hasDeep).toBe(true);
    });

    it("should handle multiple levels of nesting", async () => {
      const projectRoot = resolve(FIXTURES_ROOT, "nested");
      const files = await discoverTests({ projectRoot, extractMetadata: false });

      // Verify paths are correctly resolved
      (files as string[]).forEach((file) => {
        expect(file).toContain("cypress/e2e");
        expect(file).toMatch(/\.(spec|cy|test)\.(ts|tsx|js|jsx)$/);
      });
    });
  });

  describe("excluded directories", () => {
    it("should exclude node_modules by default", async () => {
      const projectRoot = resolve(FIXTURES_ROOT, "excluded");
      const files = await discoverTests({ projectRoot, extractMetadata: false });

      // Should find included.spec.ts but not the one in node_modules
      const fileNames = (files as string[]).map((f) => f.split("/").pop() || "");
      expect(fileNames).toContain("included.spec.ts");
      expect(fileNames).not.toContain("should-be-excluded.spec.ts");
    });

    it("should exclude dist by default", async () => {
      const projectRoot = resolve(FIXTURES_ROOT, "excluded");
      const files = await discoverTests({ projectRoot, extractMetadata: false });

      // Should not find files in dist directory
      const hasDistFile = (files as string[]).some((f) => f.includes("/dist/"));
      expect(hasDistFile).toBe(false);
    });

    it("should respect custom exclusion patterns", async () => {
      const projectRoot = resolve(FIXTURES_ROOT, "simple");
      const files = await discoverTests({
        projectRoot,
        exclude: ["**/features/**"],
        extractMetadata: false,
      });

      // Should not find files in features directory
      const hasFeaturesFile = (files as string[]).some((f) => f.includes("/features/"));
      expect(hasFeaturesFile).toBe(false);

      // Should still find files in components directory
      const hasComponentsFile = (files as string[]).some((f) => f.includes("/components/"));
      expect(hasComponentsFile).toBe(true);
    });

    it("should handle multiple exclusion patterns", async () => {
      const projectRoot = resolve(FIXTURES_ROOT, "simple");
      const files = await discoverTests({
        projectRoot,
        exclude: ["**/features/**", "**/*.js"],
        extractMetadata: false,
      });

      // Should not find files in features or JavaScript files
      const hasFeaturesFile = (files as string[]).some((f) => f.includes("/features/"));
      const hasJsFile = (files as string[]).some((f) => f.endsWith(".js"));

      expect(hasFeaturesFile).toBe(false);
      expect(hasJsFile).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should handle empty project (no test files)", async () => {
      // Use a temporary directory that exists but has no test files
      const projectRoot = resolve(FIXTURES_ROOT, "..");
      const files = await discoverTests({ 
        projectRoot,
        testPatterns: ["**/nonexistent-pattern/**"] 
      });

      // Should return empty array, not throw
      expect(Array.isArray(files)).toBe(true);
      expect(files.length).toBe(0);
    });

    it("should handle relative project root", async () => {
      const relativeRoot = "tests/fixtures/projects/simple";
      const files = await discoverTests({ projectRoot: relativeRoot, extractMetadata: false });

      expect(files.length).toBeGreaterThan(0);
      // All paths should still be absolute
      (files as string[]).forEach((file) => {
        expect(file).toMatch(/^\//);
      });
    });

    it("should handle absolute project root", async () => {
      const absoluteRoot = resolve(FIXTURES_ROOT, "simple");
      const files = await discoverTests({ projectRoot: absoluteRoot });

      expect(files.length).toBeGreaterThan(0);
    });

    it("should reject absolute discovery patterns", async () => {
      await expect(discoverTests({
        projectRoot: resolve(FIXTURES_ROOT, "simple"), testPatterns: ["/cypress/**/*.ts"],
      })).rejects.toThrow("Invalid project-relative pattern");
    });
  });
});
