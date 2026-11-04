# Architecture and engineering review

## Assessment

The useful separation was already present: a reusable core and a CLI adapter. A framework rewrite or dependency graph engine is not necessary to make this project dependable. The main problems were unsafe failure behaviour, ambiguous selection semantics, inconsistent path handling and an unreliable development/package workflow.

This redesign keeps two packages and makes the contract explicit. This implementation is not yet released to npm; package version numbers have not been advanced.

## Issues found and addressed

| Finding | Consequence | Change |
| --- | --- | --- |
| Git commands used shell interpolation and swallowed failures | Invalid refs could look like no changes; ref text could become shell syntax | Argument-based execution, verified commits, explicit merge-base and actionable errors |
| Diffs omitted untracked paths and used line-based names | Incomplete changes and broken unusual filenames | Net merge-base-to-worktree diff plus untracked paths; strict NUL parsing |
| Rename heuristics preferred only the new path | Old feature area could be omitted | Evaluate both paths independently |
| Filename/tag matches were treated as sufficient coverage | Unrelated changes could be hidden behind a partial selection | Conservative default requires mappings/direct changes for every relevant path |
| Smoke specs could hide an unmapped change | A small smoke suite could imply a valid selection | Smoke inclusion is independent of change coverage |
| Directory matching used substrings; smoke “globs” stripped wildcards | Wrong feature matches and missed smoke specs | Root-anchored globs and literal directory boundaries |
| A broken mapping could coexist with a valid one | Missing mapped target area silently excluded | Full-suite fallback for matching rules with no discovered targets |
| Package config overrode the file; malformed config was ignored | Documented and actual behaviour disagreed | Validated layers, deterministic precedence, reject invalid/ambiguous config |
| Root default captured process.cwd at import time | Wrong project in integrations | Explicit root resolution and filesystem canonicalization |
| Git paths and logical macOS paths differed | Valid mappings became unmapped | Canonical project root at the filesystem boundary |
| JSON missing on early exits or mixed with logs | Unreliable CI parsing | Structured outcomes, stderr diagnostics, explicit non-zero errors |
| Verbose output referenced nonexistent import-graph/title scores | Misleading implementation claims | Report only implemented reasons |
| Zero weight became 1 through a truthiness default | Disabled heuristics still contributed | Nullish defaults and finite numeric validation |
| Unbounded metadata reads and swallowed I/O errors | File descriptor pressure and hidden incomplete inputs | Batches of 32, surfaced failures, outside-root checks |
| CLI referenced registry core; lockfile expected workspace core | Local CLI could use different code; frozen installs failed | Workspace dependency, consistent lockfile, local package verification |
| Build did not check all CLI source types | Compilation success concealed source errors | Explicit typecheck for both packages |
| Generated fixtures committed; metadata fixture directory missing | Duplicate discovery and six pre-existing failures | Remove generated files; temporary metadata fixtures |
| Incomplete demo workspace and broken lint scripts | Root commands were unreliable | Remove nonfunctional scaffold; executable integration fixtures |
| Old dependencies had published advisories | Avoidable maintenance/security debt | Compatible updates, current test runner and targeted esbuild patch |

## Boundaries and data flow

1. **CLI/config** loads one config directory, validates every layer and resolves the project root.
2. **CLI/Git** resolves the repo/base commit, computes merge-base, checks conflicts and reads NUL-delimited changes. Ref text is never evaluated in a shell.
3. **Core/diff** normalizes structured changes. A malformed machine record makes the CLI fail.
4. **Core/discovery** returns a deterministic inventory and optional metadata. It does not execute test code.
5. **Core/mapper** consumes changes and an inventory without Git/filesystem I/O, returning a selection with reasons.
6. **CLI/output** converts paths to portable project-relative values and reports an explicit result/exit code.

Rules are compiled once per selection. Each mapping's discovered target set is indexed once, avoiding repeated glob compilation/target matching for every change. Metadata I/O is bounded. There is no persistent cache or dependency-graph state to invalidate.

## Selection policy

**Conservative (default)**

Every relevant path must be directly changed spec or covered by an explicit mapping with targets. Missing coverage for one path selects the full discovered suite, even if others map successfully. Renames cover both locations.

Built-in shared patterns and additional fullSuiteOnChange rules also require the full suite. Built-ins take precedence over ignoreChanges. Nothing is ignored automatically by extension.

**Heuristic (opt-in)**

Filename-token and tag-token overlap may add selections. Thresholds/weights apply to inferred matches. Tags do not bypass thresholds or become “100% confidence.” Both modes include explicit mappings, direct changes and configured smoke specs.

An unmapped change still falls back, but an incorrect heuristic match can prevent that fallback. This mode has greater omission risk.

## Compatibility changes

Treat this as a **major-release candidate**, not a patch to publish with existing version numbers.

- Conservative mode is now the default; opt into heuristic mode for the older style of selection.
- Explicit mappings/direct changes cannot be disabled by heuristic weights.
- Absolute spec paths require the correct projectRoot. Lower-level directory scoring expects project-relative paths.
- No relevant changes returns no specs, even when smoke is configured.
- Invalid thresholds/config and unreadable metadata fail rather than being clamped/ignored.
- Git errors and changes with no specs are failures, not successful skips.
- JSON adds outcome metadata and uses project-relative spec paths.
- Scores/order may differ: token overlap replaces substring similarity; scores are not probabilities.
- Config extensions: .mjs, .cjs, .js and .json. Previously advertised .ts loading did not exist.
- Development requires Node 22.12+ and pinned pnpm. Local validation uses Node 22.17.0; other runtime/OS combinations need release testing.

## Verification

Run `pnpm test` for the package tests and `pnpm typecheck` for TypeScript validation.

The implementation was also checked locally against real Git repositories, installed package tarballs and Cypress's TodoMVC React application in Chrome. Those temporary fixtures, runners, logs, screenshots and validation reports are kept outside this repository.

Explicit mappings remain application-specific. Passing selector tests or one browser trial does not establish complete dependency coverage or a production savings percentage.

## Deliberate limits and next work

- **No dependency graph/runtime coverage database.** Mappings must include dependent features. Collect concrete selection misses before adding graph/coverage machinery. Import parsing alone would not capture backend, runtime, data or configuration dependencies.
- **Regex metadata is supplementary.** Common static tags are recognized; arbitrary JavaScript/dynamic tags are not evaluated. Titles are descriptive, not a selection signal.
- **Discovery must match the actual suite.** Cypress config is not executed. Symlink directories are not followed; specs resolving outside the root are rejected.
- **The worktree is the input.** Avoid modifying it during selection. Ignored untracked files follow Git's rules.
- **Legacy text/unified parsing is best-effort.** The CLI uses strict NUL records. CI library consumers should do the same and reject parser warnings.
- **No savings claim yet.** Compare selected runs with full runs on representative applications, measuring selection size, wall time and missed failures.
- **Before release:** assign compatible new versions to both packages and verify the supported Node/OS/browser combinations beyond the local consumer trial. Publishing requires a separate release.
