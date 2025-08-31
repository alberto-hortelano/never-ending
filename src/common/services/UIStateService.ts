import type {
    ICellVisualState, IPopupState,
    IState, IUIState, IProjectileState, ICoord
} from "../interfaces";
import { EventBus, UpdateStateEventsMap, StateChangeEventsMap, UpdateStateEvent, StateChangeEvent } from "../events";
import { InteractionModeManager } from "../InteractionModeManager";

interface CellVisualUpdate {
    cellKey: string;
    visualState: Partial<ICellVisualState> | null;
}

// Extended type for network updates
type UICharacterVisualData = UpdateStateEventsMap[UpdateStateEvent.uiCharacterVisual];
interface UICharacterVisualWithNetwork extends UICharacterVisualData {
    fromNetwork?: boolean;
}

export class UIStateService extends EventBus<UpdateStateEventsMap, StateChangeEventsMap> {
    private getFullState: () => IState;
    private getUIState: () => IUIState;
    private setUIState: (ui: IUIState) => void;

    constructor(getFullState: () => IState, getUIState: () => IUIState, setUIState: (ui: IUIState) => void) {
        super();
        this.getFullState = getFullState;
        this.getUIState = getUIState;
        this.setUIState = setUIState;

        // Ensure InteractionModeManager singleton is initialized
        InteractionModeManager.getInstance();

        this.listen(UpdateStateEvent.uiCharacterAnimation, (data) => {
            this.onUICharacterAnimation(data);
        });
        this.listen(UpdateStateEvent.uiCharacterVisual, (data) => {
            this.onUICharacterVisual(data);

        });
        this.listen(UpdateStateEvent.uiCellVisual, (data) => {
            this.onUICellVisual(data);

        });
        this.listen(UpdateStateEvent.uiCellVisualBatch, (data) => {
            this.onUICellVisualBatch(data);

        });
        this.listen(UpdateStateEvent.uiBoardVisual, (data) => {
            this.onUIBoardVisual(data);

        });
        this.listen(UpdateStateEvent.uiPopup, (data) => {
            this.onUIPopup(data);

        });
        this.listen(UpdateStateEvent.uiAddProjectile, (data) => {
            this.onUIAddProjectile(data);

        });
        this.listen(UpdateStateEvent.uiRemoveProjectile, (data) => {
            this.onUIRemoveProjectile(data);

        });
        this.listen(UpdateStateEvent.uiHighlights, (data) => {
            this.onUIHighlights(data);

        });
        this.listen(UpdateStateEvent.uiInteractionMode, (data) => {
            this.onUIInteractionMode(data);

        });
        this.listen(UpdateStateEvent.uiSelectedCharacter, (characterName) => {
            this.onUISelectedCharacter(characterName);

        });
    }

    private onUICharacterAnimation(data: UpdateStateEventsMap[UpdateStateEvent.uiCharacterAnimation]) {
        const uiState = this.getUIState();
        if (data.animation) {
            // Cast needed because structuredClone returns DeepReadonly type
            uiState.animations.characters[data.characterId] = structuredClone(data.animation) as typeof uiState.animations.characters[string];
        } else {
            delete uiState.animations.characters[data.characterId];
        }
        this.setUIState(uiState);
        this.dispatch(StateChangeEvent.uiAnimations, structuredClone(uiState.animations));
    }

    private onUICharacterVisual(data: UpdateStateEventsMap[UpdateStateEvent.uiCharacterVisual]) {
        const uiState = this.getUIState();
        const currentVisual = uiState.visualStates.characters[data.characterId] || {
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

        // Start with current visual state to preserve all existing properties
        const updatedVisual = { ...currentVisual };

        // Check if this is a network update with a full visual state object
        const isNetworkUpdate = (data as UICharacterVisualWithNetwork).fromNetwork === true;
        const hasFullVisualState = isNetworkUpdate &&
            data.visualState.direction !== undefined &&
            data.visualState.classList !== undefined &&
            data.visualState.styles !== undefined;

        if (hasFullVisualState) {
            // This is a full state sync from network - merge carefully
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
                updatedVisual.isDefeated = true;
            }
            updatedVisual.isCurrentTurn = data.visualState.isCurrentTurn ?? false;
            updatedVisual.isMyCharacter = data.visualState.isMyCharacter ?? false;
            updatedVisual.isOpponentCharacter = data.visualState.isOpponentCharacter ?? false;

            // CRITICAL: Preserve isDefeated state - it's determined by health/damage events, not visual sync
            // isDefeated is already preserved from currentVisual
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
                    updatedVisual.isDefeated = true;
                }
            }
            if (data.visualState.healthBarColor !== undefined) {
                updatedVisual.healthBarColor = data.visualState.healthBarColor;
            }
            // Only update isDefeated if explicitly provided (not from network sync)
            if (data.visualState.isDefeated !== undefined && !isNetworkUpdate) {
                updatedVisual.isDefeated = data.visualState.isDefeated;
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

        uiState.visualStates.characters[data.characterId] = updatedVisual;
        this.setUIState(uiState);
        this.dispatch(StateChangeEvent.uiVisualStates, structuredClone(uiState.visualStates));
    }

