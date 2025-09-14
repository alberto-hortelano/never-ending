import { Page, Locator } from '@playwright/test';
import type { TestableComponent, TestableWindow } from '../types/test-component';

export class MainMenuPage {
  readonly page: Page;
  readonly mainMenu: Locator;

  constructor(page: Page) {
    this.page = page;
    this.mainMenu = page.locator('main-menu');
    
    // Set test mode flag for shadow DOM access
    page.addInitScript(() => {
      (window as TestableWindow).__PLAYWRIGHT_TEST__ = true;
    });
  }

  async goto() {
    await this.page.goto('/');
    await this.waitForMenuToLoad();
  }

  async waitForMenuToLoad() {
    await this.mainMenu.waitFor({ state: 'visible' });
    
    // Wait for JavaScript to load and initialize
    await this.page.waitForLoadState('networkidle');
    
    // Wait for custom element to be defined
    await this.page.waitForFunction(() => {
      return customElements.get('main-menu') !== undefined;
    }, { timeout: 10000 });
    
    // Give components time to initialize
    await this.page.waitForTimeout(2000);
    
    // Wait for shadow DOM to be attached (using testing method)
    await this.page.waitForFunction(() => {
      const menu = document.querySelector('main-menu');
      if (!menu || typeof (menu as TestableComponent).getTestingShadowRoot !== 'function') return false;
      const shadowRoot = (menu as TestableComponent).getTestingShadowRoot();
      return shadowRoot && shadowRoot.querySelector('#singlePlayerBtn');
    }, { timeout: 10000 });
  }

  async startSinglePlayer() {
    // Use testing method to access closed shadow DOM
    await this.page.evaluate(() => {
      const menu = document.querySelector('main-menu');
      if (menu && (menu as TestableComponent).getTestingShadowRoot) {
        const shadowRoot = (menu as TestableComponent).getTestingShadowRoot();
        const button = shadowRoot?.querySelector('#singlePlayerBtn') as HTMLButtonElement;
        if (button) button.click();
      }
    });

    // Don't wait for menu to hide - it might show character selection instead
    await this.page.waitForTimeout(500);
  }

  async openMultiplayer() {
    await this.page.evaluate(() => {
      const menu = document.querySelector('main-menu');
      if (menu && (menu as TestableComponent).getTestingShadowRoot) {
        const shadowRoot = (menu as TestableComponent).getTestingShadowRoot();
        const button = shadowRoot?.querySelector('#multiplayerBtn') as HTMLButtonElement;
        if (button) button.click();
      }
    });
  }

  async openCharacterCreator() {
    await this.page.evaluate(() => {
      const menu = document.querySelector('main-menu');
      if (menu && (menu as TestableComponent).getTestingShadowRoot) {
        const shadowRoot = (menu as TestableComponent).getTestingShadowRoot();
        const button = shadowRoot?.querySelector('#characterCreatorBtn') as HTMLButtonElement;
        if (button) button.click();
      }
    });
  }

  async isVisible(): Promise<boolean> {
    return await this.mainMenu.isVisible();
  }
}