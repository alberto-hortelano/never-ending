import type { DeepReadonly } from "./helpers/types";
import type { ICharacter, ICoord, ICell, Direction } from "./interfaces";
import type { State } from "./State";

import {
    EventBus, ControlsEvent, ControlsEventsMap,
    GUIEvent, GUIEventsMap, StateChangeEventsMap,
    UpdateStateEvent, UpdateStateEventsMap,
} from "./events";

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

        // Calculate bounding box to limit cells to check
        const minX = Math.max(0, Math.floor(position.x - range));
        const maxX = Math.min(map[0]!.length - 1, Math.ceil(position.x + range));
        const minY = Math.max(0, Math.floor(position.y - range));
        const maxY = Math.min(map.length - 1, Math.ceil(position.y + range));

        // Check only cells within the bounding box
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                const targetCoord = { x, y };
                const distance = this.getDistance(position, targetCoord);

                if (distance <= range && distance > 0) {
                    // Check if target cell itself is blocked
                    const targetCell = map[y]?.[x];
                    if (targetCell?.content?.blocker) {
                        continue; // Skip blocked cells
                    }

                    // Calculate angle to target
                    const angleToTarget = this.getAngle(position, targetCoord);
                    const relativeAngle = this.normalizeAngle(angleToTarget - baseAngle);

                    // Check if within field of vision
                    if (Math.abs(relativeAngle) <= halfAngle) {
                        // Calculate visibility based on angle and distance
                        const angleVisibility = this.calculateAngleVisibility(relativeAngle, halfAngle);
                        const distanceVisibility = this.calculateDistanceVisibility(distance, range);

                        // Check for obstacles blocking line of sight
                        const hasLineOfSight = this.checkLineOfSight(map, position, targetCoord);

                        if (hasLineOfSight) {
                            const intensity = angleVisibility * distanceVisibility;
                            if (intensity > 0.01) { // Threshold to avoid very dim cells
                                visibleCells.push({
                                    coord: targetCoord,
                                    intensity
                                });
                            }
                        }
                    }
                }
            }
        }

        return visibleCells;
    }

    // Listeners
    private onShowShooting(characterName: ControlsEventsMap[ControlsEvent.showShooting]) {
        const character = this.state.findCharacter(characterName);
        if (!character) return;

        // Check if the character belongs to the current turn
        const currentTurn = this.state.game.turn;
        if (character.player !== currentTurn) {
            console.log(`${characterName} cannot shoot by ${currentTurn} - belongs to ${character.player}`);
            return;
        }

        this.showShootingRange(character);
    }

    private onCharacterClick(data: ControlsEventsMap[ControlsEvent.characterClick]) {
        if (!this.shootingCharacter || !this.visibleCells) return;
        
        const { characterName, position } = data;
        
        // Check if clicked position is in a visible cell
        const isInVisibleCell = this.visibleCells.find(vc => 
            vc.coord.x === position.x && vc.coord.y === position.y
        );
        
        if (isInVisibleCell) {
            // Get the target character
            const targetCharacter = this.state.findCharacter(characterName);
            
            if (targetCharacter && targetCharacter.name !== this.shootingCharacter.name) {
                // Show projectile animation
                const weapon = this.getEquippedRangedWeapon(this.shootingCharacter);
                const projectileType = weapon?.category === 'ranged' && weapon.damage > 20 ? 'laser' : 'bullet';
                
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
                
                console.log(`${this.shootingCharacter.name} shoots ${targetCharacter.name} for ${finalDamage} damage`);
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

        // Update cell visual states with intensity
        this.visibleCells.forEach(vc => {
            // Dispatch state update
            this.dispatch(UpdateStateEvent.uiCellVisual, {
                cellKey: `${vc.coord.x},${vc.coord.y}`,
                visualState: {
                    isHighlighted: true,
                    highlightType: 'attack',
                    highlightIntensity: vc.intensity,
                    classList: ['highlight', 'highlight-intensity']
                }
            });
            
            // Also dispatch the GUI event for backward compatibility/tests
            this.dispatch(GUIEvent.cellHighlightIntensity, { coord: vc.coord, intensity: vc.intensity }, JSON.stringify(vc.coord));
        });
    }

    private clearShootingHighlights() {
        if (this.visibleCells) {
            // Clear targetable cells
            this.dispatch(UpdateStateEvent.uiHighlights, {
                targetableCells: []
            });
            
            // Clear cell visual states
            this.visibleCells.forEach(vc => {
                this.dispatch(UpdateStateEvent.uiCellVisual, {
                    cellKey: `${vc.coord.x},${vc.coord.y}`,
                    visualState: null
                });
                
                // Also dispatch the GUI event for backward compatibility/tests
                this.dispatch(GUIEvent.cellReset, vc.coord, JSON.stringify(vc.coord));
            });
            
            this.visibleCells = undefined;
            this.shootingCharacter = undefined;
            
            // Reset interaction mode to normal
            this.dispatch(UpdateStateEvent.uiInteractionMode, {
                type: 'normal'
            });
        }
    }

    private getDistance(from: ICoord, to: ICoord): number {
        return Math.sqrt(Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2));
    }

    private getAngle(from: ICoord, to: ICoord): number {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        return Math.atan2(dy, dx) * 180 / Math.PI;
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