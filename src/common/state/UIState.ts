import type { 
    IState, IUIState, ICharacterAnimation, ICharacterVisualState, 
    ICellVisualState, IPopupState
} from "../interfaces";
import { EventBus, UpdateStateEventsMap, StateChangeEventsMap, UpdateStateEvent, StateChangeEvent } from "../events";
import { DeepReadonly } from "../helpers/types";

export class UIState extends EventBus<UpdateStateEventsMap, StateChangeEventsMap> {
    #ui: IState['ui'];

    constructor() {
        super();
        this.#ui = this.getInitialUIState();
        
        this.listen(UpdateStateEvent.uiCharacterAnimation, (data) => this.onUICharacterAnimation(data));
        this.listen(UpdateStateEvent.uiCharacterVisual, (data) => this.onUICharacterVisual(data));
        this.listen(UpdateStateEvent.uiCellVisual, (data) => this.onUICellVisual(data));
        this.listen(UpdateStateEvent.uiCellVisualBatch, (data) => this.onUICellVisualBatch(data));
        this.listen(UpdateStateEvent.uiBoardVisual, (data) => this.onUIBoardVisual(data));
        this.listen(UpdateStateEvent.uiPopup, (data) => this.onUIPopup(data));
        this.listen(UpdateStateEvent.uiAddProjectile, (data) => this.onUIAddProjectile(data));
        this.listen(UpdateStateEvent.uiRemoveProjectile, (data) => this.onUIRemoveProjectile(data));
        this.listen(UpdateStateEvent.uiHighlights, (data) => this.onUIHighlights(data));
        this.listen(UpdateStateEvent.uiInteractionMode, (data) => this.onUIInteractionMode(data));
    }

    private getInitialUIState(): IUIState {
        return {
            animations: {
                characters: {}
            },
            visualStates: {
                characters: {},
                cells: {},
                board: {
                    mapWidth: 0,
                    mapHeight: 0,
                    hasPopupActive: false
                }
            },
            transientUI: {
                popups: {},
                projectiles: [],
                highlights: {
                    reachableCells: [],
                    pathCells: [],
                    targetableCells: []
                }
            },
            interactionMode: {
                type: 'normal'
            }
        };
    }

