import { test, expect } from '@playwright/test';

test.describe('Development UI Screenshot', () => {
  test('capture complete development UI with all bars expanded', async ({ page }) => {
    // Navigate to the application
    await page.goto('/');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // The development-ui is inside the main-menu's shadow DOM
    // Wait for main menu to be visible first
    const mainMenu = page.locator('main-menu');
    await expect(mainMenu).toBeVisible({ timeout: 10000 });

    // Wait a moment for all components to initialize
    await page.waitForTimeout(1000);

    // Make sure dev controls are visible (they should be on localhost)
    const devControlsVisible = await page.evaluate(() => {
      const mainMenu = document.querySelector('main-menu');
      if (!mainMenu || typeof (mainMenu as any).shadowRoot === 'undefined') return false;

      const mainMenuShadow = (mainMenu as any).shadowRoot;
      if (!mainMenuShadow) return false;

      const devControls = mainMenuShadow.querySelector('#dev-controls') as HTMLElement;
      if (devControls) {
        devControls.style.display = 'block';
        return true;
      }
      return false;
    });

    if (!devControlsVisible) {
      console.log('Warning: Could not make dev controls visible');
    }

    // Wait for development-ui to be ready
    await page.waitForTimeout(500);

    // Access the development UI through main menu's shadow root and click toggles
    const togglesClicked = await page.evaluate(() => {
      // First get the main menu
      const mainMenu = document.querySelector('main-menu');
      if (!mainMenu || typeof (mainMenu as any).shadowRoot === 'undefined') return false;

      const mainMenuShadow = (mainMenu as any).shadowRoot;
      if (!mainMenuShadow) return false;

      // Find development-ui inside main menu
      const devUI = mainMenuShadow.querySelector('development-ui');
      if (!devUI || typeof (devUI as any).shadowRoot === 'undefined') return false;

      const shadow = (devUI as any).shadowRoot;
      if (!shadow) return false;

      // Click Cache bar toggle
      const cacheToggle = shadow.querySelector('#cache-bar-toggle');
      if (cacheToggle) {
        (cacheToggle as HTMLElement).click();
      }

      // Click Logs bar toggle
      const logsToggle = shadow.querySelector('#logs-bar-toggle');
      if (logsToggle) {
        (logsToggle as HTMLElement).click();
      }

      // Click Story bar toggle
      const storyToggle = shadow.querySelector('#story-bar-toggle');
      if (storyToggle) {
        (storyToggle as HTMLElement).click();
      }

      return true;
    });

    if (!togglesClicked) {
      console.log('Warning: Could not click all toggle buttons');
    }

    // Wait for bars to expand with animation
    await page.waitForTimeout(500);

    // Take a screenshot of the entire viewport
    await page.screenshot({
      path: 'e2e/screenshots/development-ui-complete.png',
      fullPage: false  // Just the viewport to focus on the dev UI at the top
    });

    // Also take a close-up screenshot focusing on the top part with dev UI
    await page.screenshot({
      path: 'e2e/screenshots/development-ui-closeup.png',
      clip: {
        x: 0,
        y: 0,
        width: page.viewportSize()?.width || 1280,
        height: 400  // Focus on top part where dev UI is
      }
    });

    console.log('Development UI screenshots saved to:');
    console.log('  - e2e/screenshots/development-ui-complete.png (full viewport)');
    console.log('  - e2e/screenshots/development-ui-closeup.png (closeup of dev UI)');

    // Verify that all expected elements are visible
    const elementsVisible = await page.evaluate(() => {
      // First get the main menu
      const mainMenu = document.querySelector('main-menu');
      if (!mainMenu || typeof (mainMenu as any).shadowRoot === 'undefined') return {};

      const mainMenuShadow = (mainMenu as any).shadowRoot;
      if (!mainMenuShadow) return {};

      // Find development-ui inside main menu
      const devUI = mainMenuShadow.querySelector('development-ui');
      if (!devUI || typeof (devUI as any).shadowRoot === 'undefined') return {};

      const shadow = (devUI as any).shadowRoot;
      if (!shadow) return {};

      return {
        mainBar: !!shadow.querySelector('.dev-main-bar'),
        cacheBar: !shadow.querySelector('#cache-bar')?.classList.contains('hidden'),
        logsBar: !shadow.querySelector('#logs-bar')?.classList.contains('hidden'),
        storyBar: !shadow.querySelector('#story-bar')?.classList.contains('hidden'),
        themesGrid: !!shadow.querySelector('.themes-grid'),
        storyDebug: !!shadow.querySelector('story-debug')
      };
    });

    console.log('Elements visibility:', elementsVisible);

    // Basic assertions to ensure UI is properly rendered
    expect(elementsVisible.mainBar).toBeTruthy();
    expect(elementsVisible.cacheBar).toBeTruthy();
    expect(elementsVisible.logsBar).toBeTruthy();
    expect(elementsVisible.storyBar).toBeTruthy();
  });
});