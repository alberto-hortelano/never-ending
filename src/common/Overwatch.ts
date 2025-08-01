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
            
            // Store overwatch data
            this.dispatch(UpdateStateEvent.setOverwatchData, {
                characterName: this.activeOverwatchCharacter.name,
                active: true,
                direction: this.activeOverwatchCharacter.direction,
                position: this.activeOverwatchCharacter.position,
                range: ShootingService.getWeaponRange(this.activeOverwatchCharacter),
                shotsRemaining: pointsToConsume,
                watchedCells: this.visibleCells.map(vc => vc.coord)
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
            
            // Update interaction mode to show overwatch is active
            this.dispatch(UpdateStateEvent.uiInteractionMode, {
                type: 'normal'
            });
        }
    }
    
    private onMousePositionUpdate(data: ControlsEventsMap[ControlsEvent.mousePositionUpdate]) {
        const { characterName, mouseCoord } = data;
        
        // Only process if this is for the current overwatch character
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
        
        // Recalculate and update the overwatch range with the new direction
        const updatedCharacter = this.state.findCharacter(characterName);
        if (updatedCharacter) {
            this.showOverwatchRange(updatedCharacter);
        }
    }
    
    private onCharacterMove(character: StateChangeEventsMap[StateChangeEvent.characterPosition]) {
        // Get all active overwatches
        const overwatchData = this.state.overwatchData;
        if (!overwatchData) {
            return;
        }
        
        // Check each overwatch - iterate manually to avoid DeepReadonly issues
        const overwatchArray = Array.from(overwatchData as any) as [string, IOverwatchData][];
        overwatchArray.forEach(([overwatcherName, data]) => {
            if (!data.active || data.shotsRemaining <= 0) {
                return;
            }
            
            // Don't shoot at friendly units
            const overwatcher = this.state.findCharacter(overwatcherName);
            if (!overwatcher || overwatcher.player === character.player) {
                return;
            }
            
            // Check if the moving character is in an overwatch cell
            const isInWatchedCell = data.watchedCells?.some((cell: any) =>
                cell.x === character.position.x && cell.y === character.position.y
            );
            
            if (isInWatchedCell) {
                // Check if we've already shot at this cell
                const cellKey = `${character.position.x},${character.position.y}`;
                if (data.shotCells?.has(cellKey)) {
                    return; // Already shot at this cell
                }
                
                // Check line of sight
                if (!ShootingService.checkLineOfSight(
                    this.state.map,
                    data.position,
                    character.position
                )) {
                    return; // No line of sight
                }
                
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
        console.log('[Overwatch] Turn change event:', data);
        // Clear overwatch completely for all characters of the player whose turn is starting
        const charactersToCheck = this.state.characters.filter(char => char.player === data.turn);
        console.log('[Overwatch] Characters to check for turn:', data.turn, charactersToCheck.map(c => c.name));
        
        charactersToCheck.forEach(character => {
            const overwatchData = (this.state.overwatchData as any).get(character.name) as IOverwatchData | undefined;
            console.log('[Overwatch] Checking character:', character.name, 'overwatchData:', overwatchData);
            if (overwatchData && overwatchData.active) {
                console.log('[Overwatch] Clearing overwatch for:', character.name);
                // Clear overwatch completely (including visuals) when their turn starts
                this.clearCharacterOverwatch(character.name);
            }
        });
    }
    
    // Helper Methods
    private showOverwatchRange(character: DeepReadonly<ICharacter>) {
        const range = ShootingService.getWeaponRange(character);
        const angleOfVision = SHOOT_CONSTANTS.DEFAULT_ANGLE_OF_VISION;
        
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
        console.log('[Overwatch] clearCharacterOverwatch called for:', characterName);
        
        // Get overwatch data BEFORE clearing it
        const overwatchData = (this.state.overwatchData as any).get(characterName) as IOverwatchData | undefined;
        console.log('[Overwatch] Overwatch data to clear:', overwatchData);
        
        // Clear visual indicators first (while we still have the data)
        if (overwatchData && overwatchData.watchedCells) {
            // Batch clear cell visual states
            const cellUpdates = overwatchData.watchedCells.map(coord => ({
                cellKey: `${coord.x},${coord.y}`,
                visualState: null
            }));
            console.log('[Overwatch] Clearing', cellUpdates.length, 'cell visuals');
            
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
        const updatedShotCells = new Set<string>(existingShotCells as any);
        updatedShotCells.add(cellKey);
        
        const newShotsRemaining = overwatchData.shotsRemaining - 1;
        
        if (newShotsRemaining <= 0) {
            // Out of shots, deactivate overwatch
            this.clearCharacterOverwatch(overwatcherName);
        } else {
            // Update remaining shots
            this.dispatch(UpdateStateEvent.setOverwatchData, {
                characterName: overwatcherName,
                active: true,
                shotsRemaining: newShotsRemaining
            });
            
            // Update interaction mode to show remaining shots
            if (weapon) {
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