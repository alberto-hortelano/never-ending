import './components/index.js';
// @ts-ignore - Module resolution will be handled at runtime
import { WebGameAdapter } from './adapters/index.js';

/**
 * Main Game UI Controller
 * Initializes and connects all UI components and handles communication with game engine
 */
export class GameUI {
  private container: HTMLElement | null = null;
  private gameMap: HTMLElement | null = null;
  private gameControls: HTMLElement | null = null;
  private gameDialog: HTMLElement | null = null;
  private gameState: any = null;
  private eventBridge: any = null;
  private gameAdapter: WebGameAdapter | null = null;
  private useRealGameEngine: boolean = true; // Set to false to use demo data

  constructor(containerSelector: string = 'body') {
    // Initialize after DOM is loaded
    window.addEventListener('DOMContentLoaded', () => {
      this.initialize(containerSelector);
    });
  }

  private initialize(containerSelector: string) {
    // Create the game container element
    this.container = document.querySelector(containerSelector);

    if (!this.container) {
      console.error(`Container element ${containerSelector} not found!`);
      return;
    }

    // Create and append game components
    this.createComponents();

    // Connect components
    this.connectComponents();

    // Initialize game engine or demo data
    if (this.useRealGameEngine) {
      this.initializeGameEngine();
    } else {
      this.initializeDemo();
    }
  }

  private createComponents() {
    if (!this.container) return;

    // Add utility components (invisible)
    this.gameState = document.createElement('game-state');
    this.eventBridge = document.createElement('event-bridge');
    this.container.appendChild(this.gameState);
    this.container.appendChild(this.eventBridge);

    // Create main container
    const gameContainer = document.createElement('game-container');
    this.container.appendChild(gameContainer);

    // Get references to child components
    this.gameMap = gameContainer.shadowRoot?.querySelector('game-map') || null;
    this.gameControls = gameContainer.shadowRoot?.querySelector('game-controls') || null;
    this.gameDialog = gameContainer.shadowRoot?.querySelector('game-dialog') || null;
  }

  private connectComponents() {
    this.connectEventListeners();
  }

  private connectEventListeners() {
    // Connect game controls to event bridge
    if (this.gameControls) {
      this.gameControls.addEventListener('control-movement', (e: any) => {
        const { direction } = e.detail;
        this.eventBridge.sendToGame('player-move', { direction });
      });

      this.gameControls.addEventListener('control-action', (e: any) => {
        const { action } = e.detail;
        this.eventBridge.sendToGame('player-action', { action });
      });
    }

    // Connect dialog choices to event bridge
    if (this.gameDialog) {
      this.gameDialog.addEventListener('dialog-choice-selected', (e: any) => {
        const { choiceId } = e.detail;
        this.eventBridge.sendToGame('dialog-choice', { choiceId });
      });
    }

    // Connect event bridge events to UI components
    if (this.eventBridge) {
      // Dialog events
      this.eventBridge.addEventListener('dialog-started', (e: any) => {
        if (this.gameDialog && 'showDialog' in this.gameDialog) {
          (this.gameDialog as any).showDialog(e.detail);
        }
      });

      this.eventBridge.addEventListener('dialog-continued', (e: any) => {
        if (this.gameDialog && 'showDialog' in this.gameDialog) {
          (this.gameDialog as any).showDialog(e.detail);
        }
      });

      this.eventBridge.addEventListener('dialog-ended', (e: any) => {
        if (this.gameDialog && 'showDialog' in this.gameDialog) {
          (this.gameDialog as any).showDialog(e.detail);

          // Auto-hide dialog after a bit
          setTimeout(() => {
            if (this.gameDialog && 'hideDialog' in this.gameDialog) {
              (this.gameDialog as any).hideDialog();
            }
          }, 3000);
        }
      });

      // Map events
      this.eventBridge.addEventListener('map-updated', (e: any) => {
        if (this.gameMap && 'updateMap' in this.gameMap) {
          (this.gameMap as any).updateMap(e.detail.mapData.cells);
        }
      });

      // Character events
      this.eventBridge.addEventListener('character-added', (e: any) => {
        const { character } = e.detail;
        if (this.gameMap && 'updateCharacter' in this.gameMap) {
          (this.gameMap as any).updateCharacter(
            character.id,
            character.x,
            character.y,
            character.symbol,
            character.type
          );
        }
      });

      this.eventBridge.addEventListener('character-updated', (e: any) => {
        const { character } = e.detail;
        if (this.gameMap && 'updateCharacter' in this.gameMap) {
          (this.gameMap as any).updateCharacter(
            character.id,
            character.x,
            character.y,
            character.symbol,
            character.type
          );
        }
      });

      // Valid moves
      this.eventBridge.addEventListener('valid-moves-updated', (e: any) => {
        const { validMoves } = e.detail;
        if (this.gameMap && 'showValidMoves' in this.gameMap) {
          (this.gameMap as any).showValidMoves(validMoves);
        }
      });
    }
  }

  /**
   * Initialize the connection to the real game engine
   */
  private initializeGameEngine() {
    if (!this.eventBridge) return;

    console.log('Initializing game engine connection...');
    
    // Create the game adapter with our event bridge
    this.gameAdapter = new WebGameAdapter(this.eventBridge);
    
    // Start the game engine
    this.gameAdapter.start();
    
    console.log('Game engine started');
  }

  /**
   * Initialize demo data for testing without the game engine
   */
  private initializeDemo() {
    // Create a sample map
    const demoMap = [
      "####################",
      "#..................#",
      "#..................#",
      "#.....P............#",
      "#..................#",
      "#.......D..........#",
      "#..................#",
      "#..................#",
      "#..................#",
      "#.........=........#",
      "####################"
    ];

    // Convert string rows to 2D character array
    const mapCells = demoMap.map(row => row.split(''));

    // Send the map to the event bridge (simulating server event)
    if (this.eventBridge) {
      this.eventBridge.receiveFromGame('map-updated', {
        mapData: { cells: mapCells }
      });

      // Add player character
      this.eventBridge.receiveFromGame('character-added', {
        character: {
          id: 'player',
          x: 5,
          y: 3,
          symbol: 'P',
          type: 'player',
          state: 'idle'
        }
      });

      // Add NPC character
      this.eventBridge.receiveFromGame('character-added', {
        character: {
          id: 'data',
          x: 7,
          y: 5,
          symbol: 'D',
          type: 'character',
          state: 'idle'
        }
      });

      // Show valid moves
      this.eventBridge.receiveFromGame('valid-moves-updated', {
        validMoves: [
          { x: 4, y: 2 },
          { x: 4, y: 3 },
          { x: 4, y: 4 },
          { x: 5, y: 2 },
          { x: 5, y: 4 },
          { x: 6, y: 2 },
          { x: 6, y: 3 },
          { x: 6, y: 4 }
        ]
      });
    }
  }
}
