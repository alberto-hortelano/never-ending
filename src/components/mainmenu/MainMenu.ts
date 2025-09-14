import { Component } from '../Component';
import { MultiplayerLobby } from '../multiplayerlobby/MultiplayerLobby';
import { MultiplayerManager } from '../../common/services/MultiplayerManager';
import CharacterCreator from '../charactercreator/CharacterCreator';
import { OriginSelection } from '../originselection/OriginSelection';
import { Settings } from '../settings/Settings';
import { ControlsEvent, StateChangeEvent } from '../../common/events/index';
import { i18n } from '../../common/i18n/i18n';
import { EnvironmentService } from '../../common/services/EnvironmentService';
import '../developmentui/DevelopmentUI';

export class MainMenu extends Component {
    private multiplayerManager: MultiplayerManager;
    private multiplayerLobby: MultiplayerLobby | null = null;
    private characterCreator: CharacterCreator | null = null;
    private originSelection: OriginSelection | null = null;
    private settings: Settings | null = null;
    private shadowRootRef: ShadowRoot | null = null;

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
        this.listen(ControlsEvent.selectOrigin, (origin) => {
            if (origin) {
                this.multiplayerManager.switchToSinglePlayer(origin);
                this.dispatch('startSinglePlayer', undefined as void);
                this.style.display = 'none';
            }
        });
        
        // Listen for language changes
        this.listen(StateChangeEvent.language, () => {
            this.updateTranslations();
        });
    }

    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;

        this.shadowRootRef = root;
        this.setupEventListeners(root);
        this.setupDevelopmentUI(root);
        this.updateTranslations();

        requestAnimationFrame(() => {
            this.updateTranslations();
        });

        return root;
    }

    private setupEventListeners(root: ShadowRoot): void {
        const buttons: Array<[string, () => void]> = [
            ['singlePlayerBtn', () => this.startSinglePlayer()],
            ['multiplayerBtn', () => this.showMultiplayerLobby()],
            ['characterCreatorBtn', () => this.showCharacterCreator()],
            ['settingsBtn', () => this.showSettings()]
        ];

        for (const [id, handler] of buttons) {
            const button = root.getElementById(id);
            if (button) {
                button.addEventListener('click', handler);
            }
        }
    }
    
    private setupDevelopmentUI(root: ShadowRoot): void {
        const devControls = root.querySelector('#dev-controls') as HTMLElement;
        if (devControls) {
            devControls.style.display = EnvironmentService.isDevelopment() ? 'block' : 'none';
        }
    }

    private startSinglePlayer(): void {
        if (!this.originSelection) {
            this.originSelection = document.createElement('origin-selection') as OriginSelection;
            document.body.appendChild(this.originSelection);
        }
        this.style.display = 'none';
    }

    private showMultiplayerLobby(): void {
        if (!this.multiplayerLobby) {
            this.multiplayerLobby = document.createElement('multiplayer-lobby') as MultiplayerLobby;
            document.body.appendChild(this.multiplayerLobby);
            this.setupLobbyListeners();
        }

        this.multiplayerLobby.show();
        this.style.display = 'none';
    }

    private setupLobbyListeners(): void {
        this.listen('lobbyGameStarted', () => {
            this.style.display = 'none';
            this.dispatch('startMultiplayer', undefined as void);
        });

        this.listen('lobbyClose', () => {
            this.show();
        });
    }

    private showCharacterCreator(): void {
        if (!this.characterCreator) {
            this.characterCreator = document.createElement('character-creator') as CharacterCreator;
            document.body.appendChild(this.characterCreator);
        }
        this.style.display = 'none';
    }

    private showSettings(): void {
        if (!this.settings) {
            this.settings = document.createElement('settings-component') as Settings;
            document.body.appendChild(this.settings);
            this.settings.addEventListener('settingsClosed', () => this.show());
        }
        this.settings.show();
        this.style.display = 'none';
    }

    public show(): void {
        this.style.display = 'flex';
    }

    public hide(): void {
        this.style.display = 'none';
    }
    
    private updateTranslations(): void {
        const root = this.shadowRootRef;
        if (!root) return;

        const translations: Array<[string, string]> = [
            ['singlePlayerBtn', 'menu.singlePlayer'],
            ['multiplayerBtn', 'menu.multiplayer'],
            ['characterCreatorBtn', 'menu.createCharacter'],
            ['settingsBtn', 'menu.settings']
        ];

        for (const [id, key] of translations) {
            const element = root.getElementById(id);
            if (element) {
                // Type assertion needed: key is string but i18n.t expects TranslationKey
                element.textContent = i18n.t(key as Parameters<typeof i18n.t>[0]);
            }
        }
    }
}

customElements.define('main-menu', MainMenu);