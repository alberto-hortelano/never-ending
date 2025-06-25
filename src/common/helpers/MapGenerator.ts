import type { ICell, ICoord, IRoom } from "../interfaces";
import { CorridorGenerator, type CorridorPattern, type Corridor } from "./CorridorGenerator";
import { RoomPlacer } from "./RoomPlacer";

export class MapGenerator {
    private map: number[][];
    private corridorGenerator: CorridorGenerator;
    private roomPlacer: RoomPlacer;
    private corridors: Corridor[] = [];
    private placedRooms: { room: IRoom; position: ICoord; size: number }[] = [];

    constructor(
        private width: number = 50,
        private height: number = 50,
        private corridorPattern: CorridorPattern = 'random',
    ) {
        this.map = Array(height).fill(null).map(() => Array(width).fill(0));
        this.corridorGenerator = new CorridorGenerator(width, height);
        this.roomPlacer = new RoomPlacer(width, height, this.corridorGenerator);
    }

    public getCells(): ICell[][] {
        // this.printMap(this.map);
        return this.map.map((row, y) => row.map((cell, x) => {
            const roomNames = this.getRoomNamesForCell({ x, y });
            return {
                position: { x, y },
                locations: roomNames,
                elements: [],
                content: {
                    position: { x, y },
                    location: roomNames[0] || '',
                    blocker: !cell,
                },
            };
        }))
    }

    public generateMap(rooms: IRoom[], startingPoint: ICoord): number[][] {
        this.reset();
        if (rooms.length === 0) return this.map;

        this.corridors = this.corridorGenerator.generateCorridors(rooms.length, this.corridorPattern, startingPoint);
        const roomPlacements = this.roomPlacer.placeAllRooms(rooms, this.corridors);
        this.placedRooms = roomPlacements.map(placement => ({
            room: placement.room,
            position: placement.position,
            size: placement.room.size
        }));
        this.carveEverything();
        this.trimMap();

        return this.map;
    }

    private reset(): void {
        this.corridors = [];
        this.placedRooms = [];
        this.map = Array(this.height).fill(null).map(() => Array(this.width).fill(0));
    }

    private carveEverything(): void {
        this.corridorGenerator.carveCorridors(this.map);
        this.roomPlacer.carveRooms(this.map);
        this.roomPlacer.carveRoomConnections(this.map);
    }

    private trimMap(): void {
        // Find first and last non-empty rows
        let firstRow = -1;
        let lastRow = -1;
        
        for (let y = 0; y < this.map.length; y++) {
            const row = this.map[y];
            if (row && row.some(cell => cell !== 0)) {
                if (firstRow === -1) firstRow = y;
                lastRow = y;
            }
        }
        
        // Find first and last non-empty columns
        let firstCol = -1;
        let lastCol = -1;
        
        for (let x = 0; x < this.width; x++) {
            let hasNonZero = false;
            for (let y = 0; y < this.map.length; y++) {
                const row = this.map[y];
                if (row && row[x] !== 0) {
                    hasNonZero = true;
                    break;
                }
            }
            if (hasNonZero) {
                if (firstCol === -1) firstCol = x;
                lastCol = x;
            }
        }
        
        // If map is all zeros, return as is
        if (firstRow === -1 || firstCol === -1) return;
        
        // Create trimmed map
        const trimmedMap: number[][] = [];
        for (let y = firstRow; y <= lastRow; y++) {
            const row = this.map[y];
            if (row) {
                trimmedMap.push(row.slice(firstCol, lastCol + 1));
            }
        }
        
        // Update map and dimensions
        this.map = trimmedMap;
        this.height = trimmedMap.length;
        this.width = trimmedMap[0]?.length || 0;
        
        // Adjust placed room positions to account for trimming
        const offsetX = firstCol;
        const offsetY = firstRow;
        this.placedRooms = this.placedRooms.map(placedRoom => ({
            ...placedRoom,
            position: {
                x: placedRoom.position.x - offsetX,
                y: placedRoom.position.y - offsetY
            }
        }));
    }

    private getRoomNamesForCell(coord: ICoord): string[] {
        const roomNames: string[] = [];

        for (const placedRoom of this.placedRooms) {
            const { room, position } = placedRoom;
            const halfSize = Math.floor(room.size / 2);

            // Check if this cell is within the room's bounds
            if (coord.x >= position.x - halfSize &&
                coord.x <= position.x + halfSize &&
                coord.y >= position.y - halfSize &&
                coord.y <= position.y + halfSize) {
                roomNames.push(room.name);
            }
        }

        return roomNames;
    }

    private printMap = (map: number[][]) => {
        console.log(map.map(row => row.map(cell => cell ? ' ' : '#').join('')).join('\n'));
    }
}