import { test, expect } from '@playwright/test';

test.describe('Load Game from Main Menu', () => {
  const TEST_SAVE_SLOT = 'menu_load_test';
  
  // Clean up before and after tests
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    // Clean up any existing test save
    await page.evaluate((slotName) => {
      if (window.deleteSave) {
        (window as any).deleteSave(slotName);
      }
    }, TEST_SAVE_SLOT);
  });

  test.afterEach(async ({ page }) => {
    // Clean up test save
    await page.evaluate((slotName) => {
      if (window.deleteSave) {
        (window as any).deleteSave(slotName);
      }
    }, TEST_SAVE_SLOT);
  });

  test('should load a saved game from main menu', async ({ page }) => {
    // Step 1: Start a game and create a save
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    // Start single player game
    await page.evaluate(() => {
      const eventBus = new (window as any).EventBus();
      eventBus.dispatch('startSinglePlayer', {});
    });
    
    await page.waitForTimeout(2000);
    
    // Handle origin selection if it appears
    const originSelection = await page.locator('origin-selection').isVisible();
    if (originSelection) {
      // Select the first origin
      await page.evaluate(() => {
        const origins = document.querySelector('origin-selection');
        if (origins && (origins as any).getTestingShadowRoot) {
          const shadowRoot = (origins as any).getTestingShadowRoot();
          const firstOrigin = shadowRoot?.querySelector('.origin-card') as HTMLElement;
          if (firstOrigin) firstOrigin.click();
        }
      });
      await page.waitForTimeout(3000);
    }
    
    // Wait for game to start
    const gameStarted = await page.waitForFunction(
      () => {
        const container = document.querySelector('container-component');
        return container && container.getAttribute('style')?.includes('display: block');
      },
      { timeout: 10000 }
    ).catch(() => false);
    
    if (!gameStarted) {
      console.log('Game did not start automatically, trying to start manually');
      // Try to start game manually
      await page.evaluate(() => {
        (window as any).playWithState();
      });
      await page.waitForTimeout(2000);
    }
    
    // Get initial game state info
    const initialState = await page.evaluate(() => {
      const state = (window as any).getCurrentGameState();
      if (!state) return null;
      
      return {
        turn: state.game?.turn,
        turnNumber: state.game?.turnNumber || 1,
        players: state.game?.players,
        characterCount: state.characters?.length || 0,
        mapSize: {
          width: state.map?.width,
          height: state.map?.height
        }
      };
    });
    
    expect(initialState).not.toBeNull();
    console.log('Initial state captured:', initialState);
    
    // Save the game
    await page.evaluate((slotName) => {
      (window as any).saveGame(slotName);
    }, TEST_SAVE_SLOT);
    
    await page.waitForTimeout(1000);
    
    // Verify save was created
    const saves = await page.evaluate(async () => {
      return await (window as any).listSaves();
    });
    
    const testSave = saves.find((s: any) => s.slotName === TEST_SAVE_SLOT);
    expect(testSave).toBeDefined();
    
    // Step 2: Return to main menu
    await page.reload();
    await page.waitForTimeout(2000);
    
    // Verify we're at the main menu
    const mainMenu = await page.locator('main-menu').isVisible();
    expect(mainMenu).toBe(true);
    
    // Verify the game container is hidden
    const containerHidden = await page.evaluate(() => {
      const container = document.querySelector('container-component');
      return !container || container.getAttribute('style')?.includes('display: none');
    });
    expect(containerHidden).toBe(true);
    
    // Step 3: Load the saved game from main menu
    console.log('Loading saved game from main menu...');
    
    const loadResult = await page.evaluate(async (slotName) => {
      try {
        // Use the helper function to load and start the game
        const result = await (window as any).loadAndPlayGame(slotName);
        return { success: true, result };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }, TEST_SAVE_SLOT);
    
    expect(loadResult.success).toBe(true);
    console.log('Load result:', loadResult);
    
    await page.waitForTimeout(2000);
    
    // Step 4: Verify the game started with the loaded state
    
    // Check that main menu is hidden
    const menuHidden = await page.evaluate(() => {
      const menu = document.querySelector('main-menu') as HTMLElement;
      return !menu || menu.style.display === 'none' || !menu.offsetParent;
    });
    expect(menuHidden).toBe(true);
    
    // Check that game container is visible
    const containerVisible = await page.evaluate(() => {
      const container = document.querySelector('container-component');
      return container && container.getAttribute('style')?.includes('display: block');
    });
    expect(containerVisible).toBe(true);
    
    // Get the loaded state
    const loadedState = await page.evaluate(() => {
      const state = (window as any).getCurrentGameState();
      if (!state) return null;
      
      return {
        turn: state.game?.turn,
        turnNumber: state.game?.turnNumber || 1,
        players: state.game?.players,
        characterCount: state.characters?.length || 0,
        mapSize: {
          width: state.map?.width,
          height: state.map?.height
        }
      };
    });
    
    expect(loadedState).not.toBeNull();
    console.log('Loaded state:', loadedState);
    
    // Verify the loaded state matches the saved state
    if (initialState && loadedState) {
      expect(loadedState.turn).toBe(initialState.turn);
      expect(loadedState.turnNumber).toBe(initialState.turnNumber);
      expect(loadedState.players).toEqual(initialState.players);
      expect(loadedState.characterCount).toBe(initialState.characterCount);
      expect(loadedState.mapSize).toEqual(initialState.mapSize);
    }
    
    // Verify game elements are rendered
    const board = await page.locator('game-board').isVisible();
    expect(board).toBe(true);
    
    const topBar = await page.locator('top-bar').isVisible();
    expect(topBar).toBe(true);
    
    // Check that characters are rendered if there are any
    if (loadedState?.characterCount > 0) {
      const characters = await page.locator('game-character').count();
      expect(characters).toBeGreaterThan(0);
    }
  });

  test('should handle loading non-existent save from menu', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    // Verify we're at the main menu
    const mainMenu = await page.locator('main-menu').isVisible();
    expect(mainMenu).toBe(true);
    
    // Try to load a non-existent save
    const loadResult = await page.evaluate(async () => {
      try {
        const result = await (window as any).loadAndPlayGame('non_existent_save');
        return { success: true, result };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });
    
    expect(loadResult.success).toBe(false);
    expect(loadResult.error).toContain('not found');
    
    // Verify we're still at the main menu
    const stillAtMenu = await page.locator('main-menu').isVisible();
    expect(stillAtMenu).toBe(true);
    
    // Verify game container is still hidden
    const containerHidden = await page.evaluate(() => {
      const container = document.querySelector('container-component');
      return !container || container.getAttribute('style')?.includes('display: none');
    });
    expect(containerHidden).toBe(true);
  });

  test('should load quicksave from main menu', async ({ page }) => {
    // First create a quicksave
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    // Start a game with a minimal state
    await page.evaluate(() => {
      // Create a minimal game state for testing
      // Create a simple 5x5 map
      const mapSize = 5;
      const map = [];
      for (let y = 0; y < mapSize; y++) {
        const row = [];
        for (let x = 0; x < mapSize; x++) {
          row.push({
            x,
            y,
            type: 'floor',
            visibleCharacterName: null,
            actions: [],
            isWall: false,
            color: '',
            roomNames: []
          });
        }
        map.push(row);
      }
      
      const testState = {
        game: { 
          turn: 'player1', 
          players: ['player1'],
          turnNumber: 1,
          playerInfo: {
            player1: { name: 'Player 1', isAI: false }
          }
        },
        characters: [],
        map: map,
        messages: [],
        ui: {
          animations: { characters: {} },
          visualStates: {
            characters: {},
            cells: {},
            board: {
              mapWidth: mapSize,
              mapHeight: mapSize,
              hasPopupActive: false
            }
          },
          transientUI: {
            popups: {},
            projectiles: [],
            highlights: {
              reachableCells: [],
              pathCells: [],
              targetableCells: []
            }
          },
          interactionMode: { type: 'normal' }
        }
      };
      (window as any).playWithState(testState);
    });
    
    await page.waitForTimeout(2000);
    
    // Create a quicksave
    await page.evaluate(() => {
      (window as any).quickSave();
    });
    await page.waitForTimeout(1000);
    
    // Verify quicksave exists
    const saves = await page.evaluate(async () => {
      return await (window as any).listSaves();
    });
    
    const quicksave = saves.find((s: any) => s.slotName === 'quicksave');
    expect(quicksave).toBeDefined();
    
    // Return to main menu
    await page.reload();
    await page.waitForTimeout(3000); // Give more time for initialization
    
    // Ensure window functions are available
    const functionsAvailable = await page.evaluate(() => {
      return typeof (window as any).loadAndPlayGame === 'function';
    });
    expect(functionsAvailable).toBe(true);
    
    // Load the quicksave
    const loadResult = await page.evaluate(async () => {
      try {
        const result = await (window as any).loadAndPlayGame('quicksave');
        return { success: true, result };
      } catch (error) {
        console.error('Load error:', error);
        return { success: false, error: (error as Error).message || String(error) };
      }
    });
    
    console.log('Load result:', loadResult);
    if (!loadResult.success) {
      console.error('Load failed with error:', loadResult.error);
    }
    expect(loadResult.success).toBe(true);
    
    // Verify game started
    const containerVisible = await page.evaluate(() => {
      const container = document.querySelector('container-component');
      return container && container.getAttribute('style')?.includes('display: block');
    });
    expect(containerVisible).toBe(true);
    
    // Clean up quicksave
    await page.evaluate(() => {
      (window as any).deleteSave('quicksave');
    });
  });
});