import { Component } from "../Component";
import { StateChangeEvent, GameEvent } from "../../common/events";
import type { DeepReadonly } from "../../common/helpers/types";
import type { IGame } from "../../common/interfaces";
import { NetworkService } from "../../common/services/NetworkService";

export default class TopBar extends Component {
    protected override hasCss = true;
    protected override hasHtml = true;
    
    private players: string[] = [];
    private currentTurn = '';
    private networkService: NetworkService = NetworkService.getInstance();
    
    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;
        
        this.setupEventListeners(root);
        return root;
    }
    
    private setupEventListeners(root: ShadowRoot) {
        const endTurnBtn = root.querySelector('#end-turn-button') as HTMLButtonElement;
        
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
        
        this.listen(StateChangeEvent.game, (game: DeepReadonly<IGame>) => {
            const playerNameElement = root.querySelector('#player-name');
            const endTurnBtn = root.querySelector('#end-turn-button') as HTMLButtonElement;
            
            if (game) {
                // Update internal state
                this.players = [...game.players];
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
                
                if (endTurnBtn) {
                    const networkPlayerId = this.networkService.getPlayerId();
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