import { Component } from "../Component";
import { StateChangeEvent, GameEvent, ControlsEvent, ActionEvent } from "../../common/events";
import type { DeepReadonly } from "../../common/helpers/types";
import type { IGame, ICharacter } from "../../common/interfaces";
import { NetworkService } from "../../common/services/NetworkService";
import { i18n } from "../../common/i18n/i18n";
import { EnvironmentService } from "../../common/services/EnvironmentService";
import "../developmentui/DevelopmentUI";
import "../tooltip/Tooltip";

export default class TopBar extends Component {
    protected override hasCss = true;
    protected override hasHtml = true;
    
    private players: string[] = [];
    private currentTurn = '';
    private selectedCharacter = '';
    private networkService: NetworkService = NetworkService.getInstance();
    
    constructor() {
        super();
        // Listen for language changes
        this.listen(StateChangeEvent.language, () => {
            this.updateTranslations();
        });
    }
    
    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;
        
        // Show/hide development UI based on environment
        const devRow = root.querySelector('#dev-row') as HTMLElement;
        if (devRow) {
            if (EnvironmentService.isDevelopment()) {
                devRow.style.display = 'block';
            } else {
                devRow.style.display = 'none';
            }
        }
        
        // Initialize from state if available
        const state = this.getState();
        if (state) {
            this.players = [...state.game.players];
            this.currentTurn = state.game.turn;
            
            // Update UI with initial state
            const playerNameElement = root.querySelector('#player-name');
            if (playerNameElement) {
                const playerName = state.game.playerInfo?.[state.game.turn]?.name || state.game.turn || i18n.t('common.loading');
                playerNameElement.textContent = playerName;
                
                const isAI = state.game.playerInfo?.[state.game.turn]?.isAI;
                if (isAI) {
                    playerNameElement.classList.add('ai');
                    playerNameElement.classList.remove('human');
                } else {
                    playerNameElement.classList.add('human');
                    playerNameElement.classList.remove('ai');
                }
            }
        }
        
