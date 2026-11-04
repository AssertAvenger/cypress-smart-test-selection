import { readFile } from "node:fs/promises";

/**
 * Normalize a tag: lowercase, trim, allow only alphanumeric and hyphen/underscore
 */
function normalizeTag(tag: string): string {
  return tag
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]/g, "");
}

/**
 * Tokenize text using the same logic as similarity heuristic
 * Splits on camelCase, underscores, hyphens, and spaces
 */
export function tokenizeText(text: string): string[] {
  // First, split on delimiters (hyphens, underscores, spaces)
  const parts = text.split(/[-_\s]+/);
  
  const tokens: string[] = [];
  
  for (const part of parts) {
    // Split camelCase: insert space before uppercase letters
    // e.g., "LoginForm" -> "Login Form"
    const camelSplit = part.replace(/([a-z])([A-Z])/g, "$1 $2");
    
    // Split on spaces and process each word
    const words = camelSplit.split(/\s+/);
    
    for (const word of words) {
      // Lowercase and remove punctuation
      const cleaned = word.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (cleaned.length > 0) {
        tokens.push(cleaned);
      }
    }
  }

  return tokens;
}

/**
 * Extract tags from test file content
 * Supports:
 * - Comment tags: // @tag: login, // @tags: login,auth
 * - Inline tags: describe("[auth] login flow")
 * - Cypress metadata: it("test", { tags: ["login"] }, () => {})
 */
function extractTags(content: string): string[] {
  const tags = new Set<string>();

  // Comment tags: // @tag: login or // @tags: login,auth,user
  const commentTagRegex = /\/\/\s*@tags?:\s*([^\n]+)/gi;
  let match;
  while ((match = commentTagRegex.exec(content)) !== null) {
    const tagString = match[1].trim();
    tagString
      .split(",")
      .map((t) => normalizeTag(t))
      .filter((t) => t.length > 0)
      .forEach((t) => tags.add(t));
  }

  // Inline tags in describe/it: describe("[auth] login flow")
  const inlineTagRegex = /(?:describe|it|context|specify)(?:\.(?:only|skip))?\s*\(\s*["'`]\[([^\]]+)\][^"'`]*["'`]/gi;
  while ((match = inlineTagRegex.exec(content)) !== null) {
    const tagString = match[1].trim();
    tagString
      .split(",")
      .map((t: string) => normalizeTag(t))
      .filter((t: string) => t.length > 0)
      .forEach((t: string) => tags.add(t));
  }

  // Cypress metadata tags: it("test", { tags: ["login", "auth"] }, () => {})
  const metadataTagRegex = /(?:describe|it|context|specify)(?:\.(?:only|skip))?\s*\([^,]+,\s*\{[^}]*tags:\s*\[([^\]]+)\]/gi;
  while ((match = metadataTagRegex.exec(content)) !== null) {
    const tagString = match[1].trim();
    tagString
      .split(",")
      .map((t: string) => t.trim().replace(/["'`]/g, ""))
      .map((t: string) => normalizeTag(t))
      .filter((t: string) => t.length > 0)
      .forEach((t: string) => tags.add(t));
  }

  return Array.from(tags);
}

/**
 * Extract test titles from describe/it blocks
 * Handles nested describe blocks
 */
function extractTitles(content: string): string[] {
  const titles: string[] = [];

  // Match describe/it/context/specify blocks
  // Handles: describe("title", ...), describe('title', ...), describe(`title`, ...)
  const titleRegex = /(?:describe|it|context|specify)(?:\.(?:only|skip))?\s*\(\s*["'`]([^"'`]+)["'`]/gi;
  let match;
  while ((match = titleRegex.exec(content)) !== null) {
    const title = match[1].trim();
    // Remove inline tags from title: "[auth] login flow" -> "login flow"
    const cleanedTitle = title.replace(/^\[[^\]]+\]\s*/, "");
    if (cleanedTitle.length > 0) {
      titles.push(cleanedTitle);
    }
  }

  return titles;
}

/**
 * Extract metadata from a test file
 */
export async function extractTestMetadata(
  filePath: string
): Promise<{
  tags: string[];
  titles: string[];
  tokens: string[];
}> {
  try {
    const content = await readFile(filePath, "utf-8");

    const tags = extractTags(content);
    const titles = extractTitles(content);
    const tokens = titles.flatMap((title) => tokenizeText(title));

    return {
      tags: Array.from(new Set(tags)), // Deduplicate
      titles: Array.from(new Set(titles)), // Deduplicate
      tokens: Array.from(new Set(tokens)), // Deduplicate
    };
  } catch (error) {
    throw new Error("Cannot read spec metadata: " + filePath, { cause: error });
  }
}
