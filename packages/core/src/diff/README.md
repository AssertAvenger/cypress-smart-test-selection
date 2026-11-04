# Diff parsing

For machine/CI use, pass NUL-delimited git diff --name-status -z output:

~~~ts
const result = parseDiff(output, { format: "name-status-z" });
if (result.warnings.length) throw new Error(result.warnings.join("; "));
~~~

This preserves spaces, tabs and newlines. Added, modified, deleted, renamed, copied and type-changed files become ChangedFile records. Both rename paths are retained. Malformed records/unmerged statuses produce warnings that the CLI treats as fatal.

Legacy auto-detected name-only, tab-delimited and unified formats remain best-effort compatibility interfaces. They are not the CLI's production input. The old includeBinary/includeUntracked options do not fetch/filter Git data; pass the actual changes to the parser.

Git execution, merge-base resolution and untracked discovery belong to the CLI adapter.
