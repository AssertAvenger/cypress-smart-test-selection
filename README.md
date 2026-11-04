# Cypress Smart Test Selection

Select Cypress specs from Git changes using explicit source-to-spec mappings, with a full-suite fallback when a change cannot be mapped.

**This branch contains an unreleased redesign. The npm releases 2.0.0/2.0.1 do not contain these changes.**

## Why this exists

Running the complete browser suite for every change is expensive. Skipping specs based only on similar filenames is risky. This tool makes the selection policy explicit: maintain mappings for known areas, include smoke checks, and run the complete discovered suite for changes outside those mappings.

It produces a selection plan; it does not execute Cypress or infer complete dependency coverage.

## Selection policy

The default mode is **conservative**:

1. Include directly changed specs and specs covered by explicit mappings.
2. Include configured smoke specs whenever there are relevant changes.
3. Consider both paths of a rename and the original path of a deletion.
4. Select the full discovered suite if **any** relevant path is unmapped, a matching mapping has no discovered targets, or shared configuration/dependencies changed.
5. Return an explicit no-changes result when there are no relevant changes.

Package manifests, common lockfiles, Cypress support/fixtures/plugins, Cypress and selector configuration, TypeScript/build configuration, and GitHub Actions/CircleCI configuration trigger a full suite. Add project-specific shared modules through **fullSuiteOnChange**.

**Mappings are maintained coverage assumptions, not proof of coverage.** Keep scheduled/full main-branch runs and compare selections with full runs before relying on this in CI. Shared dependencies, backend changes and dynamically loaded code can affect specs outside a mapping.

Opt-in **heuristic** mode adds filename-token and tag signals. It can miss affected specs even when it selects some tests. Scores are not coverage probabilities.

## Local development

Use Node 22.12+ and pnpm 11.25.0 for this repository.

~~~sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
pnpm typecheck
pnpm test
~~~

The test command builds both packages, runs the existing tests and exercises the built CLI against temporary Git repositories. It does not start a browser. See [QUICK_START.md](QUICK_START.md) for integration details.

Run the local CLI against a project:

~~~sh
node /absolute/path/to/this/repo/packages/cli/dist/bin/cy-select.js diff \
  --root /absolute/path/to/your/project --base origin/main --json
~~~

## Configuration

Use one **cypress-test-selector.config.mjs**:

~~~js
export default {
  defaultBase: "origin/main",
  mappings: [
    { src: "src/features/auth", test: "cypress/e2e/auth" },
    { src: ["src/cart/**", "src/pricing/**"], test: "cypress/e2e/checkout/**/*.cy.ts" },
  ],
  smoke: { patterns: ["cypress/e2e/smoke/**/*.cy.{js,ts}"], tags: ["smoke"] },
  fullSuiteOnChange: ["src/shared/**", "src/bootstrap.ts"],
  ignoreChanges: ["docs/**"],
};
~~~

Patterns are case-sensitive, use forward slashes and are anchored to **projectRoot**. Mapping/smoke/shared-change patterns accept literal files, directory prefixes or globs. They do not match arbitrary substrings. Negative patterns and paths outside the project are rejected; use **exclude** for discovery exclusions.

Supported config formats: .mjs, .cjs, .js (following Node module rules), and .json. TypeScript configuration is unsupported. Configuration modules execute as code; only load them from repositories you trust.

Precedence: CLI arguments > config file > package.json "cypress-test-selector" > defaults. Arrays replace lower-priority arrays. Invalid, unknown or ambiguous configuration is an error.

| Option | Default / purpose |
| --- | --- |
| projectRoot | Config directory; relative values resolve against it |
| testPatterns | cypress/e2e/**/*.{cy,spec,test}.{ts,tsx,js,jsx} |
| exclude | Extra discovery exclusions; dependencies/build output excluded by default |
| mappings | Source-to-spec coverage rules |
| smoke | Extra specs included for relevant changes |
| fullSuiteOnChange | Additional shared files/directories/globs |
| ignoreChanges | Explicit non-runtime changes to ignore; none by default |
| defaultBase | Auto-detect default branch if omitted; set explicitly in CI |
| mode | conservative or opt-in heuristic |
| safetyLevel / threshold | Heuristic threshold only; see [mapper API](packages/core/src/mapper/README.md) |

The CLI does not load Cypress configuration automatically. Match discovery to the suite your CI actually runs. “Full suite” means the entire **discovered** inventory, not every possible Cypress project.

## CLI contract

- Changes are compared from the selected ref's merge-base to the working tree, including committed, staged, unstaged and untracked changes.
- Pass **--base** explicitly in CI and fetch the target ref plus enough history to find the merge-base.
- **--root** identifies the config directory. No implicit search through parent directories.
- **--json** emits one JSON object on stdout. Diagnostics use stderr, including in debug mode.
- JSON spec paths are project-relative. The returned **projectRoot** identifies where to run Cypress.
- No remote data is fetched automatically, and no specs are executed by this tool.

| Status | Meaning | Exit code |
| --- | --- | --- |
| selected | A valid selection plan | 0 |
| full-suite | Every discovered spec selected; inspect fallbackReasons | 0 |
| no-changes | No relevant changes after configured ignores | 0 |
| no-tests | Relevant changes, but discovery found no specs | 2 |
| Error | Invalid config/ref, insufficient history, conflicts, unreadable files, etc. | 1 |

Errors do not produce a successful selection object. Do not turn a non-zero exit into an empty selection or skip the job.

## Packages and design

- **packages/core**: diff parsing, spec discovery and selection policy. Exports: /diff, /discovery and /mapper.
- **packages/cli**: configuration, Git access and machine/human output.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the engineering review, design decisions, compatibility changes and remaining limitations.
