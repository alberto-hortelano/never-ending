import type { ICell, ICharacter, IState, IUIState } from "./interfaces";
import { EventBus, UpdateStateEventsMap, StateChangeEventsMap, StateChangeEvent, ControlsEventsMap, GameEvent, GameEventsMap } from "./events";
import { DeepReadonly } from "./helpers/types";
import { getBaseState } from '../data/state';

// Import sub-state modules
import { GameState } from './state/GameState';
import { MapState } from './state/MapState';
import { CharacterState } from './state/CharacterState';
import { MessageState } from './state/MessageState';
import { UIState } from './state/UIState';
import { OverwatchState } from './state/OverwatchState';
import { UIStateService } from './services/UIStateService';

export class State extends EventBus<UpdateStateEventsMap & GameEventsMap, StateChangeEventsMap & ControlsEventsMap> {
    private readonly storageName = 'state';
    
    // Sub-state modules
    private gameState: GameState;
    private mapState: MapState;
    private characterState: CharacterState;
    private messageState: MessageState;
    private uiState: UIState;
    private uiStateService: UIStateService;
    private overwatchState: OverwatchState;

    constructor(initialState?: IState) {
        super();
        
        // Initialize sub-state modules
        this.gameState = new GameState(() => this.save());
        this.mapState = new MapState(() => this.save());
        this.characterState = new CharacterState(() => this.gameState.getCurrentTurn(), () => this.save());
        this.messageState = new MessageState(() => this.save());
        this.uiState = new UIState();
        this.uiStateService = new UIStateService(
            () => ({
                game: this.game,
                map: this.map,
                characters: this.characters,
                messages: this.messages,
                ui: this.ui,
                overwatchData: this.overwatchData
            } as IState),
            () => this.uiState.ui as IUIState,
            (ui) => { this.uiState.ui = ui; }
        );
        this.overwatchState = new OverwatchState(() => this.save());
        
        // Load initial state
        this.load(initialState);
        
        // Handle turn changes - coordinate between sub-states
        this.listen(GameEvent.changeTurn, (data) => {
            // Clear UI state for turn change
            this.uiStateService.clearTurnBasedUI();
            
            // Reset action points for the new turn
            this.characterState.resetActionPointsForTurn(data.turn);
            
            // Save state after turn change
            this.save();
        });
        
        // Handle character defeat - coordinate between character and UI state
        // Since all EventBus instances share listeners, we can listen on 'this'
        this.listen(StateChangeEvent.characterDefeated as any, (character: any) => {
            this.uiStateService.updateCharacterDefeated(character.name);
        });
    }

    // Getters - expose the same interface as before
    get game(): DeepReadonly<IState['game']> {
        return this.gameState.game;
    }

    get map(): DeepReadonly<IState['map']> {
        return this.mapState.map;
    }

    get characters(): DeepReadonly<IState['characters']> {
        return this.characterState.characters;
    }

    get messages(): DeepReadonly<IState['messages']> {
        return this.messageState.messages;
    }

    get ui(): DeepReadonly<IState['ui']> {
        return this.uiState.ui;
    }

    get overwatchData(): DeepReadonly<IState['overwatchData']> {
        return this.overwatchState.overwatchData;
    }

    // Public helper methods
    findCharacter(name: ICharacter['name']): DeepReadonly<ICharacter> | undefined {
        return this.characterState.getCharacter(name);
    }

    findCell(coord: ICell['position']): DeepReadonly<ICell> | undefined {
        return this.mapState.findCell(coord);
    }

    // Storage methods
    private save() {
        // TODO: Implement if needed
        // const state: IState = {
        //     game: this.gameState.game,
        //     map: this.mapState.map,
        //     characters: this.characterState.characters,
        //     messages: this.messageState.messages,
        //     ui: this.uiState.ui,
        //     overwatchData: this.overwatchState.overwatchData
        // };
        // localStorage.setItem(this.storageName, JSON.stringify(state));
    }

    private load(initialState?: IState) {
        let state = initialState;
        if (!state) {
            try {
                const raw = localStorage.getItem(this.storageName);
                state ||= raw && JSON.parse(raw);
            } catch (error) {
                console.error('State#constructor - localStorage parse error:', error);
            }
        }
        state ||= getBaseState();
        
        // Initialize sub-states with loaded data
        this.gameState.game = state.game;
        this.mapState.map = state.map;
        this.characterState.characters = state.characters;
        this.messageState.messages = state.messages;
        this.uiState.ui = state.ui || this.uiState.ui;
        
        // Initialize overwatch data if present
        if (state.overwatchData) {
            this.overwatchState.overwatchData = state.overwatchData;
        }
    }
}