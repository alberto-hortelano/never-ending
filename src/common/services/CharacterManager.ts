import type { DeepReadonly } from "../helpers/types";
import type { ICharacter } from "../interfaces";
import { EventBus, ControlsEvent, UpdateStateEvent, StateChangeEvent, ControlsEventsMap, UpdateStateEventsMap, StateChangeEventsMap } from "../events";
import { MultiplayerManager } from "./MultiplayerManager";

export class CharacterManager extends EventBus<
    ControlsEventsMap & StateChangeEventsMap,
    UpdateStateEventsMap & ControlsEventsMap
> {
    private currentSelectedCharacter: DeepReadonly<ICharacter> | null = null;
    private playerCharacters: DeepReadonly<ICharacter[]> = [];

    constructor() {
        super();
        
        // Listen for character selection from UI
        this.listen(ControlsEvent.selectCharacter, (character) => this.onSelectCharacter(character));
        this.listen(ControlsEvent.deselectCharacter, () => this.onDeselectCharacter());
        
        // Listen for state changes to track available characters
        this.listen(StateChangeEvent.characters, (characters) => this.onCharactersChanged(characters));
        this.listen(StateChangeEvent.selectedCharacter, (character) => this.onSelectedCharacterChanged(character));
        
        // Listen for character click events
        this.listen(ControlsEvent.characterClick, (data) => this.onCharacterClick(data));
    }

    private onCharactersChanged(characters: StateChangeEventsMap[StateChangeEvent.characters]) {
        // Get current player ID for multiplayer
        const multiplayerManager = (window as any).multiplayerManager || MultiplayerManager.getInstance();
        const currentPlayerId = multiplayerManager.getCurrentPlayerId();
        const isMultiplayer = multiplayerManager.isInMultiplayerMode();
        
        // Filter characters that belong to the current player
        if (isMultiplayer && currentPlayerId) {
            // In multiplayer, filter by the specific player ID
            this.playerCharacters = characters.filter(char => char.player === currentPlayerId);
        } else {
            // In single player, filter for human-controlled characters
            this.playerCharacters = characters.filter(char => char.player === 'human');
        }
        
        // Auto-select if only one character
        if (this.playerCharacters.length === 1 && !this.currentSelectedCharacter) {
            const singleCharacter = this.playerCharacters[0];
            if (singleCharacter) {
                // Delay the auto-selection to ensure State is ready
                setTimeout(() => {
                    this.selectCharacter(singleCharacter);
                }, 100);
            }
        }
    }

    private onSelectedCharacterChanged(character: StateChangeEventsMap[StateChangeEvent.selectedCharacter]) {
        this.currentSelectedCharacter = character;
        
        // If a character is selected, pre-select movement action
        if (character) {
            // Dispatch show movement event to highlight reachable cells
            this.dispatch(ControlsEvent.showMovement, character.name);
        }
    }

    private onCharacterClick(data: ControlsEventsMap[ControlsEvent.characterClick]) {
        // Check if this is a player-controlled character
        const isPlayerCharacter = this.playerCharacters.some(char => char.name === data.characterName);
        
        if (isPlayerCharacter) {
            const clickedCharacter = this.playerCharacters.find(char => char.name === data.characterName);
            if (clickedCharacter) {
                // If clicking the currently selected character, show interaction popup
                if (this.currentSelectedCharacter?.name === data.characterName) {
                    // Dispatch a talk action which will show the confirmation popup
                    this.dispatch(ControlsEvent.talk, data.characterName);
                    return;
                }
                
                // Otherwise, select the clicked character
                this.selectCharacter(clickedCharacter);
            }
        } else {
            // Check if it's a non-player character (NPC) or object
            // For now, dispatch use action for objects
            this.dispatch(ControlsEvent.use, data.characterName);
        }
    }

    private onSelectCharacter(character: ControlsEventsMap[ControlsEvent.selectCharacter]) {
        this.selectCharacter(character);
    }

    private selectCharacter(character: DeepReadonly<ICharacter>) {
        // Update state with selected character
        this.dispatch(UpdateStateEvent.selectCharacter, character);
    }

    private onDeselectCharacter() {
        // Clear selected character
        this.dispatch(UpdateStateEvent.deselectCharacter, null);
    }

    // Public method to get current selected character
    public getSelectedCharacter(): DeepReadonly<ICharacter> | null {
        return this.currentSelectedCharacter;
    }

    // Public method to check if a character is selected
    public isCharacterSelected(characterName: string): boolean {
        return this.currentSelectedCharacter?.name === characterName;
    }
}

// Create singleton instance
export const characterManager = new CharacterManager();