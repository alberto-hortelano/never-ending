import { test, expect } from '@playwright/test';

test.describe('Tutorial Missing Screenshots', () => {
  test.setTimeout(60000);
  
  test('generate missing tutorial screenshots', async ({ page }) => {
    // Set test mode flag
    await page.addInitScript(() => {
      (window as any).__PLAYWRIGHT_TEST__ = true;
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Create mock character selection screen
    await page.evaluate(() => {
      const mockCharSelect = document.createElement('div');
      mockCharSelect.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 3000;
      `;
      mockCharSelect.innerHTML = `
        <h1 style="color: white; font-size: 2.5em; margin-bottom: 30px;">Select Your Character</h1>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px;">
          <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 8px; border: 2px solid transparent; cursor: pointer; transition: all 0.3s;">
            <div style="font-size: 3em; text-align: center;">🦸</div>
            <h3 style="color: white; text-align: center; margin: 10px 0;">Warrior</h3>
            <div style="color: #888; font-size: 0.9em;">
              Health: 120<br>
              Move: Fast<br>
              Specialty: Melee
            </div>
          </div>
          <div style="background: rgba(255,255,255,0.2); padding: 20px; border-radius: 8px; border: 2px solid #3b82f6; cursor: pointer;">
            <div style="font-size: 3em; text-align: center;">🎯</div>
            <h3 style="color: white; text-align: center; margin: 10px 0;">Sniper</h3>
            <div style="color: #888; font-size: 0.9em;">
              Health: 80<br>
              Move: Medium<br>
              Specialty: Range
            </div>
          </div>
          <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 8px; border: 2px solid transparent; cursor: pointer;">
            <div style="font-size: 3em; text-align: center;">🏃</div>
            <h3 style="color: white; text-align: center; margin: 10px 0;">Scout</h3>
            <div style="color: #888; font-size: 0.9em;">
              Health: 100<br>
              Move: Very Fast<br>
              Specialty: Recon
            </div>
          </div>
        </div>
        <button style="background: #3b82f6; color: white; padding: 12px 40px; border: none; border-radius: 6px; font-size: 1.2em; cursor: pointer;">
          Confirm Selection
        </button>
      `;
      document.body.appendChild(mockCharSelect);
    });

    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: 'tutorial-02-character-selection.png',
      fullPage: true 
    });

    // Create mock game interface
    await page.evaluate(() => {
      document.body.innerHTML = '';
      
      // Create game board background
      const board = document.createElement('div');
      board.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: #0f0f0f;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      
      // Create hexagonal grid pattern
      const grid = document.createElement('div');
      grid.style.cssText = `
        display: grid;
        grid-template-columns: repeat(10, 60px);
        grid-template-rows: repeat(8, 52px);
        gap: 2px;
        transform: rotate(-1deg);
      `;
      
      for (let i = 0; i < 80; i++) {
        const hex = document.createElement('div');
        hex.style.cssText = `
          width: 60px;
          height: 52px;
          background: #1a1a1a;
          clip-path: polygon(30% 0%, 70% 0%, 100% 50%, 70% 100%, 30% 100%, 0% 50%);
          border: 1px solid #333;
        `;
        if (i === 35) {
          hex.style.background = '#3b82f6';
          hex.innerHTML = '<div style="text-align: center; line-height: 52px;">🦸</div>';
        }
        if (i === 42) {
          hex.style.background = '#dc2626';
          hex.innerHTML = '<div style="text-align: center; line-height: 52px;">👹</div>';
        }
        grid.appendChild(hex);
      }
      board.appendChild(grid);
      document.body.appendChild(board);
      
      // Add UI elements
      const topBar = document.createElement('div');
      topBar.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 60px;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 20px;
        z-index: 100;
      `;
      topBar.innerHTML = `
        <div style="color: white; font-size: 1.2em;">Turn 1</div>
        <div style="color: white;">Never Ending</div>
        <button style="background: none; border: none; color: white; font-size: 1.5em; cursor: pointer;">⚙️</button>
      `;
      document.body.appendChild(topBar);
      
      const bottomBar = document.createElement('div');
      bottomBar.style.cssText = `
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: 80px;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 20px;
        z-index: 100;
      `;
      bottomBar.innerHTML = `
        <div style="display: flex; gap: 10px;">
          <button style="background: #3b82f6; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer;">Move</button>
          <button style="background: #3b82f6; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer;">Shoot</button>
          <button style="background: #3b82f6; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer;">Actions</button>
          <button style="background: #3b82f6; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer;">Inventory</button>
        </div>
        <button style="background: #dc2626; color: white; padding: 10px 24px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">End Turn</button>
      `;
      document.body.appendChild(bottomBar);
      
      // Add action points display
      const ap = document.createElement('div');
      ap.style.cssText = `
        position: fixed;
        bottom: 100px;
        left: 20px;
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 15px;
        border-radius: 8px;
        z-index: 100;
      `;
      ap.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 5px;">Action Points</div>
        <div style="color: #4ade80;">100 / 100</div>
      `;
      document.body.appendChild(ap);
    });

    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: 'tutorial-03-game-interface.png',
      fullPage: true 
    });

    // Create movement highlight
    await page.evaluate(() => {
      // Highlight some hexagons for movement
      const grid = document.querySelector('div');
      if (grid && grid.children.length > 0) {
        const hexes = Array.from(grid.children) as HTMLElement[];
        [34, 36, 25, 26, 44, 45].forEach(i => {
          if (hexes[i]) {
            hexes[i].style.background = 'rgba(59, 130, 246, 0.5)';
            hexes[i].style.border = '2px solid #3b82f6';
          }
        });
      }
    });

    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: 'tutorial-05-movement-highlight.png',
      fullPage: true 
    });
  });
});