    private onUICellVisual(data: UpdateStateEventsMap[UpdateStateEvent.uiCellVisual]) {
        const uiState = this.getUIState();
        if (data.visualState) {
            const currentVisual = uiState.visualStates.cells[data.cellKey] || {
                isHighlighted: false,
                classList: []
            };

            uiState.visualStates.cells[data.cellKey] = {
                ...currentVisual,
                ...data.visualState
            } as ICellVisualState;
        } else {
            delete uiState.visualStates.cells[data.cellKey];
        }

        this.setUIState(uiState);
        this.dispatch(StateChangeEvent.uiVisualStates, structuredClone(uiState.visualStates));
    }

    private onUICellVisualBatch(data: UpdateStateEventsMap[UpdateStateEvent.uiCellVisualBatch]) {
        const uiState = this.getUIState();

        // Update state and dispatch targeted events to individual cells
        data.updates.forEach(update => {
            if (update.visualState) {
                uiState.visualStates.cells[update.cellKey] = update.visualState as ICellVisualState;
            } else {
                delete uiState.visualStates.cells[update.cellKey];
            }

            // Dispatch targeted update to ONLY this specific cell using filter
            this.dispatch(
                StateChangeEvent.uiCellUpdate,
                { visualState: update.visualState as ICellVisualState | null },
                update.cellKey // Use cellKey as filter - only the cell with this key will receive it
            );
        });

        this.setUIState(uiState);
    }

    private onUIBoardVisual(data: UpdateStateEventsMap[UpdateStateEvent.uiBoardVisual]) {
        const uiState = this.getUIState();
        uiState.visualStates.board = {
            ...uiState.visualStates.board,
            ...data.updates
        };

        this.setUIState(uiState);
        this.dispatch(StateChangeEvent.uiVisualStates, structuredClone(uiState.visualStates));
    }

    private onUIPopup(data: UpdateStateEventsMap[UpdateStateEvent.uiPopup]) {
        const uiState = this.getUIState();
        if (data.popupState) {
            uiState.transientUI.popups[data.popupId] = structuredClone(data.popupState) as IPopupState;
        } else {
            delete uiState.transientUI.popups[data.popupId];
        }

        this.setUIState(uiState);
        this.dispatch(StateChangeEvent.uiTransient, structuredClone(uiState.transientUI));
    }

    private onUIAddProjectile(data: UpdateStateEventsMap[UpdateStateEvent.uiAddProjectile]) {
        const uiState = this.getUIState();
        uiState.transientUI.projectiles.push(structuredClone(data));
        this.setUIState(uiState);
        this.dispatch(StateChangeEvent.uiTransient, structuredClone(uiState.transientUI));
    }

    private onUIRemoveProjectile(data: UpdateStateEventsMap[UpdateStateEvent.uiRemoveProjectile]) {
        const uiState = this.getUIState();
        uiState.transientUI.projectiles = uiState.transientUI.projectiles.filter(
            (p: IProjectileState) => p.id !== data.projectileId
        );
        this.setUIState(uiState);
        this.dispatch(StateChangeEvent.uiTransient, structuredClone(uiState.transientUI));
    }

    private mergeHighlightTypes(
        existing: Array<'movement' | 'attack' | 'path' | 'overwatch'> | undefined,
        newType: 'movement' | 'attack' | 'path' | 'overwatch'
    ): Array<'movement' | 'attack' | 'path' | 'overwatch'> {
        const types = new Set(existing || []);
        types.add(newType);
        return Array.from(types) as Array<'movement' | 'attack' | 'path' | 'overwatch'>;
    }

