import { EventBus, StateChangeEvent, ControlsEvent, StateChangeEventsMap, ControlsEventsMap } from "../events";
import { State } from "../State";
import type { DeepReadonly } from "../helpers/types";
import type { IGame } from "../interfaces";
import { NetworkService } from "./NetworkService";

export class AutoSelectCharacter extends EventBus<StateChangeEventsMap & ControlsEventsMap, ControlsEventsMap> {
    private currentTurn: string = '';
    private networkService: NetworkService = NetworkService.getInstance();
    
    constructor(private state: State) {
        super();
        this.setupEventListeners();
        
        // Check if game already has a current turn set
        const currentGame = this.state.game;
        if (currentGame && currentGame.turn) {
            this.currentTurn = currentGame.turn;
            // Delay to ensure characters are loaded
            setTimeout(() => {
                this.checkAndAutoSelectCharacter(currentGame.turn);
            }, 200);
        }
    }
    
    private setupEventListeners(): void {
        // Listen for game state changes (turn changes)
        this.listen(StateChangeEvent.game, (game: DeepReadonly<IGame>) => {
            // Check if the turn has changed
            if (game.turn !== this.currentTurn) {
                this.currentTurn = game.turn;
                this.checkAndAutoSelectCharacter(game.turn);
            }
        });
        
        // Also listen for state characters to handle initial load
        this.listen(StateChangeEvent.characters, () => {
            if (this.currentTurn) {
                this.checkAndAutoSelectCharacter(this.currentTurn);
            }
        });
    }
    
    private checkAndAutoSelectCharacter(currentPlayer: string): void {
        // In multiplayer, only auto-select for the player whose turn it is
        const networkPlayerId = this.networkService.getPlayerId();
        if (networkPlayerId && currentPlayer !== networkPlayerId) {
            return;
        }
        
        // Get all characters for the current player
        const characters = this.state.characters;
        const playerCharacters = characters.filter(char => char.player === currentPlayer);
        
        // Only auto-select if the player has exactly one character
        if (playerCharacters.length === 1) {
            const character = playerCharacters[0];
            if (!character) return;
            
            // Small delay to ensure UI is ready
            setTimeout(() => {
                // Dispatch the showActions event to select the character
                this.dispatch(ControlsEvent.showActions, character.name);
            }, 500);
        }
    }
}