import type { ICoord, ICell, ICharacter, Direction } from '../interfaces';
import type { DeepReadonly } from '../helpers/types';

/**
 * Spatial utility functions for AI pathfinding and positioning
 * Pure static methods with no side effects
 */
export class AISpatialUtils {
    /**
     * Calculate Euclidean distance between two positions
     */
    static getDistance(pos1: ICoord, pos2: ICoord): number {
        return Math.sqrt(
            Math.pow(pos2.x - pos1.x, 2) +
            Math.pow(pos2.y - pos1.y, 2)
        );
    }

    /**
     * Check if there's a clear line of sight between two positions using Bresenham's algorithm
     * @param ignoreCharacters - If true, only walls block LOS (useful for conversations)
     */
    static checkLineOfSight(
        from: ICoord,
        to: ICoord,
        map: DeepReadonly<ICell[][]>,
        characters: DeepReadonly<ICharacter[]>,
        ignoreCharacters: boolean = false
    ): boolean {
        // Use Bresenham's line algorithm to check for obstacles
        const dx = Math.abs(to.x - from.x);
        const dy = Math.abs(to.y - from.y);
        const sx = from.x < to.x ? 1 : -1;
        const sy = from.y < to.y ? 1 : -1;
        let err = dx - dy;
        let x = Math.round(from.x);
        let y = Math.round(from.y);
        const targetX = Math.round(to.x);
        const targetY = Math.round(to.y);

        while (x !== targetX || y !== targetY) {
            // Skip the starting position
            if (x !== Math.round(from.x) || y !== Math.round(from.y)) {
                const cell = map[y]?.[x];
                if (cell?.content?.blocker) {
                    return false; // Wall blocks line of sight
                }

                // Only check for blocking characters if not ignoring them
                if (!ignoreCharacters && !(x === targetX && y === targetY)) {
                    const blockingChar = characters.find(c =>
                        Math.round(c.position.x) === x &&
                        Math.round(c.position.y) === y &&
                        c.health > 0
                    );
                    if (blockingChar) {
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
     * Convert an angle (in radians) to one of the 8 game directions
     */
    static angleToDirection(angle: number): Direction {
        // Normalize angle to 0-360 degrees
        const degrees = ((angle * 180 / Math.PI) + 360) % 360;

        // Map angle to 8 directions
        if (degrees >= 337.5 || degrees < 22.5) return 'right';
        if (degrees >= 22.5 && degrees < 67.5) return 'down-right';
        if (degrees >= 67.5 && degrees < 112.5) return 'down';
        if (degrees >= 112.5 && degrees < 157.5) return 'down-left';
        if (degrees >= 157.5 && degrees < 202.5) return 'left';
        if (degrees >= 202.5 && degrees < 247.5) return 'up-left';
        if (degrees >= 247.5 && degrees < 292.5) return 'up';
        return 'up-right'; // 292.5 to 337.5
    }

    /**
     * Get a position 3 cells in front of a character based on their facing direction
     */
    static getPositionInFront(character: DeepReadonly<ICharacter>): ICoord {
        const direction = character.direction;
        let dx = 0, dy = 0;

        switch (direction) {
            case 'up': dy = -3; break;
            case 'down': dy = 3; break;
            case 'left': dx = -3; break;
            case 'right': dx = 3; break;
            case 'up-left': dx = -2; dy = -2; break;
            case 'up-right': dx = 2; dy = -2; break;
            case 'down-left': dx = -2; dy = 2; break;
            case 'down-right': dx = 2; dy = 2; break;
        }

        return {
            x: Math.round(character.position.x + dx),
            y: Math.round(character.position.y + dy)
        };
    }

    /**
     * Find positions within conversation range that have line of sight to the target
     * Used when an AI character wants to speak but is blocked by walls
     */
    static findPositionsWithLineOfSight(
        from: ICoord,
        target: ICoord,
        map: DeepReadonly<ICell[][]>,
        characters: DeepReadonly<ICharacter[]>,
        maxDistance: number = 8
    ): ICoord[] {
        const positions: ICoord[] = [];

        // Search in a square around the target within maxDistance
        const searchRadius = Math.ceil(maxDistance);
        for (let dy = -searchRadius; dy <= searchRadius; dy++) {
            for (let dx = -searchRadius; dx <= searchRadius; dx++) {
                const x = Math.round(target.x) + dx;
                const y = Math.round(target.y) + dy;

                // Check if position is valid and within range
                const testPos = { x, y };
                const distance = this.getDistance(testPos, target);
                if (distance > maxDistance) continue;

                // Check if the cell is walkable
                const cell = map[y]?.[x];
                if (!cell || cell.content?.blocker) continue;

                // Check if there's a character already there
                const occupied = characters.some(c =>
                    Math.round(c.position.x) === x &&
                    Math.round(c.position.y) === y &&
                    c.health > 0
                );
                if (occupied) continue;

                // Check if this position has line of sight to target (ignoring characters)
                if (this.checkLineOfSight(testPos, target, map, characters, true)) {
                    positions.push(testPos);
                }
            }
        }

        // Sort by distance from the character's current position
        positions.sort((a, b) => {
            const distA = this.getDistance(from, a);
            const distB = this.getDistance(from, b);
            return distA - distB;
        });

        return positions;
    }

    /**
     * Detect what's blocking the path between two positions
     * Returns information about the blocking entity
     */
    static detectBlockingEntity(
        from: ICoord,
        to: ICoord,
        map: DeepReadonly<ICell[][]>,
        characters: DeepReadonly<ICharacter[]>
    ): { type: 'none' | 'wall' | 'character', character?: DeepReadonly<ICharacter> } {
        // Use Bresenham's line algorithm to find what's blocking
        const dx = Math.abs(to.x - from.x);
        const dy = Math.abs(to.y - from.y);
        const sx = from.x < to.x ? 1 : -1;
        const sy = from.y < to.y ? 1 : -1;
        let err = dx - dy;
        let x = Math.round(from.x);
        let y = Math.round(from.y);
        const targetX = Math.round(to.x);
        const targetY = Math.round(to.y);

        while (x !== targetX || y !== targetY) {
            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x += sx;
            }
            if (e2 < dx) {
                err += dx;
                y += sy;
            }

            // Skip checking the starting position
            if (x === Math.round(from.x) && y === Math.round(from.y)) {
                continue;
            }

            // Check for wall
            const cell = map[y]?.[x];
            if (cell?.content?.blocker) {
                return { type: 'wall' };
            }

            // Check for character (except at target position)
            if (!(x === targetX && y === targetY)) {
                const blockingChar = characters.find(c =>
                    Math.round(c.position.x) === x &&
                    Math.round(c.position.y) === y &&
                    c.health > 0
                );
                if (blockingChar) {
                    return { type: 'character', character: blockingChar };
                }
            }
        }

        return { type: 'none' };
    }
}
