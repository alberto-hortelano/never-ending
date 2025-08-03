import { test as base, Page } from '@playwright/test';
import { MainMenuPage } from '../pages/MainMenuPage';
import { GameBoardPage } from '../pages/GameBoardPage';

type GameFixtures = {
  mainMenuPage: MainMenuPage;
  gameBoardPage: GameBoardPage;
};

export const test = base.extend<GameFixtures>({
  mainMenuPage: async ({ page }, use) => {
    const mainMenuPage = new MainMenuPage(page);
    await use(mainMenuPage);
  },

  gameBoardPage: async ({ page }, use) => {
    const gameBoardPage = new GameBoardPage(page);
    await use(gameBoardPage);
  },
});

export { expect } from '@playwright/test';

/**
 * Common game utilities
 */
export class GameUtils {
  constructor(private page: Page) {}

  async waitForGameToLoad() {
    // Wait for the main game container to be visible
    await this.page.waitForSelector('container-component', { state: 'visible' });
    
    // Wait for the board to be loaded
    await this.page.waitForSelector('board-component', { state: 'visible' });
    
    // Give the game a moment to fully initialize
    await this.page.waitForTimeout(1000);
  }

  async waitForTurnChange() {
    // Wait for turn indicator to update
    await this.page.waitForFunction(() => {
      const turnIndicator = document.querySelector('turn-indicator');
      return turnIndicator && turnIndicator.shadowRoot;
    });
  }

  async getCharacterPosition(characterName: string): Promise<{ x: number; y: number } | null> {
    return await this.page.evaluate((name) => {
      const character = document.querySelector(`character-component[id="${name}"]`);
      if (!character) return null;
      
      const rect = character.getBoundingClientRect();
      return { x: rect.left, y: rect.top };
    }, characterName);
  }

  async waitForAnimation(selector: string) {
    await this.page.waitForFunction((sel) => {
      const element = document.querySelector(sel);
      if (!element) return false;
      
      const animations = element.getAnimations();
      return animations.length === 0 || animations.every(a => a.playState === 'finished');
    }, selector);
  }
}