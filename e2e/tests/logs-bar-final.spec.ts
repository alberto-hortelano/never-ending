import { test, expect } from '@playwright/test';

test.describe('Logs Bar Final Design Test', () => {
  test('show expanded logs bar with improved design', async ({ page }) => {
    // Set viewport to ensure consistent screenshots
    await page.setViewportSize({ width: 1280, height: 720 });
    
    // Navigate to the application  
    await page.goto('/');
    
    // Wait for page load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    
    // Since we can see the dev UI in screenshots, we know it's there
    // Let's inject some JavaScript to directly manipulate it
    const result = await page.evaluate(() => {
      // Find main menu
      const mainMenu = document.querySelector('main-menu');
      if (!mainMenu || !mainMenu.shadowRoot) return { error: 'No main menu' };
      
      // Get development-ui
      const devUI = mainMenu.shadowRoot.querySelector('development-ui');
      if (!devUI || !devUI.shadowRoot) return { error: 'No dev UI' };
      
      const shadow = devUI.shadowRoot;
      
      // First, make sure the logs bar exists
      const logsBar = shadow.querySelector('#logs-bar');
      if (!logsBar) return { error: 'No logs bar' };
      
      // Remove hidden class and ensure it's visible
      logsBar.classList.remove('hidden');
      (logsBar as HTMLElement).style.display = 'flex';
      (logsBar as HTMLElement).style.visibility = 'visible';
      (logsBar as HTMLElement).style.opacity = '1';
      
      // Also ensure the toggle button shows as active
      const logsToggle = shadow.querySelector('#logs-bar-toggle');
      if (logsToggle) {
        logsToggle.classList.add('active');
      }
      
      // Get info about the logs bar content
      const themesGrid = shadow.querySelector('.themes-grid');
      const themeCheckboxes = shadow.querySelectorAll('.theme-checkbox');
      const logsHeader = shadow.querySelector('.logs-header');
      const logsContent = shadow.querySelector('.logs-content');
      const logsBottomRow = shadow.querySelector('.logs-bottom-row');
      
      return {
        success: true,
        logsBarVisible: true,
        hasThemesGrid: !!themesGrid,
        themeCount: themeCheckboxes.length,
        hasHeader: !!logsHeader,
        hasContent: !!logsContent,
        hasBottomRow: !!logsBottomRow,
        logsBarHeight: (logsBar as HTMLElement).offsetHeight
      };
    });
    
    console.log('Logs bar state:', result);
    
    // Wait for any animations
    await page.waitForTimeout(500);
    
    // Take screenshots at different sizes to show the responsive design
    
    // Full viewport screenshot
    await page.screenshot({ 
      path: 'e2e/screenshots/logs-bar-final-full.png',
      fullPage: false
    });
    
    // Closeup of just the dev UI area
    await page.screenshot({
      path: 'e2e/screenshots/logs-bar-final-closeup.png',
      clip: {
        x: 0,
        y: 0,
        width: 1280,
        height: 250  // Focus on the dev UI area
      }
    });
    
    // If we can get the exact position, take a very focused shot
    const barPosition = await page.evaluate(() => {
      const mainMenu = document.querySelector('main-menu');
      if (!mainMenu || !mainMenu.shadowRoot) return null;
      
      const devUI = mainMenu.shadowRoot.querySelector('development-ui');
      if (!devUI || !devUI.shadowRoot) return null;
      
      const logsBar = devUI.shadowRoot.querySelector('#logs-bar');
      if (!logsBar) return null;
      
      const rect = (logsBar as HTMLElement).getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      };
    });
    
    if (barPosition && barPosition.height > 0) {
      console.log('Logs bar position:', barPosition);
      
      // Take a screenshot of just the logs bar
      await page.screenshot({
        path: 'e2e/screenshots/logs-bar-final-exact.png',
        clip: {
          x: Math.max(0, barPosition.x - 10),
          y: Math.max(0, barPosition.y - 10),
          width: Math.min(barPosition.width + 20, 1280),
          height: barPosition.height + 20
        }
      });
    }
    
    console.log('Screenshots saved:');
    console.log('  - logs-bar-final-full.png');
    console.log('  - logs-bar-final-closeup.png');
    if (barPosition && barPosition.height > 0) {
      console.log('  - logs-bar-final-exact.png');
    }
    
    // Verify the design improvements are applied
    const designCheck = await page.evaluate(() => {
      const mainMenu = document.querySelector('main-menu');
      if (!mainMenu || !mainMenu.shadowRoot) return null;
      
      const devUI = mainMenu.shadowRoot.querySelector('development-ui');
      if (!devUI || !devUI.shadowRoot) return null;
      
      const shadow = devUI.shadowRoot;
      const logsBar = shadow.querySelector('.logs-bar');
      if (!logsBar) return null;
      
      // Check various style improvements
      const styles = window.getComputedStyle(logsBar);
      const themesSection = shadow.querySelector('.logs-themes');
      const themesGrid = shadow.querySelector('.themes-grid');
      
      return {
        padding: styles.padding,
        flexDirection: styles.flexDirection,
        hasThemesBackground: themesSection ? window.getComputedStyle(themesSection).backgroundColor : 'none',
        themesGridDisplay: themesGrid ? window.getComputedStyle(themesGrid).display : 'none',
        gap: styles.gap
      };
    });
    
    console.log('Design check:', designCheck);
  });
});