import type { ICoord, ICell, ICharacter } from '../interfaces';
import type { DeepReadonly } from '../helpers/types';
import type { State } from '../State';
import { CharacterService } from './CharacterService';

/**
 * Location resolution and positioning utilities for AI
 * Handles converting location strings (room names, character names) to coordinates
 * Also handles abstract movement actions like patrol, search, investigate
 */
export class AILocationResolver {
    // Movement resolution constants
    private static readonly PATROL_MAX_DISTANCE = 8;
    private static readonly PATROL_MIN_DISTANCE = 2;
    private static readonly PATROL_MAX_ATTEMPTS = 10;
    private static readonly PATROL_DISTANCE_REDUCTION_INTERVAL = 3; // Reduce distance every N attempts
    private static readonly PATROL_DISTANCE_REDUCTION = 5;

    private static readonly SEARCH_BASE_DISTANCE = 5;
    private static readonly SEARCH_DISTANCE_VARIANCE = 3;
    private static readonly SEARCH_MAX_ATTEMPTS = 6;
    private static readonly SEARCH_ANGLE_VARIANCE = Math.PI / 3; // +/- 30 degrees

    private static readonly SCOUT_MAX_ATTEMPTS = 12;

    private static readonly RETREAT_MAX_DISTANCE = 12;
    private static readonly RETREAT_MIN_DISTANCE = 4;
    private static readonly RETREAT_MAX_ATTEMPTS = 8;
    private static readonly RETREAT_DISTANCE_REDUCTION_INTERVAL = 2;
    private static readonly RETREAT_ANGLE_VARIANCE = Math.PI / 3; // +/- 30 degrees

    private static readonly DEFAULT_MAP_SIZE = 50;
    private static readonly MAX_NEARBY_CELL_SEARCH_RADIUS = 10;

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
            const mapWidth = state.map[0]?.length || this.DEFAULT_MAP_SIZE;
            const mapHeight = state.map.length || this.DEFAULT_MAP_SIZE;
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
                const mapWidth = state.map[0]?.length || this.DEFAULT_MAP_SIZE;
                const mapHeight = state.map.length || this.DEFAULT_MAP_SIZE;

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
        const maxRadius = this.MAX_NEARBY_CELL_SEARCH_RADIUS; // Don't search too far

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
     * Check if a cell is valid and walkable
     * @param pos - The position to check
     * @param state - Game state
     * @param excludeCharacter - Character name to exclude from blocking check
     * @returns True if the cell is walkable
     */
    private static isValidWalkableCell(
        pos: ICoord,
        state: State,
        excludeCharacter?: string
    ): boolean {
        const map = state.map;
        const mapHeight = map.length;
        const mapWidth = map[0]?.length || 0;

        // Check bounds
        if (pos.x < 0 || pos.x >= mapWidth || pos.y < 0 || pos.y >= mapHeight) {
            return false;
        }

        // Check if cell is blocked
        const cell = map[pos.y]?.[pos.x];
        if (cell?.content?.blocker) {
            return false;
        }

        // Check if a living character is blocking the cell
        const characters = state.characters;
        if (characters && CharacterService.isCharacterAtPosition(characters, pos, excludeCharacter)) {
            return false;
        }

        return true;
    }

    /**
     * Resolve an abstract movement action to coordinates
     * @param action - The abstract action (patrol, search, investigate, etc.)
     * @param character - The character performing the action
     * @param state - Game state
     * @param target - Optional target for search/investigate actions
     * @returns Target coordinates or null if cannot resolve
     */
    static resolveAbstractMovement(
        action: 'patrol' | 'search' | 'investigate' | 'scout' | 'retreat' | 'advance',
        character: DeepReadonly<ICharacter>,
        state: State,
        target?: string
    ): ICoord | null {
        try {
            switch (action) {
                case 'patrol':
                    return this.resolvePatrol(character, state);
                case 'search':
                    return this.resolveSearch(character, state, target);
                case 'investigate':
                    return this.resolveInvestigate(character, state, target);
                case 'scout':
                    return this.resolveScout(character, state);
                case 'retreat':
                    return this.resolveRetreat(character, state);
                case 'advance':
                    return this.resolveAdvance(character, state);
                default:
                    console.error(`[AI] Unknown abstract movement action: ${action}`);
                    return null;
            }
        } catch (error) {
            console.error(`[AI] Error resolving ${action} movement for ${character.name}:`, error);
            return null;
        }
    }

