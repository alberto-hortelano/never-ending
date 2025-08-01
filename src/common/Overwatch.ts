import type { DeepReadonly } from "./helpers/types";
import type { ICharacter, IOverwatchData } from "./interfaces";
import type { State } from "./State";

import {
    EventBus, ControlsEvent, ControlsEventsMap,
    GUIEvent, GUIEventsMap, StateChangeEventsMap,
    UpdateStateEvent, UpdateStateEventsMap,
    ActionEvent, ActionEventsMap, GameEvent, GameEventsMap,
    StateChangeEvent
} from "./events";
import { ShootingService, SHOOT_CONSTANTS, VisibleCell } from "./services/ShootingService";
import { DirectionsService } from "./services/DirectionsService";

export class Overwatch extends EventBus<
    GUIEventsMap & ControlsEventsMap & StateChangeEventsMap & GameEventsMap & ActionEventsMap,
    GUIEventsMap & ControlsEventsMap & UpdateStateEventsMap & ActionEventsMap
> {
    private activeOverwatchCharacter?: DeepReadonly<ICharacter>;
    private visibleCells?: VisibleCell[];
    
    constructor(
        private state: State,
    ) {
        super();
        
        // Controls events
        this.listen(ControlsEvent.showOverwatch, characterName => this.onShowOverwatch(characterName));
        this.listen(ControlsEvent.cellClick, coord => this.onCellClick(coord));
        this.listen(ControlsEvent.mousePositionUpdate, data => this.onMousePositionUpdate(data));
        
        // State change events
        this.listen(StateChangeEvent.characterPosition, character => this.onCharacterMove(character));
        this.listen(StateChangeEvent.characterHealth, character => this.onCharacterHealthChange(character));
        this.listen(StateChangeEvent.uiVisualStates, visualStates => this.onVisualStatesChange(visualStates));
        
        // Game events
        this.listen(GameEvent.changeTurn, data => this.onTurnChange(data));
        
        // Clear overwatch mode when popup is shown
        this.listen(GUIEvent.popupShow, () => this.clearOverwatchMode());
    }
    
    // Event Handlers
    private onShowOverwatch(characterName: ControlsEventsMap[ControlsEvent.showOverwatch]) {
        const character = this.state.findCharacter(characterName);
        if (!character) {
            console.error('[Overwatch] Character not found');
            return;
        }
        
        // Check if the character belongs to the current turn
        const currentTurn = this.state.game.turn;
        if (character.player !== currentTurn) {
            console.error('[Overwatch] Not current turn');
            return;
        }
        
        // Check if character has action points
        if (character.actions.pointsLeft <= 0) {
            this.dispatch(ActionEvent.error, 'No action points remaining for overwatch');
            return;
        }
        
        // Show overwatch range preview
        this.showOverwatchRange(character);
    }
    
    private onCellClick(coord: ControlsEventsMap[ControlsEvent.cellClick]) {
        if (!this.activeOverwatchCharacter || !this.visibleCells) {
            return;
        }
        
        // Check if clicked position is in visible cells
        const isInVisibleCell = this.visibleCells.find(vc =>
            vc.coord.x === coord.x && vc.coord.y === coord.y
        );
        
        if (isInVisibleCell) {
            // Activate overwatch
            const pointsToConsume = this.activeOverwatchCharacter.actions.pointsLeft;
            
            console.log(`[Overwatch] Activating overwatch for ${this.activeOverwatchCharacter.name} with ${pointsToConsume} shots`);
            
            // Store overwatch data
            this.dispatch(UpdateStateEvent.setOverwatchData, {
                characterName: this.activeOverwatchCharacter.name,
                active: true,
                direction: this.activeOverwatchCharacter.direction,
                position: this.activeOverwatchCharacter.position,
                range: ShootingService.getWeaponRange(this.activeOverwatchCharacter),
                shotsRemaining: pointsToConsume,
                watchedCells: this.visibleCells.map(vc => vc.coord),
                shotCells: [] as any // Initialize empty array (will be converted to Set in State)
            });
            
            // Deduct all remaining action points
            this.dispatch(UpdateStateEvent.deductActionPoints, {
                characterName: this.activeOverwatchCharacter.name,
                actionId: 'overwatch',
                cost: pointsToConsume
            });
            
            // Keep the visual indicators active but clear the selection mode
            this.activeOverwatchCharacter = undefined;
            this.visibleCells = undefined;
            
            // Reset interaction mode to normal since overwatch is now active and locked
            this.dispatch(UpdateStateEvent.uiInteractionMode, {
                type: 'normal'
            });
        }
    }
    
    private onMousePositionUpdate(data: ControlsEventsMap[ControlsEvent.mousePositionUpdate]) {
        const { characterName, mouseCoord } = data;
        
        // Only process if this is for the current overwatch setup (not active overwatch)
        if (!this.activeOverwatchCharacter || this.activeOverwatchCharacter.name !== characterName) {
            return;
        }
        
        // Get character position from state
        const character = this.state.findCharacter(characterName);
        if (!character) {
            return;
        }
        
        // Calculate angle from character to mouse
        const dx = mouseCoord.x - character.position.x;
        const dy = mouseCoord.y - character.position.y;
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        
        // Get the nearest direction
        const newDirection = DirectionsService.getDirectionFromAngle(angle);
        
        // Check if the direction actually changed
        if (character.direction === newDirection) {
            return;
        }
        
        // Update the character's direction
        this.dispatch(UpdateStateEvent.characterDirection, {
            characterName: characterName,
            direction: newDirection
        });
        
        // Handle only if we're in setup mode (not active overwatch)
        if (this.activeOverwatchCharacter) {
            // Setting up overwatch - update visual range
            const updatedCharacter = this.state.findCharacter(characterName);
            if (updatedCharacter) {
                this.showOverwatchRange(updatedCharacter);
            }
        }
    }
    
    private trackedCharacterPositions = new Map<string, { x: number, y: number }>();
    
    private onVisualStatesChange(visualStates: StateChangeEventsMap[StateChangeEvent.uiVisualStates]) {
        // Track character positions during animations
        for (const [characterId, visualState] of Object.entries(visualStates.characters)) {
            if (!visualState || !visualState.styles) continue;
            
            if ('--x' in visualState.styles && '--y' in visualState.styles) {
                const xStr = visualState.styles['--x'];
                const yStr = visualState.styles['--y'];
                if (!xStr || !yStr) continue;
                
                const newX = Math.round(parseFloat(xStr));
                const newY = Math.round(parseFloat(yStr));
                
                const lastPos = this.trackedCharacterPositions.get(characterId);
                
                // Check if character moved to a new cell
                if (!lastPos || lastPos.x !== newX || lastPos.y !== newY) {
                    console.log(`[Overwatch] Character ${characterId} animated to cell ${newX},${newY}`);
                    
                    // Update tracked position
                    this.trackedCharacterPositions.set(characterId, { x: newX, y: newY });
                    
                    // Find the character data
                    const character = this.state.findCharacter(characterId);
                    if (character) {
                        // Create a temporary character state with the animated position
                        const characterAtPosition = {
                            ...character,
                            position: { x: newX, y: newY }
                        } as DeepReadonly<ICharacter>;
                        
                        // Check overwatch for this position
                        this.checkOverwatchTriggers(characterAtPosition);
                    }
                }
            }
        }
    }
    
    private onCharacterMove(character: StateChangeEventsMap[StateChangeEvent.characterPosition]) {
        console.log(`[Overwatch] onCharacterMove: ${character.name} moved to ${character.position.x},${character.position.y}`);
        
        // Update tracked position for when movement completes
        this.trackedCharacterPositions.set(character.name, {
            x: character.position.x,
            y: character.position.y
        });
        
        this.checkOverwatchTriggers(character);
    }
    
    private checkOverwatchTriggers(character: DeepReadonly<ICharacter>) {
        // Get all active overwatches
        const overwatchData = this.state.overwatchData;
        if (!overwatchData) {
            console.log('[Overwatch] No overwatch data in state');
            return;
        }
        
        console.log(`[Overwatch] Found ${overwatchData.size} overwatch entries for ${character.name} at ${character.position.x},${character.position.y}`);
        
        // Check each overwatch - iterate manually to avoid DeepReadonly issues
        const overwatchArray = Array.from(overwatchData as any) as [string, IOverwatchData][];
        overwatchArray.forEach(([overwatcherName, data]) => {
            console.log(`[Overwatch] Checking ${overwatcherName}: active=${data.active}, shots=${data.shotsRemaining}, shotCells=`, data.shotCells);
            
            if (!data.active || data.shotsRemaining <= 0) {
                console.log(`[Overwatch] ${overwatcherName} is inactive or out of shots`);
                return;
            }
            
            // Don't shoot at friendly units
            const overwatcher = this.state.findCharacter(overwatcherName);
            if (!overwatcher || overwatcher.player === character.player) {
                console.log(`[Overwatch] ${overwatcherName} won't shoot at friendly ${character.name} (${character.player})`);
                return;
            }
            
            // Check if the moving character is in an overwatch cell
            const isInWatchedCell = data.watchedCells?.some((cell: any) =>
                cell.x === character.position.x && cell.y === character.position.y
            );
            
            console.log(`[Overwatch] ${character.name} in watched cell: ${isInWatchedCell}`);
            
            if (isInWatchedCell) {
                // Check if we've already shot at this cell
                const cellKey = `${character.position.x},${character.position.y}`;
                console.log(`[Overwatch] Checking shotCells for ${cellKey}:`, data.shotCells, 'has:', data.shotCells?.has(cellKey));
                
                if (data.shotCells?.has(cellKey)) {
                    console.log(`[Overwatch] Already shot at cell ${cellKey}`);
                    return; // Already shot at this cell
                }
                
                // Check line of sight
                if (!ShootingService.checkLineOfSight(
                    this.state.map,
                    data.position,
                    character.position
                )) {
                    console.log(`[Overwatch] No line of sight`);
                    return; // No line of sight
                }
                
                console.log(`[Overwatch] EXECUTING SHOT at ${cellKey}`);
                // Execute overwatch shot
                this.executeOverwatchShot(overwatcherName, data, character);
            }
        });
        
        // If the moving character has overwatch, update their position
        const movingCharacterOverwatch = (overwatchData as any).get(character.name) as IOverwatchData | undefined;
        if (movingCharacterOverwatch && movingCharacterOverwatch.active) {
            // Update overwatch position and recalculate watched cells
            const newWatchedCells = ShootingService.calculateVisibleCells(
                this.state.map,
                character.position,
                character.direction,
                movingCharacterOverwatch.range,
                SHOOT_CONSTANTS.DEFAULT_ANGLE_OF_VISION
            );
            
            this.dispatch(UpdateStateEvent.setOverwatchData, {
                characterName: character.name,
                active: true,
                position: character.position,
                watchedCells: newWatchedCells.map(vc => vc.coord)
            });
        }
    }
    
    private onCharacterHealthChange(character: StateChangeEventsMap[StateChangeEvent.characterHealth]) {
        // Clear overwatch if character is defeated
        if (character.health <= 0) {
            const overwatchData = (this.state.overwatchData as any).get(character.name) as IOverwatchData | undefined;
            if (overwatchData && overwatchData.active) {
                this.clearCharacterOverwatch(character.name);
            }
        }
    }
    
    private onTurnChange(data: GameEventsMap[GameEvent.changeTurn]) {
        // Group logging to avoid spam
        const activeOverwatches: string[] = [];
        const overwatchesToClear: string[] = [];
        
        // Check all characters for active overwatch
        this.state.characters.forEach(character => {
            const overwatchData = (this.state.overwatchData as any).get(character.name) as IOverwatchData | undefined;
            if (overwatchData && overwatchData.active) {
                activeOverwatches.push(`${character.name}(${character.player})`);
                
                // Clear overwatch for characters whose turn is starting (they can act again)
                if (character.player === data.turn) {
                    overwatchesToClear.push(character.name);
                }
            }
        });
        
        
        // Clear overwatch for characters whose turn is starting
        overwatchesToClear.forEach(characterName => {
            this.clearCharacterOverwatch(characterName);
            
            // Also ensure interaction mode is cleared if this character was in overwatch mode
            const interactionMode = this.state.ui.interactionMode;
            if (interactionMode.type === 'overwatch' && interactionMode.data) {
                const overwatchModeData = interactionMode.data as { characterId: string };
                if (overwatchModeData.characterId === characterName) {
                    this.dispatch(UpdateStateEvent.uiInteractionMode, {
                        type: 'normal'
                    });
                }
            }
        });
    }
    
    // Helper Methods
    private showOverwatchRange(character: DeepReadonly<ICharacter>) {
        const range = ShootingService.getWeaponRange(character);
        const angleOfVision = SHOOT_CONSTANTS.DEFAULT_ANGLE_OF_VISION;
        
        // Clear previous visible cells if they exist
        if (this.visibleCells) {
            const clearUpdates = this.visibleCells.map(vc => ({
                cellKey: `${vc.coord.x},${vc.coord.y}`,
                visualState: null
            }));
            this.dispatch(UpdateStateEvent.uiCellVisualBatch, { updates: clearUpdates });
        }
        
        this.activeOverwatchCharacter = character;
        this.visibleCells = ShootingService.calculateVisibleCells(
            this.state.map,
            character.position,
            character.direction,
            range,
            angleOfVision
        );
        
        // Update interaction mode to overwatch selection
        const weapon = ShootingService.getEquippedRangedWeapon(character);
        const weaponClass = weapon?.class || 'unarmed';
        
        // Add overwatch class when entering overwatch mode
        this.dispatch(UpdateStateEvent.uiCharacterVisual, {
            characterId: character.name,
            visualState: {
                temporaryClasses: ['overwatch'],
                weaponClass: weaponClass
            }
        });
        
        // Set interaction mode for overwatch
        if (weapon) {
            this.dispatch(UpdateStateEvent.uiInteractionMode, {
                type: 'overwatch',
                data: {
                    characterId: character.name,
                    weapon: weapon,
                    remainingPoints: character.actions.pointsLeft
                } as any
            });
        }
        
        // Update targetable cells in highlights for overwatch mode
        this.dispatch(UpdateStateEvent.uiHighlights, {
            targetableCells: this.visibleCells.map(vc => vc.coord)
        });
        
        // Batch update cell visual states with intensity
        const cellUpdates = this.visibleCells.map(vc => ({
            cellKey: `${vc.coord.x},${vc.coord.y}`,
            visualState: {
                isHighlighted: true,
                highlightTypes: ['overwatch'] as Array<'overwatch'>,
                highlightIntensity: vc.intensity,
                classList: ['highlight', 'overwatch']
            }
        }));
        
        // Dispatch a single batch update
        this.dispatch(UpdateStateEvent.uiCellVisualBatch, { updates: cellUpdates });
    }
    
    private clearOverwatchMode() {
        if (this.visibleCells) {
            // Clear targetable cells
            this.dispatch(UpdateStateEvent.uiHighlights, {
                targetableCells: []
            });
            
            // Batch clear cell visual states
            const cellUpdates = this.visibleCells.map(vc => ({
                cellKey: `${vc.coord.x},${vc.coord.y}`,
                visualState: null
            }));
            
            // Dispatch a single batch update to clear all cells
            this.dispatch(UpdateStateEvent.uiCellVisualBatch, { updates: cellUpdates });
            
            // Remove overwatch class when exiting overwatch mode
            if (this.activeOverwatchCharacter) {
                this.dispatch(UpdateStateEvent.uiCharacterVisual, {
                    characterId: this.activeOverwatchCharacter.name,
                    visualState: {
                        temporaryClasses: [] // Clear temporary classes
                    }
                });
            }
            
            this.visibleCells = undefined;
            this.activeOverwatchCharacter = undefined;
            
            // Reset interaction mode to normal
            this.dispatch(UpdateStateEvent.uiInteractionMode, {
                type: 'normal'
            });
        }
    }
    
    private clearCharacterOverwatch(characterName: string) {
        // Get overwatch data BEFORE clearing it
        const overwatchData = (this.state.overwatchData as any).get(characterName) as IOverwatchData | undefined;
        
        // Clear visual indicators first (while we still have the data)
        if (overwatchData && overwatchData.watchedCells) {
            // Batch clear cell visual states
            const cellUpdates = overwatchData.watchedCells.map(coord => ({
                cellKey: `${coord.x},${coord.y}`,
                visualState: null
            }));
            
            this.dispatch(UpdateStateEvent.uiCellVisualBatch, { updates: cellUpdates });
        }
        
        // Then clear overwatch data
        this.dispatch(UpdateStateEvent.setOverwatchData, {
            characterName: characterName,
            active: false
        });
        
        // Clear targetable cells
        this.dispatch(UpdateStateEvent.uiHighlights, {
            targetableCells: []
        });
        
        // Remove overwatch class from character
        this.dispatch(UpdateStateEvent.uiCharacterVisual, {
            characterId: characterName,
            visualState: {
                temporaryClasses: []
            }
        });
        
        // Clear interaction mode if this was the active overwatch character
        const interactionMode = this.state.ui.interactionMode;
        if (interactionMode.type === 'overwatch' && interactionMode.data) {
            const overwatchModeData = interactionMode.data as { characterId: string };
            if (overwatchModeData.characterId === characterName) {
                this.dispatch(UpdateStateEvent.uiInteractionMode, {
                    type: 'normal'
                });
            }
        }
    }
    
    private executeOverwatchShot(
        overwatcherName: string,
        overwatchData: DeepReadonly<IOverwatchData>,
        target: DeepReadonly<ICharacter>
    ) {
        const overwatcher = this.state.findCharacter(overwatcherName);
        if (!overwatcher) {
            return;
        }
        
        // Show projectile animation
        const weapon = ShootingService.getEquippedRangedWeapon(overwatcher);
        const projectileType = ShootingService.getProjectileType(weapon);
        
        this.dispatch(GUIEvent.shootProjectile, {
            from: overwatchData.position,
            to: target.position,
            type: projectileType
        });
        
        // Calculate hit chance
        const distance = ShootingService.getDistance(overwatchData.position, target.position);
        const maxRange = overwatchData.range;
        const hitChance = ShootingService.calculateHitChance(distance, maxRange, 0); // No aim bonus for overwatch
        
        // Check if the shot hits
        if (ShootingService.rollHit(hitChance)) {
            // Calculate damage
            const baseDamage = ShootingService.getWeaponDamage(overwatcher);
            
            // Check for critical hit
            const critChance = ShootingService.calculateCriticalChance(0); // No aim bonus
            const isCritical = ShootingService.rollCritical(critChance);
            
            const finalDamage = ShootingService.calculateDamage(
                baseDamage,
                distance,
                maxRange,
                isCritical
            );
            
            // Dispatch damage number event for visual feedback
            this.dispatch(GUIEvent.damageNumber, {
                position: target.position,
                damage: finalDamage,
                isCritical: isCritical
            });
            
            // Apply damage to target
            this.dispatch(UpdateStateEvent.damageCharacter, {
                targetName: target.name,
                damage: finalDamage,
                attackerName: overwatcherName
            });
        } else {
            // Shot missed
            this.dispatch(ActionEvent.error, `Overwatch shot missed! (${Math.round(hitChance * 100)}% chance)`);
        }
        
        // Update overwatch data
        const cellKey = `${target.position.x},${target.position.y}`;
        const existingShotCells = overwatchData.shotCells || new Set<string>();
        console.log(`[Overwatch] Current shotCells:`, existingShotCells instanceof Set ? Array.from(existingShotCells as any) : 'not a Set');
        
        const updatedShotCells = new Set<string>(existingShotCells as any);
        updatedShotCells.add(cellKey);
        console.log(`[Overwatch] Updated shotCells after adding ${cellKey}:`, Array.from(updatedShotCells));
        
        const newShotsRemaining = overwatchData.shotsRemaining - 1;
        console.log(`[Overwatch] Shots remaining: ${overwatchData.shotsRemaining} -> ${newShotsRemaining}`);
        
        if (newShotsRemaining <= 0) {
            console.log(`[Overwatch] Out of shots, deactivating overwatch`);
            // Out of shots, deactivate overwatch
            this.clearCharacterOverwatch(overwatcherName);
            
            // Clear interaction mode if this was the active overwatch character
            this.dispatch(UpdateStateEvent.uiInteractionMode, {
                type: 'normal'
            });
        } else {
            console.log(`[Overwatch] Dispatching setOverwatchData with shotCells:`, Array.from(updatedShotCells));
            // Update remaining shots AND shotCells
            // Convert Set to Array for serialization
            this.dispatch(UpdateStateEvent.setOverwatchData, {
                characterName: overwatcherName,
                active: true,
                shotsRemaining: newShotsRemaining,
                shotCells: Array.from(updatedShotCells) as any // Convert Set to Array
            });
            
            // Update interaction mode to show remaining shots only if data changed
            const currentMode = this.state.ui.interactionMode;
            if (weapon && currentMode.type === 'overwatch') {
                const currentData = currentMode.data as any;
                if (currentData?.shotsRemaining !== newShotsRemaining) {
                    this.dispatch(UpdateStateEvent.uiInteractionMode, {
                        type: 'overwatch',
                        data: {
                            characterId: overwatcherName,
                            weapon: weapon,
                            shotsRemaining: newShotsRemaining
                        } as any
                    });
                }
            }
        }
    }
}