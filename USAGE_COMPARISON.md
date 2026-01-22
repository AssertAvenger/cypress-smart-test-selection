# Usage Comparison: Testing vs. Real-World

## What We Did (Testing/Debugging)

When we tested the cart update, we ran many commands to verify everything works:

```bash
# Test different safety levels
cy-select diff --base HEAD~1  # with high
cy-select diff --base HEAD~1  # with moderate  
cy-select diff --base HEAD~1  # with medium

# Compare outputs
cy-select diff --base HEAD~1 --verbose
cy-select diff --base HEAD~1 --json

# Debug configuration loading
# ... many more commands
```

**Why?** We were testing, debugging, and verifying the software works correctly.

## What You Do (Real Usage)

### First Time Setup (One-Time)

```bash
# 1. Install
npm install cypress-smart-test-selection

# 2. Optional: Create config file (or use defaults)
echo 'export default { safetyLevel: "medium" };' > cypress-test-selector.config.js
```

### Daily Usage (One Command)

```bash
# See which tests are selected
cy-select diff
```

That's it! 🎉

## Real-World Examples

### Example 1: Before Committing

```bash
cy-select diff
```

Output:
```
Selected 12 tests:
  login.spec.ts
  cart.spec.ts
  ...
```

### Example 2: In CI/CD

```bash
cy-select diff --base origin/main --json > selected-tests.json
```

### Example 3: Debugging (When Needed)

```bash
cy-select diff --verbose
```

## Summary

| Scenario | Commands Needed |
|----------|----------------|
| **Testing/Debugging** | 10+ commands |
| **Real-World Usage** | 1 command |
| **First-Time Setup** | 2 commands (install + optional config) |

The complexity you saw was **verification and testing**. Real usage is simple! ✨