    /**
     * Resolve patrol movement - random movement within radius
     */
    private static resolvePatrol(
        character: DeepReadonly<ICharacter>,
        state: State
    ): ICoord | null {
        const map = state.map;
        const mapWidth = map[0]?.length || this.DEFAULT_MAP_SIZE;
        const mapHeight = map.length || this.DEFAULT_MAP_SIZE;

        for (let attempt = 0; attempt < this.PATROL_MAX_ATTEMPTS; attempt++) {
            // Start with larger distance, reduce if failing
            const maxDistance = this.PATROL_MAX_DISTANCE - Math.floor(attempt / this.PATROL_DISTANCE_REDUCTION_INTERVAL);
            const minDistance = Math.max(this.PATROL_MIN_DISTANCE, maxDistance - this.PATROL_DISTANCE_REDUCTION);

            const angle = Math.random() * Math.PI * 2;
            const distance = minDistance + Math.random() * (maxDistance - minDistance + 1);
            const patrolX = character.position.x + Math.cos(angle) * distance;
            const patrolY = character.position.y + Math.sin(angle) * distance;

            // Clamp to map bounds
            const clampedX = Math.max(0, Math.min(mapWidth - 1, Math.round(patrolX)));
            const clampedY = Math.max(0, Math.min(mapHeight - 1, Math.round(patrolY)));

            const targetPos = { x: clampedX, y: clampedY };

            // Check if the target is walkable
            if (this.isValidWalkableCell(targetPos, state, character.name)) {
                return targetPos;
            }
        }

        // If no valid patrol target found, try to find any nearby walkable cell
        const nearbyCell = this.findNearestEmptyCell(
            character.position,
            state,
            character.position
        );

        if (nearbyCell) {
            return nearbyCell;
        }

        // Last resort: stay in place
        console.log(`[AI] Patrol: No valid target found for ${character.name}, staying in place`);
        return { x: character.position.x, y: character.position.y };
    }

    /**
     * Resolve search movement - move toward target or explore
     */
    private static resolveSearch(
        character: DeepReadonly<ICharacter>,
        state: State,
        target?: string
    ): ICoord | null {
        const map = state.map;
        const characters = state.characters;

        if (target) {
            const targetChar = characters.find(c =>
                c.name.toLowerCase() === target.toLowerCase() && c.health > 0
            );
            if (targetChar) {
                // Try multiple positions toward target's general area
                const baseAngle = Math.atan2(
                    targetChar.position.y - character.position.y,
                    targetChar.position.x - character.position.x
                );
                const mapWidth = map[0]?.length || this.DEFAULT_MAP_SIZE;
                const mapHeight = map.length || this.DEFAULT_MAP_SIZE;

                for (let attempt = 0; attempt < this.SEARCH_MAX_ATTEMPTS; attempt++) {
                    // Vary angle for each attempt
                    const angleVariation = (Math.random() - 0.5) * this.SEARCH_ANGLE_VARIANCE;
                    const angle = baseAngle + angleVariation;

                    // Vary distance
                    const distance = this.SEARCH_BASE_DISTANCE + Math.random() * this.SEARCH_DISTANCE_VARIANCE;

                    const searchX = character.position.x + Math.cos(angle) * distance;
                    const searchY = character.position.y + Math.sin(angle) * distance;

                    const targetPos = {
                        x: Math.max(0, Math.min(mapWidth - 1, Math.round(searchX))),
                        y: Math.max(0, Math.min(mapHeight - 1, Math.round(searchY)))
                    };

                    // Check if the search target is walkable
                    if (this.isValidWalkableCell(targetPos, state, character.name)) {
                        return targetPos;
                    }
                }

                // If no valid position toward target, try to get closer by any means
                const nearbyCell = this.findNearestEmptyCell(
                    targetChar.position,
                    state,
                    character.position
                );

                if (nearbyCell) {
                    return nearbyCell;
                }
            }
        }
        // Fall through to scout behavior if no target found
        return this.resolveScout(character, state);
    }

    /**
     * Resolve investigate movement - move to specific location
     */
    private static resolveInvestigate(
        character: DeepReadonly<ICharacter>,
        state: State,
        target?: string
    ): ICoord | null {
        const characters = state.characters;

        if (target) {
            // First try to find a room by that name
            const roomPos = this.findRoomCenter(target, state);
            if (roomPos) {
                return roomPos;
            }

            // Then try to find a character
            const targetChar = characters.find(c =>
                c.name.toLowerCase() === target.toLowerCase()
            );
            if (targetChar) {
                return { x: targetChar.position.x, y: targetChar.position.y };
            }
        }
        // If no specific target, patrol the area
        return this.resolvePatrol(character, state);
    }

