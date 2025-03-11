// @ts-ignore - Module resolution will be handled at runtime
import { MovementEventBus, ServerEventBus, UiEventBus } from '../../common/events/index.js';
// @ts-ignore - Module resolution will be handled at runtime
import type { EventBuses } from '../../common/events/EventBuses.js';
// @ts-ignore - Module resolution will be handled at runtime
import type { Coord, ICharacter, IMovable, IPath } from '../../common/interfaces.js';
// @ts-ignore - Module resolution will be handled at runtime
import { play } from '../../game/index.js';

/**
 * WebGameAdapter connects the web UI with the game logic
 * by initializing event buses and translating between web UI events and game events
 */
export class WebGameAdapter {
  private eventBuses: EventBuses;
  private eventBridge: any;
  private gameLoop: number | null = null;
  private lastFrameTime: number = 0;

  constructor(eventBridge: any) {
    // Store reference to the event bridge
    this.eventBridge = eventBridge;

    // Initialize event buses
    this.eventBuses = {
      server: new ServerEventBus(),
      ui: new UiEventBus(),
      movement: new MovementEventBus(),
    };

    // Connect event listeners
    this.connectEventListeners();
  }

  /**
   * Start the game logic and animation loop
   */
  public start(): void {
    // Start the game logic
    play(this.eventBuses);

    // Start animation loop for smooth UI updates
    this.startGameLoop();
  }

  /**
   * Clean up and stop the game
   */
  public stop(): void {
    // Stop animation loop
    if (this.gameLoop !== null) {
      cancelAnimationFrame(this.gameLoop);
      this.gameLoop = null;
    }

    // Clean up event listeners
    // this.disconnectEventListeners();
  }

  /**
   * Connect event listeners between web UI and game logic
   */
  private connectEventListeners(): void {
    // Connect web UI -> game logic
    this.connectWebToGame();

    // Connect game logic -> web UI
    this.connectGameToWeb();
  }

  /**
   * Connect events from web UI to game logic
   */
  private connectWebToGame(): void {
    if (!this.eventBridge) return;

    // Listen for player movement events from web UI
    this.eventBridge.addEventListener('player-move', (e: any) => {
      const { direction } = e.detail;

      // Dispatch to the movement event bus
      this.eventBuses.movement.dispatch(
        this.eventBuses.movement.events.direction,
        direction
      );
    });

    // Listen for player action events from web UI
    this.eventBridge.addEventListener('player-action', (e: any) => {
      const { action } = e.detail;

      // Map to appropriate game event
      // TODO: Implement action handling
      console.log(`Player action received: ${action}`);
    });

    // Listen for dialog choice events from web UI
    this.eventBridge.addEventListener('dialog-choice', (e: any) => {
      const { choiceId } = e.detail;

      // Map to appropriate game event
      // TODO: Implement dialog choice handling
      console.log(`Dialog choice selected: ${choiceId}`);
    });
  }

  /**
   * Connect events from game logic to web UI
   */
  private connectGameToWeb(): void {
    // Listen for map updates from server
    this.eventBuses.server.listen(
      this.eventBuses.server.events.map,
      this,
      (mapData) => {
        // Format map data for web UI
        this.eventBridge.receiveFromGame('map-updated', {
          mapData: { cells: mapData.map((row) => row.map((cell) => cell.symbol)) }
        });
      }
    );

    // Listen for character updates from server
    this.eventBuses.server.listen(
      this.eventBuses.server.events.characters,
      this,
      (characters) => {
        characters.forEach((character) => {
          this.updateCharacterInUI(character);
        });
      }
    );

    // Listen for player selection
    this.eventBuses.server.listen(
      this.eventBuses.server.events.player,
      this,
      (character) => {
        this.updateCharacterInUI(character, 'player');
      }
    );

    // Listen for movement events
    this.eventBuses.movement.listen(
      this.eventBuses.movement.events.move,
      this,
      (movable) => {
        this.updateMovableInUI(movable);
      }
    );

    // Listen for position updates
    this.eventBuses.movement.listen(
      this.eventBuses.movement.events.position,
      this,
      (movable) => {
        this.updateMovableInUI(movable);
      }
    );

    // Listen for valid cells updates
    this.eventBuses.server.listen(
      this.eventBuses.server.events.validCells,
      this,
      (validCellIds) => {
        // Convert cell IDs to coordinates
        const validMoves = validCellIds.map(cellId => {
          const [x, y] = cellId.split(',').map(Number);
          return { x, y };
        });

        this.eventBridge.receiveFromGame('valid-moves-updated', {
          validMoves
        });
      }
    );
  }

  /**
   * Update character in the UI
   */
  private updateCharacterInUI(character: ICharacter, type: string = 'character'): void {
    if (!character.position) return;

    this.eventBridge.receiveFromGame('character-updated', {
      character: {
        id: character.name,
        x: character.position.x,
        y: character.position.y,
        symbol: character.letter,
        type: type,
        state: character.action
      }
    });
  }

  /**
   * Update any movable entity in the UI
   */
  private updateMovableInUI(movable: IMovable): void {
    if (!movable.position) return;

    this.eventBridge.receiveFromGame('character-updated', {
      character: {
        id: movable.name,
        x: movable.position.x,
        y: movable.position.y,
        symbol: movable.letter,
        type: 'character',
        state: movable.action
      }
    });
  }

  /**
   * Start game animation loop
   */
  private startGameLoop(): void {
    this.lastFrameTime = performance.now();

    const animate = (timestamp: number) => {
      // Calculate time since last frame
      const deltaTime = timestamp - this.lastFrameTime;
      this.lastFrameTime = timestamp;

      // Dispatch frame event to game logic
      this.eventBuses.ui.dispatch(
        this.eventBuses.ui.events.frame,
        deltaTime
      );

      // Request next frame
      this.gameLoop = requestAnimationFrame(animate);
    };

    // Start animation loop
    this.gameLoop = requestAnimationFrame(animate);
  }
}