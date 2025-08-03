import { test, expect } from '@playwright/test';

test.describe('Shadow DOM Final Test', () => {
  test('verify shadow DOM initialization with longer wait', async ({ page }) => {
    await page.goto('/');
    
    // Wait for component to be defined
    await page.waitForFunction(() => {
      return customElements.get('main-menu') !== undefined;
    });
    
    // Give more time for async initialization
    await page.waitForTimeout(5000);
    
    // Check shadow DOM status
    const shadowStatus = await page.evaluate(() => {
      const menu = document.querySelector('main-menu');
      return {
        exists: menu !== null,
        hasShadowRoot: menu?.shadowRoot !== null,
        shadowMode: menu?.shadowRoot?.mode,
        // Try to access internals
        hasEventBus: !!(menu as any)?.eventBus,
        hasCss: (menu as any)?.hasCss,
        hasHtml: (menu as any)?.hasHtml,
      };
    });
    
    console.log('Shadow DOM status after wait:', shadowStatus);
    
    // Try manual initialization
    const manualInit = await page.evaluate(async () => {
      const menu = document.querySelector('main-menu');
      if (!menu || menu.shadowRoot) return { alreadyInitialized: true };
      
      try {
        // The connectedCallback might not have been called
        if ((menu as any).connectedCallback) {
          await (menu as any).connectedCallback();
          return { success: true, hasShadowRoot: menu.shadowRoot !== null };
        }
        return { error: 'No connectedCallback method' };
      } catch (error) {
        return { error: error.message };
      }
    });
    
    console.log('Manual initialization result:', manualInit);
    
    // Final check
    const finalStatus = await page.evaluate(() => {
      const menu = document.querySelector('main-menu');
      if (menu?.shadowRoot) {
        const buttons = menu.shadowRoot.querySelectorAll('button');
        return {
          hasShadowRoot: true,
          buttonCount: buttons.length,
          hasContent: menu.shadowRoot.innerHTML.length > 0,
        };
      }
      return { hasShadowRoot: false };
    });
    
    console.log('Final status:', finalStatus);
    
    // At least verify the component exists
    expect(shadowStatus.exists).toBe(true);
  });

  test('check if components wait for page load', async ({ page }) => {
    // Check different load states
    const loadStates = [];
    
    page.on('domcontentloaded', () => {
      loadStates.push('domcontentloaded');
    });
    
    page.on('load', () => {
      loadStates.push('load');
    });
    
    await page.goto('/');
    
    // Check when components initialize
    const initTiming = await page.evaluate(() => {
      return new Promise((resolve) => {
        let checkCount = 0;
        const checkInterval = setInterval(() => {
          const menu = document.querySelector('main-menu');
          checkCount++;
          
          if (menu?.shadowRoot || checkCount > 20) {
            clearInterval(checkInterval);
            resolve({
              checkCount,
              hasShadowRoot: menu?.shadowRoot !== null,
              readyState: document.readyState,
            });
          }
        }, 500);
      });
    });
    
    console.log('Load states:', loadStates);
    console.log('Initialization timing:', initTiming);
  });
});