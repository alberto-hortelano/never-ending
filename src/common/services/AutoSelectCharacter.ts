import { EventBus, StateChangeEvent, ControlsEvent, StateChangeEventsMap, ControlsEventsMap } from "../events";
import { State } from "../State";
import type { DeepReadonly } from "../helpers/types";
import type { IGame } from "../interfaces";

export class AutoSelectCharacter extends EventBus<StateChangeEventsMap & ControlsEventsMap, ControlsEventsMap> {
    private currentTurn: string = '';
    
    constructor(private state: State) {
        super();
        console.log('[AutoSelectCharacter] Service initialized');
        this.setupEventListeners();
        
        // Check if game already has a current turn set
        const currentGame = this.state.game;
        if (currentGame && currentGame.turn) {
            console.log('[AutoSelectCharacter] Game already started with turn:', currentGame.turn);
            this.currentTurn = currentGame.turn;
            // Delay to ensure characters are loaded
            setTimeout(() => {
                this.checkAndAutoSelectCharacter(currentGame.turn);
            }, 200);
        }
    }
    
    private setupEventListeners(): void {
        console.log('[AutoSelectCharacter] Setting up event listeners');
        
        // Listen for game state changes (turn changes)
        this.listen(StateChangeEvent.game, (game: DeepReadonly<IGame>) => {
            console.log('[AutoSelectCharacter] Game state changed:', {
                currentTurn: game.turn,
                previousTurn: this.currentTurn,
                turnChanged: game.turn !== this.currentTurn
            });
            
            // Check if the turn has changed
            if (game.turn !== this.currentTurn) {
                this.currentTurn = game.turn;
                console.log('[AutoSelectCharacter] Turn changed to:', game.turn);
                this.checkAndAutoSelectCharacter(game.turn);
            }
        });
        
        // Also listen for state characters to handle initial load
        this.listen(StateChangeEvent.characters, () => {
            console.log('[AutoSelectCharacter] Characters state changed, currentTurn:', this.currentTurn);
            if (this.currentTurn) {
                this.checkAndAutoSelectCharacter(this.currentTurn);
            }
        });
    }
    
    private checkAndAutoSelectCharacter(currentPlayer: string): void {
        // Get all characters for the current player
        const characters = this.state.characters;
        console.log('[AutoSelectCharacter] All characters:', characters.map(c => ({
            name: c.name,
            player: c.player
        })));
        
        const playerCharacters = characters.filter(char => char.player === currentPlayer);
        console.log('[AutoSelectCharacter] Player characters for', currentPlayer, ':', 
            playerCharacters.map(c => c.name), 
            'Count:', playerCharacters.length
        );
        
        // Only auto-select if the player has exactly one character
        if (playerCharacters.length === 1) {
            const character = playerCharacters[0];
            if (!character) return;
            
            console.log('[AutoSelectCharacter] Auto-selecting character:', character.name);
            
            // Small delay to ensure UI is ready
            setTimeout(() => {
                console.log('[AutoSelectCharacter] Dispatching showActions for:', character.name);
                // Dispatch the showActions event to select the character
                this.dispatch(ControlsEvent.showActions, character.name);
            }, 500);
        } else {
            console.log('[AutoSelectCharacter] Not auto-selecting: player has', playerCharacters.length, 'characters');
        }
    }
}