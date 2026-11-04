# Local quick start

These instructions describe the unreleased source implementation.

## Build and verify

Use Node 22.12+ and pnpm 11.25.0:

~~~sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
pnpm typecheck
pnpm test
~~~

## Configure a consumer

Create **cypress-test-selector.config.mjs** in the consumer project:

~~~js
export default {
  defaultBase: "origin/main",
  mappings: [
    { src: "src/auth", test: "cypress/e2e/auth" },
    { src: "src/cart", test: "cypress/e2e/cart" },
  ],
  smoke: { patterns: ["cypress/e2e/smoke/**/*.cy.ts"] },
  fullSuiteOnChange: ["src/shared/**"],
};
~~~

Use .cjs with module.exports for CommonJS, or JSON for non-executable config.

~~~sh
node /absolute/path/to/selector/packages/cli/dist/bin/cy-select.js \
  --root /absolute/path/to/consumer --base origin/main --json
~~~

An auth change selects auth and smoke specs. An unmapped application change, dependency manifest or shared-support change selects the full discovered suite.

## CI consumption

Check out the intended branch and fetch enough target-branch history for the merge-base. Pass the target ref explicitly. Write output outside the repository or ignore its path in Git, so it does not become a new untracked input.

Ignore generated Cypress artifacts in the consumer's `.gitignore`, too:

~~~gitignore
cypress/downloads/
cypress/screenshots/
cypress/videos/
~~~

Without these rules, a browser-generated download can become an unmapped change and correctly trigger a full suite on the next invocation. Use your configured output paths if they differ. Git ignores apply to untracked files; changes to tracked files are still considered. Do not ignore the entire Cypress directory.

The consuming job must:

1. Stop on selector errors (exit 1 or 2).
2. Parse the complete JSON object.
3. Skip only when status is **no-changes**.
4. For **selected** or **full-suite**, run returned specs from the returned projectRoot.
5. Retain fallbackReasons for diagnosis.

Do not interpolate spec paths into shell command strings. Use Cypress's supported argument/API interface and account for its handling of spec globs and filenames. This package returns a plan; it does not implement a Cypress runner.

Keep Cypress's `specPattern` aligned with the selector's `testPatterns`. When using `cypress.run()`, a resolved promise does not mean all assertions passed: treat `status: "failed"` as a run error and propagate a non-zero exit when `totalFailed > 0`. Never pass an empty `spec` value as a substitute for skipping the run.

## Heuristic experiments

~~~js
export default {
  mode: "heuristic",
  defaultBase: "origin/main",
  safetyLevel: "medium",
};
~~~

Run alongside full suites before letting this gate CI. The legacy safety labels are threshold presets, not guarantees against missed failures.
