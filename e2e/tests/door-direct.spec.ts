import { test } from '@playwright/test';

test('check doors in game', async ({ page }) => {
  test.setTimeout(30000);
  
  // Navigate to the game
  await page.goto('http://localhost:3000');
  
  // Wait for main menu to load
  await page.waitForSelector('main-menu', { timeout: 5000 });
  await page.waitForTimeout(1000);
  
  // Directly dispatch the startSinglePlayer event to bypass menu
  await page.evaluate(() => {
    const event = new CustomEvent('startSinglePlayer', { bubbles: true });
    document.dispatchEvent(event);
  });
  
  // Wait for board to appear
  await page.waitForSelector('board-component', { timeout: 10000 });
  await page.waitForTimeout(2000);
  
  // Take screenshot
  await page.screenshot({ 
    path: 'e2e/screenshots/door-game-board.png',
    fullPage: false 
  });
  
  // Check for door components
  const doorInfo = await page.evaluate(() => {
    const doors = document.querySelectorAll('door-component');
    const cells = document.querySelectorAll('cell-component');
    
    return {
      doorCount: doors.length,
      cellCount: cells.length,
      doors: Array.from(doors).slice(0, 5).map(door => ({
        id: door.getAttribute('door-id'),
        type: door.getAttribute('door-type'),
        side: door.getAttribute('door-side'),
        parent: door.parentElement?.tagName
      }))
    };
  });
  
  console.log('Game info:', JSON.stringify(doorInfo, null, 2));
});