    /**
     * Resolve scout movement - explore map edges
     */
    private static resolveScout(
        character: DeepReadonly<ICharacter>,
        state: State
    ): ICoord | null {
        const map = state.map;
        const mapWidth = map[0]?.length || this.DEFAULT_MAP_SIZE;
        const mapHeight = map.length || this.DEFAULT_MAP_SIZE;

        for (let attempt = 0; attempt < this.SCOUT_MAX_ATTEMPTS; attempt++) {
            const edge = Math.floor(Math.random() * 4);
            let targetPos: ICoord;

            switch (edge) {
                case 0: // North edge
                    targetPos = { x: Math.floor(Math.random() * mapWidth), y: 0 };
                    break;
                case 1: // East edge
                    targetPos = { x: mapWidth - 1, y: Math.floor(Math.random() * mapHeight) };
                    break;
                case 2: // South edge
                    targetPos = { x: Math.floor(Math.random() * mapWidth), y: mapHeight - 1 };
                    break;
                case 3: // West edge
                    targetPos = { x: 0, y: Math.floor(Math.random() * mapHeight) };
                    break;
                default:
                    targetPos = { x: Math.floor(mapWidth / 2), y: Math.floor(mapHeight / 2) };
            }

            // Check if the target is walkable
            if (this.isValidWalkableCell(targetPos, state, character.name)) {
                return targetPos;
            }
        }

        // If no valid edge target found, fall back to patrol behavior
        console.log(`[AI] Scout: No valid edge target found for ${character.name}, using patrol`);
        return this.resolvePatrol(character, state);
    }

    /**
     * Resolve retreat movement - move away from enemies
     */
    private static resolveRetreat(
        character: DeepReadonly<ICharacter>,
        state: State
    ): ICoord | null {
        const map = state.map;
        const characters = state.characters;

        // Find enemies
        const enemies = characters.filter(c => {
            if (c.health <= 0 || c.name === character.name) return false;
            // Simple faction check
            return c.controller !== character.controller;
        });

        if (enemies.length > 0) {
            // Find average position of enemies
            const avgX = enemies.reduce((sum, e) => sum + e.position.x, 0) / enemies.length;
            const avgY = enemies.reduce((sum, e) => sum + e.position.y, 0) / enemies.length;

            // Try multiple retreat distances/angles until we find a valid position
            const baseAngle = Math.atan2(character.position.y - avgY, character.position.x - avgX);
            const mapWidth = map[0]?.length || this.DEFAULT_MAP_SIZE;
            const mapHeight = map.length || this.DEFAULT_MAP_SIZE;

            for (let attempt = 0; attempt < this.RETREAT_MAX_ATTEMPTS; attempt++) {
                // Vary the angle slightly for each attempt
                const angleVariation = (Math.random() - 0.5) * this.RETREAT_ANGLE_VARIANCE;
                const angle = baseAngle + angleVariation;

                // Vary distance, start with further away
                const maxDistance = this.RETREAT_MAX_DISTANCE - Math.floor(attempt / this.RETREAT_DISTANCE_REDUCTION_INTERVAL);
                const minDistance = Math.max(this.RETREAT_MIN_DISTANCE, maxDistance - this.RETREAT_MIN_DISTANCE);
                const distance = minDistance + Math.random() * (maxDistance - minDistance + 1);

                const retreatX = character.position.x + Math.cos(angle) * distance;
                const retreatY = character.position.y + Math.sin(angle) * distance;

                const targetPos = {
                    x: Math.max(0, Math.min(mapWidth - 1, Math.round(retreatX))),
                    y: Math.max(0, Math.min(mapHeight - 1, Math.round(retreatY)))
                };

                // Check if the retreat target is walkable
                if (this.isValidWalkableCell(targetPos, state, character.name)) {
                    return targetPos;
                }
            }

            // If no valid retreat position found, try to find any safe cell away from enemies
            const nearbyCell = this.findNearestEmptyCell(
                character.position,
                state,
                character.position
            );

            if (nearbyCell) {
                return nearbyCell;
            }
        }
        // If no enemies or can't retreat, just patrol
        return this.resolvePatrol(character, state);
    }

    /**
     * Resolve advance movement - move toward enemies
     */
    private static resolveAdvance(
        character: DeepReadonly<ICharacter>,
        state: State
    ): ICoord | null {
        const map = state.map;
        const characters = state.characters;

        const enemies = characters.filter(c => {
            if (c.health <= 0 || c.name === character.name) return false;
            return c.controller !== character.controller;
        });

        if (enemies.length > 0) {
            // Find nearest enemy
            const nearest = enemies.reduce((closest, enemy) => {
                const closestDist = Math.abs(closest.position.x - character.position.x) +
                                   Math.abs(closest.position.y - character.position.y);
                const enemyDist = Math.abs(enemy.position.x - character.position.x) +
                                 Math.abs(enemy.position.y - character.position.y);
                return enemyDist < closestDist ? enemy : closest;
            });

            // Move toward nearest enemy
            return { x: nearest.position.x, y: nearest.position.y };
        }
        // If no enemies, move to center of map
        const mapWidth = map[0]?.length || this.DEFAULT_MAP_SIZE;
        const mapHeight = map.length || this.DEFAULT_MAP_SIZE;
        return { x: Math.floor(mapWidth / 2), y: Math.floor(mapHeight / 2) };
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
