import { test } from '@playwright/test';

test('capture door rendering', async ({ page }) => {
  // Navigate to the game
  await page.goto('http://localhost:3000');
  
  // Click Single Player button to start game
  const singlePlayerButton = page.locator('button:has-text("SINGLE PLAYER")');
  await singlePlayerButton.click();
  
  // Wait for the board to be visible
  await page.waitForSelector('board-component', { timeout: 10000 });
  
  // Wait a bit for doors to render
  await page.waitForTimeout(2000);
  
  // Take screenshot
  await page.screenshot({ 
    path: 'e2e/screenshots/door-rendering-test.png',
    fullPage: true 
  });
  
  // Also check if door components exist in DOM
  const doorCount = await page.locator('door-component').count();
  console.log(`Found ${doorCount} door components in DOM`);
  
  // Check for door CSS classes
  const doorsWithClasses = await page.evaluate(() => {
    const doors = document.querySelectorAll('door-component');
    return Array.from(doors).map(door => ({
      id: door.getAttribute('door-id'),
      type: door.getAttribute('door-type'),
      side: door.getAttribute('door-side'),
      classes: door.className
    }));
  });
  
  console.log('Door elements:', JSON.stringify(doorsWithClasses, null, 2));
});