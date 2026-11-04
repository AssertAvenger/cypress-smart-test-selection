# cypress-smart-test-selection-core

Reusable diff parsing, Cypress spec discovery and selection policy. This checkout contains an unreleased redesign; the current npm version is different.

~~~ts
import { parseDiff } from "cypress-smart-test-selection-core/diff";
import { discoverTests } from "cypress-smart-test-selection-core/discovery";
import { mapDiffToTests } from "cypress-smart-test-selection-core/mapper";

const projectRoot = "/absolute/path/to/project";
// rawGitOutput: git diff --name-status -z, executed without a shell.
const parsed = parseDiff(rawGitOutput, { format: "name-status-z" });
if (parsed.warnings.length) throw new Error(parsed.warnings.join("; "));
const tests = await discoverTests({ projectRoot });
const plan = await mapDiffToTests(parsed.files, tests, {
  projectRoot,
  config: { mappings: [{ src: "src/auth", test: "cypress/e2e/auth" }] },
});
~~~

Changes must be project-relative or absolute. If Git ran from a different repository root, resolve those paths against the Git root first. Returned core spec paths preserve supplied paths; the CLI makes them project-relative.

Conservative mode requires explicit mapping/direct-change coverage for every relevant path. Missing coverage or shared configuration/dependency changes select the entire discovered inventory. Heuristic mode is opt-in and cannot prove coverage.

The plan status is selected, full-suite, no-changes or no-tests. Inspect fallbackReasons and unmappedFiles; treat no-tests as an integration failure.

See [project documentation](../../README.md) and [architecture](../../ARCHITECTURE.md).
