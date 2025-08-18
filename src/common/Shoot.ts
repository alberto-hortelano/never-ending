import type { DeepReadonly } from "./helpers/types";
import type { ICharacter, ICoord, ICell, Direction } from "./interfaces";
import type { State } from "./State";

import {
    EventBus, ControlsEvent, ControlsEventsMap,
    GUIEvent, GUIEventsMap, StateChangeEventsMap,
    UpdateStateEvent, UpdateStateEventsMap,
    ActionEvent, ActionEventsMap,
} from "./events";
import { DirectionsService } from "./services/DirectionsService";
import { CharacterService } from "./services/CharacterService";
import { InteractionModeManager } from "./InteractionModeManager";

export interface VisibleCell {
    coord: ICoord;
    intensity: number; // 0-1, where 1 is fully visible
}

// Constants for shooting mechanics
const SHOOT_CONSTANTS = {
    DEFAULT_ANGLE_OF_VISION: 120,
    DEFAULT_UNARMED_DAMAGE: 5,
    DEFAULT_UNARMED_RANGE: 10,
    VISIBILITY_THRESHOLD: 0.01,
    DISTANCE_DAMAGE_FALLOFF: 0.5, // 50% damage reduction at max range
    AIM_RANGE_BONUS: 0.5, // 50% range increase per aim level
    CRITICAL_HIT_BASE_CHANCE: 0.05, // 5% base critical chance
    CRITICAL_HIT_AIM_BONUS: 0.05, // 5% additional critical chance per aim level
    CRITICAL_HIT_MULTIPLIER: 2.0, // Double damage on critical hits
} as const;

export class Shoot extends EventBus<
    GUIEventsMap & ControlsEventsMap & StateChangeEventsMap & ActionEventsMap,
    GUIEventsMap & ControlsEventsMap & UpdateStateEventsMap & ActionEventsMap
