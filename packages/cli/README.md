# cypress-smart-test-selection

The cy-select CLI reads Git changes and produces a Cypress spec-selection plan. This checkout contains an unreleased redesign; the current npm version is different.

~~~sh
cy-select diff --root /path/to/project --base origin/main --json
cy-select diff --base origin/main --verbose
cy-select --help
~~~

- Conservative selection is default; configure explicit source-to-spec mappings.
- Changes include committed, staged, unstaged and untracked paths relative to merge-base.
- Shared changes, unmapped paths or mappings with missing targets select the full discovered suite.
- JSON uses stdout; diagnostics use stderr.
- Exit 0: valid selection/no relevant changes. Exit 1: error. Exit 2: changes without discovered specs.
- No Cypress execution or automatic Git fetching.
- Supported config: .mjs, .cjs, .js and .json. TypeScript config is unsupported.

See [configuration](../../README.md), [quick start](../../QUICK_START.md) and [migration notes](../../ARCHITECTURE.md).
