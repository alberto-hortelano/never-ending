import { test, expect } from '@playwright/test';

test.describe('Manual Logs Bar Test', () => {
  test('manually expand logs bar and capture design', async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Inject CSS to make logs bar visible for testing
    await page.addStyleTag({
      content: `
        /* Force show dev controls */
        #dev-controls { display: block !important; }
        
        /* Force show logs bar */
        #logs-bar { display: block !important; }
        .logs-bar.hidden { display: block !important; }
        
        /* Make sure development-ui is visible */
        development-ui { display: block !important; }
      `
    });
    
    // Also manually set styles via JavaScript
    await page.evaluate(() => {
      // Try main menu first (most likely location)
      const mainMenu = document.querySelector('main-menu');
      if (mainMenu && typeof (mainMenu as any).shadowRoot !== 'undefined') {
        const shadow = (mainMenu as any).shadowRoot;
        if (shadow) {
          
          // Show dev controls
          const devControls = shadow.querySelector('#dev-controls') as HTMLElement;
          if (devControls) {
            devControls.style.display = 'block';
            devControls.style.visibility = 'visible';
          }
          
          // Find development-ui
          const devUI = shadow.querySelector('development-ui');
          if (devUI && typeof (devUI as any).shadowRoot !== 'undefined') {
            const devUIShadow = (devUI as any).shadowRoot;
            
            // Force show logs bar
            const logsBar = devUIShadow.querySelector('#logs-bar') as HTMLElement;
            if (logsBar) {
              logsBar.classList.remove('hidden');
              logsBar.style.display = 'block';
              logsBar.style.visibility = 'visible';
              logsBar.style.opacity = '1';
              
              console.log('Forced logs bar visible');
              return true;
            }
          }
        }
      }
      return false;
    });
    
    // Wait for styles to apply
    await page.waitForTimeout(1000);
    
    // Take screenshots
    await page.screenshot({ 
      path: 'e2e/screenshots/logs-bar-forced-full.png',
      fullPage: false
    });
    
    // Take multiple closeup screenshots at different heights
    for (let height of [300, 400, 500, 600]) {
      await page.screenshot({
        path: `e2e/screenshots/logs-bar-forced-${height}px.png`,
        clip: {
          x: 0,
          y: 0,
          width: page.viewportSize()?.width || 1280,
          height: height
        }
      });
    }
    
    console.log('Forced logs bar screenshots saved');
    
    // Get detailed status of the logs bar
    const logsBarDetails = await page.evaluate(() => {
      const mainMenu = document.querySelector('main-menu');
      if (!mainMenu || typeof (mainMenu as any).shadowRoot === 'undefined') return null;
      
      const shadow = (mainMenu as any).shadowRoot;
      const devUI = shadow?.querySelector('development-ui');
      if (!devUI || typeof (devUI as any).shadowRoot === 'undefined') return null;
      
      const devUIShadow = (devUI as any).shadowRoot;
      const logsBar = devUIShadow?.querySelector('#logs-bar') as HTMLElement;
      
      if (logsBar) {
        const styles = window.getComputedStyle(logsBar);
        const themesGrid = devUIShadow.querySelector('.themes-grid') as HTMLElement;
        const themeCheckboxes = devUIShadow.querySelectorAll('.theme-checkbox');
        
        return {
          display: styles.display,
          visibility: styles.visibility,
          height: logsBar.offsetHeight,
          width: logsBar.offsetWidth,
          hasHiddenClass: logsBar.classList.contains('hidden'),
          backgroundColor: styles.backgroundColor,
          padding: styles.padding,
          themesGridDisplay: themesGrid ? window.getComputedStyle(themesGrid).display : 'none',
          themeCount: themeCheckboxes.length,
          firstThemeText: themeCheckboxes[0]?.textContent || 'none'
        };
      }
      return null;
    });
    
    console.log('Logs bar details:', logsBarDetails);
  });
});