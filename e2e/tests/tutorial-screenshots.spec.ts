import { test, expect } from '@playwright/test';

test.describe('Tutorial Screenshots', () => {
  test.setTimeout(120000); // Increase timeout to 2 minutes
  
  test('generate tutorial screenshots', async ({ page }) => {
    // Set test mode flag
    await page.addInitScript(() => {
      (window as any).__PLAYWRIGHT_TEST__ = true;
    });

    // 1. Game start screen
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Give time for components to initialize
    
    await page.screenshot({ 
      path: 'tutorial-01-start-screen.png',
      fullPage: true 
    });

    // 2. Start single player game
    try {
      await page.evaluate(() => {
        const menu = document.querySelector('main-menu');
        if (menu && (menu as any).getTestingShadowRoot) {
          const shadowRoot = (menu as any).getTestingShadowRoot();
          const button = shadowRoot?.querySelector('#singlePlayerBtn') as HTMLButtonElement;
          if (button) button.click();
        }
      });
      
      // Wait for character selection
      await page.waitForSelector('select-character', { state: 'visible', timeout: 10000 });
      await page.waitForTimeout(1000); // Let animations complete
      await page.screenshot({ 
        path: 'tutorial-02-character-selection.png',
        fullPage: true 
      });

      // 3. Select a character
      await page.evaluate(() => {
        const selectChar = document.querySelector('select-character');
        if (selectChar && (selectChar as any).getTestingShadowRoot) {
          const shadowRoot = (selectChar as any).getTestingShadowRoot();
          const firstChar = shadowRoot?.querySelector('.character-option') as HTMLElement;
          if (firstChar) firstChar.click();
          
          // Submit selection
          setTimeout(() => {
            const submitBtn = shadowRoot?.querySelector('button[type="submit"]') as HTMLElement;
            if (submitBtn) submitBtn.click();
          }, 500);
        }
      });
    } catch (e) {
      console.log('Could not capture character selection screen:', e);
    }

    // 4. Game interface overview  
    try {
      await page.waitForSelector('container-component', { state: 'visible', timeout: 10000 });
      await page.waitForSelector('board-component', { state: 'visible', timeout: 10000 });
      await page.waitForTimeout(2000);
      await page.screenshot({ 
        path: 'tutorial-03-game-interface.png',
        fullPage: true 
      });

      // 5. Action points display
      await page.waitForSelector('action-summary', { state: 'visible', timeout: 5000 });
      await page.waitForTimeout(500);
      const actionSummary = await page.locator('action-summary');
      await actionSummary.screenshot({ 
        path: 'tutorial-04-action-points.png' 
      });

      // 6. Movement - click a cell to show movement highlight
      await page.evaluate(() => {
        const board = document.querySelector('board-component');
        if (board && (board as any).getTestingShadowRoot) {
          const shadowRoot = (board as any).getTestingShadowRoot();
          const cell = shadowRoot?.querySelector('cell-component[data-x="5"][data-y="5"]') as HTMLElement;
          if (cell) cell.click();
        }
      });
      await page.waitForTimeout(1000); // Let highlight appear
      await page.screenshot({ 
        path: 'tutorial-05-movement-highlight.png',
        fullPage: true 
      });
    } catch (e) {
      console.log('Could not capture game interface:', e);
    }

    // 7. Actions button in bottom bar
    try {
      await page.evaluate(() => {
        const bottomBar = document.querySelector('bottom-bar');
        if (bottomBar && (bottomBar as any).getTestingShadowRoot) {
          const shadowRoot = (bottomBar as any).getTestingShadowRoot();
          const actionsBtn = shadowRoot?.querySelector('[title="Actions"]') as HTMLElement;
          if (actionsBtn) actionsBtn.click();
        }
      });
      await page.waitForTimeout(500);
      await page.screenshot({ 
        path: 'tutorial-06-actions-menu.png',
        fullPage: true 
      });

      // Close actions menu
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    } catch (e) {
      console.log('Could not capture actions menu:', e);
    }

    // 8. Inventory button
    try {
      await page.evaluate(() => {
        const bottomBar = document.querySelector('bottom-bar');
        if (bottomBar && (bottomBar as any).getTestingShadowRoot) {
          const shadowRoot = (bottomBar as any).getTestingShadowRoot();
          const inventoryBtn = shadowRoot?.querySelector('[title="Inventory"]') as HTMLElement;
          if (inventoryBtn) inventoryBtn.click();
        }
      });
      await page.waitForTimeout(500);
      const inventoryPopup = await page.locator('popup-component');
      if (await inventoryPopup.isVisible()) {
        await inventoryPopup.screenshot({ 
          path: 'tutorial-07-inventory.png' 
        });
      }
      // Close inventory
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    } catch (e) {
      console.log('Could not capture inventory:', e);
    }

    // 9. Shooting mode - click shoot action
    try {
      await page.evaluate(() => {
        const bottomBar = document.querySelector('bottom-bar');
        if (bottomBar && (bottomBar as any).getTestingShadowRoot) {
          const shadowRoot = (bottomBar as any).getTestingShadowRoot();
          // Look for shoot button in actions
          const shootBtn = shadowRoot?.querySelector('button:has-text("Shoot")') as HTMLElement;
          if (!shootBtn) {
            // Try opening actions first
            const actionsBtn = shadowRoot?.querySelector('[title="Actions"]') as HTMLElement;
            if (actionsBtn) actionsBtn.click();
          }
        }
      });
      
      // Try to find and click shoot action
      await page.waitForTimeout(500);
      await page.evaluate(() => {
        const actionsPopup = document.querySelector('actions-component');
        if (actionsPopup && (actionsPopup as any).getTestingShadowRoot) {
          const shadowRoot = (actionsPopup as any).getTestingShadowRoot();
          const shootAction = shadowRoot?.querySelector('[data-action="shoot"]') as HTMLElement;
          if (shootAction) shootAction.click();
        }
      });
      
      await page.waitForTimeout(1000);
      await page.screenshot({ 
        path: 'tutorial-08-shooting-mode.png',
        fullPage: true 
      });
    } catch (e) {
      console.log('Could not capture shooting mode:', e);
    }

    // 10. End turn button
    try {
      await page.evaluate(() => {
        const bottomBar = document.querySelector('bottom-bar');
        if (bottomBar && (bottomBar as any).getTestingShadowRoot) {
          const shadowRoot = (bottomBar as any).getTestingShadowRoot();
          const endTurnBtn = shadowRoot?.querySelector('.end-turn-btn') as HTMLElement;
          if (endTurnBtn) {
            // Take screenshot of just the button
            const rect = endTurnBtn.getBoundingClientRect();
            (window as any).__endTurnRect = rect;
          }
        }
      });
      
      const endTurnRect = await page.evaluate(() => (window as any).__endTurnRect);
      if (endTurnRect) {
        await page.screenshot({ 
          path: 'tutorial-09-end-turn.png',
          clip: endTurnRect
        });
      }
    } catch (e) {
      console.log('Could not capture end turn button:', e);
    }

    // 11. Settings menu
    try {
      await page.evaluate(() => {
        const topBar = document.querySelector('top-bar');
        if (topBar && (topBar as any).getTestingShadowRoot) {
          const shadowRoot = (topBar as any).getTestingShadowRoot();
          const settingsBtn = shadowRoot?.querySelector('[title="Settings"]') as HTMLElement;
          if (settingsBtn) settingsBtn.click();
        }
      });
      await page.waitForTimeout(500);
      const settingsPopup = await page.locator('popup-component');
      if (await settingsPopup.isVisible()) {
        await settingsPopup.screenshot({ 
          path: 'tutorial-10-settings.png' 
        });
      }
    } catch (e) {
      console.log('Could not capture settings menu:', e);
    }
  });
});