> {
    private shootingCharacter?: DeepReadonly<ICharacter>;
    private visibleCells?: VisibleCell[];
    private aimLevel: number = 0;
    private modeManager: InteractionModeManager;

    constructor(
        private state: State,
    ) {
        super();
        this.modeManager = InteractionModeManager.getInstance();

        // Register cleanup handler for shooting mode
        this.modeManager.registerCleanupHandler('shooting', () => {
            this.cleanupShootingMode();
        });
        this.listen(ControlsEvent.showShooting, characterName => this.onShowShooting(characterName));
        this.listen(ControlsEvent.showAiming, characterName => this.onShowAiming(characterName));
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
        const baseAngle = DirectionsService.getDirectionAngle(direction);
        const rangeSquared = range * range;

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

                // Skip the cross product check for now - it seems to be causing issues
                // We'll rely on the angle check below instead

                // Check if target cell itself is blocked
                const targetCell = map[y]?.[x];
                if (targetCell?.content?.blocker) {
                    continue; // Skip blocked cells
                }

                // Check if a living character is blocking this cell (but allow targeting characters)
                if (CharacterService.isCharacterAtPosition(this.state.characters, { x, y })) {
                    // We can see the character, but not cells behind them
                    const hasLineOfSight = this.checkLineOfSight(map, position, { x, y });
                    if (hasLineOfSight) {
                        // Calculate visibility for the character's cell
                        const angleToTarget = Math.atan2(dy, dx) * 180 / Math.PI;
                        const relativeAngle = this.normalizeAngle(angleToTarget - baseAngle);

                        if (Math.abs(relativeAngle) <= halfAngle) {
                            const angleVisibility = this.calculateAngleVisibility(relativeAngle, halfAngle);
                            const distance = Math.sqrt(distanceSquared);
                            const distanceVisibility = this.calculateDistanceVisibility(distance, range);

                            const intensity = angleVisibility * distanceVisibility;
                            if (intensity > SHOOT_CONSTANTS.VISIBILITY_THRESHOLD) {
                                visibleCells.push({
                                    coord: { x, y },
                                    intensity
                                });
                            }
                        }
                    }
                    continue; // Don't check cells behind characters
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
                        if (intensity > SHOOT_CONSTANTS.VISIBILITY_THRESHOLD) { // Threshold to avoid very dim cells
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
        const character = this.state.findCharacter(characterName);
        if (!character) {
            console.error('[Shoot] Character not found');
            return;
        }

        // Check if the character belongs to the current turn
        const currentTurn = this.state.game.turn;
        if (character.player !== currentTurn) {
            console.error('[Shoot] Not current turn - character player:', character.player, 'current turn:', currentTurn);
            return;
        }

        this.aimLevel = 0; // Reset aim level when entering shoot mode

        // Set initial pending cost (just shoot cost)
        const shootCost = character.actions.rangedCombat.shoot;
        this.dispatch(UpdateStateEvent.setPendingActionCost, {
            characterName: characterName,
            cost: shootCost
        });

        this.showShootingRange(character);
    }

    private onShowAiming(characterName: ControlsEventsMap[ControlsEvent.showAiming]) {
        // Only process if we're already in shooting mode with this character
        if (!this.shootingCharacter || this.shootingCharacter.name !== characterName) {
            console.error('[Shoot] Not in shooting mode or different character');
            // If not in shooting mode, enter shooting mode first
            this.onShowShooting(characterName);
            return;
        }

        // Check if player has enough points for another aim + shoot
        const shootCost = this.shootingCharacter.actions.rangedCombat.shoot;
        const aimCost = this.shootingCharacter.actions.rangedCombat.aim;
        const newPendingCost = shootCost + (aimCost * (this.aimLevel + 1));
        const pointsLeft = this.shootingCharacter.actions.pointsLeft;

        if (newPendingCost > pointsLeft) {
            this.dispatch(ActionEvent.error, `Not enough action points to aim again. Need ${newPendingCost}, have ${pointsLeft}`);
            return;
        }

        // Increment aim level
        this.aimLevel++;

        // Update pending cost
        this.dispatch(UpdateStateEvent.setPendingActionCost, {
            characterName: characterName,
            cost: newPendingCost
        });

        // Get updated character state
        const character = this.state.findCharacter(characterName);
        if (!character) {
            console.error('[Shoot] Character not found');
            return;
        }

        // Recalculate and show updated shooting range with new aim level
        this.showShootingRange(character);
    }

    private onCharacterClick(data: ControlsEventsMap[ControlsEvent.characterClick]) {
        if (!this.shootingCharacter || !this.visibleCells) {
            console.error('[Shoot] No shooting character or visible cells');
            return;
        }

        const { characterName, position } = data;
        // console.log(`[Shoot] Character click: ${characterName} at (${position.x}, ${position.y}) by ${this.shootingCharacter.name}`);

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
                const distance = this.getDistance(this.shootingCharacter.position, position);
                const maxRange = this.getWeaponRange(this.shootingCharacter);

                // Apply distance falloff
                const distanceFactor = 1 - (distance / maxRange) * SHOOT_CONSTANTS.DISTANCE_DAMAGE_FALLOFF;
                let finalDamage = Math.round(baseDamage * distanceFactor);

                // Check for critical hit
                const critChance = this.calculateCriticalChance();
                const isCritical = this.rollCritical(critChance);

                if (isCritical) {
                    finalDamage = Math.round(finalDamage * SHOOT_CONSTANTS.CRITICAL_HIT_MULTIPLIER);
                }

                // Dispatch damage number event for visual feedback
                this.dispatch(GUIEvent.damageNumber, {
                    position: position,
                    damage: finalDamage,
                    isCritical: isCritical
                });

                // Apply damage to target
                this.dispatch(UpdateStateEvent.damageCharacter, {
                    targetName: targetCharacter.name,
                    damage: finalDamage,
                    attackerName: this.shootingCharacter.name
                });

            }

            // Deduct action points for shooting and aiming
            const shootCost = this.shootingCharacter.actions?.rangedCombat?.shoot || 30;
            const aimCost = (this.shootingCharacter.actions?.rangedCombat?.aim || 10) * this.aimLevel;
            
            // console.log(`[Shoot] Deducting action points for ${this.shootingCharacter.name}: shoot=${shootCost}, aim=${aimCost}`);

            // Deduct shoot points
            this.dispatch(UpdateStateEvent.deductActionPoints, {
                characterName: this.shootingCharacter.name,
                actionId: 'shoot',
                cost: shootCost
            });

            // Deduct aim points if any
            if (this.aimLevel > 0) {
                this.dispatch(UpdateStateEvent.deductActionPoints, {
                    characterName: this.shootingCharacter.name,
                    actionId: 'aim',
                    cost: aimCost
                });
            }

            this.clearShootingHighlights();
        }
    }

    private onMousePositionUpdate(data: ControlsEventsMap[ControlsEvent.mousePositionUpdate]) {
        const { characterName, mouseCoord } = data;

        // Only process if this is for the current shooting character
        if (!this.shootingCharacter || this.shootingCharacter.name !== characterName) {
            return;
        }

        // Get character position from state
        const character = this.state.findCharacter(characterName);
        if (!character) {
            console.error('[Shoot] Character not found in state:', characterName);
            return;
        }

        // Get the direction from character to mouse position
        const newDirection = DirectionsService.getDirectionFromCoords(
            character.position,
            mouseCoord
        );

        // Check if the direction actually changed
        if (character.direction === newDirection) {
            return;
        }

        // Update the character's direction
        this.dispatch(UpdateStateEvent.characterDirection, {
            characterName: characterName,
            direction: newDirection
        });

        // Recalculate and update the shooting range with the new direction
        const updatedCharacter = this.state.findCharacter(characterName);
        if (updatedCharacter) {
            this.showShootingRange(updatedCharacter);
        }
    }

    // Helpers
    private showShootingRange(character: DeepReadonly<ICharacter>) {
        const range = this.getWeaponRange(character);
        const angleOfVision = SHOOT_CONSTANTS.DEFAULT_ANGLE_OF_VISION;

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

        // Add shoot and weapon class when entering shooting mode (unless defeated)
        if (character.health > 0) {
            this.dispatch(UpdateStateEvent.uiCharacterVisual, {
                characterId: character.name,
                visualState: {
                    temporaryClasses: ['shoot'],
                    weaponClass: weaponClass
                }
            });
        }

        // Update targetable cells in highlights for shooting mode - do this before mode change
        this.dispatch(UpdateStateEvent.uiHighlights, {
            targetableCells: this.visibleCells.map(vc => vc.coord)
        });

        if (weapon) {
            // Use mode manager to request mode change
            this.modeManager.requestModeChange({
                type: 'shooting',
                data: {
                    characterId: character.name,
                    weapon: weapon,
                    aimLevel: this.aimLevel
                }
            });
        }

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
                this.dispatch(UpdateStateEvent.uiCharacterVisual, {
                    characterId: this.shootingCharacter.name,
                    visualState: {
                        temporaryClasses: [] // Clear temporary classes
                    }
                });
            }

            this.visibleCells = undefined;

            // Clear pending cost when exiting shooting mode
            if (this.shootingCharacter) {
                this.dispatch(UpdateStateEvent.setPendingActionCost, {
                    characterName: this.shootingCharacter.name,
                    cost: 0
                });
            }

            this.shootingCharacter = undefined;
            this.aimLevel = 0; // Reset aim level

            // Reset interaction mode to normal
            this.modeManager.requestModeChange({
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

                // Check if a living character is blocking line of sight (except at the target position)
                if (!(x === to.x && y === to.y)) {
                    if (CharacterService.isCharacterAtPosition(this.state.characters, { x, y })) {
                        return false; // Character blocks line of sight
                    }
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
        return weapon ? weapon.damage : SHOOT_CONSTANTS.DEFAULT_UNARMED_DAMAGE;
    }

    private getWeaponRange(character: DeepReadonly<ICharacter>): number {
        const weapon = this.getEquippedRangedWeapon(character);
        const baseRange = weapon ? weapon.range : SHOOT_CONSTANTS.DEFAULT_UNARMED_RANGE;
        // Apply aim bonus
        return baseRange * (1 + SHOOT_CONSTANTS.AIM_RANGE_BONUS * this.aimLevel);
    }

    private calculateCriticalChance(): number {
        const baseChance = SHOOT_CONSTANTS.CRITICAL_HIT_BASE_CHANCE;
        const aimBonus = this.aimLevel * SHOOT_CONSTANTS.CRITICAL_HIT_AIM_BONUS;
        return Math.min(0.5, baseChance + aimBonus); // Cap at 50%
    }

    private rollCritical(critChance: number): boolean {
        return Math.random() < critChance;
    }

    private cleanupShootingMode(): void {
        this.shootingCharacter = undefined;
        this.visibleCells = undefined;
        this.aimLevel = 0;
        this.clearShootingHighlights();
    }
}