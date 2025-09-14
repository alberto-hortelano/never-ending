import type { BasicDirection, ICoord } from "../interfaces";
import type { SeededRandom } from "./SeededRandom";

export type CorridorPattern = 'random' | 'star' | 'grid' | 'linear';

export interface Corridor {
    start: ICoord;
    end: ICoord;
    direction: BasicDirection;
    cells: ICoord[];
}

export class CorridorGenerator {
    private corridors: Corridor[] = [];
    private readonly directions: BasicDirection[] = ['up', 'right', 'down', 'left'];
    private rng?: SeededRandom;

    constructor(
        private width: number,
        private height: number,
        rng?: SeededRandom
    ) {
        this.rng = rng;
    }

    public generateCorridors(
        roomCount: number,
        pattern: CorridorPattern,
        center: ICoord = { x: Math.floor(this.width / 2), y: Math.floor(this.height / 2) }
    ): Corridor[] {
        this.corridors = [];
        const corridorCount = Math.max(2, Math.ceil(roomCount * 0.8));
        const avgLength = Math.min(this.width, this.height) / 4;

        const generators = {
            random: () => this.generateRandomCorridors(corridorCount, avgLength, center),
            star: () => this.generateStarCorridors(corridorCount, avgLength, center),
            grid: () => this.generateGridCorridors(avgLength, center),
            linear: () => this.generateLinearCorridors(corridorCount, avgLength, center)
        };

        generators[pattern]();
        
        // Ensure at least one corridor is generated
        if (this.corridors.length === 0) {
            this.generateFallbackCorridor(center);
        }
        
        return [...this.corridors];
    }

    public extendCorridor(corridorIndex: number): void {
        const corridor = this.corridors[corridorIndex];
        if (!corridor) return;

        const validDirections = this.directions.filter(dir =>
            dir !== this.getOppositeDirection(corridor.direction)
        );

        if (validDirections.length === 0) return;

        const randomIndex = this.rng ? this.rng.nextInt(validDirections.length) : Math.floor(Math.random() * validDirections.length);
        const direction = validDirections[randomIndex]!;
        this.addCorridor(corridor.end, direction, 15);
    }

    public addNewCorridorBranch(): void {
        const baseCorridor = this.randomCorridor();
        if (!baseCorridor) return;

        const branchPoint = this.randomMidPointOnCorridor(baseCorridor);
        const perpendicularDirections = this.directions.filter(dir =>
            !this.areDirectionsParallel(dir, baseCorridor.direction)
        );

        if (perpendicularDirections.length === 0) return;

        const randomIndex = this.rng ? this.rng.nextInt(perpendicularDirections.length) : Math.floor(Math.random() * perpendicularDirections.length);
        const direction = perpendicularDirections[randomIndex]!;
        const length = Math.floor(Math.min(this.width, this.height) / 6) + 10;
        this.addCorridor(branchPoint, direction, length);
    }

    public addLongCorridors(): void {
        for (let i = 0; i < 3; i++) {
            const extendableCorridor = this.findExtendableCorridor();
            if (!extendableCorridor) continue;

            const validDirections = this.getValidExtensionDirections(extendableCorridor);
            if (validDirections.length === 0) continue;

            const randomIndex = this.rng ? this.rng.nextInt(validDirections.length) : Math.floor(Math.random() * validDirections.length);
        const direction = validDirections[randomIndex]!;
            const length = Math.floor(Math.min(this.width, this.height) / 3);
            this.addCorridor(extendableCorridor.end, direction, length);
        }
    }

    public carveCorridors(map: number[][]): void {
        this.corridors.forEach(corridor =>
            corridor.cells.forEach(cell => this.carveCell(cell, map))
        );
    }

    public getCorridors(): Corridor[] {
        return [...this.corridors];
    }

    private randomPointOnCorridor(corridor: Corridor): ICoord {
        const randomIndex = this.rng ? this.rng.nextInt(corridor.cells.length) : Math.floor(Math.random() * corridor.cells.length);
        return corridor.cells[randomIndex] || corridor.start;
    }

    private generateRandomCorridors(count: number, avgLength: number, center: ICoord): void {
        const firstDirection = this.randomDirection();
        const firstLength = this.randomLength(avgLength);
        this.addCorridor(center, firstDirection, firstLength);

        for (let i = 1; i < count; i++) {
            const existingCorridor = this.randomCorridor();
            if (!existingCorridor) continue;

            const connectionPoint = this.randomPointOnCorridor(existingCorridor);
            const validDirections = this.directions.filter(dir =>
                dir !== existingCorridor.direction &&
                dir !== this.getOppositeDirection(existingCorridor.direction)
            );

            if (validDirections.length === 0) continue;

            const randomIndex = this.rng ? this.rng.nextInt(validDirections.length) : Math.floor(Math.random() * validDirections.length);
            const newDirection = validDirections[randomIndex]!;
            const newLength = this.randomLength(avgLength);
            this.addCorridor(connectionPoint, newDirection, newLength);
        }
    }

