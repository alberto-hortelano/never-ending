import { test, expect } from '@playwright/test';

test.describe('Tutorial Screenshots - Actual Game Only', () => {
  test.setTimeout(120000); // 2 minute timeout
  
  test('generate tutorial screenshots of actual game features', async ({ page }) => {
    // Helper to save screenshot with error handling
    const saveScreenshot = async (filename: string, element?: any, options = {}) => {
      try {
        if (element) {
          await element.screenshot({ 
            path: filename,
            ...options
          });
        } else {
          await page.screenshot({ 
            path: filename,
            fullPage: true,
            ...options
          });
        }
        console.log(`✓ Captured ${filename}`);
        return true;
      } catch (e) {
        console.log(`✗ Failed to capture ${filename}:`, e);
        return false;
      }
    };

    // Helper to wait for element with fallback
    const waitForElement = async (selector: string, timeout = 5000) => {
      try {
        await page.waitForSelector(selector, { state: 'visible', timeout });
        return true;
      } catch {
        console.log(`Element ${selector} not found within ${timeout}ms`);
        return false;
      }
    };

    // Set test mode flag
    await page.addInitScript(() => {
      (window as any).__PLAYWRIGHT_TEST__ = true;
    });

    // 1. Game start screen
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    await saveScreenshot('tutorial-01-start-screen.png');

    // 2. Try to start single player game
    const menuInteracted = await page.evaluate(() => {
      const menu = document.querySelector('main-menu');
      if (menu) {
        // Try multiple approaches
        if ((menu as any).startSinglePlayer) {
          (menu as any).startSinglePlayer();
          return true;
        } else if ((menu as any).getTestingShadowRoot) {
          const shadowRoot = (menu as any).getTestingShadowRoot();
          const button = shadowRoot?.querySelector('#singlePlayerBtn') as HTMLButtonElement;
          if (button) {
            button.click();
            return true;
          }
        }
      }
      return false;
    });

    if (!menuInteracted) {
      console.log('Could not interact with menu - stopping here');
      return;
    }

    // 2. Character selection (only if it exists)
    const charSelectFound = await waitForElement('select-character', 8000);
    
    if (charSelectFound) {
      await page.waitForTimeout(1000);
      await saveScreenshot('tutorial-02-character-selection.png');

      // Try to select a character
      await page.evaluate(() => {
        const selectChar = document.querySelector('select-character');
        if (selectChar && (selectChar as any).getTestingShadowRoot) {
          const shadowRoot = (selectChar as any).getTestingShadowRoot();
          const firstChar = shadowRoot?.querySelector('.character-option') as HTMLElement;
          if (firstChar) firstChar.click();
          setTimeout(() => {
            const submitBtn = shadowRoot?.querySelector('button[type="submit"]') as HTMLElement;
            if (submitBtn) submitBtn.click();
          }, 500);
        }
      });
    }

    // 3. Game interface (only if it loads)
    const gameStarted = await waitForElement('container-component', 8000) || 
                       await waitForElement('board-component', 5000);
    
    if (gameStarted) {
      await page.waitForTimeout(2000);
      await saveScreenshot('tutorial-03-game-interface.png');

      // 4. Action points (if visible)
      if (await waitForElement('action-summary', 3000)) {
        const actionSummary = await page.locator('action-summary');
        await saveScreenshot('tutorial-04-action-points.png', actionSummary);
      }

      // 5. Movement highlight - try clicking a cell
      const cellClicked = await page.evaluate(() => {
        const board = document.querySelector('board-component');
        if (board && (board as any).getTestingShadowRoot) {
          const shadowRoot = (board as any).getTestingShadowRoot();
          const cells = shadowRoot?.querySelectorAll('cell-component');
          if (cells && cells.length > 5) {
            (cells[5] as HTMLElement).click();
            return true;
          }
        }
        return false;
      });

      if (cellClicked) {
        await page.waitForTimeout(1000);
        await saveScreenshot('tutorial-05-movement-highlight.png');
      }

      // 6. Actions menu (if accessible)
      const actionsOpened = await page.evaluate(() => {
        const bottomBar = document.querySelector('bottom-bar');
        if (bottomBar && (bottomBar as any).getTestingShadowRoot) {
          const shadowRoot = (bottomBar as any).getTestingShadowRoot();
          const actionsBtn = shadowRoot?.querySelector('[title="Actions"]') as HTMLElement;
          if (actionsBtn) {
            actionsBtn.click();
            return true;
          }
        }
        return false;
      });

      if (actionsOpened) {
        await page.waitForTimeout(500);
        await saveScreenshot('tutorial-06-actions-menu.png');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }

      // 7. Inventory (if accessible)
      const inventoryOpened = await page.evaluate(() => {
        const bottomBar = document.querySelector('bottom-bar');
        if (bottomBar && (bottomBar as any).getTestingShadowRoot) {
          const shadowRoot = (bottomBar as any).getTestingShadowRoot();
          const inventoryBtn = shadowRoot?.querySelector('[title="Inventory"]') as HTMLElement;
          if (inventoryBtn) {
            inventoryBtn.click();
            return true;
          }
        }
        return false;
      });

      if (inventoryOpened) {
        await page.waitForTimeout(500);
        const inventoryPopup = await page.locator('popup-component');
        if (await inventoryPopup.isVisible()) {
          await saveScreenshot('tutorial-07-inventory.png', inventoryPopup);
        }
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }

      // 8. Shooting mode (if available)
      const shootingActivated = await page.evaluate(() => {
        const bottomBar = document.querySelector('bottom-bar');
        if (bottomBar && (bottomBar as any).getTestingShadowRoot) {
          const shadowRoot = (bottomBar as any).getTestingShadowRoot();
          const actionsBtn = shadowRoot?.querySelector('[title="Actions"]') as HTMLElement;
          if (actionsBtn) actionsBtn.click();
        }
        return true;
      });

      if (shootingActivated) {
        await page.waitForTimeout(500);
        const shootClicked = await page.evaluate(() => {
          const actionsPopup = document.querySelector('actions-component');
          if (actionsPopup && (actionsPopup as any).getTestingShadowRoot) {
            const shadowRoot = (actionsPopup as any).getTestingShadowRoot();
            const shootAction = shadowRoot?.querySelector('[data-action="shoot"]') as HTMLElement;
            if (shootAction) {
              shootAction.click();
              return true;
            }
          }
          return false;
        });

        if (shootClicked) {
          await page.waitForTimeout(1000);
          await saveScreenshot('tutorial-08-shooting-mode.png');
        }
      }

      // 9. End turn button (if visible)
      const endTurnRect = await page.evaluate(() => {
        const bottomBar = document.querySelector('bottom-bar');
        if (bottomBar && (bottomBar as any).getTestingShadowRoot) {
          const shadowRoot = (bottomBar as any).getTestingShadowRoot();
          const endTurnBtn = shadowRoot?.querySelector('.end-turn-btn') as HTMLElement;
          if (endTurnBtn) {
            return endTurnBtn.getBoundingClientRect();
          }
        }
        return null;
      });

      if (endTurnRect) {
        await page.screenshot({ 
          path: 'tutorial-09-end-turn.png',
          clip: endTurnRect
        });
      }

      // 10. Settings menu (if accessible)
      const settingsOpened = await page.evaluate(() => {
        const topBar = document.querySelector('top-bar');
        if (topBar && (topBar as any).getTestingShadowRoot) {
          const shadowRoot = (topBar as any).getTestingShadowRoot();
          const settingsBtn = shadowRoot?.querySelector('[title="Settings"]') as HTMLElement;
          if (settingsBtn) {
            settingsBtn.click();
            return true;
          }
        }
        return false;
      });

      if (settingsOpened) {
        await page.waitForTimeout(500);
        const settingsPopup = await page.locator('popup-component');
        if (await settingsPopup.isVisible()) {
          await saveScreenshot('tutorial-10-settings.png', settingsPopup);
        }
      }
    }

    console.log('Screenshot generation complete - captured only actual game features');
  });
});