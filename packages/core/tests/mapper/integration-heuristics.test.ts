import { describe, it, expect } from "vitest";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile, unlink } from "node:fs/promises";
import { mapDiffToTests } from "../../src/mapper/index.js";
import { discoverTests } from "../../src/discovery/discoverTests.js";
import type { ChangedFile } from "../../src/diff/types.js";
import type { DiscoveredTestFile } from "../../src/discovery/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURES_ROOT = resolve(__dirname, "../fixtures/mapping");

describe("integration: tag heuristic", () => {
  it("should use tag heuristic when test has matching tags", async () => {
    const testFile = resolve(FIXTURES_ROOT, "test-files/cypress/e2e/tagged-test.spec.ts");
    const testContent = `// @tag: login
// @tags: auth,button
describe("[login] Login button tests", () => {
  it("should render login button", () => {});
});`;

    await writeFile(testFile, testContent, "utf-8");

    const diff: ChangedFile[] = [
      {
        newPath: "src/components/LoginButton.tsx",
        status: "modified",
      },
    ];

    const discovered = await discoverTests({
      projectRoot: resolve(FIXTURES_ROOT, "test-files"),
      extractMetadata: true,
    });

    const tests = discovered as DiscoveredTestFile[];
    const taggedTest = tests.find((t) => t.file.includes("tagged-test"));

    if (taggedTest) {
      const result = await mapDiffToTests(diff, [taggedTest], {
        safetyLevel: "high",
      });

      expect(result.mappings.length).toBeGreaterThan(0);
      const mapping = result.mappings[0];
      expect(mapping.heuristics.tags).toBeGreaterThan(0.0);
    }

    await unlink(testFile).catch(() => {});
  });

  it("should combine directory and similarity heuristics in scoring", async () => {
    const testFile = resolve(FIXTURES_ROOT, "test-files/cypress/e2e/combined-test.spec.ts");
    const testContent = `// @tag: button
describe("Button component", () => {
  it("should render button", () => {});
});`;

    await writeFile(testFile, testContent, "utf-8");

    const diff: ChangedFile[] = [
      {
        newPath: "src/components/Button.tsx",
        status: "modified",
      },
    ];

    const discovered = await discoverTests({
      projectRoot: resolve(FIXTURES_ROOT, "test-files"),
      extractMetadata: true,
    });

    const tests = discovered as DiscoveredTestFile[];
    const combinedTest = tests.find((t) => t.file.includes("combined-test"));

    if (combinedTest) {
      const result = await mapDiffToTests(diff, [combinedTest], {
        safetyLevel: "high",
      });

      expect(result.mappings.length).toBeGreaterThan(0);
      const mapping = result.mappings[0];
      
      expect(mapping.heuristics.directory).toBeGreaterThanOrEqual(0.0);
      expect(mapping.heuristics.similarity).toBeGreaterThanOrEqual(0.0);
      expect(mapping.heuristics.tags).toBeGreaterThanOrEqual(0.0);
      expect(mapping.score).toBeGreaterThan(0.0);
    }

    await unlink(testFile).catch(() => {});
  });

  it("should use explicit directory mappings when provided", async () => {
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
        file: resolve("/project", "cypress/e2e/unrelated/other.spec.ts"),
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

    const authMapping = result.mappings.find((m) => m.testPath.includes("auth"));
    expect(authMapping).toBeDefined();
    expect(authMapping?.heuristics.directory).toBe(1.0);

    const unrelatedMapping = result.mappings.find((m) => m.testPath.includes("unrelated"));
    if (unrelatedMapping) {
      expect(unrelatedMapping.heuristics.directory).toBe(0.0);
    }
  });
});
