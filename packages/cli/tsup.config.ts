import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "bin/cy-select": "src/bin/cy-select.ts",
    index: "src/index.ts",
  },
  format: ["esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  outDir: "dist",
  // Shebang will be added by tsup automatically for bin files
  banner: undefined,
  external: ["cypress-smart-test-selection-core"],
  target: "node18",
});

