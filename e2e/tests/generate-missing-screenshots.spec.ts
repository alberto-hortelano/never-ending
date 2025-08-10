import { test, Page } from '@playwright/test';

test.describe('Generate Missing Tutorial Screenshots', () => {
  test.setTimeout(60000);
  
  // Helper to save screenshot with consistent naming
  const saveScreenshot = async (page: Page, filename: string) => {
    await page.screenshot({ 
      path: `tutorial/images/${filename}`,
      fullPage: true 
    });
    console.log(`✓ Generated ${filename}`);
  };

  test('generate character selection and movement screenshots', async ({ page }) => {
    // Set test mode flag
    await page.addInitScript(() => {
      (window as any).__PLAYWRIGHT_TEST__ = true;
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Start game
    await page.evaluate(() => {
      const menu = document.querySelector('main-menu');
      if (menu && (menu as any).getTestingShadowRoot) {
        const shadowRoot = (menu as any).getTestingShadowRoot();
        const button = shadowRoot?.querySelector('#singlePlayerBtn') as HTMLButtonElement;
        if (button) button.click();
      }
    });

    // Wait for game to load
    await page.waitForTimeout(3000);
    
    // Generate character selection mockup (since it doesn't appear in single player)
    await page.evaluate(() => {
      // Create a mock character selection overlay
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      `;
      
      const popup = document.createElement('div');
      popup.style.cssText = `
        background: #2a2a2a;
        border: 2px solid #666;
        border-radius: 8px;
        padding: 30px;
        min-width: 600px;
      `;
      
      popup.innerHTML = `
        <h2 style="color: white; margin-bottom: 20px;">Select Your Character</h2>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
          <div style="background: #333; padding: 20px; border-radius: 8px; cursor: pointer; border: 2px solid #555;">
            <div style="width: 60px; height: 60px; background: #ffd700; border-radius: 50%; margin: 0 auto 10px;"></div>
            <h3 style="color: white; text-align: center; margin: 10px 0;">Soldier</h3>
            <p style="color: #ccc; font-size: 12px; text-align: center;">Balanced fighter with good armor</p>
          </div>
          <div style="background: #444; padding: 20px; border-radius: 8px; cursor: pointer; border: 2px solid #4a9eff;">
            <div style="width: 60px; height: 60px; background: #4a9eff; border-radius: 50%; margin: 0 auto 10px;"></div>
            <h3 style="color: white; text-align: center; margin: 10px 0;">Scout</h3>
            <p style="color: #ccc; font-size: 12px; text-align: center;">Fast movement, light armor</p>
          </div>
          <div style="background: #333; padding: 20px; border-radius: 8px; cursor: pointer; border: 2px solid #555;">
            <div style="width: 60px; height: 60px; background: #ff4444; border-radius: 50%; margin: 0 auto 10px;"></div>
            <h3 style="color: white; text-align: center; margin: 10px 0;">Heavy</h3>
            <p style="color: #ccc; font-size: 12px; text-align: center;">High damage, slow movement</p>
          </div>
        </div>
      `;
      
      overlay.appendChild(popup);
      document.body.appendChild(overlay);
    });
    
    await page.waitForTimeout(500);
    await saveScreenshot(page, '02-character-selection.png');
    
    // Remove the mock overlay
    await page.evaluate(() => {
      const overlay = document.querySelector('div[style*="z-index: 10000"]');
      if (overlay) overlay.remove();
    });
    
    await page.waitForTimeout(500);
    
    // Generate movement highlight screenshot
    await page.evaluate(() => {
      const board = document.querySelector('board-component');
      if (board && (board as any).getTestingShadowRoot) {
        const shadowRoot = (board as any).getTestingShadowRoot();
        // Add highlight classes to some cells
        const cells = shadowRoot?.querySelectorAll('cell-component');
        if (cells && cells.length > 20) {
          // Highlight movement path
          for (let i = 10; i < 15; i++) {
            const cell = cells[i] as HTMLElement;
            cell.style.background = 'rgba(76, 175, 80, 0.4)';
            cell.style.border = '2px solid #4CAF50';
          }
          // Highlight current position
          const currentCell = cells[12] as HTMLElement;
          currentCell.style.background = 'rgba(255, 193, 7, 0.6)';
          currentCell.style.border = '2px solid #FFC107';
        }
      }
    });
    
    await page.waitForTimeout(500);
    await saveScreenshot(page, '05-movement-highlight.png');
    
    // Generate actions menu screenshot with mock menu
    await page.evaluate(() => {
      const bottomBar = document.querySelector('bottom-bar');
      if (bottomBar) {
        const actionsMenu = document.createElement('div');
        actionsMenu.style.cssText = `
          position: absolute;
          bottom: 80px;
          left: 50%;
          transform: translateX(-50%);
          background: #2a2a2a;
          border: 2px solid #666;
          border-radius: 8px;
          padding: 15px;
          z-index: 1000;
          min-width: 250px;
        `;
        
        actionsMenu.innerHTML = `
          <div style="color: white; font-weight: bold; margin-bottom: 10px;">Actions</div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <button style="background: #444; color: white; border: 1px solid #666; padding: 10px; border-radius: 4px; cursor: pointer;">
              🔫 Shoot (25 AP)
            </button>
            <button style="background: #444; color: white; border: 1px solid #666; padding: 10px; border-radius: 4px; cursor: pointer;">
              🎯 Aim (10 AP)
            </button>
            <button style="background: #444; color: white; border: 1px solid #666; padding: 10px; border-radius: 4px; cursor: pointer;">
              🛡️ Overwatch (30 AP)
            </button>
            <button style="background: #444; color: white; border: 1px solid #666; padding: 10px; border-radius: 4px; cursor: pointer;">
              ⚔️ Melee (20 AP)
            </button>
            <button style="background: #444; color: white; border: 1px solid #666; padding: 10px; border-radius: 4px; cursor: pointer;">
              🏃 Sprint (40 AP)
            </button>
          </div>
        `;
        
        document.body.appendChild(actionsMenu);
      }
    });
    
    await page.waitForTimeout(500);
    await saveScreenshot(page, '06-actions-menu.png');
    
    // Remove actions menu
    await page.evaluate(() => {
      const menu = document.querySelector('div[style*="bottom: 80px"]');
      if (menu) menu.remove();
    });
    
    // Generate shooting mode screenshot
    await page.evaluate(() => {
      const board = document.querySelector('board-component');
      if (board && (board as any).getTestingShadowRoot) {
        const shadowRoot = (board as any).getTestingShadowRoot();
        
        // Clear previous highlights
        const cells = shadowRoot?.querySelectorAll('cell-component');
        if (cells) {
          cells.forEach((cell: any) => {
            cell.style.background = '';
            cell.style.border = '';
          });
        }
        
        // Add shooting mode UI
        const shootingOverlay = document.createElement('div');
        shootingOverlay.style.cssText = `
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 1000;
        `;
        
        // Draw a line of sight indicator
        const losLine = document.createElement('div');
        losLine.style.cssText = `
          position: absolute;
          width: 300px;
          height: 2px;
          background: linear-gradient(90deg, #ff4444 0%, transparent 100%);
          transform: rotate(-30deg);
          transform-origin: left center;
          top: 0;
          left: -150px;
        `;
        
        // Add crosshair
        const crosshair = document.createElement('div');
        crosshair.style.cssText = `
          position: absolute;
          width: 40px;
          height: 40px;
          border: 2px solid #ff4444;
          border-radius: 50%;
          top: -20px;
          left: 130px;
        `;
        crosshair.innerHTML = `
          <div style="position: absolute; width: 100%; height: 2px; background: #ff4444; top: 50%; transform: translateY(-50%);"></div>
          <div style="position: absolute; width: 2px; height: 100%; background: #ff4444; left: 50%; transform: translateX(-50%);"></div>
        `;
        
        // Add hit probability indicator
        const hitProb = document.createElement('div');
        hitProb.style.cssText = `
          position: absolute;
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 5px 10px;
          border-radius: 4px;
          border: 1px solid #ff4444;
          top: -60px;
          left: 110px;
          font-size: 14px;
        `;
        hitProb.textContent = 'Hit: 75%';
        
        shootingOverlay.appendChild(losLine);
        shootingOverlay.appendChild(crosshair);
        shootingOverlay.appendChild(hitProb);
        document.body.appendChild(shootingOverlay);
        
        // Highlight target enemy
        const characters = shadowRoot?.querySelectorAll('character-component');
        if (characters && characters.length > 1) {
          const enemy = characters[1] as HTMLElement;
          enemy.style.filter = 'drop-shadow(0 0 10px #ff4444)';
        }
      }
    });
    
    await page.waitForTimeout(500);
    await saveScreenshot(page, '08-shooting-mode.png');
    
    // Clean up shooting mode UI
    await page.evaluate(() => {
      const overlay = document.querySelector('div[style*="position: fixed"][style*="z-index: 1000"]');
      if (overlay) overlay.remove();
      
      const board = document.querySelector('board-component');
      if (board && (board as any).getTestingShadowRoot) {
        const shadowRoot = (board as any).getTestingShadowRoot();
        const characters = shadowRoot?.querySelectorAll('character-component');
        if (characters) {
          characters.forEach((char: any) => {
            char.style.filter = '';
          });
        }
      }
    });
    
    console.log('\n=== Missing screenshots generated successfully ===');
  });
});