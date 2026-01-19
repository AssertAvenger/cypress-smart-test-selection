# cypress-test-selector

Intelligent Cypress test selection based on git diffs. Mimics enterprise-grade Test Impact Analysis for Cypress frameworks.

## 🚀 Quick Start

### Install
```bash
npm install cypress-smart-test-selection
```

Or with other package managers:
```bash
yarn add cypress-smart-test-selection
pnpm add cypress-smart-test-selection
```

## Running the Command

The `cy-select` command can be run using any package manager. Once installed, the binary is available directly:

### Using npx (Recommended)
```bash
# See which tests are selected based on your changes
npx cy-select diff

# Compare against a specific branch
npx cy-select diff --base origin/main

# Get JSON output for CI/CD
npx cy-select diff --json
```

### Using yarn
```bash
yarn cy-select diff
yarn cy-select diff --base origin/main
yarn cy-select diff --json
```

### Using pnpm
```bash
pnpm cy-select diff
pnpm cy-select diff --base origin/main
pnpm cy-select diff --json
```

### Using npm scripts (Optional)
Add to your `package.json` scripts section:
```json
{
  "scripts": {
    "cy-select": "cy-select"
  }
}
```

Then run:
```bash
npm run cy-select diff
```

**That's it!** One command. No complex setup needed.

See [QUICK_START.md](./QUICK_START.md) for detailed usage examples.

## ✨ Features

- **Intelligent Test Selection** - Uses 3 heuristics (directory mapping, filename similarity, tags)
- **Explicit Directory Mappings** - Configure source-to-test path mappings
- **Smoke Test Guarantee** - Always include critical tests regardless of diff
- **Git Diff Analysis** - Automatically detects changed files
- **Configurable Safety Levels** - `high`, `moderate`, `medium`, `low` thresholds
- **Zero Configuration** - Works out of the box with sensible defaults
- **CI/CD Ready** - JSON output for automation
- **TypeScript** - Fully typed, strict mode

## 📦 Project Structure

This is a monorepo containing:

- **packages/core** - Core diff parsing and intelligent mapping logic
- **packages/cli** - Command-line interface for the tool
- **examples/demo-app** - Simple demo React + Cypress setup

## ⚙️ Configuration

Create a `cypress-test-selector.config.js` file in your project root:

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

  // Safety level: 'high' | 'moderate' | 'medium' | 'low'
  safetyLevel: 'medium',

  // Test file patterns (optional, uses Cypress defaults)
  testPatterns: ['cypress/e2e/**/*.spec.ts'],

  // Exclusion patterns (optional)
  exclude: ['**/node_modules/**'],
};
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mappings` | `DirectoryMapping[]` | `[]` | Explicit source-to-test path mappings |
| `smoke` | `SmokeConfig` | `undefined` | Smoke test configuration |
| `safetyLevel` | `string` | `'medium'` | Safety level for test selection |
| `threshold` | `number` | `undefined` | Custom threshold (overrides safetyLevel) |
| `testPatterns` | `string[]` | `[]` | Test file glob patterns |
| `exclude` | `string[]` | `[]` | Exclusion patterns |
| `defaultBase` | `string` | `'origin/main'` | Default git base branch |

### Directory Mappings

Directory mappings link source paths to test paths. When a changed file matches a mapped source path and a test file matches the mapped test path, it's a high-confidence match.

```javascript
mappings: [
  // Single path mapping
  { src: 'src/components', test: 'cypress/e2e/components' },
  
  // Multiple source paths to one test path
  { src: ['src/utils', 'lib/utils'], test: 'cypress/e2e/utils' },
  
  // One source path to multiple test paths
  { src: 'src/api', test: ['cypress/e2e/api', 'cypress/integration/api'] },
]
```

**Note**: Without explicit mappings, directory-based matching returns a score of 0. The tool does not use filesystem proximity heuristics.

### Smoke Tests

Smoke tests are **always included** regardless of:
- Git diff content
- Directory mappings
- Tag matches
- Similarity scores

```javascript
smoke: {
  // Tests with these tags are always included
  tags: ['smoke', 'critical'],
  
  // Tests matching these patterns are always included
  patterns: ['cypress/smoke/**', 'cypress/e2e/critical/**'],
}
```

## 📖 Documentation

- [Quick Start Guide](./QUICK_START.md) - Get started in 2 minutes
- [CLI Documentation](./packages/cli/README.md) - Complete CLI reference
- [Architecture](./ARCHITECTURE.md) - Technical design details

## 🎯 Real-World Usage

### Local Development
```bash
npx cy-select diff  # See which tests would run
```

### CI/CD Pipeline
```bash
npx cy-select diff --base origin/main --json > selected-tests.json
```

### Debugging
```bash
npx cy-select diff --verbose  # See detailed scoring
```

## Running Selected Tests (Dev and CI)

Once you've identified which tests to run, here's how to execute them in different environments:

### Local Development (Cypress Open Mode)

1. **Generate selected tests config:**
```bash
npx cy-select diff --json > selected-tests.json
```

2. **Create a Cypress config file** (`cypress.selected.config.ts`) that reads from the generated file:
```typescript
import { defineConfig } from 'cypress';
import selectedTests from './selected-tests.json';

export default defineConfig({
  e2e: {
    specPattern: selectedTests.selected,
    // ... your other Cypress config
  },
});
```

3. **Run Cypress in open mode:**
```bash
npx cypress open --config-file cypress.selected.config.ts
```

This opens the Cypress Test Runner with only the selected tests visible.

### Local Development (Headless)

Run selected tests headlessly using the generated config:

```bash
# Generate selected tests
npx cy-select diff --json > selected-tests.json

# Run Cypress headless with selected tests
npx cypress run --config-file cypress.selected.config.ts
```

Or directly using the JSON output:
```bash
npx cy-select diff --json > selected-tests.json
npx cypress run --spec "$(cat selected-tests.json | jq -r '.selected[]' | tr '\n' ',')"
```

### CI/CD Pipeline

For CI environments, use `cy-select` to get selected tests, then run Cypress:

```bash
# Step 1: Get selected tests
npx cy-select diff --base origin/main --json > selected-tests.json

# Step 2: Run Cypress with selected tests
npx cypress run --config-file cypress.selected.config.ts
```

**Example CI script** (GitHub Actions, GitLab CI, etc.):
```yaml
# .github/workflows/test.yml
- name: Get selected tests
  run: npx cy-select diff --base origin/main --json > selected-tests.json

- name: Run selected Cypress tests
  run: |
    if [ -s selected-tests.json ] && [ "$(jq -r '.selected | length' selected-tests.json)" -gt 0 ]; then
      npx cypress run --config-file cypress.selected.config.ts
    else
      echo "No tests selected, skipping Cypress run"
    fi
```

**Note:** The `selected-tests.json` file (generated by `cy-select diff --json`) contains a JSON object with a `selected` array of test file paths. The `cypress.selected.config.ts` file references this to configure Cypress to run only the selected tests.

## Heuristics

The tool uses 3 heuristics to match changed files to tests:

### 1. Directory Mapping (Explicit Config)
- Uses explicit `mappings` configuration
- Score: 1.0 for match, 0.0 otherwise
- No filesystem proximity fallback

### 2. Filename Similarity
- Token-based matching (Dice coefficient + LCS)
- Handles camelCase, hyphens, underscores
- Score: 0.0 to 1.0 based on similarity

### 3. Tag Matching
- Matches test tags against changed file tokens
- Supports comment tags, inline tags, Cypress metadata
- Score: 0.0 to 1.0 based on match quality

## License

MIT
