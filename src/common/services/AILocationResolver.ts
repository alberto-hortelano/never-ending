import type { ICoord, ICell, ICharacter } from '../interfaces';
import type { DeepReadonly } from '../helpers/types';
import type { State } from '../State';

/**
 * Location resolution and positioning utilities for AI
 * Handles converting location strings (room names, character names) to coordinates
 */
export class AILocationResolver {
    /**
     * Resolve a location string to coordinates
     * @param location - Room name, character name, or "center"
     * @param state - Game state
     * @param fromCharacter - Optional character to calculate nearest empty from
     * @param allowCoordinates - Whether to allow coordinate strings (for internal use only)
     */
    static resolveLocation(
        location: string,
        state: State,
        _fromCharacter?: DeepReadonly<ICharacter>,
        allowCoordinates = false
    ): ICoord | null {
        if (!location || location.trim() === '') {
            throw new Error(`[AI] Invalid location: location is empty or null`);
        }

        if (!state) {
            throw new Error(`[AI] Cannot resolve location: game state is not initialized`);
        }

        if (!state.characters || !state.map) {
            throw new Error(`[AI] Cannot resolve location: game state is not initialized`);
        }

        const lowerLocation = location.toLowerCase().trim();

        // Check if it's a direction - these are NOT allowed
        const directions = [
            'north', 'south', 'east', 'west', 'up', 'down', 'left', 'right',
            'northeast', 'northwest', 'southeast', 'southwest',
            'north-east', 'north-west', 'south-east', 'south-west'
        ];

        if (directions.includes(lowerLocation)) {
            const errorMsg = `[AI] Invalid location format '${location}': Movement locations must be room names or character names, not directions. Use actual location names like 'Cargo Bay' or character names like 'Enemy Captain'.`;
            console.error(errorMsg);
            throw new Error(errorMsg);
        }

        // Handle "center" or "center of map"
        if (lowerLocation.includes('center')) {
            const mapWidth = state.map[0]?.length || 50;
            const mapHeight = state.map.length || 50;
            return { x: Math.floor(mapWidth / 2), y: Math.floor(mapHeight / 2) };
        }

        // Try to find character by name (case-insensitive)
        const targetChar = state.characters.find((c: DeepReadonly<ICharacter>) =>
            c.name.toLowerCase() === lowerLocation
        );
        if (targetChar) {
            // Return the character's exact position
            // Path finding will handle finding a valid adjacent cell if needed
            return { x: targetChar.position.x, y: targetChar.position.y };
        }

        // Try to find room by name
        const roomPosition = this.findRoomCenter(location, state);
        if (roomPosition) {
            return roomPosition;
        }

        // Try to parse as building/room
        if (location.includes('/')) {
            const parts = location.split('/');
            const roomName = parts[parts.length - 1]; // Get last part as room name
            const roomPos = roomName ? this.findRoomCenter(roomName, state) : null;
            if (roomPos) {
                return roomPos;
            }
        }

        // Check for coordinate strings (e.g., "11,12")
        const coordMatch = location.match(/(\d+),\s*(\d+)/);
        if (coordMatch && coordMatch[1] && coordMatch[2]) {
            if (allowCoordinates) {
                // Parse and validate coordinates for internal system use
                const x = parseInt(coordMatch[1], 10);
                const y = parseInt(coordMatch[2], 10);

                // Validate coordinates are within map bounds
                const mapWidth = state.map[0]?.length || 50;
                const mapHeight = state.map.length || 50;

                if (x >= 0 && x < mapWidth && y >= 0 && y < mapHeight) {
                    return { x, y };
                }

                const errorMsg = `[AI] Coordinate '${location}' is out of map bounds (${mapWidth}x${mapHeight})`;
                console.error(errorMsg);
                throw new Error(errorMsg);
            } else {
                // Coordinates from AI commands are not allowed
                const errorMsg = `[AI] Invalid location format '${location}': Movement locations must be room names or character names, not coordinates. Use names like 'Cargo Bay', 'Bridge', or character names like 'Enemy Captain'.`;
                console.error(errorMsg);
                throw new Error(errorMsg);
            }
        }

        // If we couldn't resolve the location, throw an error with helpful information
        const availableRooms = this.getAvailableRoomNames(state);
        const availableCharacters = state.characters.map(c => c.name).join(', ');
        const errorMsg = `[AI] Could not resolve location '${location}'. Available rooms: [${availableRooms.join(', ')}]. Available characters: [${availableCharacters}]`;
        console.error(errorMsg);
        throw new Error(errorMsg);
    }

