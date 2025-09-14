import type { ICell, ICoord, IRoom } from "../interfaces";
import { CorridorGenerator, type CorridorPattern, type Corridor } from "./CorridorGenerator";
import { RoomPlacer } from "./RoomPlacer";
import { SeededRandom } from "./SeededRandom";

const DEFAULT_MAP_WIDTH = 50;
const DEFAULT_MAP_HEIGHT = 50;
const DEFAULT_CORRIDOR_PATTERN: CorridorPattern = 'random';

interface PlacedRoom {
    room: IRoom;
    position: ICoord;
    size: number;
}

export class MapGenerator {
    private map: number[][];
    private corridorGenerator: CorridorGenerator;
    private roomPlacer: RoomPlacer;
    private corridors: Corridor[] = [];
    private placedRooms: PlacedRoom[] = [];
    private rng?: SeededRandom;
    private readonly seed?: number;

    constructor(
        private readonly width: number = DEFAULT_MAP_WIDTH,
        private readonly height: number = DEFAULT_MAP_HEIGHT,
        private readonly corridorPattern: CorridorPattern = DEFAULT_CORRIDOR_PATTERN,
        seed?: number
    ) {
        this.map = this.createEmptyMap();
        this.seed = seed;
        if (seed !== undefined) {
            this.rng = new SeededRandom(seed);
        }
        this.corridorGenerator = new CorridorGenerator(width, height, this.rng);
        this.roomPlacer = new RoomPlacer(width, height, this.corridorGenerator);
    }

    private createEmptyMap(): number[][] {
        return Array(this.height).fill(null).map(() => Array(this.width).fill(0));
    }

    public getCells(): ICell[][] {
        return this.map.map((row, y) => row.map((cell, x) =>
            this.createCell(x, y, cell)
        ));
    }

    private createCell(x: number, y: number, cellValue: number): ICell {
        const roomNames = this.getRoomNamesForCell({ x, y });
        return {
            position: { x, y },
            locations: roomNames,
            elements: [],
            content: {
                position: { x, y },
                location: roomNames[0] || '',
                blocker: !cellValue,
            },
        };
    }

    public generateMap(rooms: IRoom[], startingPoint: ICoord): number[][] {
        this.reset();
        if (rooms.length === 0) return this.map;

        this.corridors = this.corridorGenerator.generateCorridors(
            rooms.length,
            this.corridorPattern,
            startingPoint
        );

        const roomPlacements = this.roomPlacer.placeAllRooms(rooms, this.corridors);
        this.placedRooms = this.createPlacedRooms(roomPlacements);

        this.carveEverything();
        this.trimMap();

        return this.map;
    }

    private createPlacedRooms(placements: ReturnType<RoomPlacer['placeAllRooms']>): PlacedRoom[] {
        return placements.map(placement => ({
            room: placement.room,
            position: placement.position,
            size: placement.room.size
        }));
    }

    private reset(): void {
        this.corridors = [];
        this.placedRooms = [];
        this.map = this.createEmptyMap();
    }

    private carveEverything(): void {
        this.corridorGenerator.carveCorridors(this.map);
        this.roomPlacer.carveRooms(this.map);
        this.roomPlacer.carveRoomConnections(this.map);
    }

    private trimMap(): void {
        const bounds = this.findMapBounds();
        if (!bounds) return;

        const { firstRow, lastRow, firstCol, lastCol } = bounds;
        this.map = this.extractTrimmedMap(firstRow, lastRow, firstCol, lastCol);
        this.adjustPlacedRoomPositions(firstCol, firstRow);
    }

    private findMapBounds(): { firstRow: number; lastRow: number; firstCol: number; lastCol: number } | null {
        let firstRow = -1;
        let lastRow = -1;

        for (let y = 0; y < this.map.length; y++) {
            const row = this.map[y];
            if (row && row.some(cell => cell !== 0)) {
                if (firstRow === -1) firstRow = y;
                lastRow = y;
            }
        }

        let firstCol = -1;
        let lastCol = -1;

        for (let x = 0; x < this.width; x++) {
            if (this.columnHasNonZero(x)) {
                if (firstCol === -1) firstCol = x;
                lastCol = x;
            }
        }

        if (firstRow === -1 || firstCol === -1) return null;

        // Add one row margin on all sides
        return {
            firstRow: Math.max(0, firstRow - 1),
            lastRow: Math.min(this.map.length - 1, lastRow + 1),
            firstCol: Math.max(0, firstCol - 1),
            lastCol: Math.min(this.width - 1, lastCol + 1)
        };
    }

    private columnHasNonZero(x: number): boolean {
        for (let y = 0; y < this.map.length; y++) {
            const row = this.map[y];
            if (row && row[x] !== 0) {
                return true;
            }
        }
        return false;
    }

    private extractTrimmedMap(firstRow: number, lastRow: number, firstCol: number, lastCol: number): number[][] {
        const trimmedMap: number[][] = [];
        for (let y = firstRow; y <= lastRow; y++) {
            const row = this.map[y];
            if (row) {
                trimmedMap.push(row.slice(firstCol, lastCol + 1));
            }
        }
        return trimmedMap;
    }

    private adjustPlacedRoomPositions(offsetX: number, offsetY: number): void {
        this.placedRooms = this.placedRooms.map(placedRoom => ({
            ...placedRoom,
            position: {
                x: placedRoom.position.x - offsetX,
                y: placedRoom.position.y - offsetY
            }
        }));
    }

    private getRoomNamesForCell(coord: ICoord): string[] {
        return this.placedRooms
            .filter(placedRoom => this.isCoordInRoom(coord, placedRoom))
            .map(placedRoom => placedRoom.room.name);
    }

    private isCoordInRoom(coord: ICoord, placedRoom: PlacedRoom): boolean {
        const { room, position } = placedRoom;
        const halfSize = Math.floor(room.size / 2);

        return coord.x >= position.x - halfSize &&
               coord.x <= position.x + halfSize &&
               coord.y >= position.y - halfSize &&
               coord.y <= position.y + halfSize;
    }

    public getSeed(): number | undefined {
        return this.seed;
    }
}