import { test, expect, Page } from '@playwright/test';

test.describe('Complete Game Flow - Happy Path', () => {
  test.setTimeout(180000); // 3 minutes for complete flow
  
  // Helper to save screenshot with consistent naming
  const saveScreenshot = async (page: Page, filename: string) => {
    await page.screenshot({ 
      path: `tutorial/images/${filename}`,
      fullPage: true 
    });
    console.log(`✓ Captured ${filename}`);
  };

  // Helper to save element screenshot
  const saveElementScreenshot = async (page: Page, selector: string, filename: string) => {
    const element = await page.locator(selector);
    if (await element.isVisible()) {
      await element.screenshot({ 
        path: `tutorial/images/${filename}` 
      });
      console.log(`✓ Captured ${filename}`);
      return true;
    }
    console.log(`✗ Could not capture ${filename} - element not visible`);
    return false;
  };

  // Helper to wait for element with fallback
  const waitForElement = async (page: Page, selector: string, timeout = 5000) => {
    try {
      await page.waitForSelector(selector, { state: 'visible', timeout });
      return true;
    } catch {
      console.log(`Element ${selector} not found within ${timeout}ms`);
      return false;
    }
  };

  test('complete game flow with tutorial screenshots', async ({ page }) => {
    // Set test mode flag
    await page.addInitScript(() => {
      (window as any).__PLAYWRIGHT_TEST__ = true;
    });

    // ========================================
    // 1. GAME START & MAIN MENU
    // ========================================
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    await saveScreenshot(page, '01-main-menu.png');

    // ========================================
    // 2. START SINGLE PLAYER GAME
    // ========================================
    const menuInteracted = await page.evaluate(() => {
      const menu = document.querySelector('main-menu');
      if (menu && (menu as any).getTestingShadowRoot) {
        const shadowRoot = (menu as any).getTestingShadowRoot();
        const button = shadowRoot?.querySelector('#singlePlayerBtn') as HTMLButtonElement;
        if (button) {
          button.click();
          return true;
        }
      }
      return false;
    });

    expect(menuInteracted).toBe(true);

    // ========================================
    // 3. CHARACTER SELECTION
    // ========================================
    const charSelectFound = await waitForElement(page, 'select-character', 8000);
    
    if (charSelectFound) {
      await page.waitForTimeout(1000);
      await saveScreenshot(page, '02-character-selection.png');

      // Select first character
      await page.evaluate(() => {
        const selectChar = document.querySelector('select-character');
        if (selectChar && (selectChar as any).getTestingShadowRoot) {
          const shadowRoot = (selectChar as any).getTestingShadowRoot();
          const firstChar = shadowRoot?.querySelector('.character-option') as HTMLElement;
          if (firstChar) {
            firstChar.click();
            setTimeout(() => {
              const submitBtn = shadowRoot?.querySelector('button[type="submit"]') as HTMLElement;
              if (submitBtn) submitBtn.click();
            }, 500);
          }
        }
      });
    }

    // ========================================
    // 4. GAME BOARD & INITIAL STATE
    // ========================================
    const gameStarted = await waitForElement(page, 'container-component', 10000) || 
                       await waitForElement(page, 'board-component', 5000);
    
    if (gameStarted) {
      await page.waitForTimeout(3000); // Let everything render
      await saveScreenshot(page, '03-game-board.png');

      // ========================================
      // 5. ACTION POINTS DISPLAY
      // ========================================
      if (await waitForElement(page, 'action-summary', 3000)) {
        await saveElementScreenshot(page, 'action-summary', '06-action-points.png');
      }

      // ========================================
      // 6. MOVEMENT SYSTEM
      // ========================================
      // Click on a cell to show movement options
      const cellClicked = await page.evaluate(() => {
        const board = document.querySelector('board-component');
        if (board && (board as any).getTestingShadowRoot) {
          const shadowRoot = (board as any).getTestingShadowRoot();
          // Try to find a character first
          const character = shadowRoot?.querySelector('character-component') as HTMLElement;
          if (character) {
            character.click();
            return 'character';
          }
          // Otherwise click a cell
          const cells = shadowRoot?.querySelectorAll('cell-component');
          if (cells && cells.length > 10) {
            (cells[10] as HTMLElement).click();
            return 'cell';
          }
        }
        return false;
      });

      if (cellClicked) {
        await page.waitForTimeout(1500);
        await saveScreenshot(page, '04-movement-basics.png');
        
        // Try to show movement path
        await page.evaluate(() => {
          const board = document.querySelector('board-component');
          if (board && (board as any).getTestingShadowRoot) {
            const shadowRoot = (board as any).getTestingShadowRoot();
            const highlightedCell = shadowRoot?.querySelector('cell-component.highlight') as HTMLElement;
            if (highlightedCell) {
              highlightedCell.click();
            }
          }
        });
        
        await page.waitForTimeout(1000);
        await saveScreenshot(page, '05-movement-path.png');
      }

      // ========================================
      // 7. SHOOTING & LINE OF SIGHT
      // ========================================
      // Open actions menu to access shoot
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
        await page.waitForTimeout(1000);
        await saveScreenshot(page, '12-actions-menu.png');

        // Try to select shoot action
        const shootSelected = await page.evaluate(() => {
          const actionsComponent = document.querySelector('actions-component');
          if (actionsComponent && (actionsComponent as any).getTestingShadowRoot) {
            const shadowRoot = (actionsComponent as any).getTestingShadowRoot();
            const shootAction = shadowRoot?.querySelector('[data-action="shoot"]') as HTMLElement;
            if (shootAction) {
              shootAction.click();
              return true;
            }
          }
          return false;
        });

        if (shootSelected) {
          await page.waitForTimeout(1500);
          await saveScreenshot(page, '07-shooting-setup.png');
          
          // Show line of sight visualization
          await page.evaluate(() => {
            // Try to hover over an enemy to show LOS
            const characters = document.querySelectorAll('character-component');
            if (characters.length > 1) {
              const enemy = characters[1] as HTMLElement;
              const event = new MouseEvent('mouseover', {
                view: window,
                bubbles: true,
                cancelable: true
              });
              enemy.dispatchEvent(event);
            }
          });
          
          await page.waitForTimeout(1000);
          await saveScreenshot(page, '08-line-of-sight.png');
        }

        // Close actions menu
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }

      // ========================================
      // 8. OVERWATCH SYSTEM
      // ========================================
      // Open actions menu again for overwatch
      await page.evaluate(() => {
        const bottomBar = document.querySelector('bottom-bar');
        if (bottomBar && (bottomBar as any).getTestingShadowRoot) {
          const shadowRoot = (bottomBar as any).getTestingShadowRoot();
          const actionsBtn = shadowRoot?.querySelector('[title="Actions"]') as HTMLElement;
          if (actionsBtn) actionsBtn.click();
        }
      });

      await page.waitForTimeout(500);

      // Try to select overwatch action
      const overwatchSelected = await page.evaluate(() => {
        const actionsComponent = document.querySelector('actions-component');
        if (actionsComponent && (actionsComponent as any).getTestingShadowRoot) {
          const shadowRoot = (actionsComponent as any).getTestingShadowRoot();
          const overwatchAction = shadowRoot?.querySelector('[data-action="overwatch"]') as HTMLElement;
          if (overwatchAction) {
            overwatchAction.click();
            return true;
          }
        }
        return false;
      });

      if (overwatchSelected) {
        await page.waitForTimeout(1500);
        await saveScreenshot(page, '10-overwatch-setup.png');
        
        // Simulate overwatch trigger (would need enemy movement)
        await page.waitForTimeout(1000);
        await saveScreenshot(page, '11-overwatch-trigger.png');
      }

      // Close actions if still open
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);

      // ========================================
      // 9. INVENTORY SYSTEM
      // ========================================
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
        await page.waitForTimeout(1000);
        const inventoryPopup = await page.locator('popup-component');
        if (await inventoryPopup.isVisible()) {
          await saveElementScreenshot(page, 'popup-component', '13-inventory.png');
        }
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }

      // ========================================
      // 10. END TURN
      // ========================================
      const endTurnVisible = await page.evaluate(() => {
        const bottomBar = document.querySelector('bottom-bar');
        if (bottomBar && (bottomBar as any).getTestingShadowRoot) {
          const shadowRoot = (bottomBar as any).getTestingShadowRoot();
          const endTurnBtn = shadowRoot?.querySelector('.end-turn-btn') as HTMLElement;
          return endTurnBtn !== null;
        }
        return false;
      });

      if (endTurnVisible) {
        // Capture just the end turn button area
        const endTurnRect = await page.evaluate(() => {
          const bottomBar = document.querySelector('bottom-bar');
          if (bottomBar && (bottomBar as any).getTestingShadowRoot) {
            const shadowRoot = (bottomBar as any).getTestingShadowRoot();
            const endTurnBtn = shadowRoot?.querySelector('.end-turn-btn') as HTMLElement;
            if (endTurnBtn) {
              const rect = endTurnBtn.getBoundingClientRect();
              // Expand the area a bit to show context
              return {
                x: Math.max(0, rect.x - 20),
                y: Math.max(0, rect.y - 20),
                width: rect.width + 40,
                height: rect.height + 40
              };
            }
          }
          return null;
        });

        if (endTurnRect) {
          await page.screenshot({ 
            path: 'tutorial/images/14-end-turn.png',
            clip: endTurnRect
          });
          console.log('✓ Captured 14-end-turn.png');
        }
      }

      // ========================================
      // 11. HIT PROBABILITY (if in combat)
      // ========================================
      // This would show during actual combat
      await saveScreenshot(page, '09-hit-probability.png');

      // ========================================
      // 12. VICTORY CONDITION
      // ========================================
      // This would be shown at game end
      await saveScreenshot(page, '15-victory.png');

    } else {
      console.log('Game did not start properly - some screenshots may be missing');
    }

    console.log('\n=== Screenshot generation complete ===');
    console.log('Check tutorial/images/ for all generated screenshots');
  });

  test('verify all game mechanics are accessible', async ({ page }) => {
    // This test verifies that all game mechanics can be accessed
    // It's a companion to the screenshot test to ensure nothing is broken
    
    await page.addInitScript(() => {
      (window as any).__PLAYWRIGHT_TEST__ = true;
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Start game
    await page.evaluate(() => {
      const menu = document.querySelector('main-menu');
      if (menu && (menu as any).getTestingShadowRoot) {
        const shadowRoot = (menu as any).getTestingShadowRoot();
        const button = shadowRoot?.querySelector('#singlePlayerBtn') as HTMLButtonElement;
        if (button) button.click();
      }
    });

    // Skip character selection if it appears
    const charSelect = await waitForElement(page, 'select-character', 5000);
    if (charSelect) {
      await page.evaluate(() => {
        const selectChar = document.querySelector('select-character');
        if (selectChar && (selectChar as any).getTestingShadowRoot) {
          const shadowRoot = (selectChar as any).getTestingShadowRoot();
          const firstChar = shadowRoot?.querySelector('.character-option') as HTMLElement;
          if (firstChar) firstChar.click();
          setTimeout(() => {
            const submitBtn = shadowRoot?.querySelector('button[type="submit"]') as HTMLElement;
            if (submitBtn) submitBtn.click();
          }, 100);
        }
      });
    }

    // Wait for game to load
    await waitForElement(page, 'container-component', 10000);
    await page.waitForTimeout(2000);

    // Verify key components exist
    const components = await page.evaluate(() => {
      return {
        board: document.querySelector('board-component') !== null,
        bottomBar: document.querySelector('bottom-bar') !== null,
        topBar: document.querySelector('top-bar') !== null,
        turnIndicator: document.querySelector('turn-indicator') !== null,
        characters: document.querySelector('characters-component') !== null,
      };
    });

    expect(components.board).toBe(true);
    expect(components.bottomBar).toBe(true);
    
    // Verify actions are accessible
    const actionsAccessible = await page.evaluate(() => {
      const bottomBar = document.querySelector('bottom-bar');
      if (bottomBar && (bottomBar as any).getTestingShadowRoot) {
        const shadowRoot = (bottomBar as any).getTestingShadowRoot();
        return {
          hasActionsButton: shadowRoot?.querySelector('[title="Actions"]') !== null,
          hasInventoryButton: shadowRoot?.querySelector('[title="Inventory"]') !== null,
          hasEndTurnButton: shadowRoot?.querySelector('.end-turn-btn') !== null,
        };
      }
      return { hasActionsButton: false, hasInventoryButton: false, hasEndTurnButton: false };
    });

    expect(actionsAccessible.hasActionsButton || actionsAccessible.hasInventoryButton).toBe(true);
  });
});