    private onUICharacterAnimation(data: UpdateStateEventsMap[UpdateStateEvent.uiCharacterAnimation]) {
        if (data.animation) {
            this.#ui.animations.characters[data.characterId] = structuredClone(data.animation) as ICharacterAnimation;
        } else {
            delete this.#ui.animations.characters[data.characterId];
        }
        this.dispatch(StateChangeEvent.uiAnimations, structuredClone(this.#ui.animations));
    }

    private onUICharacterVisual(data: UpdateStateEventsMap[UpdateStateEvent.uiCharacterVisual]) {
        console.log(`[UIState] onUICharacterVisual called for ${data.characterId}`, data.visualState);
        console.log(`[UIState] Incoming isDefeated value: ${data.visualState.isDefeated}`);
        
        const currentVisual = this.#ui.visualStates.characters[data.characterId] || {
            direction: 'down',
            classList: [],
            temporaryClasses: [],
            weaponClass: undefined,
            styles: {},
            healthBarPercentage: 100,
            healthBarColor: '#4ade80',
            isDefeated: false,
            isCurrentTurn: false
        };

        console.log(`[UIState] Current visual state for ${data.characterId}:`, currentVisual);
        console.log(`[UIState] Current isDefeated value: ${currentVisual.isDefeated}`);

        // Start with current visual state to preserve all existing properties
        const updatedVisual = { ...currentVisual };
        
        // Check if this is a network update with a full visual state object
        const isNetworkUpdate = (data as any).fromNetwork === true;
        const hasFullVisualState = isNetworkUpdate && 
            data.visualState.direction !== undefined &&
            data.visualState.classList !== undefined &&
            data.visualState.styles !== undefined;
        
        if (hasFullVisualState) {
            // This is a full state sync from network - merge carefully
            console.log(`[UIState] Network sync for ${data.characterId} - preserving critical local state`);
            
            // Update all properties from network EXCEPT critical local-only state
            updatedVisual.direction = data.visualState.direction || 'down';
            updatedVisual.classList = data.visualState.classList ? [...data.visualState.classList] : [];
            updatedVisual.temporaryClasses = data.visualState.temporaryClasses ? [...data.visualState.temporaryClasses] : [];
            updatedVisual.weaponClass = data.visualState.weaponClass;
            updatedVisual.styles = data.visualState.styles || {};
            updatedVisual.healthBarPercentage = data.visualState.healthBarPercentage ?? updatedVisual.healthBarPercentage;
            updatedVisual.healthBarColor = data.visualState.healthBarColor || updatedVisual.healthBarColor;
            
            // If health is 0 from network sync, ensure defeated state is set
            if (updatedVisual.healthBarPercentage === 0 && !updatedVisual.isDefeated) {
                console.log(`[UIState] Network sync shows health is 0, marking ${data.characterId} as defeated`);
                updatedVisual.isDefeated = true;
            }
            updatedVisual.isCurrentTurn = data.visualState.isCurrentTurn ?? false;
            updatedVisual.isMyCharacter = data.visualState.isMyCharacter ?? false;
            updatedVisual.isOpponentCharacter = data.visualState.isOpponentCharacter ?? false;
            
            // CRITICAL: Preserve isDefeated state - it's determined by health/damage events, not visual sync
            // isDefeated is already preserved from currentVisual
            console.log(`[UIState] Preserved isDefeated=${updatedVisual.isDefeated} during network sync`);
        } else {
            // Normal partial update - only update provided properties
            if (data.visualState.direction !== undefined) {
                updatedVisual.direction = data.visualState.direction;
            }
            if (data.visualState.classList !== undefined) {
                updatedVisual.classList = [...data.visualState.classList];
            }
            if (data.visualState.temporaryClasses !== undefined) {
                updatedVisual.temporaryClasses = [...data.visualState.temporaryClasses];
            }
            if (data.visualState.weaponClass !== undefined) {
                updatedVisual.weaponClass = data.visualState.weaponClass;
            }
            if (data.visualState.styles !== undefined) {
                // Merge styles instead of replacing them entirely
                updatedVisual.styles = {
                    ...updatedVisual.styles,
                    ...data.visualState.styles
                };
            }
            if (data.visualState.healthBarPercentage !== undefined) {
                updatedVisual.healthBarPercentage = data.visualState.healthBarPercentage;
                // If health is 0, ensure defeated state is set
                if (data.visualState.healthBarPercentage === 0 && !updatedVisual.isDefeated) {
                    console.log(`[UIState] Health is 0, marking ${data.characterId} as defeated`);
                    updatedVisual.isDefeated = true;
                }
            }
            if (data.visualState.healthBarColor !== undefined) {
                updatedVisual.healthBarColor = data.visualState.healthBarColor;
            }
            // Only update isDefeated if explicitly provided (not from network sync)
            if (data.visualState.isDefeated !== undefined && !isNetworkUpdate) {
                updatedVisual.isDefeated = data.visualState.isDefeated;
                console.log(`[UIState] Explicitly setting isDefeated=${data.visualState.isDefeated} for ${data.characterId}`);
            }
            if (data.visualState.isCurrentTurn !== undefined) {
                updatedVisual.isCurrentTurn = data.visualState.isCurrentTurn;
            }
            if (data.visualState.isMyCharacter !== undefined) {
                updatedVisual.isMyCharacter = data.visualState.isMyCharacter;
            }
            if (data.visualState.isOpponentCharacter !== undefined) {
                updatedVisual.isOpponentCharacter = data.visualState.isOpponentCharacter;
            }
        }

        console.log(`[UIState] Final updated visual state for ${data.characterId}:`, updatedVisual);
        
        this.#ui.visualStates.characters[data.characterId] = updatedVisual as ICharacterVisualState;
        this.dispatch(StateChangeEvent.uiVisualStates, structuredClone(this.#ui.visualStates));
    }

    private onUICellVisual(data: UpdateStateEventsMap[UpdateStateEvent.uiCellVisual]) {
        if (data.visualState) {
            const currentVisual = this.#ui.visualStates.cells[data.cellKey] || {
                isHighlighted: false,
                classList: []
            };

            this.#ui.visualStates.cells[data.cellKey] = {
                ...currentVisual,
                ...data.visualState
            } as ICellVisualState;
        } else {
            delete this.#ui.visualStates.cells[data.cellKey];
        }

        this.dispatch(StateChangeEvent.uiVisualStates, structuredClone(this.#ui.visualStates));
    }

    private onUICellVisualBatch(data: UpdateStateEventsMap[UpdateStateEvent.uiCellVisualBatch]) {
        data.updates.forEach(update => {
            if (update.visualState) {
                this.#ui.visualStates.cells[update.cellKey] = update.visualState as ICellVisualState;
            } else {
                delete this.#ui.visualStates.cells[update.cellKey];
            }
        });

        this.dispatch(StateChangeEvent.uiVisualStates, structuredClone(this.#ui.visualStates));
    }

    private onUIBoardVisual(data: UpdateStateEventsMap[UpdateStateEvent.uiBoardVisual]) {
        this.#ui.visualStates.board = {
            ...this.#ui.visualStates.board,
            ...data.updates
        };

        this.dispatch(StateChangeEvent.uiVisualStates, structuredClone(this.#ui.visualStates));
    }

    private onUIPopup(data: UpdateStateEventsMap[UpdateStateEvent.uiPopup]) {
        if (data.popupState) {
            this.#ui.transientUI.popups[data.popupId] = structuredClone(data.popupState) as IPopupState;
        } else {
            delete this.#ui.transientUI.popups[data.popupId];
        }

        this.dispatch(StateChangeEvent.uiTransient, structuredClone(this.#ui.transientUI));
    }

    private onUIAddProjectile(data: UpdateStateEventsMap[UpdateStateEvent.uiAddProjectile]) {
        this.#ui.transientUI.projectiles.push(structuredClone(data));
        this.dispatch(StateChangeEvent.uiTransient, structuredClone(this.#ui.transientUI));
    }

    private onUIRemoveProjectile(data: UpdateStateEventsMap[UpdateStateEvent.uiRemoveProjectile]) {
        this.#ui.transientUI.projectiles = this.#ui.transientUI.projectiles.filter(
            p => p.id !== data.projectileId
        );
        this.dispatch(StateChangeEvent.uiTransient, structuredClone(this.#ui.transientUI));
    }

    private mergeHighlightTypes(
        existing: Array<'movement' | 'attack' | 'path' | 'overwatch'> | undefined,
        newType: 'movement' | 'attack' | 'path' | 'overwatch'
    ): Array<'movement' | 'attack' | 'path' | 'overwatch'> {
        const types = new Set(existing || []);
        types.add(newType);
        return Array.from(types) as Array<'movement' | 'attack' | 'path' | 'overwatch'>;
    }

    private onUIHighlights(data: UpdateStateEventsMap[UpdateStateEvent.uiHighlights]) {
        const previouslyHighlighted = new Set<string>();
        const overwatchCells = new Map<string, ICellVisualState>();

        Object.keys(this.#ui.visualStates.cells).forEach(cellKey => {
            const cell = this.#ui.visualStates.cells[cellKey];
            if (cell?.isHighlighted) {
                const isOverwatch = cell.highlightTypes?.includes('overwatch') || cell.highlightType === 'overwatch';
                if (isOverwatch) {
                    overwatchCells.set(cellKey, cell);
                } else {
                    previouslyHighlighted.add(cellKey);
                }
            }
        });

        this.#ui.transientUI.highlights = {
            ...this.#ui.transientUI.highlights,
            ...data
        } as any;

        const cellUpdates: Array<{ cellKey: string; visualState: Partial<ICellVisualState> | null }> = [];

        previouslyHighlighted.forEach(cellKey => {
            cellUpdates.push({ cellKey, visualState: null });
        });

        data.reachableCells?.forEach(coord => {
            const cellKey = `${coord.x},${coord.y}`;
            const existingOverwatch = overwatchCells.get(cellKey);

            if (existingOverwatch) {
                const mergedTypes = this.mergeHighlightTypes(existingOverwatch.highlightTypes, 'movement');
                cellUpdates.push({
                    cellKey,
                    visualState: {
                        isHighlighted: true,
                        highlightTypes: mergedTypes,
                        highlightIntensity: existingOverwatch.highlightIntensity,
                        classList: ['highlight']
                    }
                });
            } else {
                cellUpdates.push({
                    cellKey,
                    visualState: {
                        isHighlighted: true,
                        highlightTypes: ['movement'],
                        classList: ['highlight']
                    }
                });
            }
        });

        data.pathCells?.forEach(coord => {
            const cellKey = `${coord.x},${coord.y}`;
            const existingOverwatch = overwatchCells.get(cellKey);

            if (existingOverwatch) {
                cellUpdates.push({
                    cellKey,
                    visualState: {
                        isHighlighted: true,
                        highlightTypes: this.mergeHighlightTypes(existingOverwatch.highlightTypes, 'path'),
                        highlightIntensity: existingOverwatch.highlightIntensity,
                        classList: ['path']
                    }
                });
            } else {
                cellUpdates.push({
                    cellKey,
                    visualState: {
                        isHighlighted: true,
                        highlightTypes: ['path'],
                        classList: ['path']
                    }
                });
            }
        });

        data.targetableCells?.forEach(coord => {
            const cellKey = `${coord.x},${coord.y}`;
            const existingOverwatch = overwatchCells.get(cellKey);

            if (existingOverwatch) {
                cellUpdates.push({
                    cellKey,
                    visualState: {
                        isHighlighted: true,
                        highlightTypes: this.mergeHighlightTypes(existingOverwatch.highlightTypes, 'attack'),
                        highlightIntensity: existingOverwatch.highlightIntensity,
                        classList: ['highlight']
                    }
                });
            } else {
                cellUpdates.push({
                    cellKey,
                    visualState: {
                        isHighlighted: true,
                        highlightTypes: ['attack'],
                        classList: ['highlight']
                    }
                });
            }
        });

        overwatchCells.forEach((cell, cellKey) => {
            if (!cellUpdates.some(update => update.cellKey === cellKey)) {
                cellUpdates.push({
                    cellKey,
                    visualState: cell
                });
            }
        });

        if (cellUpdates.length > 0) {
            this.onUICellVisualBatch({ updates: cellUpdates });
        }

        this.dispatch(StateChangeEvent.uiTransient, structuredClone(this.#ui.transientUI));
    }

    private onUIInteractionMode(data: UpdateStateEventsMap[UpdateStateEvent.uiInteractionMode]) {
        this.#ui.interactionMode = structuredClone(data);
        this.dispatch(StateChangeEvent.uiInteractionMode, structuredClone(this.#ui.interactionMode));
    }

    updateCharacterDefeated(characterName: string) {
        console.log(`[UIState] updateCharacterDefeated called for ${characterName}`);
        
        // Get existing visual state or create a minimal one
        const existingState = this.#ui.visualStates.characters[characterName];
        
        if (existingState) {
            // Update existing state
            existingState.isDefeated = true;
            // Ensure health bar shows 0 for defeated characters
            existingState.healthBarPercentage = 0;
            existingState.healthBarColor = '#f44336';
            console.log(`[UIState] Set isDefeated=true for existing state of ${characterName}`, existingState);
        } else {
            // Create new visual state with defeated flag
            this.#ui.visualStates.characters[characterName] = {
                direction: 'down',
                classList: [],
                temporaryClasses: [],
                weaponClass: undefined,
                styles: {},
                healthBarPercentage: 0,
                healthBarColor: '#f44336',
                isDefeated: true,  // Set to true directly
                isCurrentTurn: false
            };
            console.log(`[UIState] Created new defeated state for ${characterName}`);
        }
        
        console.log(`[UIState] Dispatching StateChangeEvent.uiVisualStates with defeated state for ${characterName}`);
        this.dispatch(StateChangeEvent.uiVisualStates, structuredClone(this.#ui.visualStates));
    }

    clearTurnBasedUI() {
        this.#ui.transientUI.highlights = {
            reachableCells: [],
            pathCells: [],
            targetableCells: []
        };

        this.#ui.interactionMode = {
            type: 'normal'
        };

        const cellUpdates: Array<{ cellKey: string; visualState: Partial<ICellVisualState> | null }> = [];
        Object.keys(this.#ui.visualStates.cells).forEach(cellKey => {
            const cell = this.#ui.visualStates.cells[cellKey];
            const isOverwatch = cell?.highlightTypes?.includes('overwatch') || cell?.highlightType === 'overwatch';
            if (cell?.isHighlighted && !isOverwatch) {
                cellUpdates.push({ cellKey, visualState: null });
            }
        });

        if (cellUpdates.length > 0) {
            this.onUICellVisualBatch({ updates: cellUpdates });
        }

        this.dispatch(StateChangeEvent.uiTransient, structuredClone(this.#ui.transientUI));
        this.dispatch(StateChangeEvent.uiInteractionMode, structuredClone(this.#ui.interactionMode));
    }

    set ui(ui: IState['ui']) {
        this.#ui = ui;
        this.dispatch(StateChangeEvent.uiAnimations, structuredClone(this.#ui.animations));
        this.dispatch(StateChangeEvent.uiVisualStates, structuredClone(this.#ui.visualStates));
        this.dispatch(StateChangeEvent.uiTransient, structuredClone(this.#ui.transientUI));
        this.dispatch(StateChangeEvent.uiInteractionMode, structuredClone(this.#ui.interactionMode));
    }

    get ui(): DeepReadonly<IState['ui']> {
        return this.#ui;
    }
}