import type { ICell, ICharacter, IState, IDoor } from "./interfaces";
import { EventBus, UpdateStateEventsMap, StateChangeEventsMap, StateChangeEvent, ControlsEventsMap, GameEvent, GameEventsMap, UpdateStateEvent } from "./events";
import { DeepReadonly } from "./helpers/types";
import { getBaseState } from '../data/state';

// Import sub-state modules
import { GameState } from './state/GameState';
import { MapState } from './state/MapState';
import { CharacterState } from './state/CharacterState';
import { MessageState } from './state/MessageState';
import { UIState } from './state/UIState';
import { OverwatchState } from './state/OverwatchState';
import { StoryState } from './state/StoryState';
import { LanguageState } from './state/LanguageState';
import { UIStateService } from './services/UIStateService';

export class State extends EventBus<UpdateStateEventsMap & GameEventsMap & StateChangeEventsMap, StateChangeEventsMap & ControlsEventsMap> {
    private readonly storageName = 'state';
    
    // Sub-state modules
    private gameState: GameState;
    private mapState: MapState;
    private characterState: CharacterState;
    private messageState: MessageState;
    private uiState: UIState;
    private uiStateService: UIStateService;
    private overwatchState: OverwatchState;
    private storyState: StoryState;
    private languageState: LanguageState;
    #doors: Record<string, IDoor> = {};

    constructor(initialState?: IState, isPreview = false) {
        super();
        
        // Initialize sub-state modules
        // For preview states, skip event dispatching to avoid affecting the main game
        this.gameState = new GameState(isPreview ? undefined : () => this.save(), isPreview);
        this.mapState = new MapState(isPreview ? undefined : () => this.save(), isPreview);
        this.characterState = new CharacterState(() => this.gameState.getCurrentTurn(), isPreview ? undefined : () => this.save(), isPreview);
        this.messageState = new MessageState(isPreview ? undefined : () => this.save());
        this.uiState = new UIState();
        // Only set up UIStateService for non-preview states
        // Preview states shouldn't process or dispatch UI events
        if (!isPreview) {
            this.uiStateService = new UIStateService(
                () => this.getInternalState(),
                () => this.uiState.getInternalUI(),
                (ui) => { this.uiState.ui = ui; }
            );
        } else {
            // Create a no-op service for preview mode that doesn't listen or dispatch
            // This creates a minimal stub that satisfies the interface
            const noOpState: IState = {
                game: { turn: '', players: [] },
                map: [],
                characters: [],
                messages: [],
                ui: { 
                    animations: { characters: {} }, 
                    visualStates: { characters: {}, cells: {}, board: { mapWidth: 0, mapHeight: 0, hasPopupActive: false } }, 
                    transientUI: { 
                        highlights: { reachableCells: [], pathCells: [], targetableCells: [] }, 
                        popups: {}, 
                        projectiles: [] 
                    }, 
                    interactionMode: { type: 'normal' } 
                },
                overwatchData: {}
            };
            this.uiStateService = new UIStateService(
                () => noOpState,
                () => noOpState.ui,
                () => {}
            );
        }
        this.overwatchState = new OverwatchState(() => this.save());
        this.storyState = new StoryState(isPreview ? undefined : () => this.save(), isPreview);
        this.languageState = new LanguageState(isPreview ? undefined : () => this.save(), isPreview);
        
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
        this.listen(StateChangeEvent.characterDefeated, (character) => {
            this.uiStateService.updateCharacterDefeated(character.name);
        });
        
        // Listen for door updates
        this.listen(UpdateStateEvent.doors, (newDoors) => {
            this.#doors = newDoors;
            this.dispatch(StateChangeEvent.doors, structuredClone(this.#doors));
            this.save();
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
    
    get story(): DeepReadonly<IState['story']> {
        return this.storyState.story;
    }
    
    get language(): DeepReadonly<IState['language']> {
        return this.languageState.language;
    }

    get doors(): DeepReadonly<Record<string, IDoor>> {
        return this.#doors;
    }

    // Method to get mutable state for internal use by trusted services
    getInternalState(): IState {
        return {
            game: this.gameState.getInternalGame(),
            map: this.mapState.getInternalMap(),
            characters: this.characterState.getInternalCharacters(),
            messages: this.messageState.getInternalMessages(),
            ui: this.uiState.getInternalUI(),
            overwatchData: this.overwatchState.getInternalOverwatchData(),
            story: this.storyState.getInternalStory(),
            language: this.languageState.getInternalLanguage(),
            doors: this.#doors
        };
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
        
        // Initialize doors if present
        if (state.doors) {
            this.#doors = state.doors;
            // Dispatch initial doors state so components can render them
            this.dispatch(StateChangeEvent.doors, structuredClone(this.#doors));
        }
        
        // Initialize language if present
        if (state.language) {
            this.languageState.deserialize(state.language);
        }
        
        // No need to complete initialization anymore since we handle events differently
    }
}