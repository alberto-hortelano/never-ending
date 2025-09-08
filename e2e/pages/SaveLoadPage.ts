import { Page, Locator } from '@playwright/test';
import type { TestableComponent } from '../types/test-component';

export class SaveLoadPage {
  readonly page: Page;
  readonly saveLoadMenu: Locator;
  readonly saveLoadButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.saveLoadMenu = page.locator('save-load-menu');
    this.saveLoadButton = page.locator('#save-load-button');
    
    // Set test mode flag for shadow DOM access
    page.addInitScript(() => {
      (window as any).__PLAYWRIGHT_TEST__ = true;
    });
  }

  /**
   * Open the save/load menu by clicking the button in TopBar
   */
  async openMenu() {
    // Click the save/load button in the TopBar
    await this.page.evaluate(() => {
      const topBar = document.querySelector('top-bar');
      if (topBar && (topBar as TestableComponent).getTestingShadowRoot) {
        const shadowRoot = (topBar as TestableComponent).getTestingShadowRoot();
        const button = shadowRoot?.querySelector('#save-load-button') as HTMLButtonElement;
        if (button) button.click();
      }
    });

    // Wait for menu to be visible
    await this.saveLoadMenu.waitFor({ state: 'visible' });
  }

  /**
   * Close the save/load menu
   */
  async closeMenu() {
    await this.page.evaluate(() => {
      const menu = document.querySelector('save-load-menu');
      if (menu && (menu as any).hide) {
        (menu as any).hide();
      }
    });

    // Wait for menu to be hidden
    await this.saveLoadMenu.waitFor({ state: 'hidden' });
  }

  /**
   * Save the game using keyboard shortcut (F5)
   */
  async quickSave() {
    await this.page.keyboard.press('F5');
    // Wait a bit for save to complete
    await this.page.waitForTimeout(500);
  }

  /**
   * Load the game using keyboard shortcut (F9)
   */
  async quickLoad() {
    await this.page.keyboard.press('F9');
    // Wait a bit for load to complete
    await this.page.waitForTimeout(500);
  }

  /**
   * Save the game to a specific slot via UI
   */
  async saveToSlot(slotName: string) {
    // Open menu if not already open
    const isVisible = await this.saveLoadMenu.isVisible();
    if (!isVisible) {
      await this.openMenu();
    }

    // Switch to save tab if needed
    await this.page.evaluate(() => {
      const menu = document.querySelector('save-load-menu');
      if (menu && (menu as TestableComponent).getTestingShadowRoot) {
        const shadowRoot = (menu as TestableComponent).getTestingShadowRoot();
        const saveTab = shadowRoot?.querySelector('[data-tab="save"]') as HTMLButtonElement;
        if (saveTab) saveTab.click();
      }
    });

    // Click "Create New Save" button
    await this.page.evaluate(() => {
      const menu = document.querySelector('save-load-menu');
      if (menu && (menu as TestableComponent).getTestingShadowRoot) {
        const shadowRoot = (menu as TestableComponent).getTestingShadowRoot();
        const newSaveBtn = shadowRoot?.querySelector('.new-save-button') as HTMLButtonElement;
        if (newSaveBtn) newSaveBtn.click();
      }
    });

    // Handle the prompt dialog
    await this.page.evaluate((name) => {
      // Override window.prompt temporarily
      (window as any).__promptResponse = name;
      const originalPrompt = window.prompt;
      window.prompt = () => (window as any).__promptResponse;
      
      // Trigger the save
      const menu = document.querySelector('save-load-menu');
      if (menu && (menu as any).createNewSave) {
        (menu as any).createNewSave();
      }
      
      // Restore original prompt
      window.prompt = originalPrompt;
    }, slotName);

    // Wait for save to complete
    await this.page.waitForTimeout(500);
  }

  /**
   * Load a game from a specific slot via UI
   */
  async loadFromSlot(slotName: string) {
    // Open menu if not already open
    const isVisible = await this.saveLoadMenu.isVisible();
    if (!isVisible) {
      await this.openMenu();
    }

    // Switch to load tab
    await this.page.evaluate(() => {
      const menu = document.querySelector('save-load-menu');
      if (menu && (menu as TestableComponent).getTestingShadowRoot) {
        const shadowRoot = (menu as TestableComponent).getTestingShadowRoot();
        const loadTab = shadowRoot?.querySelector('[data-tab="load"]') as HTMLButtonElement;
        if (loadTab) loadTab.click();
      }
    });

    // Click the load button for the specific slot
    await this.page.evaluate((slot) => {
      const menu = document.querySelector('save-load-menu');
      if (menu && (menu as TestableComponent).getTestingShadowRoot) {
        const shadowRoot = (menu as TestableComponent).getTestingShadowRoot();
        const loadBtn = shadowRoot?.querySelector(`.load-btn[data-slot="${slot}"]`) as HTMLButtonElement;
        if (loadBtn) loadBtn.click();
      }
    }, slotName);

    // Handle confirmation dialog
    await this.page.evaluate(() => {
      // Override window.confirm to always return true
      const originalConfirm = window.confirm;
      window.confirm = () => true;
      
      // Restore after a moment
      setTimeout(() => {
        window.confirm = originalConfirm;
      }, 100);
    });

    // Wait for load to complete
    await this.page.waitForTimeout(1000);
  }

  /**
   * Get list of saved games
   */
  async getSavedGames(): Promise<Array<{ slotName: string; turn: string; timestamp: number }>> {
    const isVisible = await this.saveLoadMenu.isVisible();
    if (!isVisible) {
      await this.openMenu();
    }

    return await this.page.evaluate(() => {
      const menu = document.querySelector('save-load-menu');
      if (menu && (menu as TestableComponent).getTestingShadowRoot) {
        const shadowRoot = (menu as TestableComponent).getTestingShadowRoot();
        const saveItems = shadowRoot?.querySelectorAll('.save-item');
        const saves: Array<{ slotName: string; turn: string; timestamp: number }> = [];
        
        saveItems?.forEach(item => {
          const nameEl = item.querySelector('.save-name');
          const detailsEl = item.querySelector('.save-details');
          
          if (nameEl && detailsEl) {
            const slotName = nameEl.textContent || '';
            const turnText = detailsEl.querySelector('span')?.textContent || '';
            const turn = turnText.replace('Turn: ', '');
            
            saves.push({
              slotName,
              turn,
              timestamp: Date.now() // We can't get the actual timestamp from UI easily
            });
          }
        });
        
        return saves;
      }
      return [];
    });
  }

  /**
   * Check if a save exists
   */
  async saveExists(slotName: string): Promise<boolean> {
    const saves = await this.getSavedGames();
    return saves.some(save => save.slotName === slotName);
  }

  /**
   * Delete a saved game
   */
  async deleteSave(slotName: string) {
    const isVisible = await this.saveLoadMenu.isVisible();
    if (!isVisible) {
      await this.openMenu();
    }

    // Click delete button for the specific slot
    await this.page.evaluate((slot) => {
      const menu = document.querySelector('save-load-menu');
      if (menu && (menu as TestableComponent).getTestingShadowRoot) {
        const shadowRoot = (menu as TestableComponent).getTestingShadowRoot();
        const deleteBtn = shadowRoot?.querySelector(`.delete-btn[data-slot="${slot}"]`) as HTMLButtonElement;
        if (deleteBtn) deleteBtn.click();
      }
    }, slotName);

    // Handle confirmation dialog
    await this.page.evaluate(() => {
      const originalConfirm = window.confirm;
      window.confirm = () => true;
      setTimeout(() => {
        window.confirm = originalConfirm;
      }, 100);
    });

    await this.page.waitForTimeout(500);
  }

  /**
   * Check if the menu is visible
   */
  async isMenuVisible(): Promise<boolean> {
    return await this.saveLoadMenu.isVisible();
  }
}