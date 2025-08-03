import { test, expect } from '@playwright/test';

test.describe('Tutorial Screenshots - Simple', () => {
  test.setTimeout(60000); // 1 minute timeout
  
  test('generate simple tutorial screenshots', async ({ page }) => {
    // Set test mode flag
    await page.addInitScript(() => {
      (window as any).__PLAYWRIGHT_TEST__ = true;
    });

    // 1. Game start screen
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    await page.screenshot({ 
      path: 'tutorial-01-start-screen.png',
      fullPage: true 
    });

    // 2. Click multiplayer to show popup
    try {
      await page.evaluate(() => {
        const menu = document.querySelector('main-menu');
        if (menu && (menu as any).getTestingShadowRoot) {
          const shadowRoot = (menu as any).getTestingShadowRoot();
          const button = shadowRoot?.querySelector('#multiplayerBtn') as HTMLButtonElement;
          if (button) button.click();
        }
      });
      
      await page.waitForTimeout(1000);
      await page.screenshot({ 
        path: 'tutorial-02-multiplayer-popup.png',
        fullPage: true 
      });
      
      // Close popup
      await page.keyboard.press('Escape');
    } catch (e) {
      console.log('Could not capture multiplayer popup:', e);
    }

    // 3. Character creator
    try {
      await page.evaluate(() => {
        const menu = document.querySelector('main-menu');
        if (menu && (menu as any).getTestingShadowRoot) {
          const shadowRoot = (menu as any).getTestingShadowRoot();
          const button = shadowRoot?.querySelector('#characterCreatorBtn') as HTMLButtonElement;
          if (button) button.click();
        }
      });
      
      await page.waitForTimeout(1000);
      await page.screenshot({ 
        path: 'tutorial-03-character-creator.png',
        fullPage: true 
      });
    } catch (e) {
      console.log('Could not capture character creator:', e);
    }

    // 4. Try single player with mock data for demo
    try {
      // Go back to main menu
      await page.goto('/');
      await page.waitForTimeout(2000);
      
      // Create mock game state for demo
      await page.evaluate(() => {
        // Inject some demo UI elements
        const demoActionPoints = document.createElement('div');
        demoActionPoints.id = 'demo-action-points';
        demoActionPoints.style.cssText = `
          position: fixed;
          bottom: 20px;
          left: 20px;
          background: rgba(0,0,0,0.8);
          color: white;
          padding: 15px;
          border-radius: 8px;
          font-family: monospace;
          font-size: 14px;
          z-index: 1000;
        `;
        demoActionPoints.innerHTML = `
          <div style="margin-bottom: 10px; font-weight: bold;">Action Points</div>
          <div style="color: #4ade80;">Available: 100 / 100</div>
          <div style="margin-top: 5px; opacity: 0.8;">
            • Move: 10-20 AP<br>
            • Shoot: 25 AP<br>
            • Aim: 10 AP
          </div>
        `;
        document.body.appendChild(demoActionPoints);
        
        // Add demo end turn button
        const demoEndTurn = document.createElement('button');
        demoEndTurn.id = 'demo-end-turn';
        demoEndTurn.style.cssText = `
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: #dc2626;
          color: white;
          padding: 12px 24px;
          border: none;
          border-radius: 6px;
          font-weight: bold;
          font-size: 16px;
          cursor: pointer;
          z-index: 1000;
        `;
        demoEndTurn.textContent = 'End Turn';
        document.body.appendChild(demoEndTurn);
        
        // Add demo inventory button
        const demoInventory = document.createElement('button');
        demoInventory.id = 'demo-inventory';
        demoInventory.style.cssText = `
          position: fixed;
          bottom: 80px;
          right: 20px;
          background: #3b82f6;
          color: white;
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          font-weight: bold;
          cursor: pointer;
          z-index: 1000;
        `;
        demoInventory.textContent = '🎒 Inventory';
        document.body.appendChild(demoInventory);
        
        // Add demo settings button  
        const demoSettings = document.createElement('button');
        demoSettings.id = 'demo-settings';
        demoSettings.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: #6b7280;
          color: white;
          padding: 10px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          z-index: 1000;
        `;
        demoSettings.textContent = '⚙️';
        document.body.appendChild(demoSettings);
      });
      
      await page.waitForTimeout(500);
      
      // Screenshot action points
      const actionPoints = await page.locator('#demo-action-points');
      await actionPoints.screenshot({ 
        path: 'tutorial-04-action-points.png' 
      });
      
      // Screenshot end turn button
      const endTurn = await page.locator('#demo-end-turn');
      await endTurn.screenshot({ 
        path: 'tutorial-09-end-turn.png' 
      });
      
      // Create demo inventory popup
      await page.evaluate(() => {
        const popup = document.createElement('div');
        popup.id = 'demo-inventory-popup';
        popup.style.cssText = `
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(20,20,20,0.95);
          color: white;
          padding: 30px;
          border-radius: 12px;
          box-shadow: 0 0 30px rgba(0,0,0,0.8);
          z-index: 2000;
          min-width: 400px;
        `;
        popup.innerHTML = `
          <h2 style="margin: 0 0 20px 0;">Inventory</h2>
          <div style="display: grid; gap: 10px;">
            <div style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 4px;">
              🔫 Assault Rifle (Weight: 3.5kg)
            </div>
            <div style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 4px;">
              🩹 Medkit x3 (Weight: 0.5kg)
            </div>
            <div style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 4px;">
              💣 Grenade x2 (Weight: 1.0kg)
            </div>
          </div>
          <div style="margin-top: 20px; opacity: 0.7;">
            Total Weight: 5.0kg / 20.0kg
          </div>
        `;
        document.body.appendChild(popup);
      });
      
      await page.waitForTimeout(500);
      const inventory = await page.locator('#demo-inventory-popup');
      await inventory.screenshot({ 
        path: 'tutorial-07-inventory.png' 
      });
      
      // Create demo settings popup
      await page.evaluate(() => {
        // Remove inventory popup
        const inv = document.getElementById('demo-inventory-popup');
        if (inv) inv.remove();
        
        const popup = document.createElement('div');
        popup.id = 'demo-settings-popup';
        popup.style.cssText = `
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: rgba(20,20,20,0.95);
          color: white;
          padding: 30px;
          border-radius: 12px;
          box-shadow: 0 0 30px rgba(0,0,0,0.8);
          z-index: 2000;
          min-width: 350px;
        `;
        popup.innerHTML = `
          <h2 style="margin: 0 0 20px 0;">Settings</h2>
          <div style="display: grid; gap: 15px;">
            <label style="display: flex; justify-content: space-between; align-items: center;">
              <span>Difficulty</span>
              <select style="background: #333; color: white; padding: 5px; border: 1px solid #555; border-radius: 4px;">
                <option>Normal</option>
                <option>Hard</option>
              </select>
            </label>
            <label style="display: flex; justify-content: space-between; align-items: center;">
              <span>Sound Effects</span>
              <input type="checkbox" checked style="width: 20px; height: 20px;">
            </label>
            <label style="display: flex; justify-content: space-between; align-items: center;">
              <span>Music</span>
              <input type="checkbox" checked style="width: 20px; height: 20px;">
            </label>
          </div>
        `;
        document.body.appendChild(popup);
      });
      
      await page.waitForTimeout(500);
      const settings = await page.locator('#demo-settings-popup');
      await settings.screenshot({ 
        path: 'tutorial-10-settings.png' 
      });
      
    } catch (e) {
      console.log('Could not create demo screenshots:', e);
    }
  });
});