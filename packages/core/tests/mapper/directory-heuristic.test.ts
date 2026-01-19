import { describe, it, expect } from "vitest";
import { resolve } from "node:path";
import { calculateDirectoryScore } from "../../src/mapper/directory-heuristic.js";
import type { ChangedFile } from "../../src/diff/types.js";
import type { DirectoryMapping } from "../../src/mapper/types.js";

describe("directory-heuristic", () => {
  describe("calculateDirectoryScore with explicit mappings", () => {
    it("should return 1.0 when source and test match explicit mapping", () => {
      const changedFile: ChangedFile = {
        newPath: "src/components/Button.tsx",
        status: "modified",
      };
      const testPath = resolve("/project", "cypress/e2e/components/button.spec.ts");
      const mappings: DirectoryMapping[] = [
        { src: "src/components", test: "cypress/e2e/components" },
      ];

      const score = calculateDirectoryScore(changedFile, testPath, mappings);

      expect(score).toBe(1.0);
    });

    it("should return 0 when no mappings are configured", () => {
      const changedFile: ChangedFile = {
        newPath: "src/components/Button.tsx",
        status: "modified",
      };
      const testPath = resolve("/project", "cypress/e2e/components/button.spec.ts");

      const score = calculateDirectoryScore(changedFile, testPath, undefined);

      expect(score).toBe(0.0);
    });

    it("should return 0 when mappings array is empty", () => {
      const changedFile: ChangedFile = {
        newPath: "src/components/Button.tsx",
        status: "modified",
      };
      const testPath = resolve("/project", "cypress/e2e/components/button.spec.ts");

      const score = calculateDirectoryScore(changedFile, testPath, []);

      expect(score).toBe(0.0);
    });

    it("should return 0 when source matches but test does not", () => {
      const changedFile: ChangedFile = {
        newPath: "src/components/Button.tsx",
        status: "modified",
      };
      const testPath = resolve("/project", "cypress/e2e/features/auth.spec.ts");
      const mappings: DirectoryMapping[] = [
        { src: "src/components", test: "cypress/e2e/components" },
      ];

      const score = calculateDirectoryScore(changedFile, testPath, mappings);

      expect(score).toBe(0.0);
    });

    it("should return 0 when test matches but source does not", () => {
      const changedFile: ChangedFile = {
        newPath: "src/features/auth/Login.tsx",
        status: "modified",
      };
      const testPath = resolve("/project", "cypress/e2e/components/button.spec.ts");
      const mappings: DirectoryMapping[] = [
        { src: "src/components", test: "cypress/e2e/components" },
      ];

      const score = calculateDirectoryScore(changedFile, testPath, mappings);

      expect(score).toBe(0.0);
    });

    it("should support multiple mappings", () => {
      const changedFile: ChangedFile = {
        newPath: "src/features/auth/LoginForm.tsx",
        status: "modified",
      };
      const testPath = resolve("/project", "cypress/e2e/auth/login-form.spec.ts");
      const mappings: DirectoryMapping[] = [
        { src: "src/components", test: "cypress/e2e/components" },
        { src: "src/features/auth", test: "cypress/e2e/auth" },
      ];

      const score = calculateDirectoryScore(changedFile, testPath, mappings);

      expect(score).toBe(1.0);
    });

    it("should support array of src paths in mapping", () => {
      const changedFile: ChangedFile = {
        newPath: "lib/utils/helpers.ts",
        status: "modified",
      };
      const testPath = resolve("/project", "cypress/e2e/utils/helpers.spec.ts");
      const mappings: DirectoryMapping[] = [
        { src: ["src/utils", "lib/utils"], test: "cypress/e2e/utils" },
      ];

      const score = calculateDirectoryScore(changedFile, testPath, mappings);

      expect(score).toBe(1.0);
    });

    it("should support array of test paths in mapping", () => {
      const changedFile: ChangedFile = {
        newPath: "src/components/Button.tsx",
        status: "modified",
      };
      const testPath = resolve("/project", "cypress/integration/components/button.spec.ts");
      const mappings: DirectoryMapping[] = [
        { src: "src/components", test: ["cypress/e2e/components", "cypress/integration/components"] },
      ];

      const score = calculateDirectoryScore(changedFile, testPath, mappings);

      expect(score).toBe(1.0);
    });

    it("should support arrays for both src and test paths", () => {
      const changedFile: ChangedFile = {
        newPath: "lib/shared/utils.ts",
        status: "modified",
      };
      const testPath = resolve("/project", "tests/e2e/shared/utils.spec.ts");
      const mappings: DirectoryMapping[] = [
        { 
          src: ["src/shared", "lib/shared"], 
          test: ["cypress/e2e/shared", "tests/e2e/shared"] 
        },
      ];

      const score = calculateDirectoryScore(changedFile, testPath, mappings);

      expect(score).toBe(1.0);
    });

    it("should handle nested directories", () => {
      const changedFile: ChangedFile = {
        newPath: "src/features/auth/components/LoginButton.tsx",
        status: "modified",
      };
      const testPath = resolve("/project", "cypress/e2e/features/auth/components/login-button.spec.ts");
      const mappings: DirectoryMapping[] = [
        { src: "src/features", test: "cypress/e2e/features" },
      ];

      const score = calculateDirectoryScore(changedFile, testPath, mappings);

      expect(score).toBe(1.0);
    });

    it("should handle renamed files using newPath", () => {
      const changedFile: ChangedFile = {
        oldPath: "src/components/OldButton.tsx",
        newPath: "src/components/NewButton.tsx",
        status: "renamed",
      };
      const testPath = resolve("/project", "cypress/e2e/components/new-button.spec.ts");
      const mappings: DirectoryMapping[] = [
        { src: "src/components", test: "cypress/e2e/components" },
      ];

      const score = calculateDirectoryScore(changedFile, testPath, mappings);

      expect(score).toBe(1.0);
    });

    it("should return 0 for missing paths", () => {
      const changedFile: ChangedFile = {
        newPath: "",
        status: "modified",
      };
      const testPath = resolve("/project", "cypress/e2e/test.spec.ts");
      const mappings: DirectoryMapping[] = [
        { src: "src", test: "cypress/e2e" },
      ];

      const score = calculateDirectoryScore(changedFile, testPath, mappings);

      expect(score).toBe(0.0);
    });

    it("should not use filesystem proximity heuristics", () => {
      // This test verifies that without explicit mappings, even files
      // in similar directories get a score of 0
      const changedFile: ChangedFile = {
        newPath: "src/components/Button.tsx",
        status: "modified",
      };
      const testPath = resolve("/project", "cypress/e2e/components/button.spec.ts");
      
      // No mappings - should return 0 even though paths are similar
      const score = calculateDirectoryScore(changedFile, testPath, []);

      expect(score).toBe(0.0);
    });
  });
});
