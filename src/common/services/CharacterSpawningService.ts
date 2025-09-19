import type { ICharacter, ICell, ICoord } from '../interfaces';
import { baseCharacter } from '../../data/state';
import { MAIN_CHARACTER_NAME, COMPANION_DROID_NAME, PLAYER_TEAM, HUMAN_PLAYER } from '../constants';
import { CharacterPositioningError } from '../errors/CharacterPositioningError';

export interface CharacterSpawnData {
    name: string;
    race: 'human' | 'alien' | 'robot';
    description: string;
    location: string;
    orientation?: string;
    palette?: {
        skin: string;
        helmet: string;
        suit: string;
    };
    player?: string;
    team?: string;
    faction?: string;
}

export class CharacterSpawningService {
    private static instance: CharacterSpawningService;

    private constructor() {}

    public static getInstance(): CharacterSpawningService {
        if (!CharacterSpawningService.instance) {
            CharacterSpawningService.instance = new CharacterSpawningService();
        }
        return CharacterSpawningService.instance;
    }

    public createCharacterFromBase(overrides: Partial<ICharacter>): ICharacter {
        const base = structuredClone(baseCharacter);
        return {
            ...base,
            ...overrides,
            inventory: overrides.inventory || base.inventory,
            actions: overrides.actions || base.actions,
            palette: overrides.palette || base.palette
        };
    }

    public findSpawnPosition(
        location: string,
        map: ICell[][],
        occupiedPositions: Set<string>
    ): ICoord | null {
        // Handle special location strings
        if (location === 'center') {
            return this.findCenterPosition(map, occupiedPositions);
        }

        if (location === 'near_player') {
            return this.findNearPlayerPosition(map, occupiedPositions);
        }

        // Try coordinate format
        const coordMatch = location.match(/(\d+),\s*(\d+)/);
        if (coordMatch && coordMatch[1] && coordMatch[2]) {
            return {
                x: parseInt(coordMatch[1], 10),
                y: parseInt(coordMatch[2], 10)
            };
        }

        // Try to find room by name
        const roomPos = this.findRoomPosition(location, map, occupiedPositions);
        if (roomPos) {
            return roomPos;
        }

        // Fallback to first walkable position
        return this.findFirstWalkablePosition(map, occupiedPositions);
    }

    private findCenterPosition(map: ICell[][], occupiedPositions: Set<string>): ICoord | null {
        const centerX = Math.floor((map[0]?.length || 0) / 2);
        const centerY = Math.floor(map.length / 2);

        return this.searchInRadius(centerX, centerY, map, occupiedPositions, 10);
    }

