import type { BasicDirection, ICoord } from "../interfaces";
import type { SeededRandom } from "./SeededRandom";

export type CorridorPattern = 'random' | 'star' | 'grid' | 'linear';

const CORRIDOR_PADDING = 5;
const MIN_CORRIDOR_DISTANCE = 3;
const DEFAULT_CORRIDOR_LENGTH_FACTOR = 0.25;
const CORRIDOR_LENGTH_VARIANCE = 0.6;
const CORRIDOR_MID_POINT_MIN = 0.2;
const CORRIDOR_MID_POINT_MAX = 0.8;

export interface Corridor {
    start: ICoord;
    end: ICoord;
    direction: BasicDirection;
    cells: ICoord[];
}

type DirectionMap = Record<BasicDirection, ICoord>;

export class CorridorGenerator {
    private corridors: Corridor[] = [];
    private readonly directions: readonly BasicDirection[] = ['up', 'right', 'down', 'left'] as const;
    private readonly directionMoves: DirectionMap = {
        up: { x: 0, y: -1 },
        right: { x: 1, y: 0 },
        down: { x: 0, y: 1 },
        left: { x: -1, y: 0 }
    };
    private readonly oppositeDirections: Record<BasicDirection, BasicDirection> = {
        up: 'down',
        down: 'up',
        left: 'right',
        right: 'left'
    };

    constructor(
        private readonly width: number,
        private readonly height: number,
        private readonly rng?: SeededRandom
    ) {}

    public generateCorridors(
        roomCount: number,
        pattern: CorridorPattern,
        center: ICoord = this.getMapCenter()
    ): Corridor[] {
        this.corridors = [];
        const corridorCount = this.calculateCorridorCount(roomCount);
        const avgLength = this.calculateAverageLength();

        this.generateByPattern(pattern, corridorCount, avgLength, center);
        this.ensureMinimumCorridors(center);

        return [...this.corridors];
    }

    private getMapCenter(): ICoord {
        return {
            x: Math.floor(this.width / 2),
            y: Math.floor(this.height / 2)
        };
    }

    private calculateCorridorCount(roomCount: number): number {
        return Math.max(2, Math.ceil(roomCount * 0.8));
    }

    private calculateAverageLength(): number {
        return Math.min(this.width, this.height) * DEFAULT_CORRIDOR_LENGTH_FACTOR;
    }

    private generateByPattern(
        pattern: CorridorPattern,
        corridorCount: number,
        avgLength: number,
        center: ICoord
    ): void {
        const generators: Record<CorridorPattern, () => void> = {
            random: () => this.generateRandomCorridors(corridorCount, avgLength, center),
            star: () => this.generateStarCorridors(corridorCount, avgLength, center),
            grid: () => this.generateGridCorridors(avgLength, center),
            linear: () => this.generateLinearCorridors(corridorCount, avgLength, center)
        };

        generators[pattern]();
    }

    private ensureMinimumCorridors(center: ICoord): void {
        if (this.corridors.length === 0) {
            this.generateFallbackCorridor(center);
        }
    }

    public extendCorridor(corridorIndex: number): void {
        const corridor = this.corridors[corridorIndex];
        if (!corridor) return;

        const validDirections = this.getValidExtensionDirections(corridor);
        if (validDirections.length === 0) return;

        const direction = this.selectRandomDirection(validDirections);
        this.addCorridor(corridor.end, direction, 15);
    }

    public addNewCorridorBranch(): void {
        const baseCorridor = this.selectRandomCorridor();
        if (!baseCorridor) return;

        const branchPoint = this.selectRandomMidPoint(baseCorridor);
        const perpendicularDirections = this.getPerpendicularDirections(baseCorridor.direction);

        if (perpendicularDirections.length === 0) return;

        const direction = this.selectRandomDirection(perpendicularDirections);
        const length = Math.floor(Math.min(this.width, this.height) / 6) + 10;
        this.addCorridor(branchPoint, direction, length);
    }

