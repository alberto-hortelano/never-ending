import { test } from '@playwright/test';

test('check door rendering', async ({ page }) => {
  // Set a longer timeout
  test.setTimeout(60000);
  
  // Navigate to the game
  await page.goto('http://localhost:3000');
  
  // Wait for page to load
  await page.waitForTimeout(2000);
  
  // Take screenshot of main menu
  await page.screenshot({ 
    path: 'e2e/screenshots/door-test-1-menu.png',
    fullPage: false 
  });
  
  // Click Single Player button
  await page.click('button:has-text("SINGLE PLAYER")');
  
  // Wait for board to appear
  await page.waitForSelector('board-component', { timeout: 15000 });
  
  // Wait for cells and doors to render
  await page.waitForTimeout(3000);
  
  // Take screenshot of game board
  await page.screenshot({ 
    path: 'e2e/screenshots/door-test-2-board.png',
    fullPage: false 
  });
  
  // Check for door components
  const doorCount = await page.locator('door-component').count();
  console.log(`Found ${doorCount} door components`);
  
  // Check for cells
  const cellCount = await page.locator('cell-component').count();
  console.log(`Found ${cellCount} cell components`);
  
  // Get door details
  const doors = await page.evaluate(() => {
    const doorElements = document.querySelectorAll('door-component');
    return Array.from(doorElements).map(door => ({
      id: door.getAttribute('door-id'),
      type: door.getAttribute('door-type'),
      side: door.getAttribute('door-side'),
      isOpen: door.getAttribute('is-open'),
      isLocked: door.getAttribute('is-locked'),
      hasStyle: door.shadowRoot ? 'yes' : 'no'
    }));
  });
  
  console.log('Door details:', JSON.stringify(doors, null, 2));
});