# Finding Unused Code in TypeScript Projects

## Automated Tools for Finding Unused Code

### 1. TypeScript Compiler (tsc)
```bash
# Find unused locals and parameters
npx tsc --noUnusedLocals --noUnusedParameters
```

### 2. ts-prune
A dedicated tool for finding unused exports in TypeScript:
```bash
# Install
npm install -g ts-prune

# Run in project root
ts-prune

# Or with specific tsconfig
ts-prune -p tsconfig.json
```

### 3. ESLint with TypeScript Plugin
Add these rules to `.eslintrc.json`:
```json
{
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "no-unused-vars": "off"
  }
}
```

### 4. ts-unused-exports
Find unused exports:
```bash
# Install
npm install -g ts-unused-exports

# Run
ts-unused-exports tsconfig.json
```

### 5. Knip
A more comprehensive tool that finds unused files, dependencies, and exports:
```bash
# Install
npm install -g knip

# Run
knip
```

### 6. IDE Features
- **VS Code**: "Find All References" (Shift+F12) on methods
- **WebStorm**: Code inspection for unused code
- **Coverage reports**: Run tests with coverage to see unused code

### 7. Manual Search with grep/ripgrep
```bash
# Find usage of a specific method
rg "methodName\(" --type ts

# Find all public methods and check usage
rg "public\s+\w+\(" --type ts
```

## Best Practices
1. Run these tools as part of CI/CD pipeline
2. Configure pre-commit hooks to catch unused code
3. Regular code reviews to identify dead code
4. Use private/protected modifiers for internal methods
5. Remove code immediately when it becomes unused

## What We Did Today
We manually searched for unused methods by:
1. Listing all public methods in service files
2. Searching for their usage across the codebase
3. Identifying methods with no external usage
4. Removing or making private the unused methods

This resulted in removing 12 completely unused methods and making 4 methods private (they were only used internally).