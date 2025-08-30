import { test, expect } from '@playwright/test';

test.describe('Logs Bar Click Test', () => {
  test('click logs button to expand and capture', async ({ page }) => {
    // Navigate to the application  
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Use page.locator to find and click the logs button through shadow DOM
    // This approach uses Playwright's built-in shadow DOM piercing
    
    console.log('Looking for logs bar toggle button...');
    
    // Try to find the logs toggle button
    const logsToggleFound = await page.evaluate(() => {
      // Check main menu location
      const mainMenu = document.querySelector('main-menu');
      if (mainMenu && mainMenu.shadowRoot) {
        const devUI = mainMenu.shadowRoot.querySelector('development-ui');
        if (devUI && devUI.shadowRoot) {
          const logsToggle = devUI.shadowRoot.querySelector('#logs-bar-toggle');
          if (logsToggle) {
            console.log('Found logs toggle in main menu');
            (logsToggle as HTMLElement).click();
            return 'main-menu';
          }
        }
      }
      
      // Check if in game (container -> top-bar)
      const container = document.querySelector('container-component');
      if (container && container.shadowRoot) {
        const topBar = container.shadowRoot.querySelector('top-bar');
        if (topBar && topBar.shadowRoot) {
          const devUI = topBar.shadowRoot.querySelector('development-ui');
          if (devUI && devUI.shadowRoot) {
            const logsToggle = devUI.shadowRoot.querySelector('#logs-bar-toggle');
            if (logsToggle) {
              console.log('Found logs toggle in game top bar');
              (logsToggle as HTMLElement).click();
              return 'top-bar';
            }
          }
        }
      }
      
      return null;
    });
    
    console.log('Logs toggle found in:', logsToggleFound);
    
    // Wait for animation
    await page.waitForTimeout(1500);
    
    // Take screenshot
    await page.screenshot({ 
      path: 'e2e/screenshots/logs-bar-clicked.png',
      fullPage: false
    });
    
    // Get the actual state of the logs bar
    const logsBarState = await page.evaluate(() => {
      // Helper to check all locations
      const checkLocations = () => {
        const locations = [
          { 
            name: 'main-menu',
            getDevUI: () => {
              const el = document.querySelector('main-menu');
              return el?.shadowRoot?.querySelector('development-ui');
            }
          },
          {
            name: 'top-bar',
            getDevUI: () => {
              const container = document.querySelector('container-component');
              const topBar = container?.shadowRoot?.querySelector('top-bar');
              return topBar?.shadowRoot?.querySelector('development-ui');
            }
          }
        ];
        
        for (const loc of locations) {
          const devUI = loc.getDevUI();
          if (devUI && devUI.shadowRoot) {
            const logsBar = devUI.shadowRoot.querySelector('#logs-bar');
            if (logsBar) {
              const styles = window.getComputedStyle(logsBar);
              const themesGrid = devUI.shadowRoot.querySelector('.themes-grid');
              const themeCheckboxes = devUI.shadowRoot.querySelectorAll('.theme-checkbox');
              const logsHeader = devUI.shadowRoot.querySelector('.logs-header');
              
              // Get bounding rect for logs bar
              const rect = (logsBar as HTMLElement).getBoundingClientRect();
              
              return {
                location: loc.name,
                isHidden: logsBar.classList.contains('hidden'),
                display: styles.display,
                visibility: styles.visibility,
                height: rect.height,
                top: rect.top,
                themesCount: themeCheckboxes.length,
                hasThemesGrid: !!themesGrid,
                hasLogsHeader: !!logsHeader,
                opacity: styles.opacity,
                position: styles.position
              };
            }
          }
        }
        return null;
      };
      
      return checkLocations();
    });
    
    console.log('Logs bar state:', logsBarState);
    
    // If logs bar is visible, take a closeup
    if (logsBarState && !logsBarState.isHidden && logsBarState.height > 0) {
      console.log('Logs bar is visible, taking closeup...');
      
      await page.screenshot({
        path: 'e2e/screenshots/logs-bar-closeup-actual.png',
        clip: {
          x: 0,
          y: Math.max(0, logsBarState.top - 10),
          width: page.viewportSize()?.width || 1280,
          height: Math.min(logsBarState.height + 50, 400)
        }
      });
      
      console.log('Closeup screenshot saved');
    } else {
      console.log('Logs bar not visible or has no height');
      
      // Try to force it visible as a fallback
      await page.evaluate(() => {
        const mainMenu = document.querySelector('main-menu');
        if (mainMenu && mainMenu.shadowRoot) {
          const devUI = mainMenu.shadowRoot.querySelector('development-ui');
          if (devUI && devUI.shadowRoot) {
            const logsBar = devUI.shadowRoot.querySelector('#logs-bar') as HTMLElement;
            if (logsBar) {
              logsBar.classList.remove('hidden');
              logsBar.style.display = 'block';
              console.log('Forced logs bar visible');
            }
          }
        }
      });
      
      await page.waitForTimeout(500);
      
      await page.screenshot({ 
        path: 'e2e/screenshots/logs-bar-forced-visible.png',
        fullPage: false
      });
    }
  });
});