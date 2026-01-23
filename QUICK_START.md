# Quick Start Guide

## Real-World Usage (It's Simple!)

### Step 1: Install (One Command)

```bash
npm install cypress-smart-test-selection
```

Or with other package managers:
```bash
yarn add cypress-smart-test-selection
pnpm add cypress-smart-test-selection
```

### Step 2: Configure (One-Time, Optional)

Create `cypress-test-selector.config.js` in your project root:

```javascript
export default {
  testPatterns: ["cypress/**/*.spec.ts"],
  safetyLevel: "medium", // or "high", "moderate", "low"
  defaultBase: "origin/main",
};
```

**That's it!** You can skip this step and use defaults.

### Step 3: Use It (One Command)

Run the command using your package manager:

**Using npx (Recommended):**
```bash
# Basic usage - compares against default branch
npx cy-select diff

# Compare against specific commit/branch
npx cy-select diff --base origin/develop

# Get JSON output (for CI/CD)
npx cy-select diff --json

# See detailed scoring (for debugging)
npx cy-select diff --verbose
```

**Using yarn/pnpm:**
```bash
# yarn
yarn cy-select diff

# pnpm
pnpm cy-select diff
```

**Using npm scripts (Optional):**
Add to your `package.json`:
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

## Typical Workflows

### Local Development

```bash
# Before committing, see which tests would run
npx cy-select diff

# Compare against main branch
npx cy-select diff --base origin/main
```

### CI/CD Pipeline

```bash
# In your CI script
npx cy-select diff --base origin/main --json > selected-tests.json

# Then run Cypress with selected tests
npx cypress run --spec "$(cat selected-tests.json | jq -r '.selected[]' | tr '\n' ',')"
```

### Debugging

```bash
# See why tests were selected
npx cy-select diff --verbose
```

Output:
```
Selected 12 tests:
  login.spec.ts
  home-page.spec.ts
  cart.spec.ts
  ...

Safety level: moderate (threshold: 0.2)
```

## Common Use Cases

### 1. Pre-commit Check
```bash
npx cy-select diff
```

### 2. PR Validation (CI)
```bash
npx cy-select diff --base origin/main --json
```

### 3. Debug Test Selection
```bash
npx cy-select diff --verbose
```

### 4. Custom Test Patterns
```bash
npx cy-select diff --pattern "**/*.spec.ts" --pattern "**/*.test.ts"
```