    private categorizeHighlightedCells(cells: Record<string, ICellVisualState | undefined>): {
        previouslyHighlighted: Set<string>;
        overwatchCells: Map<string, ICellVisualState>;
    } {
        const previouslyHighlighted = new Set<string>();
        const overwatchCells = new Map<string, ICellVisualState>();

        Object.keys(cells).forEach(cellKey => {
            const cell = cells[cellKey];
            if (cell?.isHighlighted) {
                const isOverwatch = cell.highlightTypes?.includes('overwatch') || cell.highlightType === 'overwatch';
                if (isOverwatch) {
                    overwatchCells.set(cellKey, cell);
                } else {
                    previouslyHighlighted.add(cellKey);
                }
            }
        });

        return { previouslyHighlighted, overwatchCells };
    }

    private collectCellsToKeep(
        data: UpdateStateEventsMap[UpdateStateEvent.uiHighlights],
        currentHighlights: { reachableCells: ICoord[], pathCells: ICoord[], targetableCells: ICoord[] }
    ): Set<string> {
        const cellsToKeep = new Set<string>();

        // Add reachable cells (with null check)
        const reachableCells = data.reachableCells !== undefined ? data.reachableCells : currentHighlights.reachableCells;
        if (reachableCells && Array.isArray(reachableCells)) {
            reachableCells.forEach(coord => cellsToKeep.add(`${coord.x},${coord.y}`));
        }

        // Add path cells (with null check)
        const pathCells = data.pathCells !== undefined ? data.pathCells : currentHighlights.pathCells;
        if (pathCells && Array.isArray(pathCells)) {
            pathCells.forEach(coord => cellsToKeep.add(`${coord.x},${coord.y}`));
        }

        // Add targetable cells (with null check)
        const targetableCells = data.targetableCells !== undefined ? data.targetableCells : currentHighlights.targetableCells;
        if (targetableCells && Array.isArray(targetableCells)) {
            targetableCells.forEach(coord => cellsToKeep.add(`${coord.x},${coord.y}`));
        }

        return cellsToKeep;
    }

    private createCellUpdate(
        cellKey: string,
        _coord: ICoord,
        highlightType: 'movement' | 'attack' | 'path',
        overwatchCell?: ICellVisualState,
        existingCell?: ICellVisualState
    ): CellVisualUpdate | null {
        if (highlightType === 'path') {
            const hasPathHighlight = existingCell?.highlightTypes?.includes('path');
            const hasCorrectClass = existingCell?.classList?.includes('path');

            if (overwatchCell) {
                const mergedTypes = this.mergeHighlightTypes(overwatchCell.highlightTypes, 'path');
                if (!existingCell || JSON.stringify(existingCell.highlightTypes) !== JSON.stringify(mergedTypes) || !hasCorrectClass) {
                    return {
                        cellKey,
                        visualState: {
                            isHighlighted: true,
                            highlightTypes: mergedTypes,
                            highlightIntensity: overwatchCell.highlightIntensity,
                            classList: ['path']
                        }
                    };
                }
            } else if (!hasPathHighlight || !hasCorrectClass) {
                return {
                    cellKey,
                    visualState: {
                        isHighlighted: true,
                        highlightTypes: ['path'],
                        classList: ['path']
                    }
                };
            }
        } else if (highlightType === 'movement') {
            const hasMovementHighlight = existingCell?.highlightTypes?.includes('movement');

            if (overwatchCell) {
                const mergedTypes = this.mergeHighlightTypes(overwatchCell.highlightTypes, 'movement');
                if (!existingCell || JSON.stringify(existingCell.highlightTypes) !== JSON.stringify(mergedTypes)) {
                    return {
                        cellKey,
                        visualState: {
                            isHighlighted: true,
                            highlightTypes: mergedTypes,
                            highlightIntensity: overwatchCell.highlightIntensity,
                            classList: ['highlight']
                        }
                    };
                }
            } else if (!hasMovementHighlight) {
                return {
                    cellKey,
                    visualState: {
                        isHighlighted: true,
                        highlightTypes: ['movement'],
                        classList: ['highlight']
                    }
                };
            }
        } else if (highlightType === 'attack') {
            if (overwatchCell) {
                return {
                    cellKey,
                    visualState: {
                        isHighlighted: true,
                        highlightTypes: this.mergeHighlightTypes(overwatchCell.highlightTypes, 'attack'),
                        highlightIntensity: overwatchCell.highlightIntensity,
                        classList: ['highlight']
                    }
                };
            } else {
                return {
                    cellKey,
                    visualState: {
                        isHighlighted: true,
                        highlightTypes: ['attack'],
                        classList: ['highlight']
                    }
                };
            }
        }

        return null;
    }

