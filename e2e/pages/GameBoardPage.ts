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
        const cell = board.shadowRoot.querySelector<HTMLElement>(`cell-component[data-x="${x}"][data-y="${y}"]`);
        if (cell) cell.click();
      }
    }, { x, y });
  }

  async selectCharacter(characterName: string) {
    await this.page.evaluate((name) => {
      const character = document.querySelector<HTMLElement>(`character-component[id="${name}"]`);
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
        const actionButton = actionsComponent.shadowRoot.querySelector<HTMLElement>(`[data-action="${action}"]`);
        if (actionButton) actionButton.click();
      }
    }, actionName);
  }

  async endTurn() {
    // Look for end turn button in the bottom bar
    await this.page.evaluate(() => {
      const bottomBar = document.querySelector('bottom-bar');
      if (bottomBar && bottomBar.shadowRoot) {
        const endTurnBtn = bottomBar.shadowRoot.querySelector<HTMLElement>('.end-turn-btn');
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

  async goto() {
    await this.page.goto('/');
  }

  async startSinglePlayerGame() {
    // Click single player button on main menu
    await this.page.click('button:has-text("Single Player")');
  }

  async waitForGameToLoad() {
    await this.waitForGameToStart();
    // Additional wait for game initialization
    await this.page.waitForTimeout(1000);
  }

  async openActionMenu() {
    // Click on the actions button in bottom bar
    await this.page.evaluate(() => {
      const bottomBar = document.querySelector('bottom-bar');
      if (bottomBar && bottomBar.shadowRoot) {
        const actionsBtn = bottomBar.shadowRoot.querySelector<HTMLElement>('.actions-btn');
        if (actionsBtn) actionsBtn.click();
      }
    });
    await this.page.waitForTimeout(500);
  }

  async moveCharacterTo(x: number, y: number) {
    await this.clickCell(x, y);
    await this.page.waitForTimeout(500);
  }

  async getCharacterAP(characterName: string): Promise<number> {
    return await this.page.evaluate((name) => {
      const character = document.querySelector(`character-component[id="${name}"]`);
      if (character && character.shadowRoot) {
        const apDisplay = character.shadowRoot.querySelector('.ap-display');
        if (apDisplay) {
          const ap = apDisplay.getAttribute('data-ap');
          return ap ? parseInt(ap, 10) : 0;
        }
      }
      return 0;
    }, characterName);
  }

  async setupAdjacentCombat() {
    // Position two characters adjacent to each other
    await this.selectCharacter('Character1');
    await this.moveCharacterTo(5, 5);
    await this.endTurn();

    await this.selectCharacter('Character2');
    await this.moveCharacterTo(6, 5);
    await this.endTurn();
  }

  async equipWeapon(characterName: string, weaponType: string) {
    await this.selectCharacter(characterName);
    // Open inventory
    await this.page.evaluate(() => {
      const bottomBar = document.querySelector('bottom-bar');
      if (bottomBar && bottomBar.shadowRoot) {
        const inventoryBtn = bottomBar.shadowRoot.querySelector<HTMLElement>('.inventory-btn');
        if (inventoryBtn) inventoryBtn.click();
      }
    });

    // Equip weapon of specified type
    await this.page.click(`.weapon-item[data-type="${weaponType}"]`);
    await this.page.click('button:has-text("Equip")');
  }

  async unequipAllWeapons(characterName: string) {
    await this.selectCharacter(characterName);
    // Open inventory
    await this.page.evaluate(() => {
      const bottomBar = document.querySelector('bottom-bar');
      if (bottomBar && bottomBar.shadowRoot) {
        const inventoryBtn = bottomBar.shadowRoot.querySelector<HTMLElement>('.inventory-btn');
        if (inventoryBtn) inventoryBtn.click();
      }
    });

    // Unequip all weapons
    await this.page.click('button:has-text("Unequip All")');
  }
}