    private findNearPlayerPosition(map: ICell[][], occupiedPositions: Set<string>): ICoord | null {
        const playerPos = this.findCenterPosition(map, new Set());
        if (!playerPos) return null;

        const offsets: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]];
        for (const [dx, dy] of offsets) {
            const x = playerPos.x + dx;
            const y = playerPos.y + dy;
            if (this.isValidPosition(x, y, map, occupiedPositions)) {
                return { x, y };
            }
        }

        return null;
    }

    private findRoomPosition(
        roomName: string,
        map: ICell[][],
        occupiedPositions: Set<string>
    ): ICoord | null {
        const normalizedName = roomName.toLowerCase().trim();
        const roomCells: ICoord[] = [];

        for (let y = 0; y < map.length; y++) {
            const row = map[y];
            if (!row) continue;

            for (let x = 0; x < row.length; x++) {
                const cell = row[x];
                if (!cell?.locations) continue;

                const hasRoom = cell.locations.some(loc =>
                    loc.toLowerCase().includes(normalizedName) ||
                    normalizedName.includes(loc.toLowerCase())
                );

                if (hasRoom && !cell.content?.blocker) {
                    roomCells.push({ x, y });
                }
            }
        }

        // Find first unoccupied cell
        for (const cell of roomCells) {
            const posKey = `${cell.x},${cell.y}`;
            if (!occupiedPositions.has(posKey)) {
                return cell;
            }
        }

        // Return random cell if all occupied
        return roomCells.length > 0 ? (roomCells[0] ?? null) : null;
    }

    private findFirstWalkablePosition(
        map: ICell[][],
        occupiedPositions: Set<string>
    ): ICoord | null {
        for (let y = 0; y < map.length; y++) {
            const row = map[y];
            if (!row) continue;

            for (let x = 0; x < row.length; x++) {
                if (this.isValidPosition(x, y, map, occupiedPositions)) {
                    return { x, y };
                }
            }
        }

        return null;
    }

    private searchInRadius(
        centerX: number,
        centerY: number,
        map: ICell[][],
        occupiedPositions: Set<string>,
        maxRadius: number
    ): ICoord | null {
        for (let radius = 0; radius < maxRadius; radius++) {
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    const x = centerX + dx;
                    const y = centerY + dy;
                    if (this.isValidPosition(x, y, map, occupiedPositions)) {
                        return { x, y };
                    }
                }
            }
        }
        return null;
    }

    private isValidPosition(
        x: number,
        y: number,
        map: ICell[][],
        occupiedPositions: Set<string>
    ): boolean {
        if (y < 0 || y >= map.length) return false;

        const row = map[y];
        if (!row || x < 0 || x >= row.length) return false;

        const cell = row[x];
        if (!cell || !cell.locations || cell.content?.blocker) return false;

        const posKey = `${x},${y}`;
        return !occupiedPositions.has(posKey);
    }

    public validatePosition(position: ICoord, mapBounds: { width: number; height: number }): void {
        if (position.x < 0 || position.x >= mapBounds.width ||
            position.y < 0 || position.y >= mapBounds.height) {
            throw new CharacterPositioningError(
                'Unknown',
                `Invalid position (${position.x}, ${position.y})`,
                [],
                mapBounds
            );
        }
    }

    public getAvailableRooms(map: ICell[][]): string[] {
        const rooms = new Set<string>();

        for (const row of map) {
            if (!row) continue;
            for (const cell of row) {
                if (cell?.locations) {
                    for (const loc of cell.locations) {
                        if (loc !== 'wall' && loc !== 'floor') {
                            rooms.add(loc);
                        }
                    }
                }
            }
        }

        return Array.from(rooms);
    }

    public determineTeam(charData: CharacterSpawnData): string {
        // Use faction field if explicitly provided
        if (charData.faction) {
            // Map faction values to team values
            if (charData.faction === 'enemy') {
                return 'enemy';
            }
            if (charData.faction === 'player') {
                return PLAYER_TEAM;
            }
            if (charData.faction === 'neutral') {
                return 'neutral';
            }
            // If faction is already a team value, use it directly
            return charData.faction;
        }

        // Fallback to description-based detection
        const desc = (charData.description || '').toLowerCase();
        if (desc.includes('enemy') || desc.includes('hostile') || desc.includes('enemigo')) {
            return 'enemy';
        }

        if (desc.includes('ally') || desc.includes('friend') || desc.includes('aliado')) {
            return PLAYER_TEAM;
        }

        return 'neutral';
    }

    public ensurePlayerCharacters(): CharacterSpawnData[] {
        return [
            {
                name: MAIN_CHARACTER_NAME,
                race: 'human',
                description: 'The player character',
                location: 'center',
                player: HUMAN_PLAYER,
                team: PLAYER_TEAM,
                palette: {
                    skin: '#d7a55f',
                    helmet: 'white',
                    suit: 'white'
                }
            },
            {
                name: COMPANION_DROID_NAME,
                race: 'robot',
                description: 'Your robot companion',
                location: 'near_player',
                player: HUMAN_PLAYER,
                team: PLAYER_TEAM,
                palette: {
                    skin: 'yellow',
                    helmet: 'gold',
                    suit: 'gold'
                }
            }
        ];
    }
}