    private onUIHighlights(data: UpdateStateEventsMap[UpdateStateEvent.uiHighlights]) {
        const startTime = performance.now();
        const uiState = this.getUIState();

        // Categorize existing highlighted cells
        const { previouslyHighlighted, overwatchCells } = this.categorizeHighlightedCells(uiState.visualStates.cells);

        // Only update the properties that are explicitly provided
        // If a property is provided (even as empty array), it replaces the old value
        if (!uiState.transientUI) {
            uiState.transientUI = {
                highlights: {
                    reachableCells: [],
                    pathCells: [],
                    targetableCells: []
                },
                popups: {},
                projectiles: []
            };
        }
        uiState.transientUI.highlights = {
            reachableCells: data.reachableCells !== undefined ? [...data.reachableCells] : uiState.transientUI.highlights.reachableCells,
            pathCells: data.pathCells !== undefined ? [...data.pathCells] : uiState.transientUI.highlights.pathCells,
            targetableCells: data.targetableCells !== undefined ? [...data.targetableCells] : uiState.transientUI.highlights.targetableCells
        };

        const cellUpdates: Array<CellVisualUpdate> = [];

        // Collect cells that should remain highlighted
        const cellsToKeep = this.collectCellsToKeep(data, uiState.transientUI.highlights);

        // Only clear cells that are no longer needed (but not overwatch cells)
        previouslyHighlighted.forEach(cellKey => {
            if (!cellsToKeep.has(cellKey)) {
                cellUpdates.push({ cellKey, visualState: null });
            }
        });

        // Special case: when pathCells is empty array, remove 'path' highlight from all cells
        if (data.pathCells !== undefined && data.pathCells.length === 0) {
            Object.keys(uiState.visualStates.cells).forEach(cellKey => {
                const cell = uiState.visualStates.cells[cellKey];
                if (cell?.highlightTypes?.includes('path')) {
                    // Remove 'path' from highlight types
                    const newTypes = cell.highlightTypes.filter(t => t !== 'path');
                    const newClasses = (cell.classList || []).filter(c => c !== 'path');

                    // Check if this cell is still a reachable cell
                    const coord = cellKey.split(',').map(Number);
                    const isStillReachable = uiState.transientUI.highlights.reachableCells.some(
                        c => c.x === coord[0] && c.y === coord[1]
                    );

                    if (newTypes.length > 0 || isStillReachable) {
                        // Cell still has other highlights or is reachable
                        // Make sure it keeps the movement highlight if reachable
                        const finalTypes = isStillReachable && !newTypes.includes('movement')
                            ? [...newTypes, 'movement'] as Array<'movement' | 'attack' | 'path' | 'overwatch'>
                            : newTypes;
                        const finalClasses = isStillReachable && !newClasses.includes('highlight')
                            ? [...newClasses, 'highlight']
                            : newClasses;

                        cellUpdates.push({
                            cellKey,
                            visualState: {
                                ...cell,
                                highlightTypes: finalTypes,
                                classList: finalClasses
                            }
                        });
                    } else {
                        // Cell has no other highlights and is not reachable, clear it
                        cellUpdates.push({ cellKey, visualState: null });
                    }
                }
            });
        }

        // Process reachable cells
        data.reachableCells?.forEach(coord => {
            const cellKey = `${coord.x},${coord.y}`;
            const update = this.createCellUpdate(
                cellKey,
                coord,
                'movement',
                overwatchCells.get(cellKey),
                uiState.visualStates.cells[cellKey]
            );
            if (update) cellUpdates.push(update);
        });

        // Process path cells
        data.pathCells?.forEach(coord => {
            const cellKey = `${coord.x},${coord.y}`;
            const update = this.createCellUpdate(
                cellKey,
                coord,
                'path',
                overwatchCells.get(cellKey),
                uiState.visualStates.cells[cellKey]
            );
            if (update) cellUpdates.push(update);
        });

        // Process targetable cells
        data.targetableCells?.forEach(coord => {
            const cellKey = `${coord.x},${coord.y}`;
            const update = this.createCellUpdate(
                cellKey,
                coord,
                'attack',
                overwatchCells.get(cellKey),
                uiState.visualStates.cells[cellKey]
            );
            if (update) cellUpdates.push(update);
        });

        // Check if we're clearing all highlights
        // We're clearing if all provided arrays are empty (or if nothing is provided)
        const hasReachable = data.reachableCells !== undefined;
        const hasPath = data.pathCells !== undefined;
        const hasTargetable = data.targetableCells !== undefined;

        const isClearingAllHighlights =
            (hasReachable && data.reachableCells!.length === 0) &&
            (hasPath && data.pathCells!.length === 0) &&
            (hasTargetable && data.targetableCells!.length === 0);


        if (!isClearingAllHighlights) {
            // Preserve overwatch cells that weren't updated
            overwatchCells.forEach((cell, cellKey) => {
                if (!cellUpdates.some(update => update.cellKey === cellKey)) {
                    cellUpdates.push({
                        cellKey,
                        visualState: cell
                    });
                }
            });
        } else {
            // When clearing all highlights, check if we should preserve overwatch from other players
            const fullState = this.getFullState();
            const currentTurn = fullState.game.turn;

            // Clear all overwatch cells that don't belong to active overwatches
            overwatchCells.forEach((cell, cellKey) => {
                let shouldPreserve = false;

                // Look through overwatch data to find which player owns this overwatch
                const overwatchDataObj = fullState.overwatchData;
                Object.entries(overwatchDataObj || {}).forEach(([characterName, overwatchData]) => {
                    if (overwatchData.active && overwatchData.watchedCells) {
                        const hasThisCell = overwatchData.watchedCells.some((watchedCell: ICoord) =>
                            `${watchedCell.x},${watchedCell.y}` === cellKey
                        );

                        if (hasThisCell) {
                            const characters = fullState.characters;
                            const overwatchCharacter = characters.find(c => c.name === characterName);
                            // Preserve if it's from a different player
                            if (overwatchCharacter && overwatchCharacter.player !== currentTurn) {
                                shouldPreserve = true;
                            }
                        }
                    }
                });

                // Clear the cell if it's not being preserved
                cellUpdates.push({
                    cellKey,
                    visualState: shouldPreserve ? cell : null
                });
            });
        }

        this.setUIState(uiState);
        if (cellUpdates.length > 0) {
            this.onUICellVisualBatch({ updates: cellUpdates });
        }
        this.dispatch(StateChangeEvent.uiTransient, structuredClone(uiState.transientUI));

        const duration = performance.now() - startTime;
        // Only log if very slow
        if (duration > 100) {
            console.log(`[UIStateService] onUIHighlights slow: ${duration.toFixed(1)}ms`);
        }
    }

