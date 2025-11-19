import { chromium, Browser, Page } from '@playwright/test';

/**
 * Interactive Playwright test script for manual game exploration
 * This bypasses the MCP and lets us control the browser directly
 */

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runInteractiveTest() {
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    console.log('🚀 Launching Chromium browser...');
    browser = await chromium.launch({
      headless: false, // Run in headed mode so we can see it
      args: ['--disable-gpu', '--no-sandbox', '--disable-setuid-sandbox'],
      slowMo: 500 // Slow down actions so we can see them
    });

    console.log('📄 Creating new page...');
    page = await browser.newPage();

    // Set viewport
    await page.setViewportSize({ width: 1920, height: 1080 });

    console.log('🌐 Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

    console.log('📸 Taking initial screenshot...');
    await page.screenshot({ path: 'test-results/01-main-menu.png', fullPage: true });

    // Check console messages
    page.on('console', msg => {
      const type = msg.type();
      if (type === 'error' || type === 'warning') {
        console.log(`Browser ${type}: ${msg.text()}`);
      }
    });

    console.log('✅ Page loaded successfully!');
    console.log('📊 Page title:', await page.title());

    // Wait a bit to let everything initialize
    await sleep(2000);

    console.log('\n🎮 PHASE 1: Main Menu Exploration');
    console.log('=====================================');

    // Get accessibility snapshot
    const snapshot = await page.accessibility.snapshot();
    console.log('Accessibility tree:', JSON.stringify(snapshot, null, 2));

    // Check for main menu
    const mainMenu = await page.locator('main-menu').first();
    if (await mainMenu.isVisible()) {
      console.log('✅ Main menu is visible');

      // Try to access shadow DOM using the testing hook
      const shadowContent = await page.evaluate(() => {
        const menu = document.querySelector('main-menu');
        if (!menu) return null;

        // Use the testing hook
        const shadowRoot = (menu as any).getTestingShadowRoot?.();
        if (!shadowRoot) return null;

        // Get button information
        const buttons = Array.from(shadowRoot.querySelectorAll('button'));
        return buttons.map(btn => ({
          text: btn.textContent?.trim(),
          id: btn.id,
          class: btn.className
        }));
      });

      console.log('Main menu buttons:', shadowContent);

      // Take screenshot of main menu
      await page.screenshot({ path: 'test-results/02-main-menu-detail.png' });

      // Try clicking Single Player button
      console.log('\n🎯 Attempting to click Single Player button...');
      const clicked = await page.evaluate(() => {
        const menu = document.querySelector('main-menu');
        if (!menu) return false;

        const shadowRoot = (menu as any).getTestingShadowRoot?.();
        if (!shadowRoot) return false;

        const singlePlayerBtn = shadowRoot.querySelector('#single-player-btn');
        if (singlePlayerBtn) {
          (singlePlayerBtn as HTMLElement).click();
          return true;
        }
        return false;
      });

      if (clicked) {
        console.log('✅ Single player button clicked!');
        await sleep(2000);
        await page.screenshot({ path: 'test-results/03-after-single-player-click.png', fullPage: true });
      } else {
        console.log('❌ Could not click single player button');
      }
    }

    console.log('\n⏸️  Browser will stay open for 30 seconds for manual inspection...');
    console.log('Check the browser window to see the game state!');
    await sleep(30000);

  } catch (error) {
    console.error('❌ Test failed:', error);
    if (page) {
      await page.screenshot({ path: 'test-results/error-screenshot.png' });
    }
  } finally {
    console.log('\n🧹 Cleaning up...');
    if (browser) {
      await browser.close();
    }
    console.log('✅ Test completed!');
  }
}

// Run the test
runInteractiveTest().catch(console.error);
