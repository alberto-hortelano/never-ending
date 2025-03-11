export class GameMap extends HTMLElement {
  private mapGrid: HTMLElement | null = null;
  private mapData: string[][] = [];
  private characters: Map<string, { x: number, y: number, symbol: string, type: string }> = new Map();

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: block;
            padding: 10px;
          }
          .map-container {
            background-color: #111;
            border: 2px solid #444;
            padding: 10px;
            margin: 0 auto;
            width: fit-content;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
          }
          .map-grid {
            display: grid;
            grid-template-columns: repeat(var(--map-width, 20), 1fr);
            grid-gap: 0;
            font-family: monospace;
            font-size: 20px;
            line-height: 1;
          }
          .map-cell {
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            box-sizing: border-box;
          }
          .wall {
            background-color: #333;
            color: #666;
          }
          .floor {
            background-color: #111;
            color: #888;
          }
          .control-panel {
            background-color: #222233;
            color: #8888ff;
          }
          .player {
            color: #ffff00;
            font-weight: bold;
            animation: pulse 2s infinite;
          }
          .character {
            color: #88ff88;
            font-weight: bold;
          }
          @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
          }
          .valid-move {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 255, 0, 0.2);
            z-index: -1;
          }
        </style>
        <div class="map-container">
          <div class="map-grid" id="map-grid"></div>
        </div>
      `;

      this.mapGrid = this.shadowRoot.getElementById('map-grid');

      // Initialize with a placeholder map until real data is received
      this.initializePlaceholderMap();
    }
  }

  private initializePlaceholderMap() {
    const placeholderMap = [
      "####################",
      "#..................#",
      "#..................#",
      "#..................#",
      "#..................#",
      "#..................#",
      "#..................#",
      "#..................#",
      "#..................#",
      "#..................#",
      "####################"
    ];

    this.updateMap(placeholderMap.map(row => row.split('')));
  }

  updateMap(newMapData: string[][]) {
    this.mapData = newMapData;

    if (!this.mapGrid || !this.shadowRoot) return;

    // Update CSS variable for grid columns
    (this.shadowRoot.host as HTMLElement).style.setProperty('--map-width', this.mapData[0]?.length.toString() || null);

    // Clear existing map
    this.mapGrid.innerHTML = '';

    // Render new map
    this.mapData.forEach((row, y) => {
      row.forEach((cell, x) => {
        const cellElement = document.createElement('div');
        cellElement.className = 'map-cell';
        cellElement.dataset.x = x.toString();
        cellElement.dataset.y = y.toString();

        // Determine cell type and add appropriate class
        if (cell === '#') {
          cellElement.classList.add('wall');
          cellElement.textContent = '█';
        } else if (cell === '.') {
          cellElement.classList.add('floor');
          cellElement.textContent = '·';
        } else if (cell === '=') {
          cellElement.classList.add('control-panel');
          cellElement.textContent = '=';
        } else {
          cellElement.classList.add('floor');
          cellElement.textContent = cell || '·';
        }

        this.mapGrid?.appendChild(cellElement);
      });
    });

    // Re-render characters on updated map
    this.renderCharacters();
  }

  renderCharacters() {
    if (!this.mapGrid) return;

    // Clear existing character elements
    const existingCharacters = this.mapGrid.querySelectorAll('.character-overlay');
    existingCharacters.forEach(char => char.remove());

    // Render each character
    this.characters.forEach(character => {
      const { x, y, symbol, type } = character;
      const cell = this.mapGrid?.querySelector(`[data-x="${x}"][data-y="${y}"]`);

      if (cell) {
        const characterElement = document.createElement('div');
        characterElement.className = `character-overlay ${type}`;
        characterElement.textContent = symbol;
        cell.appendChild(characterElement);
      }
    });
  }

  updateCharacter(id: string, x: number, y: number, symbol: string, type: string) {
    this.characters.set(id, { x, y, symbol, type });
    this.renderCharacters();
  }

  removeCharacter(id: string) {
    this.characters.delete(id);
    this.renderCharacters();
  }

  showValidMoves(validPositions: { x: number, y: number }[]) {
    if (!this.mapGrid) return;

    // Clear any existing valid move indicators
    const existing = this.mapGrid.querySelectorAll('.valid-move');
    existing.forEach(el => el.remove());

    // Add indicators for valid moves
    validPositions.forEach(pos => {
      const cell = this.mapGrid?.querySelector(`[data-x="${pos.x}"][data-y="${pos.y}"]`);

      if (cell) {
        const indicator = document.createElement('div');
        indicator.className = 'valid-move';
        cell.appendChild(indicator);
      }
    });
  }
}

customElements.define('game-map', GameMap);