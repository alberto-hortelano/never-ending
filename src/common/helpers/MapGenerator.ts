import type { ICell, ICoord, IRoom } from "../interfaces";
import { CorridorGenerator, type CorridorPattern, type Corridor } from "./CorridorGenerator";
import { RoomPlacer } from "./RoomPlacer";

export class MapGenerator {
    private map: number[][];
    private corridorGenerator: CorridorGenerator;
    private roomPlacer: RoomPlacer;
    private corridors: Corridor[] = [];

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
        this.printMap(this.map);
        return this.map.map((row, y) => row.map((cell, x) => ({
            position: { x, y },
            locations: [],
            elements: [],
            content: {
                position: { x, y },
                location: '',
                blocker: !cell,
            },
        })))
    }

    public generateMap(rooms: IRoom[], startingPoint: ICoord): number[][] {
        this.reset();
        if (rooms.length === 0) return this.map;

        this.corridors = this.corridorGenerator.generateCorridors(rooms.length, this.corridorPattern, startingPoint);
        this.roomPlacer.placeAllRooms(rooms, this.corridors);
        this.carveEverything();

        return this.map;
    }

    private reset(): void {
        this.corridors = [];
        this.map = Array(this.height).fill(null).map(() => Array(this.width).fill(0));
    }

    private carveEverything(): void {
        this.corridorGenerator.carveCorridors(this.map);
        this.roomPlacer.carveRooms(this.map);
        this.roomPlacer.carveRoomConnections(this.map);
    }

    private printMap = (map: number[][]) => {
        console.log(map.map(row => row.map(cell => cell ? ' ' : '#').join('')).join('\n'));
    }
}