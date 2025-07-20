import { Component } from '../Component';
import { MultiplayerLobby } from '../multiplayerlobby/MultiplayerLobby';
import { MultiplayerManager } from '../../common/services/MultiplayerManager';

export class MainMenu extends Component {
    private multiplayerManager: MultiplayerManager;
    private multiplayerLobby: MultiplayerLobby | null = null;

    constructor() {
        super();
        this.hasCss = true;
        this.hasHtml = true;
        this.multiplayerManager = MultiplayerManager.getInstance();
    }

    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) {
            console.error('MainMenu: No root returned from super.connectedCallback');
            return root;
        }

        this.setupEventListeners(root);
        return root;
    }

    private setupEventListeners(root: ShadowRoot) {
        // Single player button
        const singlePlayerBtn = root.getElementById('singlePlayerBtn');
        if (singlePlayerBtn) {
            singlePlayerBtn.addEventListener('click', () => {
                this.startSinglePlayer();
            });
        } else {
            console.error('Single player button not found');
        }

        // Multiplayer button
        const multiplayerBtn = root.getElementById('multiplayerBtn');
        if (multiplayerBtn) {
            multiplayerBtn.addEventListener('click', () => {
                this.showMultiplayerLobby();
            });
        } else {
            console.error('Multiplayer button not found');
        }

        // Settings button (placeholder)
        const settingsBtn = root.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                console.log('Settings not implemented yet');
            });
        } else {
            console.error('Settings button not found');
        }
    }

    private startSinglePlayer() {
        this.multiplayerManager.switchToSinglePlayer();
        this.dispatchEvent(new CustomEvent('startSinglePlayer', { bubbles: true }));
        this.style.display = 'none';
    }

    private showMultiplayerLobby() {
        if (!this.multiplayerLobby) {
            this.multiplayerLobby = document.createElement('multiplayer-lobby') as MultiplayerLobby;
            document.body.appendChild(this.multiplayerLobby);

            // Listen for lobby events
            this.multiplayerLobby.addEventListener('lobbyGameStarted', () => {
                this.style.display = 'none';
                this.dispatchEvent(new CustomEvent('startMultiplayer', { bubbles: true }));
            });

            this.multiplayerLobby.addEventListener('lobbyClose', () => {
                this.show();
            });
        }

        this.multiplayerLobby.show();
        this.style.display = 'none';
    }

    show() {
        this.style.display = 'flex';
    }

    hide() {
        this.style.display = 'none';
    }
}

customElements.define('main-menu', MainMenu);