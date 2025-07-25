import { StateChangeEvent, GameEvent } from "../../common/events";
import { Component } from "../Component";
import { NetworkService } from "../../common/services/NetworkService";

export default class TurnIndicator extends Component {
    protected override hasCss = true;
    protected override hasHtml = true;
    private currentTurn: string = '';
    private players: string[] = [];
    private playerInfo: Record<string, { name: string; isAI?: boolean }> = {};
    private networkService: NetworkService = NetworkService.getInstance();

    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;

        // Get elements from HTML template
        const playerName = root.getElementById('player-name') as HTMLSpanElement;
        const endTurnButton = root.getElementById('end-turn-button') as HTMLButtonElement;

        if (playerName) {
            const displayName = this.playerInfo[this.currentTurn]?.name || this.currentTurn || 'Loading...';
            playerName.textContent = displayName;
        }

        if (endTurnButton) {
            // Initially hide the button until we know whose turn it is
            const networkPlayerId = this.networkService.getPlayerId();
            if (networkPlayerId) {
                endTurnButton.style.display = 'none';
            }
            
            endTurnButton.addEventListener('click', () => {
                // Calculate next turn
                const currentIndex = this.players.indexOf(this.currentTurn);
                const nextIndex = (currentIndex + 1) % this.players.length;
                const nextTurn = this.players[nextIndex] || this.currentTurn;

                // Dispatch change turn event directly
                this.dispatch(GameEvent.changeTurn, {
                    turn: nextTurn,
                    previousTurn: this.currentTurn
                });
            });
        }

        // Listen for game state changes
        this.listen(StateChangeEvent.game, (game) => {
            this.currentTurn = game.turn;
            this.players = [...game.players]; // Create a copy to avoid readonly issues
            this.playerInfo = game.playerInfo || {};

            const playerNameElement = root.getElementById('player-name') as HTMLSpanElement;
            const endTurnBtn = root.getElementById('end-turn-button') as HTMLButtonElement;
            
            if (playerNameElement) {
                const displayName = this.playerInfo[game.turn]?.name || game.turn;
                playerNameElement.textContent = displayName;
                playerNameElement.className = `player-name ${game.turn}`;
            }
            
            // Show/hide end turn button based on whether it's this player's turn
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
        });

        return root;
    }
}

customElements.define('turn-indicator', TurnIndicator);