# Architecture Plan

## Directory Structure

```
cypress-smart-test-selection/
├── packages/
│   ├── core/
│   │   ├── src/
│   │   │   ├── index.ts                    # Main export
│   │   │   ├── diff/
│   │   │   │   ├── parser.ts               # Git diff parsing
│   │   │   │   └── types.ts                # Diff-related types
│   │   │   ├── mapper/
│   │   │   │   ├── index.ts                # Main mapping orchestrator
│   │   │   │   ├── directory-heuristic.ts  # Explicit config-based mapping
│   │   │   │   ├── similarity-heuristic.ts # File similarity mapping
│   │   │   │   ├── tag-heuristic.ts        # Tag-based matching
│   │   │   │   ├── scoring.ts              # Score combination logic
│   │   │   │   ├── safety.ts               # Safety level filtering
│   │   │   │   └── types.ts                # Mapper types
│   │   │   ├── discovery/
│   │   │   │   ├── discoverTests.ts        # Find Cypress test files
│   │   │   │   └── metadata.ts             # Extract test metadata
│   │   │   └── utils/
│   │   │       └── file-utils.ts           # File path utilities
│   │   ├── tests/
│   │   │   ├── diff/
│   │   │   ├── mapper/
│   │   │   └── discovery/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── cli/
│       ├── src/
│       │   ├── cli.ts                      # CLI entry point
│       │   ├── commands/
│       │   │   └── diff.ts                 # Main diff command
│       │   ├── config/
│       │   │   └── loadConfig.ts           # Config file loading
│       │   └── output/
│       │       └── formatters.ts           # Output formatting
│       ├── tests/
│       ├── package.json
│       └── tsconfig.json
│
├── examples/
│   └── demo-app/
│       ├── src/                            # React app source
│       ├── cypress/
│       │   ├── e2e/
│       │   │   └── **/*.spec.ts            # Demo test files
│       │   └── support/
│       ├── package.json
│       └── tsconfig.json
│
├── package.json                            # Root workspace config
├── tsconfig.base.json                      # Shared TS config
└── README.md
```

## Core Package (`packages/core`)

### Responsibilities

1. **Diff Parsing** (`diff/`)
   - Parse git diff output (file-level and granular)
   - Extract changed files, lines, and change types
   - Handle various git diff formats

2. **Mapping Logic** (`mapper/`)
   - **Directory Heuristic**: Explicit config-based mapping only
     - Uses `mappings` configuration to link source paths to test paths
     - No filesystem proximity fallback
     - Score: 1.0 for match, 0.0 otherwise
   - **Similarity Heuristic**: File name similarity matching
     - Token-based matching using Dice coefficient and LCS
     - `Button.tsx` → `button.spec.ts`, `Button.spec.ts`
   - **Tag Heuristic**: Test tag matching
     - Matches test tags against changed file tokens
     - Supports comment tags, inline tags, Cypress metadata

3. **Smoke Tests**
   - Explicit configuration via `smoke` config section
   - Always included regardless of diff, safety level, or other heuristics
   - Union operation - never filtered out

4. **Safety Levels** (`safety/`)
   - **High**: Guarantee no test silently skipped (may include extra tests)
   - **Moderate**: Between high and medium
   - **Medium**: Balanced selection with reasonable confidence
   - **Low**: Aggressive filtering (may miss some tests)

5. **Discovery** (`discovery/`)
   - Test file discovery (`cypress/e2e/**/*.spec.ts`)
   - Metadata extraction (tags, titles, tokens)

## CLI Package (`packages/cli`)

### Responsibilities

1. **Command Interface** (`cli.ts`)
   - Parse command-line arguments
   - Handle `--diff`, `--safety-level`, `--pattern`, `--json`, `--verbose`
   - Exit codes: 0 (OK), 1 (errors)

2. **Configuration** (`config/`)
   - Load config from `cypress-smart-test-selection.config.js`
   - Load config from `package.json` "cypress-smart-test-selection" key
   - Merge CLI args with config file
   - Validate configuration (fail loudly on invalid config)

3. **Output** (`output/`)
   - Generate JSON output with selected test paths
   - Human-readable console output
   - Verbose mode with scoring breakdown

## Configuration

### `cypress-smart-test-selection.config.js`

```javascript
module.exports = {
  // Explicit directory mappings (required for directory-based matching)
  mappings: [
    { src: 'src/components', test: 'cypress/e2e/components' },
    { src: 'src/features/auth', test: 'cypress/e2e/auth' },
    { src: ['src/utils', 'lib/utils'], test: 'cypress/e2e/utils' },
  ],

  // Smoke tests - always included regardless of diff
  smoke: {
    tags: ['smoke', 'critical'],
    patterns: ['cypress/smoke/**'],
  },

  // Safety level
  safetyLevel: 'medium',

  // Test patterns
  testPatterns: ['cypress/e2e/**/*.spec.ts'],

  // Exclusions
  exclude: ['**/node_modules/**'],
};
```

## Data Flow

```
1. CLI receives git diff (or runs `git diff` command)
2. Core parses diff → ChangedFile[]
3. Core discovers all Cypress test files
4. Core applies mapping heuristics:
   - Directory heuristic (explicit config only)
   - Similarity heuristic
   - Tag heuristic
5. Core identifies smoke tests (always included)
6. Core applies safety level filter
7. Core combines smoke tests + filtered tests
8. CLI outputs selected-tests.json
9. CLI exits with appropriate code
```

## Key Design Decisions

1. **Monorepo**: Separate concerns, enable independent versioning
2. **TypeScript Strict**: Type safety and better DX
3. **Vitest**: Fast, modern testing framework
4. **Configurable Safety**: Balance between precision and safety
5. **JSON Output**: CI-friendly, machine-readable
6. **Explicit Mappings**: No magic filesystem proximity heuristics
7. **Smoke Test Guarantee**: Critical tests always run
8. **Fail Loudly**: Invalid config causes immediate failure

## Removed Features

The following features have been intentionally removed:

- **Import Graph Heuristic**: Removed for simplicity and determinism
- **Title-based Heuristic**: Titles are human-readable only, not used for selection
- **Filesystem Proximity**: Directory matching requires explicit configuration