    /**
     * Find the nearest empty and reachable cell near a target position
     */
    static findNearestEmptyCell(
        targetPosition: ICoord,
        state: State,
        fromPosition?: ICoord
    ): ICoord | null {
        const map = state.map;
        const characters = state.characters;
        const mapWidth = map[0]?.length || 0;
        const mapHeight = map.length;

        // Check cells in expanding radius around target
        const maxRadius = 10; // Don't search too far

        for (let radius = 1; radius <= maxRadius; radius++) {
            const candidates: Array<{ pos: ICoord; distance: number }> = [];

            // Check all cells at this radius
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dy = -radius; dy <= radius; dy++) {
                    // Only check cells at exactly this radius (Manhattan distance)
                    if (Math.abs(dx) + Math.abs(dy) !== radius) continue;

                    const pos: ICoord = {
                        x: targetPosition.x + dx,
                        y: targetPosition.y + dy
                    };

                    // Check bounds
                    if (pos.x < 0 || pos.x >= mapWidth || pos.y < 0 || pos.y >= mapHeight) {
                        continue;
                    }

                    // Check if cell is valid (not blocked, not occupied)
                    const cell = map[pos.y]?.[pos.x];
                    if (cell?.content?.blocker) continue;

                    // Check if a character is blocking
                    const isOccupied = characters.some(c =>
                        Math.round(c.position.x) === pos.x &&
                        Math.round(c.position.y) === pos.y &&
                        c.health > 0
                    );
                    if (isOccupied) continue;

                    // Calculate distance from starting position if provided
                    const distance = fromPosition ?
                        Math.abs(pos.x - fromPosition.x) + Math.abs(pos.y - fromPosition.y) :
                        0;

                    candidates.push({ pos, distance });
                }
            }

            // If we found valid cells at this radius, return the closest one to starting position
            if (candidates.length > 0) {
                candidates.sort((a, b) => a.distance - b.distance);
                return candidates[0]!.pos;
            }
        }

        return null;
    }

    /**
     * Get all available room names from the map
     */
    static getAvailableRoomNames(state: State): string[] {
        const roomNames = new Set<string>();
        const map = state.map;

        for (let y = 0; y < map.length; y++) {
            for (let x = 0; x < (map[y]?.length || 0); x++) {
                const cell = map[y]?.[x];
                if (cell?.locations) {
                    for (const loc of cell.locations) {
                        if (loc && loc !== 'floor' && loc !== 'wall') {
                            roomNames.add(loc);
                        }
                    }
                }
            }
        }

        return Array.from(roomNames);
    }

    /**
     * Get the name of the room a character is currently in
     */
    static getCurrentRoomName(character: DeepReadonly<ICharacter>, map: DeepReadonly<ICell[][]>): string {
        const x = Math.round(character.position.x);
        const y = Math.round(character.position.y);

        // Get the cell at the character's position
        const cell = map[y]?.[x];
        if (cell?.locations && cell.locations.length > 0) {
            // Find the first meaningful location (not floor/wall)
            for (const loc of cell.locations) {
                if (loc && loc !== 'floor' && loc !== 'wall') {
                    return loc;
                }
            }
        }

        // If no room name found, return a descriptive fallback
        return 'Unknown Location';
    }

    /**
     * Find the center coordinates of a room by name
     */
    static findRoomCenter(roomName: string, state: State): ICoord | null {
        const map = state.map;
        const roomPositions: ICoord[] = [];
        const lowerRoomName = roomName.toLowerCase();

        // Find all cells belonging to this room
        for (let y = 0; y < map.length; y++) {
            for (let x = 0; x < (map[0]?.length || 0); x++) {
                const cell = map[y]?.[x];
                if (cell?.locations && cell.locations.length > 0) {
                    const cellRoom = cell.locations[0];
                    if (cellRoom && cellRoom.toLowerCase().includes(lowerRoomName)) {
                        roomPositions.push({ x, y });
                    }
                }
            }
        }

        // Calculate center of room
        if (roomPositions.length > 0) {
            const centerX = Math.floor(roomPositions.reduce((sum, pos) => sum + pos.x, 0) / roomPositions.length);
            const centerY = Math.floor(roomPositions.reduce((sum, pos) => sum + pos.y, 0) / roomPositions.length);
            return { x: centerX, y: centerY };
        }

        return null;
    }
}
