import { test, expect } from '@playwright/test';

test.describe('Smoke Test', () => {
  test('should load the home page', async ({ page }) => {
    // Navigate to the page
    await page.goto('http://localhost:3000');
    
    // Check if the page loads
    await expect(page).toHaveTitle(/Never Ending/);
    
    // Check if main-menu component exists
    const mainMenu = page.locator('main-menu');
    await expect(mainMenu).toBeVisible({ timeout: 10000 });
    
    // Debug: Log what's on the page
    const bodyContent = await page.evaluate(() => document.body.innerHTML);
    console.log('Page content:', bodyContent.substring(0, 500));
    
    // Check if the component has been defined
    const componentDefined = await page.evaluate(() => {
      return customElements.get('main-menu') !== undefined;
    });
    expect(componentDefined).toBe(true);
  });

  test('should have working web components', async ({ page }) => {
    // Set test mode for shadow DOM access
    await page.addInitScript(() => {
      (window as any).__PLAYWRIGHT_TEST__ = true;
    });
    
    await page.goto('http://localhost:3000');
    
    // Wait for custom elements to be defined
    await page.waitForFunction(() => {
      return customElements.get('main-menu') !== undefined;
    }, { timeout: 10000 });
    
    // Give components time to initialize
    await page.waitForTimeout(2000);
    
    // Check if shadow DOM is attached using testing method
    const shadowDOMInfo = await page.evaluate(() => {
      const menu = document.querySelector('main-menu');
      if (!menu) return { exists: false };
      
      const testingShadowRoot = (menu as any).getTestingShadowRoot?.();
      return {
        exists: true,
        hasTestingMethod: typeof (menu as any).getTestingShadowRoot === 'function',
        hasShadowRoot: testingShadowRoot !== null,
        // Since shadow DOM is closed, we use our testing method
        shadowRootAccessible: testingShadowRoot !== null
      };
    });
    
    console.log('Shadow DOM info:', shadowDOMInfo);
    
    // Verify component has shadow DOM via testing method
    expect(shadowDOMInfo.exists).toBe(true);
    expect(shadowDOMInfo.hasTestingMethod).toBe(true);
    expect(shadowDOMInfo.shadowRootAccessible).toBe(true);
  });
});