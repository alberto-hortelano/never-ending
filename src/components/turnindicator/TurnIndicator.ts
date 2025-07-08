import { StateChangeEvent, GameEvent } from "../../common/events";
import { Component } from "../Component";

export default class TurnIndicator extends Component {
    protected override hasCss = true;
    protected override hasHtml = true;
    private currentTurn: string = '';
    private players: string[] = [];

    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;

        // Get elements from HTML template
        const playerName = root.getElementById('player-name') as HTMLSpanElement;
        const endTurnButton = root.getElementById('end-turn-button') as HTMLButtonElement;
        
        if (playerName) {
            playerName.textContent = this.currentTurn || 'Loading...';
        }
        
        if (endTurnButton) {
            endTurnButton.addEventListener('click', () => {
                console.log('TurnIndicator', 'End turn button clicked');
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
            console.log('TurnIndicator', 'StateChangeEvent.game received', game);
            this.currentTurn = game.turn;
            this.players = [...game.players]; // Create a copy to avoid readonly issues
            
            const playerNameElement = root.getElementById('player-name') as HTMLSpanElement;
            if (playerNameElement) {
                playerNameElement.textContent = game.turn;
                playerNameElement.className = `player-name ${game.turn}`;
            }
        });

        return root;
    }
}

customElements.define('turn-indicator', TurnIndicator);