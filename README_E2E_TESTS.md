# End-to-End Testing Setup

This project uses Playwright for end-to-end testing of the web components-based game.

## Installation

1. Install dependencies:
```bash
npm install
```

2. Install Playwright browsers:
```bash
npx playwright install
```

## Running Tests

### Run all E2E tests
```bash
npm run test:e2e
```

### Run tests with UI (interactive mode)
```bash
npm run test:e2e:ui
```

### Debug tests
```bash
npm run test:e2e:debug
```

### View test report
```bash
npm run test:e2e:report
```

## Test Structure

- `/e2e/tests/` - Test files
- `/e2e/pages/` - Page Object Models
- `/e2e/fixtures/` - Test fixtures and utilities
- `playwright.config.ts` - Playwright configuration

## Writing Tests

The tests use Page Object Model pattern to encapsulate component interactions:

```typescript
import { test, expect } from '../fixtures/game.fixture';

test('should start a single player game', async ({ mainMenuPage, gameBoardPage }) => {
  await mainMenuPage.goto();
  await mainMenuPage.startSinglePlayer();
  await gameBoardPage.waitForGameToStart();
  // ... assertions
});
```

## Configuration

The tests are configured to:
- Run against the local development server (http://localhost:3000)
- Test in Chromium, Firefox, and WebKit
- Capture screenshots and videos on failure
- Generate HTML reports

## Notes

- Tests handle Shadow DOM components using `evaluate` methods
- The server automatically starts before tests run
- Tests run in parallel for faster execution