import { test, expect } from '@playwright/test';

test.describe('Language Selector Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForSelector('main-menu', { state: 'visible' });

    // Wait for shadow root to be created
    await page.waitForFunction(
      () => {
        const mainMenu = document.querySelector('main-menu');
        return mainMenu && mainMenu.shadowRoot;
      },
      { timeout: 5000 }
    );
  });

  test('should load without console errors', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.waitForTimeout(2000);

    // Filter out expected errors (if any)
    const unexpectedErrors = errors.filter(err =>
      !err.includes('known-expected-error')
    );

    expect(unexpectedErrors).toHaveLength(0);
  });

  test('should have correct positioning (absolute)', async ({ page }) => {
    const positioning = await page.evaluate(() => {
      const mainMenu = document.querySelector('main-menu');
      if (!mainMenu || !mainMenu.shadowRoot) return null;

      const langContainer = mainMenu.shadowRoot.querySelector('.language-selector-container');
      if (!langContainer) return null;

      const styles = window.getComputedStyle(langContainer);

      return {
        position: styles.position,
        top: styles.top,
        right: styles.right,
        zIndex: styles.zIndex
      };
    });

    expect(positioning).not.toBeNull();
    expect(positioning?.position).toBe('absolute');
    expect(positioning?.zIndex).toBe('2');
  });

  test('should not overlap with dev controls', async ({ page }) => {
    const hasOverlap = await page.evaluate(() => {
      const mainMenu = document.querySelector('main-menu');
      if (!mainMenu || !mainMenu.shadowRoot) return null;

      const langContainer = mainMenu.shadowRoot.querySelector('.language-selector-container');
      const devControls = mainMenu.shadowRoot.querySelector('.dev-controls');

      if (!langContainer) return null;

      const langRect = langContainer.getBoundingClientRect();

      if (devControls) {
        const devRect = devControls.getBoundingClientRect();
        const devVisible = window.getComputedStyle(devControls).display !== 'none';

        if (devVisible) {
          // Check if they overlap
          const overlap = !(langRect.bottom < devRect.top ||
                          langRect.top > devRect.bottom ||
                          langRect.right < devRect.left ||
                          langRect.left > devRect.right);
          return overlap;
        }
      }

      return false;
    });

    expect(hasOverlap).toBe(false);
  });

  test('should switch languages correctly', async ({ page }) => {
    const initialLang = await page.evaluate(() => {
      const mainMenu = document.querySelector('main-menu');
      if (!mainMenu || !mainMenu.shadowRoot) return null;

      const langSwitcher = mainMenu.shadowRoot.querySelector('language-switcher');
      if (!langSwitcher || !langSwitcher.shadowRoot) return null;

      const select = langSwitcher.shadowRoot.querySelector('#language-select') as HTMLSelectElement;
      return select ? select.value : null;
    });

    expect(initialLang).toBeTruthy();

    // Switch language
    await page.evaluate(() => {
      const mainMenu = document.querySelector('main-menu');
      if (!mainMenu || !mainMenu.shadowRoot) return;

      const langSwitcher = mainMenu.shadowRoot.querySelector('language-switcher');
      if (!langSwitcher || !langSwitcher.shadowRoot) return;

      const select = langSwitcher.shadowRoot.querySelector('#language-select') as HTMLSelectElement;
      if (select) {
        select.value = select.value === 'en' ? 'es' : 'en';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    await page.waitForTimeout(500);

    const newLang = await page.evaluate(() => {
      const mainMenu = document.querySelector('main-menu');
      if (!mainMenu || !mainMenu.shadowRoot) return null;

      const langSwitcher = mainMenu.shadowRoot.querySelector('language-switcher');
      if (!langSwitcher || !langSwitcher.shadowRoot) return null;

      const select = langSwitcher.shadowRoot.querySelector('#language-select') as HTMLSelectElement;
      return select ? select.value : null;
    });

    expect(newLang).toBeTruthy();
    expect(newLang).not.toBe(initialLang);
  });

  test('should be visible at multiple viewport sizes', async ({ page }) => {
    const viewports = [
      { name: 'desktop', width: 1920, height: 1080 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'mobile', width: 375, height: 667 }
    ];

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(300);

      const isVisible = await page.evaluate(() => {
        const mainMenu = document.querySelector('main-menu');
        if (!mainMenu || !mainMenu.shadowRoot) return false;

        const langContainer = mainMenu.shadowRoot.querySelector('.language-selector-container');
        if (!langContainer) return false;

        const styles = window.getComputedStyle(langContainer);
        const rect = langContainer.getBoundingClientRect();

        return styles.display !== 'none' &&
               styles.visibility !== 'hidden' &&
               styles.opacity !== '0' &&
               rect.width > 0 &&
               rect.height > 0;
      });

      expect(isVisible).toBe(true);

      // Take screenshot for visual verification
      await page.screenshot({
        path: `test-results/language-selector-${viewport.name}.png`,
        fullPage: false
      });
    }
  });

  test('should have accessible shadow DOM elements', async ({ page }) => {
    const shadowElements = await page.evaluate(() => {
      const mainMenu = document.querySelector('main-menu');
      if (!mainMenu || !mainMenu.shadowRoot) return null;

      const langContainer = mainMenu.shadowRoot.querySelector('.language-selector-container');
      const langSwitcher = langContainer?.querySelector('language-switcher');

      if (!langSwitcher || !langSwitcher.shadowRoot) return null;

      const select = langSwitcher.shadowRoot.querySelector('#language-select');
      const options = select ? Array.from(select.querySelectorAll('option')).map(o => o.value) : [];

      return {
        hasContainer: !!langContainer,
        hasSwitcher: !!langSwitcher,
        hasSelect: !!select,
        languages: options
      };
    });

    expect(shadowElements).not.toBeNull();
    expect(shadowElements?.hasContainer).toBe(true);
    expect(shadowElements?.hasSwitcher).toBe(true);
    expect(shadowElements?.hasSelect).toBe(true);
    expect(shadowElements?.languages.length).toBeGreaterThan(0);
  });

  test('should load all required resources', async ({ page }) => {
    const missingResources: string[] = [];

    page.on('response', response => {
      if (response.status() === 404) {
        missingResources.push(response.url());
      }
    });

    await page.reload();
    await page.waitForTimeout(2000);

    // Filter out known optional resources
    const criticalMissing = missingResources.filter(url =>
      !url.includes('optional-resource')
    );

    expect(criticalMissing).toHaveLength(0);
  });

  test('should maintain state after interactions', async ({ page }) => {
    // Set initial language to 'es'
    await page.evaluate(() => {
      const mainMenu = document.querySelector('main-menu');
      if (!mainMenu || !mainMenu.shadowRoot) return;

      const langSwitcher = mainMenu.shadowRoot.querySelector('language-switcher');
      if (!langSwitcher || !langSwitcher.shadowRoot) return;

      const select = langSwitcher.shadowRoot.querySelector('#language-select') as HTMLSelectElement;
      if (select) {
        select.value = 'es';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    await page.waitForTimeout(500);

    // Interact with other menu items (if any)
    await page.evaluate(() => {
      const mainMenu = document.querySelector('main-menu');
      if (!mainMenu || !mainMenu.shadowRoot) return;

      // Simulate hovering over menu items
      const menuItems = mainMenu.shadowRoot.querySelectorAll('.menu-button');
      menuItems.forEach(item => {
        item.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        item.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
      });
    });

    // Verify language is still 'es'
    const currentLang = await page.evaluate(() => {
      const mainMenu = document.querySelector('main-menu');
      if (!mainMenu || !mainMenu.shadowRoot) return null;

      const langSwitcher = mainMenu.shadowRoot.querySelector('language-switcher');
      if (!langSwitcher || !langSwitcher.shadowRoot) return null;

      const select = langSwitcher.shadowRoot.querySelector('#language-select') as HTMLSelectElement;
      return select ? select.value : null;
    });

    expect(currentLang).toBe('es');
  });
});