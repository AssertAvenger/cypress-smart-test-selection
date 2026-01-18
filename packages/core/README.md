# cypress-smart-test-selection-core

Core library for intelligent Cypress test selection based on git diffs. Provides diff parsing, test discovery, and intelligent mapping heuristics.

## Installation

```bash
npm install cypress-smart-test-selection-core
```

## Modules

This package is organized into subpath exports:

### `cypress-smart-test-selection-core/diff`

Parse and normalize git diff output.

```typescript
import { parseDiff } from 'cypress-smart-test-selection-core/diff';

const result = parseDiff(gitDiffOutput);
// result.files - array of changed files
// result.warnings - any parsing warnings
```

### `cypress-smart-test-selection-core/discovery`

Discover Cypress test files in a project.

```typescript
import { discoverTests } from 'cypress-smart-test-selection-core/discovery';

const tests = await discoverTests({
  projectRoot: process.cwd(),
  testPatterns: ['cypress/e2e/**/*.spec.ts'], // optional
});
```

### `cypress-smart-test-selection-core/mapper`

Map changed files to relevant test files using intelligent heuristics.

```typescript
import { mapDiffToTests } from 'cypress-smart-test-selection-core/mapper';
import { parseDiff } from 'cypress-smart-test-selection-core/diff';
import { discoverTests } from 'cypress-smart-test-selection-core/discovery';

const diffResult = parseDiff(gitDiffOutput);
const tests = await discoverTests({ projectRoot: process.cwd() });
const mapping = await mapDiffToTests(diffResult.files, tests, {
  safetyLevel: 'medium',
});

// mapping.selected - array of selected test file paths
// mapping.mappings - detailed scoring information
```

## Features

- **Diff Parsing**: Robust git diff parsing supporting multiple formats
- **Test Discovery**: Fast glob-based test file discovery
- **Intelligent Mapping**: 5 heuristics (directory, filename, imports, tags, titles)
- **Configurable Safety**: High/medium/low safety levels with thresholds
- **TypeScript**: Fully typed with strict mode

## Documentation

See the individual module READMEs for detailed API documentation:

- [Diff Module](./src/diff/README.md)
- [Discovery Module](./src/discovery/README.md)
- [Mapper Module](./src/mapper/README.md)

## License

MIT

