import { test, expect } from '@playwright/test';

test.describe('Logs Bar Design Test', () => {
  test('capture logs bar expanded with all elements visible', async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Wait for main menu to be visible
    const mainMenu = page.locator('main-menu');
    await expect(mainMenu).toBeVisible({ timeout: 10000 });
    
    // Wait for components to initialize
    await page.waitForTimeout(1000);
    
    // First, make dev controls visible
    await page.evaluate(() => {
      const mainMenu = document.querySelector('main-menu');
      if (!mainMenu || typeof (mainMenu as any).shadowRoot === 'undefined') return false;
      
      const mainMenuShadow = (mainMenu as any).shadowRoot;
      if (!mainMenuShadow) return false;
      
      // Show dev controls
      const devControls = mainMenuShadow.querySelector('#dev-controls') as HTMLElement;
      if (devControls) {
        devControls.style.display = 'block';
      }
      return true;
    });
    
    // Wait for dev UI to be ready
    await page.waitForTimeout(500);
    
    // Now expand the logs bar
    const logsBarExpanded = await page.evaluate(() => {
      const mainMenu = document.querySelector('main-menu');
      if (!mainMenu || typeof (mainMenu as any).shadowRoot === 'undefined') return false;
      
      const mainMenuShadow = (mainMenu as any).shadowRoot;
      if (!mainMenuShadow) return false;
      
      // Find development-ui
      const devUI = mainMenuShadow.querySelector('development-ui');
      if (!devUI || typeof (devUI as any).shadowRoot === 'undefined') return false;
      
      const shadow = (devUI as any).shadowRoot;
      if (!shadow) return false;
      
      // Click only the Logs bar toggle to expand it
      const logsToggle = shadow.querySelector('#logs-bar-toggle') as HTMLButtonElement;
      if (logsToggle) {
        logsToggle.click();
        return true;
      }
      return false;
    });
    
    if (!logsBarExpanded) {
      console.log('Warning: Could not expand logs bar');
    }
    
    // Wait for the logs bar to expand with animation
    await page.waitForTimeout(1000);
    
    // Take screenshots
    await page.screenshot({ 
      path: 'e2e/screenshots/logs-bar-expanded-full.png',
      fullPage: false
    });
    
    // Take a focused screenshot of just the top portion with logs bar
    await page.screenshot({
      path: 'e2e/screenshots/logs-bar-expanded-closeup.png',
      clip: {
        x: 0,
        y: 0,
        width: page.viewportSize()?.width || 1280,
        height: 500  // Capture enough to see the full logs bar
      }
    });
    
    console.log('Logs bar screenshots saved to:');
    console.log('  - e2e/screenshots/logs-bar-expanded-full.png');
    console.log('  - e2e/screenshots/logs-bar-expanded-closeup.png');
    
    // Verify logs bar elements are visible
    const logsBarStatus = await page.evaluate(() => {
      const mainMenu = document.querySelector('main-menu');
      if (!mainMenu || typeof (mainMenu as any).shadowRoot === 'undefined') return {};
      
      const mainMenuShadow = (mainMenu as any).shadowRoot;
      if (!mainMenuShadow) return {};
      
      const devUI = mainMenuShadow.querySelector('development-ui');
      if (!devUI || typeof (devUI as any).shadowRoot === 'undefined') return {};
      
      const shadow = (devUI as any).shadowRoot;
      if (!shadow) return {};
      
      const logsBar = shadow.querySelector('#logs-bar');
      const themesGrid = shadow.querySelector('.themes-grid');
      const themeCheckboxes = shadow.querySelectorAll('.theme-checkbox');
      
      return {
        logsBarVisible: logsBar && !logsBar.classList.contains('hidden'),
        themesGridExists: !!themesGrid,
        themeCount: themeCheckboxes.length,
        logsBarHeight: logsBar ? (logsBar as HTMLElement).offsetHeight : 0,
        logsBarDisplay: logsBar ? window.getComputedStyle(logsBar).display : 'none'
      };
    });
    
    console.log('Logs bar status:', logsBarStatus);
  });
});