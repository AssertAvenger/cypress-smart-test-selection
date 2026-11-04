# Spec discovery

**discoverTests({ projectRoot, testPatterns?, exclude?, extractMetadata? })** returns a sorted, deduplicated inventory.

- Default: cypress/e2e/**/*.{cy,spec,test}.{ts,tsx,js,jsx}.
- Project-relative, case-sensitive patterns.
- Dependencies, build output, caches, Git internals and coverage excluded by default.
- Symlink directories are not followed; files resolving outside the root are rejected.
- Metadata enabled (default): file, tags, titles and tokens. Otherwise: absolute path strings.
- Up to 32 concurrent metadata reads; unreadable files are errors.

Regexes recognize common static comment tags, bracketed titles and Cypress tag arrays. They do not evaluate JavaScript or guarantee dynamic metadata extraction. Only tags contribute to heuristic selection; titles/tokens are descriptive.

Cypress config is not loaded automatically. Configure discovery to match the consumer's suite.