    public addLongCorridors(): void {
        const maxAttempts = 3;
        for (let i = 0; i < maxAttempts; i++) {
            const extendableCorridor = this.findExtendableCorridor();
            if (!extendableCorridor) continue;

            const validDirections = this.getValidDirectionsForExtension(extendableCorridor);
            if (validDirections.length === 0) continue;

            const direction = this.selectRandomDirection(validDirections);
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
        const firstDirection = this.selectRandomDirection(this.directions);
        const firstLength = this.randomLength(avgLength);
        this.addCorridor(center, firstDirection, firstLength);

        for (let i = 1; i < count; i++) {
            const existingCorridor = this.selectRandomCorridor();
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
        return end.x >= CORRIDOR_PADDING &&
               end.x < this.width - CORRIDOR_PADDING &&
               end.y >= CORRIDOR_PADDING &&
               end.y < this.height - CORRIDOR_PADDING;
    }

    private isValidCorridorPlacement(start: ICoord, end: ICoord, direction: BasicDirection): boolean {
        const proposedCells = this.getCorridorCells(start, end);

        return this.corridors.every(corridor =>
            this.isCorridorValidAgainstExisting(proposedCells, corridor, direction)
        );
    }

    private isCorridorValidAgainstExisting(
        proposedCells: ICoord[],
        corridor: Corridor,
        direction: BasicDirection
    ): boolean {
        if (!this.areDirectionsParallel(direction, corridor.direction)) return true;

        return proposedCells.every(proposedCell =>
            corridor.cells.every(existingCell =>
                this.cellsHaveMinimumDistance(proposedCell, existingCell, direction)
            )
        );
    }

    private cellsHaveMinimumDistance(
        cell1: ICoord,
        cell2: ICoord,
        direction: BasicDirection
    ): boolean {
        const distance = this.getPerpendicularDistance(cell1, cell2, direction);
        return distance >= MIN_CORRIDOR_DISTANCE ||
               !this.areOnSameLine(cell1, cell2, direction);
    }

    private selectRandomDirection(directions: readonly BasicDirection[]): BasicDirection {
        const index = this.getRandomInt(directions.length);
        return directions[index] ?? directions[0]!;
    }

    private selectRandomCorridor(): Corridor | undefined {
        if (this.corridors.length === 0) return undefined;
        const index = this.getRandomInt(this.corridors.length);
        return this.corridors[index];
    }

    private selectRandomMidPoint(corridor: Corridor): ICoord {
        const minIndex = Math.floor(corridor.cells.length * CORRIDOR_MID_POINT_MIN);
        const maxIndex = Math.floor(corridor.cells.length * CORRIDOR_MID_POINT_MAX);
        const range = maxIndex - minIndex + 1;
        const branchIndex = this.getRandomInt(range) + minIndex;
        return corridor.cells[branchIndex] ?? corridor.start;
    }

    private getRandomInt(max: number): number {
        return this.rng ? this.rng.nextInt(max) : Math.floor(Math.random() * max);
    }

    private getRandomFloat(): number {
        return this.rng ? this.rng.nextFloat() : Math.random();
    }

    private randomLength(avgLength: number): number {
        const variance = 0.7 + this.getRandomFloat() * CORRIDOR_LENGTH_VARIANCE;
        return Math.floor(avgLength * variance);
    }

    private findExtendableCorridor(): Corridor | undefined {
        return this.corridors.find(corridor =>
            this.canExtendCorridor(corridor)
        );
    }

    private canExtendCorridor(corridor: Corridor): boolean {
        return this.directions.some(dir => {
            if (dir === this.getOppositeDirection(corridor.direction)) return false;
            const testEnd = this.moveInDirection(corridor.end, dir, 20);
            return this.isValidCorridorEnd(testEnd);
        });
    }

    private getValidExtensionDirections(corridor: Corridor): BasicDirection[] {
        return Array.from(this.directions).filter(dir =>
            dir !== this.getOppositeDirection(corridor.direction)
        );
    }

    private getValidDirectionsForExtension(corridor: Corridor): BasicDirection[] {
        return Array.from(this.directions).filter(dir => {
            if (dir === this.getOppositeDirection(corridor.direction)) return false;
            const testEnd = this.moveInDirection(corridor.end, dir, 25);
            return this.isValidCorridorEnd(testEnd) &&
                   this.isValidCorridorPlacement(corridor.end, testEnd, dir);
        });
    }

    private getPerpendicularDirections(direction: BasicDirection): BasicDirection[] {
        return Array.from(this.directions).filter(dir =>
            !this.areDirectionsParallel(dir, direction)
        );
    }

    private moveInDirection(point: ICoord, direction: BasicDirection, distance: number): ICoord {
        const move = this.directionMoves[direction];
        return {
            x: point.x + move.x * distance,
            y: point.y + move.y * distance
        };
    }

    private getOppositeDirection(direction: BasicDirection): BasicDirection {
        return this.oppositeDirections[direction];
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