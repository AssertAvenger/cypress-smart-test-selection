import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/{diff,discovery,mapper}/**/*.test.ts"],
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["**/tests/**", "**/dist/**", "**/node_modules/**"],
    },
  },
});