    private generateStarCorridors(count: number, avgLength: number, center: ICoord): void {
        for (let i = 0; i < Math.min(count, 4); i++) {
            const direction = this.directions[i];
            if (!direction) continue;
            const randomFactor = this.rng ? this.rng.nextFloat() : Math.random();
            const length = Math.floor(avgLength * (0.8 + randomFactor * 0.4));
            this.addCorridor(center, direction, length);
        }
    }

    private generateGridCorridors(avgLength: number, center: ICoord): void {
        const padding = 5;
        const horizontalStart = { x: Math.max(padding, center.x - avgLength), y: center.y };
        const horizontalEnd = { x: Math.min(this.width - padding, center.x + avgLength), y: center.y };
        const verticalStart = { x: center.x, y: Math.max(padding, center.y - avgLength) };
        const verticalEnd = { x: center.x, y: Math.min(this.height - padding, center.y + avgLength) };

        this.addCorridorDirect(horizontalStart, horizontalEnd, 'right');
        this.addCorridorDirect(verticalStart, verticalEnd, 'down');
    }

    private generateLinearCorridors(count: number, avgLength: number, center: ICoord): void {
        const totalLength = Math.min(avgLength * count, this.width - 10);
        const halfLength = Math.floor(totalLength / 2);
        const start = { x: Math.max(5, center.x - halfLength), y: center.y };
        const end = { x: Math.min(this.width - 5, center.x + halfLength), y: center.y };
        
        if (!this.addCorridorDirect(start, end, 'right')) {
            // Try vertical if horizontal fails
            const vStart = { x: center.x, y: Math.max(5, center.y - halfLength) };
            const vEnd = { x: center.x, y: Math.min(this.height - 5, center.y + halfLength) };
            this.addCorridorDirect(vStart, vEnd, 'down');
        }
    }

    private addCorridor(start: ICoord, direction: BasicDirection, length: number): boolean {
        const end = this.moveInDirection(start, direction, length);
        return this.addCorridorDirect(start, end, direction);
    }

    private addCorridorDirect(start: ICoord, end: ICoord, direction: BasicDirection): boolean {
        // Ensure start and end are valid
        const validStart = {
            x: Math.max(5, Math.min(this.width - 5, start.x)),
            y: Math.max(5, Math.min(this.height - 5, start.y))
        };
        const validEnd = {
            x: Math.max(5, Math.min(this.width - 5, end.x)),
            y: Math.max(5, Math.min(this.height - 5, end.y))
        };
        
        // Ensure corridor has at least some length
        if (validStart.x === validEnd.x && validStart.y === validEnd.y) {
            // Create a minimal corridor
            if (direction === 'right' || direction === 'left') {
                validEnd.x = Math.min(this.width - 5, validStart.x + 5);
            } else {
                validEnd.y = Math.min(this.height - 5, validStart.y + 5);
            }
        }
        
        if (!this.isValidCorridorEnd(validEnd) || !this.isValidCorridorPlacement(validStart, validEnd, direction)) {
            return false;
        }

        this.corridors.push({
            start: validStart,
            end: validEnd,
            direction,
            cells: this.getCorridorCells(validStart, validEnd)
        });
        return true;
    }

    private isValidCorridorEnd(end: ICoord): boolean {
        return end.x >= 5 && end.x < this.width - 5 && end.y >= 5 && end.y < this.height - 5;
    }

    private isValidCorridorPlacement(start: ICoord, end: ICoord, direction: BasicDirection): boolean {
        const proposedCells = this.getCorridorCells(start, end);
        const minDistance = 3;

        return this.corridors.every(corridor => {
            if (!this.areDirectionsParallel(direction, corridor.direction)) return true;

            return proposedCells.every(proposedCell =>
                corridor.cells.every(existingCell => {
                    const distance = this.getPerpendicularDistance(proposedCell, existingCell, direction);
                    return distance >= minDistance || !this.areOnSameLine(proposedCell, existingCell, direction);
                })
            );
        });
    }

    private randomDirection(): BasicDirection {
        const randomIndex = this.rng ? this.rng.nextInt(this.directions.length) : Math.floor(Math.random() * this.directions.length);
        return this.directions[randomIndex]!;
    }

