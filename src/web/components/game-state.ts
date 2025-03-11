interface IGameCharacter {
  id: string;
  x: number;
  y: number;
  symbol: string;
  type: string;
  state: 'idle' | 'walk' | 'action';
  direction?: string;
}

interface IMapData {
  cells: string[][];
  validMoves?: {x: number, y: number}[];
}

export class GameState extends HTMLElement {
  private characters: Map<string, IGameCharacter> = new Map();
  private mapData: IMapData = { cells: [] };
  private playerCharacterId: string | null = null;
  private gameSpeed: number = 1; // Default speed multiplier
  
  // Event handlers
  private eventHandlers: Map<string, Set<Function>> = new Map();
  
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: none;
          }
        </style>
      `;
    }
    
    // Setup animation loop for continuous updates
    this.setupAnimationLoop();
  }
  
  setupAnimationLoop() {
    let lastTime = 0;
    
    const gameLoop = (timestamp: number) => {
      // Calculate delta time in seconds
      const deltaTime = (timestamp - lastTime) / 1000;
      lastTime = timestamp;
      
      // Update game state
      this.update(deltaTime);
      
      // Trigger frame update event
      this.triggerEvent('frame-update', { deltaTime });
      
      // Continue the loop
      requestAnimationFrame(gameLoop);
    };
    
    // Start the animation loop
    requestAnimationFrame(gameLoop);
  }
  
  update(_: number) {
    // Update character positions, animations, etc.
    this.characters.forEach(character => {
      // Update character state based on current actions
      if (character.state === 'walk') {
        // Movement logic would go here
        // This would be driven by the event system in a real implementation
      }
    });
  }
  
  // Map methods
  updateMap(mapData: string[][]) {
    this.mapData.cells = mapData;
    this.triggerEvent('map-updated', { mapData: this.mapData });
  }
  
  updateValidMoves(validMoves: {x: number, y: number}[]) {
    this.mapData.validMoves = validMoves;
    this.triggerEvent('valid-moves-updated', { validMoves });
  }
  
  // Character methods
  addCharacter(character: IGameCharacter) {
    this.characters.set(character.id, character);
    this.triggerEvent('character-added', { character });
  }
  
  updateCharacter(id: string, updates: Partial<IGameCharacter>) {
    const character = this.characters.get(id);
    if (character) {
      Object.assign(character, updates);
      this.triggerEvent('character-updated', { character });
    }
  }
  
  removeCharacter(id: string) {
    if (this.characters.has(id)) {
      const character = this.characters.get(id);
      this.characters.delete(id);
      this.triggerEvent('character-removed', { character });
    }
  }
  
  setPlayerCharacter(id: string) {
    this.playerCharacterId = id;
  }
  
  getPlayerCharacter(): IGameCharacter | undefined {
    if (this.playerCharacterId) {
      return this.characters.get(this.playerCharacterId);
    }
    return undefined;
  }
  
  // Movement methods
  moveCharacter(id: string, x: number, y: number, immediate: boolean = false) {
    const character = this.characters.get(id);
    if (character) {
      if (immediate) {
        character.x = x;
        character.y = y;
        character.state = 'idle';
      } else {
        character.state = 'walk';
        // In a real implementation, this would set up a tween or animation
        // For simplicity, we're just updating the position immediately
        character.x = x;
        character.y = y;
        
        // Simulate movement completion
        setTimeout(() => {
          character.state = 'idle';
          this.triggerEvent('character-updated', { character });
        }, 300);
      }
      
      this.triggerEvent('character-moved', { 
        character, 
        from: { x: character.x, y: character.y },
        to: { x, y }
      });
      
      this.triggerEvent('character-updated', { character });
    }
  }
  
  // Event system
  on(eventName: string, handler: Function) {
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, new Set());
    }
    
    this.eventHandlers.get(eventName)?.add(handler);
  }
  
  off(eventName: string, handler: Function) {
    const handlers = this.eventHandlers.get(eventName);
    if (handlers) {
      handlers.delete(handler);
    }
  }
  
  triggerEvent(eventName: string, data: any) {
    const handlers = this.eventHandlers.get(eventName);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in ${eventName} handler:`, error);
        }
      });
    }
    
    // Dispatch the event to the DOM as well
    this.dispatchEvent(new CustomEvent(eventName, { detail: data }));
  }
  
  // Game speed control
  setGameSpeed(speed: number) {
    this.gameSpeed = Math.max(0.1, Math.min(5, speed)); // Clamp between 0.1 and 5
    this.triggerEvent('game-speed-changed', { speed: this.gameSpeed });
  }
  
  getGameSpeed(): number {
    return this.gameSpeed;
  }
}

customElements.define('game-state', GameState);