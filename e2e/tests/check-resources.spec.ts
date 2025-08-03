import { test, expect } from '@playwright/test';

test.describe('Check Resource Loading', () => {
  test('verify CSS and HTML resources are accessible', async ({ page }) => {
    // Track network failures
    const failedRequests: string[] = [];
    
    page.on('requestfailed', request => {
      failedRequests.push(`${request.method()} ${request.url()} - ${request.failure()?.errorText}`);
    });
    
    page.on('response', response => {
      if (response.status() >= 400) {
        failedRequests.push(`${response.status()} ${response.url()}`);
      }
    });

    // Also capture console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    console.log('Failed requests:', failedRequests);
    console.log('Console errors:', consoleErrors);
    
    // Try to fetch the resources with CORRECT paths
    const mainMenuCss = await page.evaluate(async () => {
      try {
        const response = await fetch('/css/components/mainmenu/MainMenu.css');
        return { status: response.status, ok: response.ok, url: response.url };
      } catch (error) {
        return { error: error.message };
      }
    });
    
    const mainMenuHtml = await page.evaluate(async () => {
      try {
        const response = await fetch('/html/components/mainmenu/MainMenu.html');
        return { status: response.status, ok: response.ok, url: response.url };
      } catch (error) {
        return { error: error.message };
      }
    });
    
    console.log('MainMenu CSS fetch result:', mainMenuCss);
    console.log('MainMenu HTML fetch result:', mainMenuHtml);
    
    // Check if the files exist in the expected location
    const checkPaths = await page.evaluate(() => {
      // Get the import.meta.url equivalent from a module
      const scriptTag = document.querySelector('script[type="module"][src*="components"]');
      const baseUrl = scriptTag?.getAttribute('src') || '';
      return {
        scriptUrl: baseUrl,
        expectedCssPattern: baseUrl.replace('/js/', '/css/'),
        expectedHtmlPattern: baseUrl.replace('/js/', '/html/'),
      };
    });
    
    console.log('Path patterns:', checkPaths);
    
    // Verify the correct resources are accessible
    expect(mainMenuCss.ok).toBe(true);
    expect(mainMenuHtml.ok).toBe(true);
  });

  test('manual shadow DOM creation test', async ({ page }) => {
    await page.goto('/');
    
    // Try to manually initialize shadow DOM to see what happens
    const result = await page.evaluate(async () => {
      const menu = document.querySelector('main-menu');
      if (!menu) return { error: 'No main-menu element found' };
      
      try {
        // Try to manually call connectedCallback
        const connectedResult = await (menu as any).connectedCallback();
        return { 
          success: true, 
          shadowRootExists: menu.shadowRoot !== null,
          shadowRootMode: menu.shadowRoot?.mode,
        };
      } catch (error) {
        return { 
          error: error.message,
          stack: error.stack,
        };
      }
    });
    
    console.log('Manual shadow DOM creation result:', result);
  });
});