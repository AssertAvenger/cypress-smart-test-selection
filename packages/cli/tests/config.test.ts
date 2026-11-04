import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig } from "../src/config/loadConfig.js";
import { writeFile, mkdtemp, rm, realpath } from "node:fs/promises";
import { resolve, join } from "node:path";
import { tmpdir } from "node:os";

describe("loadConfig", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), "cli-test-"));
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true }).catch(() => {});
  });

  it("should return default config when no config files exist", async () => {
    const config = await loadConfig(testDir);

    expect(config.safetyLevel).toBe("medium");
    expect(config.defaultBase).toBeUndefined();
    expect(config.projectRoot).toBe(await realpath(testDir));
    expect(config.testPatterns).toEqual([]);
    expect(config.exclude).toEqual([]);
  });

  it("should load config from package.json", async () => {
    const packageJson = {
      name: "test-project",
      "cypress-test-selector": {
        safetyLevel: "high",
        testPatterns: ["cypress/**/*.spec.ts"],
      },
    };

    await writeFile(
      join(testDir, "package.json"),
      JSON.stringify(packageJson, null, 2)
    );

    const config = await loadConfig(testDir);

    expect(config.safetyLevel).toBe("high");
    expect(config.testPatterns).toEqual(["cypress/**/*.spec.ts"]);
  });

  it("should apply CLI overrides with highest priority", async () => {
    const packageJson = {
      name: "test-project",
      "cypress-test-selector": {
        safetyLevel: "high",
        defaultBase: "origin/develop",
      },
    };

    await writeFile(
      join(testDir, "package.json"),
      JSON.stringify(packageJson, null, 2)
    );

    const config = await loadConfig(testDir, {
      safetyLevel: "low",
    });

    expect(config.safetyLevel).toBe("low");
    expect(config.defaultBase).toBe("origin/develop");
  });

  it("should resolve projectRoot to absolute path", async () => {
    const config = await loadConfig(testDir, {
      projectRoot: ".",
    });

    expect(config.projectRoot).toBe(await realpath(testDir));
  });

  it("should reject malformed package.json", async () => {
    await writeFile(join(testDir, "package.json"), "{ invalid json }");
    await expect(loadConfig(testDir)).rejects.toThrow();
  });
});
