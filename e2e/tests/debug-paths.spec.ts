import { test, expect } from '@playwright/test';

test.describe('Debug Resource Paths', () => {
  test('check actual resource URLs being requested', async ({ page }) => {
    const resourceRequests: string[] = [];
    
    // Intercept all requests
    page.on('request', request => {
      const url = request.url();
      if (url.includes('.css') || url.includes('.html')) {
        resourceRequests.push(`${request.method()} ${url}`);
      }
    });
    
    page.on('requestfailed', request => {
      const url = request.url();
      if (url.includes('.css') || url.includes('.html')) {
        console.log(`FAILED: ${request.method()} ${url} - ${request.failure()?.errorText}`);
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    console.log('Resource requests made:');
    resourceRequests.forEach(req => console.log(req));
    
    // Check if the correct paths exist
    const correctPaths = await page.evaluate(async () => {
      const paths = {
        oldCss: '/css/mainmenu/MainMenu.css',
        oldHtml: '/html/mainmenu/MainMenu.html',
        newCss: '/css/components/mainmenu/MainMenu.css',
        newHtml: '/html/components/mainmenu/MainMenu.html',
      };
      
      const results = {};
      for (const [key, path] of Object.entries(paths)) {
        try {
          const response = await fetch(path);
          results[key] = { path, status: response.status, ok: response.ok };
        } catch (error) {
          results[key] = { path, error: error.message };
        }
      }
      return results;
    });
    
    console.log('Path availability:', correctPaths);
    
    // Test import.meta.url behavior
    const importMetaTest = await page.evaluate(() => {
      // Simulate what Component class does
      const testUrl = 'http://localhost:3000/js/components/mainmenu/MainMenu.js';
      const nameLC = 'mainmenu';
      const name = 'MainMenu';
      
      // Original logic
      const oldCssUrl = new URL(`./${nameLC}/${name}.css`, testUrl).href.replace('/js/', '/css/');
      const oldHtmlUrl = new URL(`./${nameLC}/${name}.html`, testUrl).href.replace('/js/', '/html/');
      
      // Fixed logic
      const newCssUrl = new URL(`./${nameLC}/${name}.css`, testUrl).href.replace('/js/components/', '/css/components/');
      const newHtmlUrl = new URL(`./${nameLC}/${name}.html`, testUrl).href.replace('/js/components/', '/html/components/');
      
      return {
        testUrl,
        oldCssUrl,
        oldHtmlUrl,
        newCssUrl,
        newHtmlUrl,
      };
    });
    
    console.log('URL construction test:', importMetaTest);
    
    // The correct resources should be accessible
    expect(correctPaths.newCss.ok).toBe(true);
    expect(correctPaths.newHtml.ok).toBe(true);
  });
});