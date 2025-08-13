import { Component } from '../Component';
import { MultiplayerLobby } from '../multiplayerlobby/MultiplayerLobby';
import { MultiplayerManager } from '../../common/services/MultiplayerManager';
import CharacterCreator from '../charactercreator/CharacterCreator';
import { OriginSelection } from '../originselection/OriginSelection';
import { Settings } from '../settings/Settings';
import { ControlsEvent, StateChangeEvent } from '../../common/events/index';
import { i18n } from '../../common/i18n/i18n';

export class MainMenu extends Component {
    private multiplayerManager: MultiplayerManager;
    private multiplayerLobby: MultiplayerLobby | null = null;
    private characterCreator: CharacterCreator | null = null;
    private originSelection: OriginSelection | null = null;
    private settings: Settings | null = null;

    constructor() {
        super();
        this.hasCss = true;
        this.hasHtml = true;
        this.multiplayerManager = MultiplayerManager.getInstance();
        
        // Listen for character creator events
        this.listen(ControlsEvent.closeCharacterCreator, () => {
            this.show();
        });
        
        this.listen(ControlsEvent.createCharacter, (_characterData) => {
            // Here you would typically save the character or start the game with it
            this.show();
        });
        
        // Listen for origin selection
        this.listen(ControlsEvent.selectOrigin, (_origin) => {
            // Origin selected, start the game
            this.multiplayerManager.switchToSinglePlayer();
            this.dispatch('startSinglePlayer', {});
            this.style.display = 'none';
        });
        
        // Listen for language changes
        this.listen(StateChangeEvent.language, () => {
            this.updateTranslations();
        });
    }

    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) {
            console.error('MainMenu: No root returned from super.connectedCallback');
            return root;
        }

        this.setupEventListeners(root);
        this.updateTranslations();
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

        // Character Creator button
        const characterCreatorBtn = root.getElementById('characterCreatorBtn');
        if (characterCreatorBtn) {
            characterCreatorBtn.addEventListener('click', () => {
                this.showCharacterCreator();
            });
        } else {
            console.error('Character Creator button not found');
        }

        // Settings button (placeholder)
        const settingsBtn = root.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                this.showSettings();
            });
        } else {
            console.error('Settings button not found');
        }
    }

    private startSinglePlayer() {
        // Show origin selection screen
        if (!this.originSelection) {
            this.originSelection = document.createElement('origin-selection') as OriginSelection;
            document.body.appendChild(this.originSelection);
        }
        this.style.display = 'none';
    }

    private showMultiplayerLobby() {
        if (!this.multiplayerLobby) {
            this.multiplayerLobby = document.createElement('multiplayer-lobby') as MultiplayerLobby;
            document.body.appendChild(this.multiplayerLobby);

            // Listen for lobby events
            this.listen('lobbyGameStarted', () => {
                this.style.display = 'none';
                this.dispatch('startMultiplayer', {});
            });

            this.listen('lobbyClose', () => {
                this.show();
            });
        }

        this.multiplayerLobby.show();
        this.style.display = 'none';
    }

    private showCharacterCreator() {
        if (!this.characterCreator) {
            this.characterCreator = document.createElement('character-creator') as CharacterCreator;
            document.body.appendChild(this.characterCreator);
        }
        
        this.style.display = 'none';
    }

    private showSettings() {
        if (!this.settings) {
            this.settings = document.createElement('settings-component') as Settings;
            document.body.appendChild(this.settings);
            
            // Listen for settings close event
            this.settings.addEventListener('settingsClosed', () => {
                this.show();
            });
        }
        
        this.settings.show();
        this.style.display = 'none';
    }
    
    show() {
        this.style.display = 'flex';
    }

    hide() {
        this.style.display = 'none';
    }
    
    private updateTranslations() {
        const root = this.shadowRoot;
        if (!root) return;
        
        const singlePlayerBtn = root.getElementById('singlePlayerBtn');
        const multiplayerBtn = root.getElementById('multiplayerBtn');
        const characterCreatorBtn = root.getElementById('characterCreatorBtn');
        const settingsBtn = root.getElementById('settingsBtn');
        
        if (singlePlayerBtn) singlePlayerBtn.textContent = i18n.t('menu.singlePlayer');
        if (multiplayerBtn) multiplayerBtn.textContent = i18n.t('menu.multiplayer');
        if (characterCreatorBtn) characterCreatorBtn.textContent = i18n.t('menu.createCharacter');
        if (settingsBtn) settingsBtn.textContent = i18n.t('menu.settings');
    }
}

customElements.define('main-menu', MainMenu);