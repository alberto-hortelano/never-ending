import { test, expect } from '@playwright/test';

test.describe('Basic E2E Test', () => {
  test('should load the application', async ({ page }) => {
    // Navigate to the page
    await page.goto('/');
    
    // Check page title
    await expect(page).toHaveTitle(/Never Ending/);
    
    // Check that main-menu component exists in DOM
    const mainMenu = page.locator('main-menu');
    await expect(mainMenu).toBeVisible();
    
    // Log page state for debugging
    console.log('Page URL:', page.url());
    console.log('Page title:', await page.title());
    
    // Check that required scripts are loaded
    const scriptsLoaded = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script[type="module"]'));
      return scripts.map(s => s.src || s.innerHTML.substring(0, 50));
    });
    console.log('Scripts loaded:', scriptsLoaded);
  });

  test('should have container and turn indicator components', async ({ page }) => {
    await page.goto('/');
    
    // Check for other game components
    const container = page.locator('container-component');
    await expect(container).toBeAttached();
    await expect(container).toHaveAttribute('style', 'display: none;');
    
    const turnIndicator = page.locator('turn-indicator');
    await expect(turnIndicator).toBeAttached();
    await expect(turnIndicator).toHaveAttribute('style', 'display: none;');
  });

  test('should respond to console messages', async ({ page }) => {
    // Listen for console messages
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      consoleMessages.push(`${msg.type()}: ${msg.text()}`);
    });
    
    await page.goto('/');
    await page.waitForTimeout(3000);
    
    // Check if there are any JavaScript errors
    const errors = consoleMessages.filter(msg => msg.startsWith('error:'));
    console.log('Console messages:', consoleMessages);
    
    // The application should not have any errors
    expect(errors).toHaveLength(0);
  });
});