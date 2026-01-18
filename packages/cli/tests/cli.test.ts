import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

const CLI_PATH = resolve(__dirname, "../dist/bin/cy-select.js");

describe("CLI", () => {
  describe("--help", () => {
    it("should display help message", () => {
      const output = execSync(`node ${CLI_PATH} --help`, {
        encoding: "utf-8",
      });

      expect(output).toContain("cy-select");
      expect(output).toContain("--base");
      expect(output).toContain("--json");
      expect(output).toContain("--verbose");
      expect(output).toContain("--pattern");
    });

    it("should display help with -h flag", () => {
      const output = execSync(`node ${CLI_PATH} -h`, {
        encoding: "utf-8",
      });

      expect(output).toContain("cy-select");
    });
  });

  describe("help command", () => {
    it("should display help when help command is used", () => {
      const output = execSync(`node ${CLI_PATH} help`, {
        encoding: "utf-8",
      });

      expect(output).toContain("cy-select");
      expect(output).toContain("Commands:");
    });
  });

  describe("unknown command", () => {
    it("should show error for unknown command", () => {
      try {
        execSync(`node ${CLI_PATH} unknown-command`, {
          encoding: "utf-8",
          stdio: "pipe",
        });
        expect.fail("Should have thrown");
      } catch (error: unknown) {
        const execError = error as { status: number; stderr: Buffer };
        expect(execError.status).toBe(1);
        expect(execError.stderr.toString()).toContain("Unknown command");
      }
    });
  });
});
