import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { extractTestMetadata, tokenizeText } from "../../src/discovery/metadata.js";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { writeFile, unlink, mkdtemp, rm } from "node:fs/promises";

describe("metadata extraction", () => {
  let testDir: string;
  beforeAll(async () => { testDir = await mkdtemp(resolve(tmpdir(), "selector-metadata-")); });
  afterAll(async () => { await rm(testDir, { recursive: true, force: true }); });

  describe("extractTestMetadata", () => {
    it("should extract comment tags", async () => {
      const testFile = resolve(testDir, "comment-tags.spec.ts");
      const content = `// @tag: login
// @tags: auth,user
describe('Login', () => {
  it('should work', () => {});
});`;

      await writeFile(testFile, content, "utf-8");

      const metadata = await extractTestMetadata(testFile);

      expect(metadata.tags).toContain("login");
      expect(metadata.tags).toContain("auth");
      expect(metadata.tags).toContain("user");

      await unlink(testFile).catch(() => {});
    });

    it("should extract inline tags", async () => {
      const testFile = resolve(testDir, "inline-tags.spec.ts");
      const content = `describe("[auth] Login flow", () => {
  it("[smoke] should login", () => {});
});`;

      await writeFile(testFile, content, "utf-8");

      const metadata = await extractTestMetadata(testFile);

      expect(metadata.tags).toContain("auth");
      expect(metadata.tags).toContain("smoke");

      await unlink(testFile).catch(() => {});
    });

    it("should extract Cypress metadata tags", async () => {
      const testFile = resolve(testDir, "cypress-tags.spec.ts");
      const content = `it("login test", { tags: ["login", "auth"] }, () => {});`;

      await writeFile(testFile, content, "utf-8");

      const metadata = await extractTestMetadata(testFile);

      expect(metadata.tags).toContain("login");
      expect(metadata.tags).toContain("auth");

      await unlink(testFile).catch(() => {});
    });

    it("should extract titles from describe/it blocks", async () => {
      const testFile = resolve(testDir, "titles.spec.ts");
      const content = `describe("Login page tests", () => {
  it("should show error", () => {});
  describe("Nested suite", () => {
    it("nested test", () => {});
  });
});`;

      await writeFile(testFile, content, "utf-8");

      const metadata = await extractTestMetadata(testFile);

      expect(metadata.titles).toContain("Login page tests");
      expect(metadata.titles).toContain("should show error");
      expect(metadata.titles).toContain("Nested suite");
      expect(metadata.titles).toContain("nested test");

      await unlink(testFile).catch(() => {});
    });

    it("should tokenize titles", async () => {
      const testFile = resolve(testDir, "tokens.spec.ts");
      const content = `describe("LoginForm component", () => {
  it("should render button", () => {});
});`;

      await writeFile(testFile, content, "utf-8");

      const metadata = await extractTestMetadata(testFile);

      expect(metadata.tokens.length).toBeGreaterThan(0);
      expect(metadata.tokens).toContain("login");
      expect(metadata.tokens).toContain("form");
      expect(metadata.tokens).toContain("component");
      expect(metadata.tokens).toContain("button");

      await unlink(testFile).catch(() => {});
    });

    it("should normalize tags", async () => {
      const testFile = resolve(testDir, "normalize-tags.spec.ts");
      const content = `// @tags: LOGIN,  auth  ,user-profile
describe("[AUTH] Login", () => {});`;

      await writeFile(testFile, content, "utf-8");

      const metadata = await extractTestMetadata(testFile);

      // All should be lowercase and trimmed
      expect(metadata.tags.every((t) => t === t.toLowerCase())).toBe(true);
      expect(metadata.tags).toContain("login");
      expect(metadata.tags).toContain("auth");
      expect(metadata.tags).toContain("user-profile");

      await unlink(testFile).catch(() => {});
    });

    it("should report unreadable specs", async () => {
      await expect(extractTestMetadata("/nonexistent/file.spec.ts")).rejects.toThrow("Cannot read spec");
    });
  });

  describe("tokenizeText", () => {
    it("should tokenize camelCase", () => {
      const tokens = tokenizeText("LoginForm");
      expect(tokens).toContain("login");
      expect(tokens).toContain("form");
    });

    it("should tokenize hyphen-case", () => {
      const tokens = tokenizeText("login-form");
      expect(tokens).toContain("login");
      expect(tokens).toContain("form");
    });

    it("should tokenize underscore_case", () => {
      const tokens = tokenizeText("user_profile");
      expect(tokens).toContain("user");
      expect(tokens).toContain("profile");
    });

    it("should tokenize spaces", () => {
      const tokens = tokenizeText("Login page tests");
      expect(tokens).toContain("login");
      expect(tokens).toContain("page");
      expect(tokens).toContain("tests");
    });

    it("should remove punctuation", () => {
      const tokens = tokenizeText("Login, page! tests?");
      expect(tokens.every((t) => !/[.,!?]/.test(t))).toBe(true);
    });
  });
});