        this.setupEventListeners(root);
        this.updateTranslations();
        return root;
    }
    
    private setupEventListeners(root: ShadowRoot) {
        const endTurnBtn = root.querySelector('#end-turn-button') as HTMLButtonElement;
        const selectedCharacterElement = root.querySelector('#selected-character') as HTMLElement;
        
        if (endTurnBtn) {
            endTurnBtn.addEventListener('click', () => {
                // Calculate next turn
                const currentIndex = this.players.indexOf(this.currentTurn);
                const nextIndex = (currentIndex + 1) % this.players.length;
                const nextTurn = this.players[nextIndex] || this.currentTurn;

                // Dispatch change turn event
                this.eventBus.dispatch(GameEvent.changeTurn, {
                    turn: nextTurn,
                    previousTurn: this.currentTurn
                });
            });
        }
        
        
        // Listen for character selection
        this.listen(ControlsEvent.showActions, (characterName: string) => {
            this.selectedCharacter = characterName;
            if (selectedCharacterElement) {
                selectedCharacterElement.textContent = characterName;
            }
        });
        
        // Listen for action points updates
        const actionPointsElement = root.querySelector('#action-points') as HTMLElement;
        const pointsBarElement = root.querySelector('#points-bar') as HTMLElement;
        const pointsTextElement = root.querySelector('#points-text') as HTMLElement;
        
        const pointsPendingElement = root.querySelector('#points-bar-pending') as HTMLElement;
        
        this.listen(ActionEvent.update, (data) => {
            // Only show action points for the selected character
            if (data.characterName === this.selectedCharacter && actionPointsElement && pointsBarElement && pointsTextElement) {
                const pointsLeft = data.characterActions.pointsLeft;
                const pendingCost = data.characterActions.pendingCost || 0;
                const percentage = pointsLeft; // Since max is 100, points = percentage
                
                // Update the points bar
                pointsBarElement.style.setProperty('--points-percentage', `${percentage}%`);
                pointsTextElement.textContent = `${i18n.t('topbar.actionPoints')} ${pointsLeft}`;
                
                // Update pending cost overlay
                if (pointsPendingElement && pendingCost > 0) {
                    const pendingPercentage = pendingCost; // Since max is 100
                    const pendingPosition = Math.max(0, percentage - pendingPercentage);
                    pointsPendingElement.style.setProperty('--pending-percentage', `${pendingPercentage}%`);
                    pointsPendingElement.style.setProperty('--pending-position', `${pendingPosition}%`);
                    pointsPendingElement.classList.add('visible');
                } else if (pointsPendingElement) {
                    pointsPendingElement.classList.remove('visible');
                }
                
                // Show the action points display
                actionPointsElement.classList.add('visible');
            }
        });
        
        // Listen for character actions changes (includes pending cost)
        this.listen(StateChangeEvent.characterActions, (character: DeepReadonly<ICharacter>) => {
            // Only update if it's the selected character
            if (character.name === this.selectedCharacter && actionPointsElement && pointsBarElement && pointsTextElement) {
                const pointsLeft = character.actions.pointsLeft;
                const pendingCost = character.actions.pendingCost || 0;
                const percentage = pointsLeft; // Since max is 100, points = percentage
                
                // Update the points bar
                pointsBarElement.style.setProperty('--points-percentage', `${percentage}%`);
                pointsTextElement.textContent = `${i18n.t('topbar.actionPoints')} ${pointsLeft}`;
                
                // Update pending cost overlay
                if (pointsPendingElement && pendingCost > 0) {
                    const pendingPercentage = pendingCost; // Since max is 100
                    const pendingPosition = Math.max(0, percentage - pendingPercentage);
                    pointsPendingElement.style.setProperty('--pending-percentage', `${pendingPercentage}%`);
                    pointsPendingElement.style.setProperty('--pending-position', `${pendingPosition}%`);
                    pointsPendingElement.classList.add('visible');
                } else if (pointsPendingElement) {
                    pointsPendingElement.classList.remove('visible');
                }
            }
        });
        
        this.listen(StateChangeEvent.game, (game: DeepReadonly<IGame>) => {
            const playerNameElement = root.querySelector('#player-name');
            const endTurnBtn = root.querySelector('#end-turn-button') as HTMLButtonElement;
            const selectedCharacterElement = root.querySelector('#selected-character') as HTMLElement;
            const currentPlayerElement = root.querySelector('#current-player') as HTMLElement;
            
            if (game) {
                // Update internal state
                this.players = [...game.players];
                
                // Clear selected character and hide action points if turn changed
                if (this.currentTurn !== game.turn) {
                    this.selectedCharacter = '';
                    if (selectedCharacterElement) {
                        selectedCharacterElement.textContent = '';
                    }
                    if (actionPointsElement) {
                        actionPointsElement.classList.remove('visible');
                    }
                }
                
                this.currentTurn = game.turn;
                
                if (playerNameElement) {
                    // Get the actual player name from playerInfo
                    const playerName = game.playerInfo?.[game.turn]?.name || game.turn || i18n.t('common.loading');
                    playerNameElement.textContent = playerName;
                    
                    // Check if the current player is AI
                    const isAI = game.playerInfo?.[game.turn]?.isAI;
                    
                    if (isAI) {
                        playerNameElement.classList.add('ai');
                        playerNameElement.classList.remove('human');
                    } else {
                        playerNameElement.classList.add('human');
                        playerNameElement.classList.remove('ai');
                    }
                }
                
                const networkPlayerId = this.networkService.getPlayerId();
                
                // Update current player display for multiplayer
                if (currentPlayerElement && networkPlayerId) {
                    const currentPlayerName = game.playerInfo?.[networkPlayerId]?.name || networkPlayerId;
                    currentPlayerElement.textContent = currentPlayerName;
                } else if (currentPlayerElement) {
                    // In single player, show the current player name
                    const currentPlayerName = game.playerInfo?.[game.turn]?.name || game.turn;
                    currentPlayerElement.textContent = currentPlayerName;
                }
                
                if (endTurnBtn) {
                    if (networkPlayerId) {
                        // Multiplayer: only show button if it's this player's turn
                        endTurnBtn.style.display = game.turn === networkPlayerId ? 'block' : 'none';
                    } else {
                        // Single player: always show
                        endTurnBtn.style.display = 'block';
                    }
                }
            }
        });
    }
    
    private updateTranslations() {
        const root = this.shadowRoot;
        if (!root) return;
        
        // Update campaign button
        const campaignBtn = root.querySelector('#campaign-button');
        if (campaignBtn) campaignBtn.textContent = i18n.t('topbar.campaign');
        
        // Update map button
        const mapBtn = root.querySelector('#map-button');
        if (mapBtn) mapBtn.textContent = i18n.t('topbar.map');
        
        // Update end turn button
        const endTurnBtn = root.querySelector('#end-turn-button');
        if (endTurnBtn) endTurnBtn.textContent = i18n.t('topbar.endTurn');
        
        // Update action points text
        const pointsText = root.querySelector('#points-text');
        if (pointsText && pointsText.textContent) {
            const match = pointsText.textContent.match(/\d+/);
            if (match) {
                pointsText.textContent = i18n.t('topbar.actionPoints') + ' ' + match[0];
            }
        }
        
        // Update current turn label
        const turnLabel = root.querySelector('.turn-label');
        if (turnLabel) turnLabel.textContent = i18n.t('topbar.currentTurn');
        
        // Update loading text if present
        const loadingText = root.querySelector('.loading-text');
        if (loadingText) loadingText.textContent = i18n.t('topbar.loading');
        
        // Set initial player name if empty
        const playerName = root.querySelector('#player-name');
        if (playerName && !playerName.textContent) {
            playerName.textContent = i18n.t('common.loading');
        }
        
        // Set initial action points text if empty
        const pointsTextEl = root.querySelector('#points-text');
        if (pointsTextEl && !pointsTextEl.textContent) {
            pointsTextEl.textContent = `${i18n.t('topbar.actionPoints')} 0`;
        }
    }
    
    // Support for Playwright tests
    public override getTestingShadowRoot() {
        if ((window as any).__PLAYWRIGHT_TEST__) {
            return this.shadowRoot;
        }
        return null;
    }
}

customElements.define('top-bar', TopBar);