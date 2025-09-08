import { test, expect } from '@playwright/test';
import { MainMenuPage } from '../pages/MainMenuPage';
import { GameBoardPage } from '../pages/GameBoardPage';
import { SaveLoadPage } from '../pages/SaveLoadPage';

test.describe('Save/Load Game Persistence', () => {
  test.setTimeout(60000); // 1 minute timeout for the complete flow

  test('should save game, reload page, and restore game state', async ({ page, context }) => {
    // Initialize page objects
    const mainMenu = new MainMenuPage(page);
    const gameBoard = new GameBoardPage(page);
    const saveLoad = new SaveLoadPage(page);

    // ========================================
    // 1. START THE GAME
    // ========================================
    console.log('1. Starting the game...');
    await mainMenu.goto();
    await mainMenu.startSinglePlayer();

    // Wait for game to start
    await gameBoard.waitForGameToStart();
    console.log('   ✓ Game started');

    // ========================================
    // 2. CAPTURE INITIAL GAME STATE
    // ========================================
    console.log('2. Capturing initial game state...');
    
    // Get initial turn
    const initialTurn = await page.evaluate(() => {
      // Try multiple ways to get the turn
      const topBar = document.querySelector('top-bar');
      if (topBar && topBar.shadowRoot) {
        const playerName = topBar.shadowRoot.querySelector('#player-name');
        if (playerName) return playerName.textContent;
      }
      
      // Fallback: check turn indicator
      const turnIndicator = document.querySelector('turn-indicator');
      if (turnIndicator && turnIndicator.shadowRoot) {
        const turnText = turnIndicator.shadowRoot.querySelector('.player-name');
        if (turnText) return turnText.textContent;
      }
      
      return 'unknown';
    });
    console.log(`   Initial turn: ${initialTurn}`);

    // Get character positions
    const initialCharacterData = await page.evaluate(() => {
      const characters = document.querySelectorAll('character-component');
      const data: Array<{ id: string; x: string; y: string }> = [];
      
      characters.forEach((char) => {
        const id = char.getAttribute('id') || 'unknown';
        const x = char.getAttribute('data-x') || '0';
        const y = char.getAttribute('data-y') || '0';
        data.push({ id, x, y });
      });
      
      return data;
    });
    console.log(`   Found ${initialCharacterData.length} characters`);

    // ========================================
    // 3. MAKE A MOVE (OPTIONAL - TO CHANGE GAME STATE)
    // ========================================
    console.log('3. Making a move to change game state...');
    
    // Try to select and move a character
    if (initialCharacterData.length > 0) {
      const firstChar = initialCharacterData[0];
      
      // Click on the first character
      await page.evaluate((charId) => {
        const char = document.querySelector(`character-component[id="${charId}"]`);
        if (char) (char as HTMLElement).click();
      }, firstChar.id);
      
      await page.waitForTimeout(500);
      
      // Try to move to an adjacent cell
      const targetX = parseInt(firstChar.x) + 1;
      const targetY = parseInt(firstChar.y);
      
      await gameBoard.clickCell(targetX, targetY);
      await page.waitForTimeout(1000);
      
      console.log(`   ✓ Attempted to move character ${firstChar.id}`);
    }

    // ========================================
    // 4. SAVE THE GAME
    // ========================================
    console.log('4. Saving the game...');
    
    // Use quicksave (F5)
    await saveLoad.quickSave();
    console.log('   ✓ Quick save completed');
    
    // Also create a named save for verification
    await saveLoad.openMenu();
    await page.waitForTimeout(500);
    
    // Check if quicksave appears in the list
    const savesBeforeReload = await saveLoad.getSavedGames();
    const hasQuicksave = savesBeforeReload.some(s => s.slotName === 'quicksave');
    console.log(`   Quicksave exists: ${hasQuicksave}`);
    
    await saveLoad.closeMenu();

    // ========================================
    // 5. CAPTURE STATE BEFORE RELOAD
    // ========================================
    console.log('5. Capturing state before reload...');
    
    const stateBeforeReload = await page.evaluate(() => {
      const topBar = document.querySelector('top-bar');
      let currentTurn = 'unknown';
      
      if (topBar && topBar.shadowRoot) {
        const playerName = topBar.shadowRoot.querySelector('#player-name');
        if (playerName) currentTurn = playerName.textContent || 'unknown';
      }
      
      const characters = document.querySelectorAll('character-component');
      const charPositions: Array<{ id: string; x: string; y: string }> = [];
      
      characters.forEach((char) => {
        charPositions.push({
          id: char.getAttribute('id') || 'unknown',
          x: char.getAttribute('data-x') || '0',
          y: char.getAttribute('data-y') || '0'
        });
      });
      
      return { currentTurn, charPositions };
    });
    
    console.log(`   Turn before reload: ${stateBeforeReload.currentTurn}`);
    console.log(`   Characters before reload: ${stateBeforeReload.charPositions.length}`);

    // ========================================
    // 6. RELOAD THE PAGE
    // ========================================
    console.log('6. Reloading the page...');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    console.log('   ✓ Page reloaded');

    // ========================================
    // 7. START THE GAME AGAIN
    // ========================================
    console.log('7. Starting the game again...');
    await mainMenu.waitForMenuToLoad();
    await mainMenu.startSinglePlayer();
    await gameBoard.waitForGameToStart();
    console.log('   ✓ Game restarted');

    // ========================================
    // 8. VERIFY SAVES PERSISTED
    // ========================================
    console.log('8. Verifying saves persisted...');
    await saveLoad.openMenu();
    await page.waitForTimeout(500);
    
    const savesAfterReload = await saveLoad.getSavedGames();
    const quicksaveExists = savesAfterReload.some(s => s.slotName === 'quicksave');
    
    expect(quicksaveExists).toBe(true);
    console.log(`   ✓ Quicksave persisted: ${quicksaveExists}`);
    
    // ========================================
    // 9. LOAD THE SAVED GAME
    // ========================================
    console.log('9. Loading the saved game...');
    await saveLoad.closeMenu();
    
    // Use quickload (F9)
    await saveLoad.quickLoad();
    await page.waitForTimeout(2000);
    console.log('   ✓ Quick load completed');

    // ========================================
    // 10. VERIFY GAME STATE RESTORED
    // ========================================
    console.log('10. Verifying game state restored...');
    
    const stateAfterLoad = await page.evaluate(() => {
      const topBar = document.querySelector('top-bar');
      let currentTurn = 'unknown';
      
      if (topBar && topBar.shadowRoot) {
        const playerName = topBar.shadowRoot.querySelector('#player-name');
        if (playerName) currentTurn = playerName.textContent || 'unknown';
      }
      
      const characters = document.querySelectorAll('character-component');
      const charPositions: Array<{ id: string; x: string; y: string }> = [];
      
      characters.forEach((char) => {
        charPositions.push({
          id: char.getAttribute('id') || 'unknown',
          x: char.getAttribute('data-x') || '0',
          y: char.getAttribute('data-y') || '0'
        });
      });
      
      return { currentTurn, charPositions };
    });
    
    console.log(`   Turn after load: ${stateAfterLoad.currentTurn}`);
    console.log(`   Characters after load: ${stateAfterLoad.charPositions.length}`);
    
    // Verify turn is the same
    expect(stateAfterLoad.currentTurn).toBe(stateBeforeReload.currentTurn);
    console.log('   ✓ Turn restored correctly');
    
    // Verify character count is the same
    expect(stateAfterLoad.charPositions.length).toBe(stateBeforeReload.charPositions.length);
    console.log('   ✓ Character count matches');
    
    // Verify character positions (if we moved a character, it should be in the new position)
    if (stateAfterLoad.charPositions.length > 0) {
      for (const charAfter of stateAfterLoad.charPositions) {
        const charBefore = stateBeforeReload.charPositions.find(c => c.id === charAfter.id);
        if (charBefore) {
          expect(charAfter.x).toBe(charBefore.x);
          expect(charAfter.y).toBe(charBefore.y);
        }
      }
      console.log('   ✓ Character positions restored');
    }
    
    console.log('\n✅ Save/Load persistence test completed successfully!');
  });

  test('should handle multiple save slots', async ({ page }) => {
    const mainMenu = new MainMenuPage(page);
    const gameBoard = new GameBoardPage(page);
    const saveLoad = new SaveLoadPage(page);

    // Start game
    await mainMenu.goto();
    await mainMenu.startSinglePlayer();
    await gameBoard.waitForGameToStart();

    // Create multiple saves
    await saveLoad.openMenu();
    
    // Create first save
    await page.evaluate(() => {
      const menu = document.querySelector('save-load-menu');
      if (menu && (menu as any).saveToSlot) {
        (menu as any).saveToSlot('test-save-1');
      }
    });
    await page.waitForTimeout(500);

    // Create second save
    await page.evaluate(() => {
      const menu = document.querySelector('save-load-menu');
      if (menu && (menu as any).saveToSlot) {
        (menu as any).saveToSlot('test-save-2');
      }
    });
    await page.waitForTimeout(500);

    // Verify both saves exist
    const saves = await saveLoad.getSavedGames();
    const hasSave1 = saves.some(s => s.slotName === 'test-save-1');
    const hasSave2 = saves.some(s => s.slotName === 'test-save-2');

    expect(hasSave1).toBe(true);
    expect(hasSave2).toBe(true);

    // Clean up - delete test saves
    await saveLoad.deleteSave('test-save-1');
    await saveLoad.deleteSave('test-save-2');
    
    await saveLoad.closeMenu();
  });

  test.afterEach(async ({ page }) => {
    // Clean up localStorage after each test
    await page.evaluate(() => {
      localStorage.removeItem('neverending_saves');
    });
  });
});