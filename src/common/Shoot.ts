import type { DeepReadonly } from "./helpers/types";
import type { ICharacter, ICoord, ICell, Direction } from "./interfaces";
import type { State } from "./State";

import {
    EventBus, ControlsEvent, ControlsEventsMap,
    GUIEvent, GUIEventsMap, StateChangeEventsMap,
    UpdateStateEvent, UpdateStateEventsMap,
} from "./events";
import { DirectionsService } from "./services/DirectionsService";

export interface VisibleCell {
    coord: ICoord;
    intensity: number; // 0-1, where 1 is fully visible
}

export class Shoot extends EventBus<
    GUIEventsMap & ControlsEventsMap & StateChangeEventsMap,
    GUIEventsMap & ControlsEventsMap & UpdateStateEventsMap
> {
    static readonly directionAngles: Record<Direction, number> = {
        'up': -90,
        'up-right': -45,
        'right': 0,
        'down-right': 45,
        'down': 90,
        'down-left': 135,
        'left': 180,
        'up-left': -135
    };

    private shootingCharacter?: DeepReadonly<ICharacter>;
    private visibleCells?: VisibleCell[];

    constructor(
        private state: State,
    ) {
        super();
        this.listen(ControlsEvent.showShooting, characterName => this.onShowShooting(characterName));
        this.listen(ControlsEvent.characterClick, data => this.onCharacterClick(data));
        this.listen(ControlsEvent.mousePositionUpdate, data => this.onMousePositionUpdate(data));
        
        // Clear shooting mode when popup is shown (other actions selected)
        this.listen(GUIEvent.popupShow, () => this.clearShootingHighlights());
    }

    private calculateVisibleCells(
        map: DeepReadonly<ICell[][]>,
        position: ICoord,
        direction: Direction,
        range: number,
        angleOfVision: number = 90
    ): VisibleCell[] {
        const visibleCells: VisibleCell[] = [];
        const halfAngle = angleOfVision / 2;
        const baseAngle = Shoot.directionAngles[direction];
        const rangeSquared = range * range;

        // Pre-calculate angle bounds for early rejection
        const angleRadians = baseAngle * Math.PI / 180;
        const halfAngleRadians = halfAngle * Math.PI / 180;
        
        // Calculate sector bounds for early rejection
        const sectorMinAngle = angleRadians - halfAngleRadians;
        const sectorMaxAngle = angleRadians + halfAngleRadians;
        
        // Pre-calculate cos/sin for sector bounds
        const cosMin = Math.cos(sectorMinAngle);
        const sinMin = Math.sin(sectorMinAngle);
        const cosMax = Math.cos(sectorMaxAngle);
        const sinMax = Math.sin(sectorMaxAngle);

        // Calculate bounding box to limit cells to check
        const minX = Math.max(0, Math.floor(position.x - range));
        const maxX = Math.min(map[0]!.length - 1, Math.ceil(position.x + range));
        const minY = Math.max(0, Math.floor(position.y - range));
        const maxY = Math.min(map.length - 1, Math.ceil(position.y + range));

        // Check only cells within the bounding box
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                if (x === position.x && y === position.y) continue; // Skip origin
                
                const dx = x - position.x;
                const dy = y - position.y;
                const distanceSquared = dx * dx + dy * dy;

                // Early exit if beyond range (using squared distance to avoid sqrt)
                if (distanceSquared > rangeSquared) continue;

                // Quick sector check before expensive angle calculations
                // This eliminates cells clearly outside the cone of vision
                const crossMin = dx * sinMin - dy * cosMin;
                const crossMax = dx * sinMax - dy * cosMax;
                
                // If both cross products have the same sign, the point is outside the sector
                if (crossMin > 0 && crossMax > 0) continue;
                if (crossMin < 0 && crossMax < 0) continue;

                // Check if target cell itself is blocked
                const targetCell = map[y]?.[x];
                if (targetCell?.content?.blocker) {
                    continue; // Skip blocked cells
                }

                // Now do the precise angle calculation for cells that passed early checks
                const angleToTarget = Math.atan2(dy, dx) * 180 / Math.PI;
                const relativeAngle = this.normalizeAngle(angleToTarget - baseAngle);

                // Check if within field of vision
                if (Math.abs(relativeAngle) <= halfAngle) {
                    // Check for obstacles blocking line of sight
                    const hasLineOfSight = this.checkLineOfSight(map, position, { x, y });

                    if (hasLineOfSight) {
                        // Calculate visibility based on angle and distance
                        const angleVisibility = this.calculateAngleVisibility(relativeAngle, halfAngle);
                        const distance = Math.sqrt(distanceSquared);
                        const distanceVisibility = this.calculateDistanceVisibility(distance, range);
                        
                        const intensity = angleVisibility * distanceVisibility;
                        if (intensity > 0.01) { // Threshold to avoid very dim cells
                            visibleCells.push({
                                coord: { x, y },
                                intensity
                            });
                        }
                    }
                }
            }
        }

        return visibleCells;
    }

    // Listeners
    private onShowShooting(characterName: ControlsEventsMap[ControlsEvent.showShooting]) {
        console.log('[Shoot] onShowShooting called for character:', characterName);
        const character = this.state.findCharacter(characterName);
        if (!character) {
            console.log('[Shoot] Character not found');
            return;
        }

        // Check if the character belongs to the current turn
        const currentTurn = this.state.game.turn;
        if (character.player !== currentTurn) {
            console.log('[Shoot] Not current turn - character player:', character.player, 'current turn:', currentTurn);
            return;
        }

        this.showShootingRange(character);
    }

    private onCharacterClick(data: ControlsEventsMap[ControlsEvent.characterClick]) {
        console.log('[Shoot] onCharacterClick called:', data);
        
        if (!this.shootingCharacter || !this.visibleCells) {
            console.log('[Shoot] No shooting character or visible cells');
            return;
        }
        
        const { characterName, position } = data;
        
        // Check if clicked position is in a visible cell
        const isInVisibleCell = this.visibleCells.find(vc => 
            vc.coord.x === position.x && vc.coord.y === position.y
        );
        
        console.log('[Shoot] Is in visible cell:', !!isInVisibleCell);
        
        if (isInVisibleCell) {
            // Get the target character
            const targetCharacter = this.state.findCharacter(characterName);
            
            console.log('[Shoot] Target character:', targetCharacter?.name, 'Shooter:', this.shootingCharacter.name);
            
            if (targetCharacter && targetCharacter.name !== this.shootingCharacter.name) {
                // Show projectile animation
                const weapon = this.getEquippedRangedWeapon(this.shootingCharacter);
                const projectileType = weapon?.category === 'ranged' && weapon.damage > 20 ? 'laser' : 'bullet';
                
                console.log('[Shoot] Firing at target:', targetCharacter.name);
                
                this.dispatch(GUIEvent.shootProjectile, {
                    from: this.shootingCharacter.position,
                    to: position,
                    type: projectileType
                });
                
                // Calculate damage based on equipped weapon
                const baseDamage = this.getWeaponDamage(this.shootingCharacter);
                
                // Get distance for damage falloff
                const distance = this.getDistance(this.shootingCharacter.position, position);
                const maxRange = this.getWeaponRange(this.shootingCharacter);
                
                // Apply distance falloff (100% damage at point blank, 50% at max range)
                const distanceFactor = 1 - (distance / maxRange) * 0.5;
                const finalDamage = Math.round(baseDamage * distanceFactor);
                
                // Apply damage to target immediately
                this.dispatch(UpdateStateEvent.damageCharacter, {
                    targetName: targetCharacter.name,
                    damage: finalDamage,
                    attackerName: this.shootingCharacter.name
                });
                
            }
            
            // Deduct action points for shooting
            const shootCost = this.shootingCharacter.actions.rangedCombat.shoot;
            this.dispatch(UpdateStateEvent.deductActionPoints, {
                characterName: this.shootingCharacter.name,
                actionId: 'shoot',
                cost: shootCost
            });
            
            this.clearShootingHighlights();
        }
    }
    
    private onMousePositionUpdate(data: ControlsEventsMap[ControlsEvent.mousePositionUpdate]) {
        const { characterName, mouseCoord } = data;
        
        console.log('[Shoot] Mouse position update received:', { characterName, mouseCoord });
        
        // Only process if this is for the current shooting character
        if (!this.shootingCharacter || this.shootingCharacter.name !== characterName) {
            console.log('[Shoot] Not current shooting character. Current:', this.shootingCharacter?.name, 'Received:', characterName);
            return;
        }
        
        // Get character position from state
        const character = this.state.findCharacter(characterName);
        if (!character) {
            console.log('[Shoot] Character not found in state:', characterName);
            return;
        }
        
        // Calculate angle from character to mouse
        const dx = mouseCoord.x - character.position.x;
        const dy = mouseCoord.y - character.position.y;
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        
        console.log('[Shoot] Angle calculation - Character pos:', character.position, 'Mouse coord:', mouseCoord, 'dx:', dx, 'dy:', dy, 'angle:', angle);
        
        // Get the nearest direction
        const newDirection = DirectionsService.getDirectionFromAngle(angle);
        
        console.log('[Shoot] New direction:', newDirection, 'Current direction:', character.direction);
        
        // Check if the direction actually changed
        if (character.direction === newDirection) {
            console.log('[Shoot] Direction unchanged:', newDirection);
            return;
        }
        
        console.log('[Shoot] Updating character direction from', character.direction, 'to', newDirection);
        
        // Update the character's direction
        this.dispatch(UpdateStateEvent.characterDirection, {
            characterName: characterName,
            direction: newDirection
        });
        
        // Recalculate and update the shooting range with the new direction
        const updatedCharacter = this.state.findCharacter(characterName);
        if (updatedCharacter) {
            console.log('[Shoot] Recalculating shooting range for new direction');
            this.showShootingRange(updatedCharacter);
        }
    }

    // Helpers
    private showShootingRange(character: DeepReadonly<ICharacter>) {
        const range = this.getWeaponRange(character);
        const angleOfVision = 120; // Default field of vision

        this.shootingCharacter = character;
        this.visibleCells = this.calculateVisibleCells(
            this.state.map,
            character.position,
            character.direction,
            range,
            angleOfVision
        );

        // Update interaction mode to shooting
        const weapon = this.getEquippedRangedWeapon(character);
        const weaponClass = weapon?.class || 'unarmed';
        
        // Add shoot and weapon class when entering shooting mode
        console.log('[Shoot] Entering shooting mode - Adding shoot class to character:', character.name, 'with weapon class:', weaponClass);
        this.dispatch(UpdateStateEvent.uiCharacterVisual, {
            characterId: character.name,
            visualState: {
                temporaryClasses: ['shoot'],
                weaponClass: weaponClass
            }
        });
        
        if (weapon) {
            this.dispatch(UpdateStateEvent.uiInteractionMode, {
                type: 'shooting',
                data: {
                    characterId: character.name,
                    weapon: weapon
                }
            });
        }

        // Update targetable cells in highlights for shooting mode
        this.dispatch(UpdateStateEvent.uiHighlights, {
            targetableCells: this.visibleCells.map(vc => vc.coord)
        });

        // Batch update cell visual states with intensity
        const cellUpdates = this.visibleCells.map(vc => ({
            cellKey: `${vc.coord.x},${vc.coord.y}`,
            visualState: {
                isHighlighted: true,
                highlightType: 'attack' as const,
                highlightIntensity: vc.intensity,
                classList: ['highlight', 'highlight-intensity']
            }
        }));
        
        // Dispatch a single batch update instead of individual updates
        this.dispatch(UpdateStateEvent.uiCellVisualBatch, { updates: cellUpdates });
        
        // Skip compatibility events in production since there are no listeners
        if (typeof jest !== 'undefined') {
            // Only dispatch in test environment
            this.visibleCells.forEach(vc => {
                this.dispatch(GUIEvent.cellHighlightIntensity, { coord: vc.coord, intensity: vc.intensity }, JSON.stringify(vc.coord));
            });
        }
    }

    private clearShootingHighlights() {
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
            
            // Skip compatibility events in production
            if (typeof jest !== 'undefined') {
                this.visibleCells.forEach(vc => {
                    this.dispatch(GUIEvent.cellReset, vc.coord, JSON.stringify(vc.coord));
                });
            }
            
            // Remove shoot class when exiting shooting mode
            if (this.shootingCharacter) {
                console.log('[Shoot] Exiting shooting mode - Removing shoot class from character:', this.shootingCharacter.name);
                this.dispatch(UpdateStateEvent.uiCharacterVisual, {
                    characterId: this.shootingCharacter.name,
                    visualState: {
                        temporaryClasses: [] // Clear temporary classes
                    }
                });
            }
            
            this.visibleCells = undefined;
            this.shootingCharacter = undefined;
            
            // Reset interaction mode to normal
            this.dispatch(UpdateStateEvent.uiInteractionMode, {
                type: 'normal'
            });
        }
    }

    private getDistance(from: ICoord, to: ICoord): number {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    private normalizeAngle(angle: number): number {
        // Normalize angle to [-180, 180]
        while (angle > 180) angle -= 360;
        while (angle < -180) angle += 360;
        return angle;
    }

    private calculateAngleVisibility(relativeAngle: number, halfAngle: number): number {
        // Full visibility at center, decreasing towards edges
        const edgeDistance = Math.abs(relativeAngle) / halfAngle;
        return Math.max(0, 1 - edgeDistance);
    }

    private calculateDistanceVisibility(distance: number, maxRange: number): number {
        // Linear falloff for now, could be quadratic
        return Math.max(0, 1 - (distance / maxRange));
    }

    private checkLineOfSight(map: DeepReadonly<ICell[][]>, from: ICoord, to: ICoord): boolean {
        // Bresenham's line algorithm to check for obstacles
        const dx = Math.abs(to.x - from.x);
        const dy = Math.abs(to.y - from.y);
        const sx = from.x < to.x ? 1 : -1;
        const sy = from.y < to.y ? 1 : -1;
        let err = dx - dy;
        let x = from.x;
        let y = from.y;

        while (x !== to.x || y !== to.y) {
            // Skip the starting position
            if (x !== from.x || y !== from.y) {
                const cell = map[y]?.[x];
                if (cell?.content?.blocker) {
                    return false; // Obstacle blocks line of sight
                }
            }

            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x += sx;
            }
            if (e2 < dx) {
                err += dx;
                y += sy;
            }
        }

        return true;
    }

    private getEquippedRangedWeapon(character: DeepReadonly<ICharacter>) {
        const primaryWeapon = character.inventory.equippedWeapons.primary;
        const secondaryWeapon = character.inventory.equippedWeapons.secondary;
        
        if (primaryWeapon && primaryWeapon.category === 'ranged') {
            return primaryWeapon;
        }
        
        if (secondaryWeapon && secondaryWeapon.category === 'ranged') {
            return secondaryWeapon;
        }
        
        return null;
    }

    private getWeaponDamage(character: DeepReadonly<ICharacter>): number {
        const weapon = this.getEquippedRangedWeapon(character);
        return weapon ? weapon.damage : 5; // Default unarmed damage
    }

    private getWeaponRange(character: DeepReadonly<ICharacter>): number {
        const weapon = this.getEquippedRangedWeapon(character);
        return weapon ? weapon.range : 10; // Default range for unarmed/throwing
    }
}