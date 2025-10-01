import type { ICharacter, ICell, ICoord } from '../interfaces';
import { baseCharacter } from '../../data/state';
import { MAIN_CHARACTER_NAME, COMPANION_DROID_NAME, PLAYER_FACTION, HUMAN_CONTROLLER } from '../constants';
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
    controller?: string;
    faction?: string;
}

export class CharacterSpawningService {
    private static instance: CharacterSpawningService;

    private constructor() { }

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
        occupiedPositions: Set<string>,
        existingCharacters?: Array<{ name: string; position: ICoord }>
    ): ICoord | null {
        console.log(`[CharacterSpawningService] Finding spawn position for location: "${location}"`);

        // Try to find a character with this name
        if (existingCharacters) {
            const targetCharacter = existingCharacters.find(c =>
                c.name.toLowerCase() === location.toLowerCase()
            );
            if (targetCharacter) {
                console.log(`[CharacterSpawningService] Found character "${location}" at position (${targetCharacter.position.x}, ${targetCharacter.position.y})`);
                // Find a position near the target character
                return this.findNearPosition(targetCharacter.position, map, occupiedPositions);
            }
        }

        // Try to find room by name
        console.log(`[CharacterSpawningService] Searching for room: "${location}"`);
        const roomPos = this.findRoomPosition(location, map, occupiedPositions);
        if (roomPos) {
            console.log(`[CharacterSpawningService] Found room position for "${location}": (${roomPos.x}, ${roomPos.y})`);
            return roomPos;
        }

        // Location not found - throw error with helpful information
        const availableRooms = this.getAvailableRooms(map);
        const characterNames = existingCharacters?.map(c => c.name).join(', ') || 'none';
        console.error(`[CharacterSpawningService] ERROR: Location "${location}" not found.`);
        console.error(`[CharacterSpawningService]   Available rooms: ${availableRooms.join(', ')}`);
        console.error(`[CharacterSpawningService]   Available characters: ${characterNames}`);
        throw new CharacterPositioningError(
            'Unknown',
            location,
            availableRooms,
            { width: map[0]?.length || 50, height: map.length }
        );
    }

    private findNearPosition(targetPos: ICoord, map: ICell[][], occupiedPositions: Set<string>): ICoord | null {
        // Try adjacent cells first
        const offsets: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]];
        for (const [dx, dy] of offsets) {
            const x = targetPos.x + dx;
            const y = targetPos.y + dy;
            if (this.isValidPosition(x, y, map, occupiedPositions)) {
                return { x, y };
            }
        }

        // If no adjacent cell is available, search in a wider radius
        return this.searchInRadius(targetPos.x, targetPos.y, map, occupiedPositions, 5);
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

        // Filter to get only unoccupied cells
        const availableCells = roomCells.filter(cell => {
            const posKey = `${cell.x},${cell.y}`;
            return !occupiedPositions.has(posKey);
        });

        // Randomly select from available cells
        if (availableCells.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableCells.length);
            return availableCells[randomIndex] ?? null;
        }

        // If all cells in the room are occupied, find an adjacent free cell near the room
        if (roomCells.length > 0) {
            console.warn(`[CharacterSpawningService] All cells in room "${roomName}" are occupied, searching for adjacent position`);
            // Try each room cell and find an adjacent free position
            for (const roomCell of roomCells) {
                const nearPos = this.findNearPosition(roomCell, map, occupiedPositions);
                if (nearPos) {
                    console.log(`[CharacterSpawningService] Found adjacent position (${nearPos.x}, ${nearPos.y}) near room`);
                    return nearPos;
                }
            }
            console.error(`[CharacterSpawningService] Could not find any free position near room "${roomName}"`);
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

    public determineFaction(charData: CharacterSpawnData): string {
        // Use faction field if explicitly provided
        if (charData.faction) {
            // Map faction values to faction values
            if (charData.faction === 'enemy') {
                return 'enemy';
            }
            if (charData.faction === 'player') {
                return PLAYER_FACTION;
            }
            if (charData.faction === 'neutral') {
                return 'neutral';
            }
            // If faction is already a faction value, use it directly
            return charData.faction;
        }

        // Fallback to description-based detection
        const desc = (charData.description || '').toLowerCase();
        if (desc.includes('enemy') || desc.includes('hostile') || desc.includes('enemigo')) {
            return 'enemy';
        }

        if (desc.includes('ally') || desc.includes('friend') || desc.includes('aliado')) {
            return PLAYER_FACTION;
        }

        return 'neutral';
    }

    public ensurePlayerCharacters(firstRoomName: string): CharacterSpawnData[] {
        // firstRoomName MUST be provided - no defaults allowed
        if (!firstRoomName) {
            throw new Error('Location must be specified for player characters - no defaults allowed');
        }

        return [
            {
                name: MAIN_CHARACTER_NAME,
                race: 'human',
                description: 'The player character',
                location: firstRoomName,
                controller: HUMAN_CONTROLLER,
                faction: PLAYER_FACTION,
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
                location: MAIN_CHARACTER_NAME, // Spawn near the player character
                controller: HUMAN_CONTROLLER,
                faction: PLAYER_FACTION,
                palette: {
                    skin: 'yellow',
                    helmet: 'gold',
                    suit: 'gold'
                }
            }
        ];
    }
}