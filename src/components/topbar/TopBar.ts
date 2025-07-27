import { Component } from "../Component";
import { StateChangeEvent, GameEvent, ControlsEvent, ActionEvent } from "../../common/events";
import type { DeepReadonly } from "../../common/helpers/types";
import type { IGame } from "../../common/interfaces";
import { NetworkService } from "../../common/services/NetworkService";

export default class TopBar extends Component {
    protected override hasCss = true;
    protected override hasHtml = true;
    
    private players: string[] = [];
    private currentTurn = '';
    private selectedCharacter = '';
    private networkService: NetworkService = NetworkService.getInstance();
    
    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;
        
        this.setupEventListeners(root);
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
        
        this.listen(ActionEvent.update, (data) => {
            // Only show action points for the selected character
            if (data.characterName === this.selectedCharacter && actionPointsElement && pointsBarElement && pointsTextElement) {
                const pointsLeft = data.characterActions.pointsLeft;
                const percentage = pointsLeft; // Since max is 100, points = percentage
                
                // Update the points bar
                pointsBarElement.style.setProperty('--points-percentage', `${percentage}%`);
                pointsTextElement.textContent = `Action Points: ${pointsLeft}`;
                
                // Show the action points display
                actionPointsElement.classList.add('visible');
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
                    const playerName = game.playerInfo?.[game.turn]?.name || game.turn || 'Loading...';
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
}

customElements.define('top-bar', TopBar);