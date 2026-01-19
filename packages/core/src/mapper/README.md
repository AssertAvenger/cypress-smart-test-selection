# Mapping Heuristics Module

## Overview

The mapping heuristics module provides intelligent matching between changed source files and Cypress test files using multiple scoring strategies.

## Features

- ✅ **Directory Mapping**: Explicit config-based path mapping (no filesystem proximity)
- ✅ **Filename Similarity**: Token-based similarity (Dice coefficient + LCS)
- ✅ **Tag Heuristic**: Test tag matching (comment tags, inline tags, Cypress metadata)
- ✅ **Smoke Tests**: Explicit config for always-included tests
- ✅ **Safety Levels**: Configurable thresholds (high/moderate/medium/low)
- ✅ **Multiplicative Scoring**: Combines all heuristics for accurate matching

## API

### `mapDiffToTests(diff: ChangedFile[], tests: string[], options?: MappingOptions): Promise<MappingResult>`

Main public API for mapping changed files to test files.

```typescript
import { mapDiffToTests } from '@cypress-test-selector/core/mapper';
import { parseDiff } from '@cypress-test-selector/core/diff';
import { discoverTests } from '@cypress-test-selector/core/discovery';

const diffResult = parseDiff(gitDiffOutput);
const tests = await discoverTests({ projectRoot: process.cwd() });
const mapping = await mapDiffToTests(diffResult.files, tests, {
  safetyLevel: 'medium',
  config: {
    mappings: [
      { src: 'src/components', test: 'cypress/e2e/components' },
      { src: 'src/features/auth', test: 'cypress/e2e/auth' },
    ],
    smoke: {
      tags: ['smoke', 'critical'],
      patterns: ['cypress/smoke/**'],
    },
  },
});

// mapping.selected contains array of test file paths
```

## Heuristics

### 1. Directory Mapping (Explicit Config Only)

Maps source paths to test paths using explicit configuration. **No filesystem proximity heuristics are used.**

- **Score**: 1.0 for explicit mapping match, 0.0 otherwise
- **Configuration**: Requires `config.mappings` array

**Example Config**:
```javascript
// cypress-test-selector.config.js
module.exports = {
  mappings: [
    { src: 'src/components', test: 'cypress/e2e/components' },
    { src: 'src/features/auth', test: 'cypress/e2e/auth' },
    { src: ['src/utils', 'lib/utils'], test: 'cypress/e2e/utils' },
  ],
};
```

**Example**:
- Changed: `src/components/Button.tsx`
- Mapping: `{ src: 'src/components', test: 'cypress/e2e/components' }`
- Test: `cypress/e2e/components/button.spec.ts`
- Score: 1.0 (explicit mapping match)

### 2. Filename Similarity

Token-based similarity using Dice coefficient and LCS.

- **Tokenization**: Splits on camelCase, underscores, hyphens
- **Scoring**: `Dice * 0.7 + LCS * 0.3`
- **Bonus**: Exact match = 1.0, high overlap (>0.8) gets +0.1

**Example**:
- Changed: `LoginForm.tsx`
- Test: `login-form.spec.ts`
- Score: High (tokens: ["login", "form"] match)

### 3. Tag Heuristic

Matches test file tags against changed file tokens.

- **Tag Sources**: Comment tags (`// @tag: login`), inline tags (`describe("[auth] ...")`), Cypress metadata (`{ tags: ["login"] }`)
- **Scoring**:
  - Exact tag match → 1.0
  - Partial overlap → 0.4-0.7
  - No match → 0.0
- **Normalization**: Lowercase, trim, alphanumeric + hyphens/underscores only
- **Weight**: Default 0.5

**Example**:
- Changed: `src/components/LoginButton.tsx`
- Test tags: `["login", "auth"]`
- Score: 1.0 (exact "login" tag match)

## Smoke Tests

Smoke tests are **always included** regardless of diff, directory match, tags, or similarity. This is a union operation - smoke tests are never filtered out.

### Configuration

```javascript
// cypress-test-selector.config.js
module.exports = {
  smoke: {
    // Tests with these tags are always included
    tags: ['smoke', 'critical'],
    // Tests matching these patterns are always included
    patterns: ['cypress/smoke/**', 'cypress/e2e/critical/**'],
  },
};
```

