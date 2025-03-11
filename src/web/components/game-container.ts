export class GameContainer extends HTMLElement {
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
            width: 100%;
            height: 100vh;
            margin: 0;
            padding: 0;
            background-color: #222;
            color: #eee;
            font-family: monospace;
            overflow: hidden;
          }
          .game-layout {
            display: grid;
            grid-template-rows: 1fr auto;
            height: 100%;
            max-width: 1200px;
            margin: 0 auto;
          }
          .game-header {
            text-align: center;
            padding: 10px;
            background-color: #333;
            border-bottom: 1px solid #444;
          }
          .log-panel {
            background-color: #1a1a1a;
            border-top: 1px solid #444;
            padding: 10px;
            font-size: 14px;
            height: 100px;
            overflow-y: auto;
          }
          .log-entry {
            margin: 2px 0;
            white-space: pre-wrap;
          }
        </style>
        <div class="game-layout">
          <div class="game-content">
            <header class="game-header">
              <h1>Never Ending</h1>
            </header>
            <game-map></game-map>
            <game-controls></game-controls>
            <game-dialog></game-dialog>
          </div>
          <div class="log-panel" id="log-panel"></div>
        </div>
      `;
    }

    // Initialize event listeners
    this.initializeEventListeners();
  }

  initializeEventListeners() {
    // Setup keyboard listener for game controls
    document.addEventListener('keydown', (event) => {
      // Dispatch movement events based on key presses
      const key = event.key.toLowerCase();
      
      // Movement keys
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(key)) {
        event.preventDefault();
        this.dispatchEvent(new CustomEvent('game-movement', { 
          detail: { key }
        }));
      }
      
      // Action keys
      if (['e', 'space', 'enter'].includes(key)) {
        event.preventDefault();
        this.dispatchEvent(new CustomEvent('game-action', { 
          detail: { key }
        }));
      }
    });
  }

  logMessage(message: string, type: 'info' | 'error' | 'system' = 'info') {
    if (this.shadowRoot) {
      const logPanel = this.shadowRoot.getElementById('log-panel');
      if (logPanel) {
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry log-${type}`;
        logEntry.textContent = message;
        logPanel.appendChild(logEntry);
        logPanel.scrollTop = logPanel.scrollHeight;
      }
    }
  }
}

customElements.define('game-container', GameContainer);