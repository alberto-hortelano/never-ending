import { test, expect } from '@playwright/test';

test.describe('Logs Bar In-Game Design Test', () => {
  test('capture logs bar expanded in game view', async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Wait for main menu to be visible
    const mainMenu = page.locator('main-menu');
    await expect(mainMenu).toBeVisible({ timeout: 10000 });
    
    // Click Single Player to start the game
    await page.evaluate(() => {
      const mainMenu = document.querySelector('main-menu');
      if (!mainMenu || typeof (mainMenu as any).shadowRoot === 'undefined') return false;
      
      const mainMenuShadow = (mainMenu as any).shadowRoot;
      if (!mainMenuShadow) return false;
      
      // Find and click single player button
      const singlePlayerBtn = mainMenuShadow.querySelector('button.menu-button');
      if (singlePlayerBtn) {
        (singlePlayerBtn as HTMLButtonElement).click();
        return true;
      }
      return false;
    });
    
    // Wait for game to load
    await page.waitForTimeout(2000);
    
    // Check if we're in game or character selection
    const containerVisible = await page.locator('container-component').isVisible().catch(() => false);
    
    if (containerVisible) {
      console.log('Game container is visible');
      
      // Now try to expand the logs bar in the game's top bar
      const logsExpanded = await page.evaluate(() => {
        // Try to find development-ui in the container's top bar
        const container = document.querySelector('container-component');
        if (!container || typeof (container as any).shadowRoot === 'undefined') return false;
        
        const containerShadow = (container as any).shadowRoot;
        if (!containerShadow) return false;
        
        // Find top-bar
        const topBar = containerShadow.querySelector('top-bar');
        if (!topBar || typeof (topBar as any).shadowRoot === 'undefined') return false;
        
        const topBarShadow = (topBar as any).shadowRoot;
        if (!topBarShadow) return false;
        
        // Find development-ui in top bar
        const devUI = topBarShadow.querySelector('development-ui');
        if (!devUI || typeof (devUI as any).shadowRoot === 'undefined') return false;
        
        const devUIShadow = (devUI as any).shadowRoot;
        if (!devUIShadow) return false;
        
        // Click the logs bar toggle
        const logsToggle = devUIShadow.querySelector('#logs-bar-toggle') as HTMLButtonElement;
        if (logsToggle) {
          logsToggle.click();
          return true;
        }
        return false;
      });
      
      if (logsExpanded) {
        console.log('Successfully expanded logs bar in game');
      } else {
        console.log('Could not expand logs bar in game');
      }
    } else {
      console.log('Container not visible, might be in character selection');
      
      // Try origin selection
      const originSelection = await page.locator('origin-selection').isVisible().catch(() => false);
      
      if (originSelection) {
        console.log('In origin selection');
        
        // Show dev controls and expand logs in origin selection
        await page.evaluate(() => {
          const originSel = document.querySelector('origin-selection');
          if (!originSel || typeof (originSel as any).shadowRoot === 'undefined') return false;
          
          const shadow = (originSel as any).shadowRoot;
          if (!shadow) return false;
          
          // Show dev controls
          const devControls = shadow.querySelector('#dev-controls') as HTMLElement;
          if (devControls) {
            devControls.style.display = 'block';
          }
          
          return true;
        });
        
        await page.waitForTimeout(500);
        
        // Now expand logs bar
        await page.evaluate(() => {
          const originSel = document.querySelector('origin-selection');
          if (!originSel || typeof (originSel as any).shadowRoot === 'undefined') return false;
          
          const shadow = (originSel as any).shadowRoot;
          if (!shadow) return false;
          
          const devUI = shadow.querySelector('development-ui');
          if (!devUI || typeof (devUI as any).shadowRoot === 'undefined') return false;
          
          const devUIShadow = (devUI as any).shadowRoot;
          if (!devUIShadow) return false;
          
          // Click the logs bar toggle
          const logsToggle = devUIShadow.querySelector('#logs-bar-toggle') as HTMLButtonElement;
          if (logsToggle) {
            logsToggle.click();
            return true;
          }
          return false;
        });
      }
    }
    
    // Wait for animation
    await page.waitForTimeout(1000);
    
    // Take screenshots
    await page.screenshot({ 
      path: 'e2e/screenshots/logs-bar-game-full.png',
      fullPage: false
    });
    
    // Take a focused screenshot of the top portion
    await page.screenshot({
      path: 'e2e/screenshots/logs-bar-game-closeup.png',
      clip: {
        x: 0,
        y: 0,
        width: page.viewportSize()?.width || 1280,
        height: 600
      }
    });
    
    console.log('Logs bar screenshots saved to:');
    console.log('  - e2e/screenshots/logs-bar-game-full.png');
    console.log('  - e2e/screenshots/logs-bar-game-closeup.png');
    
    // Get logs bar status
    const logsBarStatus = await page.evaluate(() => {
      // Try multiple possible locations
      const locations = [
        // In game container
        () => {
          const container = document.querySelector('container-component');
          if (!container || typeof (container as any).shadowRoot === 'undefined') return null;
          const containerShadow = (container as any).shadowRoot;
          const topBar = containerShadow?.querySelector('top-bar');
          if (!topBar || typeof (topBar as any).shadowRoot === 'undefined') return null;
          const topBarShadow = (topBar as any).shadowRoot;
          return topBarShadow?.querySelector('development-ui');
        },
        // In origin selection
        () => {
          const originSel = document.querySelector('origin-selection');
          if (!originSel || typeof (originSel as any).shadowRoot === 'undefined') return null;
          const shadow = (originSel as any).shadowRoot;
          return shadow?.querySelector('development-ui');
        },
        // In main menu
        () => {
          const mainMenu = document.querySelector('main-menu');
          if (!mainMenu || typeof (mainMenu as any).shadowRoot === 'undefined') return null;
          const shadow = (mainMenu as any).shadowRoot;
          return shadow?.querySelector('development-ui');
        }
      ];
      
      for (const getDevUI of locations) {
        const devUI = getDevUI();
        if (devUI && typeof (devUI as any).shadowRoot !== 'undefined') {
          const shadow = (devUI as any).shadowRoot;
          const logsBar = shadow?.querySelector('#logs-bar');
          if (logsBar) {
            const themesGrid = shadow.querySelector('.themes-grid');
            const themeCheckboxes = shadow.querySelectorAll('.theme-checkbox');
            
            return {
              location: devUI.parentElement?.tagName || 'unknown',
              logsBarVisible: !logsBar.classList.contains('hidden'),
              themesGridExists: !!themesGrid,
              themeCount: themeCheckboxes.length,
              logsBarHeight: (logsBar as HTMLElement).offsetHeight,
              logsBarDisplay: window.getComputedStyle(logsBar).display
            };
          }
        }
      }
      
      return { error: 'No development-ui found' };
    });
    
    console.log('Logs bar status:', logsBarStatus);
  });
});