### Guarantees

1. Smoke tests are included even with empty diff
2. Smoke tests are included even with `safetyLevel: 'low'`
3. Smoke tests appear first in the selection list
4. Smoke tests are never duplicated

## Safety Levels

### High Safety (`threshold: 0.0`)
- Selects all tests with any score > 0
- Most comprehensive, may include false positives
- Use when you want to ensure no tests are missed

### Moderate Safety (`threshold: 0.2`)
- Selects tests with score >= 0.2
- More inclusive than medium, less than high
- Good balance between coverage and precision

### Medium Safety (`threshold: 0.4`)
- Selects tests with score >= 0.4
- Balanced approach
- Default recommendation

### Low Safety (`threshold: 0.7`)
- Selects only tests with score >= 0.7
- Most precise, may miss some relevant tests
- Use when you want high confidence matches only

## Scoring Engine

Heuristics are combined using multiplicative scoring:

```
combined = 1 - (1 - hDirectory) * (1 - hSimilarity) * (1 - hTags)
```

**Properties**:
- If any heuristic = 1.0, combined = 1.0
- If all heuristics are low, combined is low
- Supports weighted heuristics

## Options

```typescript
interface MappingOptions {
  safetyLevel?: "high" | "moderate" | "medium" | "low";  // Default: "medium"
  threshold?: number;                        // Override safety level
  includeScores?: boolean;                   // Include heuristic scores
  directoryWeight?: number;                  // Default: 1.0
  similarityWeight?: number;                 // Default: 1.0
  tagWeight?: number;                        // Default: 0.5
  config?: {
    mappings?: DirectoryMapping[];           // Explicit directory mappings
    smoke?: SmokeConfig;                     // Smoke test configuration
  };
}
```

### Default Weights

```typescript
import { DEFAULT_WEIGHTS } from '@cypress-test-selector/core/mapper';

// DEFAULT_WEIGHTS:
// {
//   directoryWeight: 1.0,
//   similarityWeight: 1.0,
//   tagWeight: 0.5,
// }
```

## Result Format

```typescript
interface MappingResult {
  mappings: TestMapping[];      // All mappings with scores
  selected: string[];           // Selected test paths
  safetyLevel: SafetyLevel;     // Safety level used
  threshold: number;            // Threshold applied
}

interface TestMapping {
  testPath: string;             // Absolute test file path
  score: number;                // Combined score (0.0-1.0)
  heuristics: {
    directory: number;          // Directory score
    similarity: number;         // Similarity score
    tags: number;               // Tag heuristic score
  };
  reason?: string;              // Human-readable reason
}
```

## Examples

### Basic Usage

```typescript
const result = await mapDiffToTests(changedFiles, testFiles);
console.log(result.selected); // Array of selected test paths
```

### With Explicit Mappings

```typescript
const result = await mapDiffToTests(changedFiles, testFiles, {
  safetyLevel: 'medium',
  config: {
    mappings: [
      { src: 'src/components', test: 'cypress/e2e/components' },
      { src: 'src/features', test: 'cypress/e2e/features' },
    ],
  },
});
```

### With Smoke Tests

```typescript
const result = await mapDiffToTests(changedFiles, testFiles, {
  safetyLevel: 'low',
  config: {
    smoke: {
      tags: ['smoke'],
      patterns: ['cypress/smoke/**'],
    },
  },
});
// Smoke tests are always included, even with low safety
```

### Custom Threshold

```typescript
const result = await mapDiffToTests(changedFiles, testFiles, {
  threshold: 0.6, // Custom threshold
});
```

### Weighted Heuristics

```typescript
const result = await mapDiffToTests(changedFiles, testFiles, {
  directoryWeight: 2.0,    // Emphasize directory matching
  similarityWeight: 1.0,
  tagWeight: 1.0,          // Emphasize tag matching
});
```

## Performance

- **Directory & Similarity**: Synchronous, fast
- **Tag**: Async (file I/O during discovery), cached in metadata
- **Scoring**: O(n*m) where n=changed files, m=test files

## Testing

Run tests with:
```bash
npm test
```

Test coverage includes:
- Individual heuristics
- Combined scoring
- Safety levels
- Smoke test inclusion
- Edge cases (empty inputs, missing files, etc.)