    private onUIInteractionMode(data: UpdateStateEventsMap[UpdateStateEvent.uiInteractionMode]) {
        const uiState = this.getUIState();
        uiState.interactionMode = structuredClone(data);
        this.setUIState(uiState);
        this.dispatch(StateChangeEvent.uiInteractionMode, structuredClone(uiState.interactionMode));
    }

    updateCharacterDefeated(characterName: string) {
        const uiState = this.getUIState();
        // Get existing visual state or create a minimal one
        const existingState = uiState.visualStates.characters[characterName];

        if (existingState) {
            // Update existing state
            existingState.isDefeated = true;
            // Ensure health bar shows 0 for defeated characters
            existingState.healthBarPercentage = 0;
            existingState.healthBarColor = '#f44336';
        } else {
            // Create new visual state with defeated flag
            uiState.visualStates.characters[characterName] = {
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
        }

        this.setUIState(uiState);
        this.dispatch(StateChangeEvent.uiVisualStates, structuredClone(uiState.visualStates));
    }

    clearTurnBasedUI() {
        const uiState = this.getUIState();
        uiState.transientUI.highlights = {
            reachableCells: [],
            pathCells: [],
            targetableCells: []
        };

        uiState.interactionMode = {
            type: 'normal'
        };

        const cellUpdates: Array<CellVisualUpdate> = [];
        Object.keys(uiState.visualStates.cells).forEach(cellKey => {
            const cell = uiState.visualStates.cells[cellKey];
            const isOverwatch = cell?.highlightTypes?.includes('overwatch') || cell?.highlightType === 'overwatch';
            if (cell?.isHighlighted && !isOverwatch) {
                cellUpdates.push({ cellKey, visualState: null });
            }
        });

        this.setUIState(uiState);
        if (cellUpdates.length > 0) {
            this.onUICellVisualBatch({ updates: cellUpdates });
        }

        this.dispatch(StateChangeEvent.uiTransient, structuredClone(uiState.transientUI));
        this.dispatch(StateChangeEvent.uiInteractionMode, structuredClone(uiState.interactionMode));
    }

    private onUISelectedCharacter(characterName: string | undefined) {
        const uiState = this.getUIState();
        uiState.selectedCharacter = characterName;
        this.setUIState(uiState);
        this.dispatch(StateChangeEvent.uiSelectedCharacter, characterName);
    }
}