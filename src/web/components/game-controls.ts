export class GameControls extends HTMLElement {
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
          .controls-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin: 10px auto;
            max-width: 300px;
            background-color: #222;
            border: 1px solid #444;
            border-radius: 5px;
            padding: 10px;
          }
          .movement-controls {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            grid-gap: 5px;
            margin-bottom: 15px;
          }
          .ctrl-btn {
            width: 40px;
            height: 40px;
            background-color: #333;
            color: #eee;
            border: 1px solid #555;
            border-radius: 4px;
            font-weight: bold;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            user-select: none;
          }
          .ctrl-btn:hover {
            background-color: #444;
          }
          .ctrl-btn:active {
            background-color: #555;
            transform: translateY(1px);
          }
          .empty-cell {
            width: 40px;
            height: 40px;
          }
          .action-controls {
            display: flex;
            gap: 10px;
            margin-top: 10px;
          }
          .action-btn {
            padding: 8px 16px;
            background-color: #2a4d7f;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
          }
          .action-btn:hover {
            background-color: #3a5d8f;
          }
          .action-btn:active {
            background-color: #4a6d9f;
            transform: translateY(1px);
          }
          .control-label {
            color: #aaa;
            font-size: 12px;
            margin-bottom: 10px;
          }
          .key-hint {
            font-size: 10px;
            color: #999;
            margin-top: 2px;
            text-align: center;
          }
        </style>
        <div class="controls-container">
          <div class="control-label">Movement Controls (WASD or Arrows)</div>
          <div class="movement-controls">
            <button class="ctrl-btn" data-direction="nw">↖
              <span class="key-hint">Q</span>
            </button>
            <button class="ctrl-btn" data-direction="n">↑
              <span class="key-hint">W</span>
            </button>
            <button class="ctrl-btn" data-direction="ne">↗
              <span class="key-hint">E</span>
            </button>
            <button class="ctrl-btn" data-direction="w">←
              <span class="key-hint">A</span>
            </button>
            <div class="empty-cell"></div>
            <button class="ctrl-btn" data-direction="e">→
              <span class="key-hint">D</span>
            </button>
            <button class="ctrl-btn" data-direction="sw">↙
              <span class="key-hint">Z</span>
            </button>
            <button class="ctrl-btn" data-direction="s">↓
              <span class="key-hint">S</span>
            </button>
            <button class="ctrl-btn" data-direction="se">↘
              <span class="key-hint">C</span>
            </button>
          </div>
          
          <div class="action-controls">
            <button class="action-btn" data-action="interact">
              Interact
              <span class="key-hint">E / Space</span>
            </button>
            <button class="action-btn" data-action="wait">
              Wait
              <span class="key-hint">T</span>
            </button>
          </div>
        </div>
      `;
      
      this.setupEventListeners();
    }
  }
  
  setupEventListeners() {
    if (!this.shadowRoot) return;
    
    // Setup movement button listeners
    const movementButtons = this.shadowRoot.querySelectorAll('.ctrl-btn[data-direction]');
    movementButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const direction = (e.currentTarget as HTMLElement).dataset.direction;
        this.dispatchEvent(new CustomEvent('control-movement', {
          detail: { direction }
        }));
      });
    });
    
    // Setup action button listeners
    const actionButtons = this.shadowRoot.querySelectorAll('.action-btn[data-action]');
    actionButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const action = (e.currentTarget as HTMLElement).dataset.action;
        this.dispatchEvent(new CustomEvent('control-action', {
          detail: { action }
        }));
      });
    });
  }
}

customElements.define('game-controls', GameControls);