import type { ICell, IRoom } from '../interfaces';
import { MapGenerator } from '../helpers/MapGenerator';

export interface MapGenerationResult {
    cells: ICell[][];
    rooms: IRoom[];
    seed: number;
}

export interface BuildingData {
    name: string;
    rooms: Array<{
        name: string;
        size: string;
    }>;
}

const ROOM_SIZE_MAP: Record<string, number> = {
    small: 3,
    medium: 5,
    big: 7,
    large: 9,
    huge: 11
};

const DEFAULT_MAP_WIDTH = 50;
const DEFAULT_MAP_HEIGHT = 50;
const DEFAULT_START_X = 25;
const DEFAULT_START_Y = 25;

export class MapGenerationService {
    private static instance: MapGenerationService;

    private constructor() {}

    public static getInstance(): MapGenerationService {
        if (!MapGenerationService.instance) {
            MapGenerationService.instance = new MapGenerationService();
        }
        return MapGenerationService.instance;
    }

    public generateMap(
        buildings: BuildingData[],
        seed?: number,
        width: number = DEFAULT_MAP_WIDTH,
        height: number = DEFAULT_MAP_HEIGHT
    ): MapGenerationResult {
        const rooms = this.convertBuildingsToRooms(buildings);
        const mapSeed = seed ?? Math.floor(Math.random() * 2147483647);

        const mapGen = new MapGenerator(width, height, 'random', mapSeed);
        const startPos = { x: DEFAULT_START_X, y: DEFAULT_START_Y };

        mapGen.generateMap(rooms, startPos);
        const cells = mapGen.getCells();

        return { cells, rooms, seed: mapSeed };
    }

    private convertBuildingsToRooms(buildings: BuildingData[]): IRoom[] {
        const rooms: IRoom[] = [];

        for (const building of buildings) {
            for (const room of building.rooms) {
                const roomName = `${building.name} - ${room.name}`;
                const size = ROOM_SIZE_MAP[room.size] || 5;

                rooms.push({ name: roomName, size });
            }
        }

        return rooms;
    }

    public getRoomSize(sizeString: string): number {
        return ROOM_SIZE_MAP[sizeString] || 5;
    }

    public generateSeedIfNeeded(providedSeed?: number): number {
        return providedSeed ?? Math.floor(Math.random() * 2147483647);
    }

    public getDefaultMapDimensions(): { width: number; height: number } {
        return {
            width: DEFAULT_MAP_WIDTH,
            height: DEFAULT_MAP_HEIGHT
        };
    }

    public getDefaultStartPosition(): { x: number; y: number } {
        return {
            x: DEFAULT_START_X,
            y: DEFAULT_START_Y
        };
    }
}