    private randomLength(avgLength: number): number {
        const randomFactor = this.rng ? this.rng.nextFloat() : Math.random();
        return Math.floor(avgLength * (0.7 + randomFactor * 0.6));
    }

    private randomCorridor(): Corridor | undefined {
        const randomIndex = this.rng ? this.rng.nextInt(this.corridors.length) : Math.floor(Math.random() * this.corridors.length);
        return this.corridors[randomIndex];
    }

    private randomMidPointOnCorridor(corridor: Corridor): ICoord {
        const minIndex = Math.floor(corridor.cells.length * 0.2);
        const maxIndex = Math.floor(corridor.cells.length * 0.8);
        const randomRange = this.rng ? this.rng.nextInt(maxIndex - minIndex + 1) : Math.floor(Math.random() * (maxIndex - minIndex + 1));
        const branchIndex = randomRange + minIndex;
        return corridor.cells[branchIndex] || corridor.start;
    }

    private findExtendableCorridor(): Corridor | undefined {
        return this.corridors.find(corridor =>
            this.directions.some(dir => {
                if (dir === this.getOppositeDirection(corridor.direction)) return false;
                const testEnd = this.moveInDirection(corridor.end, dir, 20);
                return this.isValidCorridorEnd(testEnd);
            })
        );
    }

    private getValidExtensionDirections(corridor: Corridor): BasicDirection[] {
        return this.directions.filter(dir => {
            if (dir === this.getOppositeDirection(corridor.direction)) return false;
            const testEnd = this.moveInDirection(corridor.end, dir, 25);
            return this.isValidCorridorEnd(testEnd) &&
                this.isValidCorridorPlacement(corridor.end, testEnd, dir);
        });
    }

    private moveInDirection(point: ICoord, direction: BasicDirection, distance: number): ICoord {
        const moves = {
            up: { x: 0, y: -distance },
            right: { x: distance, y: 0 },
            down: { x: 0, y: distance },
            left: { x: -distance, y: 0 }
        };
        const move = moves[direction];
        return { x: point.x + move.x, y: point.y + move.y };
    }

    private getOppositeDirection(direction: BasicDirection): BasicDirection {
        const opposites = { up: 'down', down: 'up', left: 'right', right: 'left' } as const;
        return opposites[direction];
    }

    private areDirectionsParallel(dir1: BasicDirection, dir2: BasicDirection): boolean {
        const horizontal = ['left', 'right'];
        const vertical = ['up', 'down'];
        return (horizontal.includes(dir1) && horizontal.includes(dir2)) ||
            (vertical.includes(dir1) && vertical.includes(dir2));
    }

    private getPerpendicularDistance(point1: ICoord, point2: ICoord, direction: BasicDirection): number {
        return ['left', 'right'].includes(direction)
            ? Math.abs(point1.y - point2.y)
            : Math.abs(point1.x - point2.x);
    }

    private areOnSameLine(point1: ICoord, point2: ICoord, direction: BasicDirection): boolean {
        const tolerance = 3;
        return ['left', 'right'].includes(direction)
            ? Math.abs(point1.y - point2.y) < tolerance
            : Math.abs(point1.x - point2.x) < tolerance;
    }

    private getCorridorCells(start: ICoord, end: ICoord): ICoord[] {
        const cells: ICoord[] = [];
        const current = { ...start };

        while (current.x !== end.x) {
            cells.push({ ...current });
            current.x += current.x < end.x ? 1 : -1;
        }
        while (current.y !== end.y) {
            cells.push({ ...current });
            current.y += current.y < end.y ? 1 : -1;
        }
        cells.push({ ...end });

        return cells;
    }

    private carveCell(cell: ICoord, map: number[][]): void {
        if (cell.x >= 0 && cell.x < this.width && cell.y >= 0 && cell.y < this.height) {
            const row = map[cell.y];
            if (row) row[cell.x] = 1;
        }
    }
    
    private generateFallbackCorridor(center: ICoord): void {
        // Try to generate a simple corridor in any valid direction
        const minLength = Math.min(10, Math.floor(Math.min(this.width, this.height) / 4));
        
        for (const direction of this.directions) {
            const end = this.moveInDirection(center, direction, minLength);
            if (this.addCorridorDirect(center, end, direction)) {
                return;
            }
        }
        
        // Last resort: create a minimal corridor
        const safeStart = { x: 10, y: Math.floor(this.height / 2) };
        const safeEnd = { x: Math.min(20, this.width - 10), y: Math.floor(this.height / 2) };
        this.corridors.push({
            start: safeStart,
            end: safeEnd,
            direction: 'right',
            cells: this.getCorridorCells(safeStart, safeEnd)
        });
    }
}