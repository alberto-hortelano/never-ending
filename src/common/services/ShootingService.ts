import type { DeepReadonly } from "../helpers/types";
import type { ICharacter, ICoord, ICell, Direction, IWeapon } from "../interfaces";
import { DirectionsService } from "./DirectionsService";
import { CharacterService } from "./CharacterService";

export interface VisibleCell {
    coord: ICoord;
    intensity: number; // 0-1, where 1 is fully visible
}

// Constants for shooting mechanics
export const SHOOT_CONSTANTS = {
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

/**
 * Service containing shared shooting mechanics for both regular shooting and overwatch
 */
export class ShootingService {
    /**
     * Calculate visible cells within a cone of vision
     */
    static calculateVisibleCells(
        map: DeepReadonly<ICell[][]>,
        position: ICoord,
        direction: Direction,
        range: number,
        angleOfVision: number = 90,
        characters?: DeepReadonly<ICharacter[]>
    ): VisibleCell[] {
        const visibleCells: VisibleCell[] = [];
        const halfAngle = angleOfVision / 2;
        const baseAngle = DirectionsService.getDirectionAngle(direction);
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
                    const hasLineOfSight = this.checkLineOfSight(map, position, { x, y }, characters);

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

    /**
     * Check if there's a clear line of sight between two positions
     */
    static checkLineOfSight(
        map: DeepReadonly<ICell[][]>, 
        from: ICoord, 
        to: ICoord,
        characters?: DeepReadonly<ICharacter[]>
    ): boolean {
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
                if (characters && !(x === to.x && y === to.y)) {
                    if (CharacterService.isCharacterAtPosition(characters, { x, y })) {
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

    /**
     * Get equipped ranged weapon for a character
     */
    static getEquippedRangedWeapon(character: DeepReadonly<ICharacter>): DeepReadonly<IWeapon> | null {
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

    /**
     * Get weapon damage for a character
     */
    static getWeaponDamage(character: DeepReadonly<ICharacter>): number {
        const weapon = this.getEquippedRangedWeapon(character);
        return weapon ? weapon.damage : SHOOT_CONSTANTS.DEFAULT_UNARMED_DAMAGE;
    }

    /**
     * Get weapon range for a character (with optional aim bonus)
     */
    static getWeaponRange(character: DeepReadonly<ICharacter>, aimLevel: number = 0): number {
        const weapon = this.getEquippedRangedWeapon(character);
        const baseRange = weapon ? weapon.range : SHOOT_CONSTANTS.DEFAULT_UNARMED_RANGE;
        // Apply aim bonus
        return baseRange * (1 + SHOOT_CONSTANTS.AIM_RANGE_BONUS * aimLevel);
    }

    /**
     * Calculate hit chance based on distance and aim level
     * @deprecated Shots now always hit with damage falloff instead of hit/miss mechanics
     */
    static calculateHitChance(distance: number, maxRange: number, aimLevel: number = 0): number {
        // Base accuracy
        let accuracy = 0.7; // Previously SHOOT_CONSTANTS.BASE_ACCURACY
        
        // Add aim level bonus
        accuracy += aimLevel * 0.15; // Previously SHOOT_CONSTANTS.AIM_ACCURACY_BONUS
        
        // Apply distance penalty (no penalty at point blank, max penalty at max range)
        const distancePenalty = (distance / maxRange) * 0.3; // Up to 30% penalty
        accuracy -= distancePenalty;
        
        // Clamp between 0.05 (5% minimum) and 0.95 (95% maximum)
        return Math.max(0.05, Math.min(0.95, accuracy));
    }

    /**
     * Calculate critical hit chance based on aim level
     */
    static calculateCriticalChance(aimLevel: number = 0): number {
        const baseChance = SHOOT_CONSTANTS.CRITICAL_HIT_BASE_CHANCE;
        const aimBonus = aimLevel * SHOOT_CONSTANTS.CRITICAL_HIT_AIM_BONUS;
        return Math.min(0.5, baseChance + aimBonus); // Cap at 50%
    }

    /**
     * Calculate final damage with distance falloff and critical hits
     */
    static calculateDamage(
        baseDamage: number,
        distance: number,
        maxRange: number,
        isCritical: boolean = false
    ): number {
        // Apply distance falloff
        const distanceFactor = 1 - (distance / maxRange) * SHOOT_CONSTANTS.DISTANCE_DAMAGE_FALLOFF;
        let finalDamage = Math.round(baseDamage * distanceFactor);

        // Apply critical multiplier if critical hit
        if (isCritical) {
            finalDamage = Math.round(finalDamage * SHOOT_CONSTANTS.CRITICAL_HIT_MULTIPLIER);
        }

        return finalDamage;
    }

    /**
     * Get distance between two coordinates
     */
    static getDistance(from: ICoord, to: ICoord): number {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Roll for hit based on hit chance
     * @deprecated Shots now always hit with damage falloff instead of hit/miss mechanics
     */
    static rollHit(hitChance: number): boolean {
        return Math.random() < hitChance;
    }

    /**
     * Roll for critical hit based on critical chance
     */
    static rollCritical(critChance: number): boolean {
        return Math.random() < critChance;
    }

    /**
     * Get projectile type based on weapon
     */
    static getProjectileType(weapon: DeepReadonly<IWeapon> | null): 'bullet' | 'laser' {
        return weapon?.category === 'ranged' && weapon.damage > 20 ? 'laser' : 'bullet';
    }

    // Helper methods
    private static normalizeAngle(angle: number): number {
        // Normalize angle to [-180, 180]
        while (angle > 180) angle -= 360;
        while (angle < -180) angle += 360;
        return angle;
    }

    private static calculateAngleVisibility(relativeAngle: number, halfAngle: number): number {
        // Full visibility at center, decreasing towards edges
        const edgeDistance = Math.abs(relativeAngle) / halfAngle;
        return Math.max(0, 1 - edgeDistance);
    }

    private static calculateDistanceVisibility(distance: number, maxRange: number): number {
        // Linear falloff for now, could be quadratic
        return Math.max(0, 1 - (distance / maxRange));
    }
}