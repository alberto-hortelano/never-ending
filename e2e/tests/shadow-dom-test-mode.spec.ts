import { test, expect } from '@playwright/test';

test.describe('Shadow DOM with Test Mode', () => {
  test.beforeEach(async ({ page }) => {
    // Set the test flag before navigating
    await page.addInitScript(() => {
      (window as any).__PLAYWRIGHT_TEST__ = true;
    });
  });

  test('should access shadow DOM via testing method', async ({ page }) => {
    await page.goto('/');
    
    // Wait for custom elements to be defined
    await page.waitForFunction(() => {
      return customElements.get('main-menu') !== undefined;
    });
    
    // Wait a bit for initialization
    await page.waitForTimeout(2000);
    
    // Check if we can access shadow DOM via testing method
    const shadowAccess = await page.evaluate(() => {
      const menu = document.querySelector('main-menu');
      if (!menu) return { error: 'No menu element' };
      
      // Try the testing method
      const testingShadowRoot = (menu as any).getTestingShadowRoot?.();
      
      return {
        hasMenu: true,
        hasTestingMethod: typeof (menu as any).getTestingShadowRoot === 'function',
        testingShadowRoot: testingShadowRoot !== null,
        shadowRootMode: testingShadowRoot?.mode,
        // Check contents if we have access
        hasButtons: testingShadowRoot ? testingShadowRoot.querySelectorAll('button').length > 0 : false,
        buttonCount: testingShadowRoot ? testingShadowRoot.querySelectorAll('button').length : 0,
      };
    });
    
    console.log('Shadow DOM access via testing method:', shadowAccess);
    
    // Verify we can access shadow DOM
    expect(shadowAccess.hasTestingMethod).toBe(true);
    expect(shadowAccess.testingShadowRoot).toBe(true);
    expect(shadowAccess.shadowRootMode).toBe('closed');
  });

  test('should be able to click buttons in closed shadow DOM', async ({ page }) => {
    await page.goto('/');
    
    // Wait for initialization
    await page.waitForFunction(() => {
      const menu = document.querySelector('main-menu');
      return menu && typeof (menu as any).getTestingShadowRoot === 'function';
    });
    
    await page.waitForTimeout(2000);
    
    // Click single player button using testing access
    const clickResult = await page.evaluate(() => {
      const menu = document.querySelector('main-menu');
      if (!menu) return { error: 'No menu' };
      
      const shadowRoot = (menu as any).getTestingShadowRoot();
      if (!shadowRoot) return { error: 'No shadow root access' };
      
      const singlePlayerBtn = shadowRoot.querySelector('#singlePlayerBtn') as HTMLButtonElement;
      if (!singlePlayerBtn) return { error: 'No single player button' };
      
      singlePlayerBtn.click();
      return { success: true, buttonText: singlePlayerBtn.textContent };
    });
    
    console.log('Click result:', clickResult);
    
    // Wait for menu to hide
    await page.waitForSelector('main-menu', { state: 'hidden' });
    
    // Verify game started
    const gameStarted = await page.evaluate(() => {
      const container = document.querySelector('container-component');
      return container && container.style.display !== 'none';
    });
    
    expect(clickResult.success).toBe(true);
    expect(gameStarted).toBe(true);
  });

  test('verify all components have testing access', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    const componentStatus = await page.evaluate(() => {
      const components = [
        'main-menu',
        'container-component',
        'turn-indicator',
      ];
      
      const status = {};
      
      components.forEach(selector => {
        const element = document.querySelector(selector);
        if (element) {
          const shadowRoot = (element as any).getTestingShadowRoot?.();
          status[selector] = {
            exists: true,
            hasMethod: typeof (element as any).getTestingShadowRoot === 'function',
            hasShadowRoot: shadowRoot !== null,
          };
        } else {
          status[selector] = { exists: false };
        }
      });
      
      return status;
    });
    
    console.log('Component testing access status:', componentStatus);
    
    // All components should have the testing method
    Object.values(componentStatus).forEach(status => {
      if (status.exists) {
        expect(status.hasMethod).toBe(true);
      }
    });
  });
});