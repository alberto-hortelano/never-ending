import { Page, Locator } from '@playwright/test';

export class GameBoardPage {
  readonly page: Page;
  readonly container: Locator;
  readonly board: Locator;
  readonly turnIndicator: Locator;
  readonly characters: Locator;
  readonly topBar: Locator;
  readonly bottomBar: Locator;

  constructor(page: Page) {
    this.page = page;
    this.container = page.locator('container-component');
    this.board = page.locator('board-component');
    this.turnIndicator = page.locator('turn-indicator');
    this.characters = page.locator('characters-component');
    this.topBar = page.locator('top-bar');
    this.bottomBar = page.locator('bottom-bar');
  }

  async waitForGameToStart() {
    // Wait for container to be visible
    await this.container.waitFor({ state: 'visible' });
    
    // Wait for board to be visible
    await this.board.waitFor({ state: 'visible' });
    
    // Wait for turn indicator
    await this.turnIndicator.waitFor({ state: 'visible' });
    
    // Wait for the board's shadow DOM to be ready
    await this.page.waitForFunction(() => {
      const board = document.querySelector('board-component');
      return board && board.shadowRoot && board.shadowRoot.querySelector('.board');
    });
  }

  async clickCell(x: number, y: number) {
    // Click on a cell using its data attributes
    await this.page.evaluate(({ x, y }) => {
      const board = document.querySelector('board-component');
      if (board && board.shadowRoot) {
        const cell = board.shadowRoot.querySelector(`cell-component[data-x="${x}"][data-y="${y}"]`) as HTMLElement;
        if (cell) cell.click();
      }
    }, { x, y });
  }

  async selectCharacter(characterName: string) {
    await this.page.evaluate((name) => {
      const character = document.querySelector(`character-component[id="${name}"]`) as HTMLElement;
      if (character) character.click();
    }, characterName);
  }

  async getCurrentTurn(): Promise<string | null> {
    return await this.page.evaluate(() => {
      const turnIndicator = document.querySelector('turn-indicator');
      if (turnIndicator && turnIndicator.shadowRoot) {
        const turnText = turnIndicator.shadowRoot.querySelector('.turn-text');
        return turnText ? turnText.textContent : null;
      }
      return null;
    });
  }

  async getCharacterHealth(characterName: string): Promise<number | null> {
    return await this.page.evaluate((name) => {
      const character = document.querySelector(`character-component[id="${name}"]`);
      if (character && character.shadowRoot) {
        const healthBar = character.shadowRoot.querySelector('.health-bar');
        if (healthBar) {
          const currentHealth = healthBar.getAttribute('data-current-health');
          return currentHealth ? parseInt(currentHealth, 10) : null;
        }
      }
      return null;
    }, characterName);
  }

  async waitForActionMenu() {
    await this.page.waitForSelector('actions-component', { state: 'visible' });
  }

  async selectAction(actionName: string) {
    await this.page.evaluate((action) => {
      const actionsComponent = document.querySelector('actions-component');
      if (actionsComponent && actionsComponent.shadowRoot) {
        const actionButton = actionsComponent.shadowRoot.querySelector(`[data-action="${action}"]`) as HTMLElement;
        if (actionButton) actionButton.click();
      }
    }, actionName);
  }

  async endTurn() {
    // Look for end turn button in the bottom bar
    await this.page.evaluate(() => {
      const bottomBar = document.querySelector('bottom-bar');
      if (bottomBar && bottomBar.shadowRoot) {
        const endTurnBtn = bottomBar.shadowRoot.querySelector('.end-turn-btn') as HTMLElement;
        if (endTurnBtn) endTurnBtn.click();
      }
    });
  }

  async isGameOver(): Promise<boolean> {
    // Check if game over popup is visible
    const gameOverPopup = this.page.locator('popup-component');
    return await gameOverPopup.isVisible();
  }

  async getVisibleCharacters(): Promise<string[]> {
    return await this.page.evaluate(() => {
      const characters = document.querySelectorAll('character-component');
      return Array.from(characters)
        .filter(char => char.checkVisibility())
        .map(char => char.id);
    });
  }
}