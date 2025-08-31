import { EventBus } from '../events/EventBus';
import { UpdateStateEvent, UpdateStateEventsMap } from '../events';
import type { AICommand, MapCommand, StorylineCommand, CharacterCommand } from './AICommandParser';
import type { ICharacter, IItem, IWeapon, IRoom, IDoor, Direction, IStoryState, ItemType, ICell } from '../interfaces';
import { MapGenerator } from '../helpers/MapGenerator';
import { DoorService } from './DoorService';
import { weapons as availableWeapons, items as availableItems, baseCharacter } from '../../data/state';
import { CharacterPositioningError } from '../errors/CharacterPositioningError';

export interface ItemSpawnCommand extends AICommand {
    type: 'item';
    items: Array<{
        id?: string;
        name: string;
        type: 'weapon' | 'consumable' | 'key' | 'artifact';
        location: string; // Character name or position
        description?: string;
    }>;
}

// Extended character data from AI commands with additional fields
interface ExtendedCharacterData {
    name: string;
    race: 'human' | 'alien' | 'robot';
    description: string;
    speed: 'slow' | 'medium' | 'fast';
    orientation: 'top' | 'right' | 'bottom' | 'left';
    location: string;
    palette?: {
        skin: string;
        helmet: string;
        suit: string;
    };
    player?: string;
    team?: string;
    faction?: string;
    personality?: string;
}

// Map cell with additional properties for door support
interface MapCell extends ICell {
    room?: string;
    terrain?: string;
    wall?: boolean;
    door?: boolean;
    doors?: IDoor[];
}

export class StoryCommandExecutor extends EventBus<{}, UpdateStateEventsMap> {
    private static instance: StoryCommandExecutor;

    private constructor() {
        super();
    }

    public static getInstance(): StoryCommandExecutor {
        if (!StoryCommandExecutor.instance) {
            StoryCommandExecutor.instance = new StoryCommandExecutor();
        }
        return StoryCommandExecutor.instance;
    }

    /**
     * Creates a character with base stats from data/state.ts
     */
    private createCharacterFromBase(overrides: Partial<ICharacter>): ICharacter {
        // Use Object.assign for better compatibility
        const base = JSON.parse(JSON.stringify(baseCharacter)) as ICharacter;
        return Object.assign(base, overrides, {
            // Ensure required fields are present
            inventory: overrides.inventory || base.inventory,
            actions: overrides.actions || base.actions,
            palette: overrides.palette || base.palette
        });
    }

    /**
     * Maps AI direction values to game direction values
     */
    private mapDirection(direction: string): Direction {
        const directionMap: Record<string, Direction> = {
            'top': 'up',
            'bottom': 'down',
            'left': 'left',
            'right': 'right',
            'top-left': 'up-left',
            'top-right': 'up-right',
            'bottom-left': 'down-left',
            'bottom-right': 'down-right'
        };
        return directionMap[direction] || direction as Direction;
    }

    /**
     * Execute a map generation command from AI
     * This replaces the current map with a new one
     */
    public async executeMapCommand(command: MapCommand, _storyState?: IStoryState): Promise<void> {

        try {
            // Log the full AI command for debugging
            console.log('[StoryExecutor] Full AI map command:', JSON.stringify(command, null, 2));

            // Convert AI building data to rooms for map generator
            const rooms: IRoom[] = [];
            for (const building of command.buildings) {
                for (const room of building.rooms) {
                    // Map size strings to numbers
                    const sizeMap: Record<string, number> = {
                        'small': 3,
                        'medium': 5,
                        'big': 7,
                        'large': 9,
                        'huge': 11
                    };

                    const roomName = `${building.name} - ${room.name}`;
                    rooms.push({
                        name: roomName,
                        size: sizeMap[room.size] || 5
                    });
                    console.log(`[StoryExecutor] Added room: "${roomName}" with size ${sizeMap[room.size] || 5}`);
                }
            }

            // Generate the new map
            const mapGen = new MapGenerator(50, 50);
            const startPos = { x: 25, y: 25 }; // Center of map
            mapGen.generateMap(rooms, startPos);
            const newMap = mapGen.getCells();

            // Update the map state
            this.dispatch(UpdateStateEvent.map, newMap);

            // Player and Data already exist in state from getEmptyState()
            // We need to ensure they are preserved and properly positioned

            // Prepare the characters list if not provided
            if (!command.characters) {
                command.characters = [];
            }

            // Check if AI already included player and Data in the character list
            const hasPlayer = command.characters.some((c) =>
                c.name?.toLowerCase() === 'player'
            );
            const hasData = command.characters.some((c) =>
                c.name?.toLowerCase() === 'data' || c.name === 'Data'
            );

            // Get first room name for spawning
            const firstRoomName = rooms.length > 0 ? rooms[0]!.name : 'floor';

            // If player is not in the AI's character list, add it
            if (!hasPlayer) {
                const playerChar = {
                    name: 'player',
                    location: firstRoomName,
                    race: 'human' as const,
                    description: 'The player character',
                    speed: 'medium' as const,
                    orientation: 'bottom' as const,
                    palette: {
                        skin: '#d7a55f',
                        helmet: 'white',
                        suit: 'white'
                    },
                    player: 'human',  // Mark as human-controlled
                    team: 'player'
                };
                command.characters.unshift(playerChar);
            }

            // If Data is not in the AI's character list, add it
            if (!hasData) {
                const dataChar = {
                    name: 'Data',
                    location: firstRoomName,
                    race: 'robot' as const,
                    description: 'Your robot companion',
                    speed: 'medium' as const,
                    orientation: 'bottom' as const,
                    palette: {
                        skin: 'yellow',
                        helmet: 'gold',
                        suit: 'gold'
                    },
                    player: 'human',  // Also controlled by human player
                    team: 'player'
                };
                command.characters.unshift(dataChar);
            }

            // Handle door generation if included in map command
            if (command.doors && command.doors.length > 0) {
                await this.generateDoorsFromMap(command.doors, newMap as MapCell[][]);
            }

            // Handle character spawning if included in map command
            if (command.characters && command.characters.length > 0) {
                await this.spawnCharactersFromMap(command.characters as ExtendedCharacterData[], newMap as MapCell[][]);
            }

            // Update terrain palette if specified
            if (command.palette?.terrain) {
                // This would update CSS variables or terrain rendering
            }

            // SAFETY CHECK: Ensure player and Data always exist after map generation
            // This is a critical failsafe to prevent them from being lost
            await this.ensurePlayerAndDataExist(newMap as MapCell[][]);

            // Map generation complete
        } catch (error) {
            console.error('[StoryExecutor] Error executing map command:', error);
            console.error('[StoryExecutor] Error details:', {
                message: (error as Error).message,
                stack: (error as Error).stack
            });
        }
    }

    /**
     * Execute a storyline command - updates narrative state and triggers action
     */
    public async executeStorylineCommand(command: StorylineCommand, storyState?: IStoryState): Promise<void> {
        console.log('[StoryExecutor] Executing storyline command');
        const storyline = (command as StorylineCommand & { storyline?: { title?: string; description?: string; objectives?: unknown[] }; trigger_action?: string }).storyline;
        console.log('[StoryExecutor] Storyline details:', {
            hasTitle: !!storyline?.title,
            hasDescription: !!storyline?.description,
            objectiveCount: storyline?.objectives?.length || 0,
            triggerAction: (command as StorylineCommand & { trigger_action?: string }).trigger_action
        });

        // Add to journal
        if (storyState) {
            const journalEntry = {
                id: `story_${Date.now()}`,
                title: command.description || 'Historia',
                content: command.content,
                date: new Date().toISOString(),
                type: 'main' as const,
                isRead: false
            };

            // Update story state with new journal entry
            const currentEntries = storyState.journalEntries || [];
            this.dispatch(UpdateStateEvent.storyState, {
                journalEntries: [...currentEntries, journalEntry]
            });
        }

        // Display as message
        this.dispatch(UpdateStateEvent.updateMessages, [{
            role: 'assistant',
            content: command.content
        }]);

        // Execute the required action
        if (command.action) {
            console.log(`[StoryExecutor] Triggering action: ${command.action}`);

            switch (command.action) {
                case 'map':
                    // Request new map generation from AI
                    console.log('[StoryExecutor] Requesting new map generation from storyline');
                    // Note: The actual map generation is now handled by the AIController
                    // when it receives the executeAction event. This is just logging
                    // that the storyline requested a map change.
                    break;

                case 'character':
                    // Spawn new characters
                    if (command.actionData?.characters) {
                        const actionData = command.actionData as { characters: CharacterCommand['characters'] };
                        await this.spawnCharactersFromMap(actionData.characters, [] as MapCell[][]);
                    }
                    break;

                case 'movement':
                    // Move existing characters
                    if (command.actionData?.movements) {
                        // Handle character movements
                        console.log('[StoryExecutor] Processing character movements');
                    }
                    break;

                case 'attack':
                    // Initiate combat
                    if (command.actionData?.combatants) {
                        // Trigger combat between specified characters
                        console.log('[StoryExecutor] Initiating combat');
                    }
                    break;

                default:
                    console.warn(`[StoryExecutor] Unknown action type: ${command.action}`);
            }
        } else {
            console.warn('[StoryExecutor] Storyline command missing required action!');
        }

        // Check for chapter transitions
        if (command.description) {
            if (command.description.includes('chapter') || command.description.includes('capítulo')) {
                const currentChapter = storyState?.currentChapter || 1;
                this.dispatch(UpdateStateEvent.storyState, {
                    currentChapter: currentChapter + 1
                });
            }
        }
    }

    /**
     * Spawn items or weapons at locations
     */
    public async executeItemSpawnCommand(command: ItemSpawnCommand): Promise<void> {
        console.log('[StoryExecutor] Executing item spawn command');
        console.log('[StoryExecutor] Items to spawn:', command.items?.length || 0);

        for (const itemData of command.items) {
            try {
                // Find or create the item
                let item: IItem | IWeapon | undefined;

                if (itemData.type === 'weapon') {
                    // Find weapon from available weapons
                    item = availableWeapons.find(w =>
                        w.name.toLowerCase().includes(itemData.name.toLowerCase())
                    );

                    if (!item) {
                        // Create custom weapon
                        item = {
                            id: itemData.id || `weapon_${Date.now()}`,
                            name: itemData.name,
                            description: itemData.description || 'A mysterious weapon',
                            weight: 2,
                            cost: 100,
                            icon: '⚔️',
                            type: 'weapon',
                            weaponType: 'oneHanded',
                            category: 'melee',
                            class: 'sword',
                            damage: 20,
                            range: 2
                        } as IWeapon;
                    }
                } else {
                    // Find or create regular item
                    item = availableItems.find(i =>
                        i.name.toLowerCase().includes(itemData.name.toLowerCase())
                    );

                    if (!item) {
                        item = {
                            id: itemData.id || `item_${Date.now()}`,
                            name: itemData.name,
                            description: itemData.description || 'A mysterious item',
                            weight: 1,
                            cost: 50,
                            icon: '📦',
                            type: (['weapon', 'consumable', 'armor'].includes(itemData.type) ?
                                itemData.type as ItemType : 'misc')
                        };
                    }
                }

                // Determine spawn location
                const location = this.resolveItemLocation(itemData.location);

                if (location.type === 'character' && location.character) {
                    // Add to character inventory
                    const currentInventory = location.character.inventory || {
                        items: [],
                        maxWeight: 50,
                        equippedWeapons: { primary: null, secondary: null }
                    };

                    this.dispatch(UpdateStateEvent.updateInventory, {
                        characterName: location.character.name,
                        inventory: {
                            ...currentInventory,
                            items: [...(currentInventory.items || []), item],
                            maxWeight: currentInventory.maxWeight || 50,
                            equippedWeapons: currentInventory.equippedWeapons || { primary: null, secondary: null }
                        }
                    });

                    console.log(`[StoryExecutor] Added ${item.name} to ${location.character.name}'s inventory`);
                } else if (location.type === 'ground' && location.position) {
                    // Place on ground at position
                    // This would require a ground items system
                    console.log(`[StoryExecutor] Would place ${item.name} at position:`, location.position);
                    // TODO: Implement ground items
                }
            } catch (error) {
                console.error(`[StoryExecutor] Error spawning item ${itemData.name}:`, error);
            }
        }

        console.log('[StoryExecutor] Item spawn command completed');
    }

    /**
     * Generate doors from AI map command
     */
    private async generateDoorsFromMap(doors: MapCommand['doors'], map: MapCell[][]): Promise<void> {
        if (!doors) return;

        console.log(`[StoryExecutor] Generating ${doors.length} doors...`);
        console.log('[StoryExecutor] Door positions:', doors.map(d => ({
            position: d.position,
            type: d.type,
            locked: (d as any).locked
        })));

        const doorService = DoorService.getInstance();
        const generatedDoors: Record<string, IDoor> = {};

        for (const doorData of doors) {
            try {
                let door: IDoor;

                if (doorData.type === 'transition') {
                    // Create transition door
                    door = doorService.createTransitionDoor(
                        doorData.position,
                        doorData.side,
                        doorData.transition?.description || 'Una puerta misteriosa',
                        doorData.transition?.targetMap
                    );
                } else if (doorData.type === 'locked') {
                    // Create locked door
                    door = doorService.createDoorBetweenRooms(
                        doorData.position,
                        doorData.targetPosition || { x: doorData.position.x, y: doorData.position.y + 1 },
                        true
                    );
                    if (doorData.keyRequired) {
                        door.keyRequired = doorData.keyRequired;
                    }
                } else {
                    // Create regular door
                    door = doorService.createDoorBetweenRooms(
                        doorData.position,
                        doorData.targetPosition || { x: doorData.position.x, y: doorData.position.y + 1 },
                        false
                    );
                }

                // Override side if specified
                if (doorData.side) {
                    door.side = doorData.side;
                }

                // Add door to collection
                generatedDoors[door.id] = door;

                // Update the cell to include door reference
                const cellY = doorData.position.y;
                const cellX = doorData.position.x;
                if (map[cellY] && map[cellY][cellX]) {
                    if (!map[cellY][cellX].doors) {
                        map[cellY][cellX].doors = [];
                    }
                    map[cellY][cellX].doors!.push(door);
                }

                console.log(`[StoryExecutor] Generated door ${door.id} at position`, doorData.position);
            } catch (error) {
                console.error(`[StoryExecutor] Error generating door:`, error);
            }
        }

        // Dispatch doors state update
        if (Object.keys(generatedDoors).length > 0) {
            this.dispatch(UpdateStateEvent.doors, generatedDoors);
        }
    }

    /**
     * Spawn characters as part of map generation
     */
    private async spawnCharactersFromMap(characters: ExtendedCharacterData[], map: MapCell[][]): Promise<void> {
        // Track occupied positions to avoid overlapping
        const occupiedPositions = new Set<string>();

        // Helper to mark position as occupied
        const markPositionOccupied = (x: number, y: number): void => {
            occupiedPositions.add(`${x},${y}`);
        };
        
        // Collect available rooms for error reporting
        const availableRooms = this.getAvailableRooms(map);

        // First, handle player and Data specially - they exist from getEmptyState()
        // We just need to update their positions
        for (const charData of characters) {
            const isPlayer = charData.name?.toLowerCase() === 'player';
            const isData = charData.name === 'Data' || charData.name?.toLowerCase() === 'data';

            if (isPlayer || isData) {
                try {
                    // Find spawn position based on location description
                    const position = this.findSpawnPosition(charData.location, map, occupiedPositions);

                    if (!position) {
                        // Player and Data are critical - they must be positioned
                        throw new CharacterPositioningError(
                            charData.name,
                            charData.location,
                            availableRooms,
                            { width: map[0]?.length || 50, height: map.length || 50 }
                        );
                    }

                    // Update the existing character's position
                    // Use base character data and only override what's needed
                    const updateCharacter = this.createCharacterFromBase({
                        name: isPlayer ? 'player' : 'Data',
                        position: position,
                        race: isPlayer ? 'human' : 'robot',
                        player: 'human',
                        team: 'player',
                        palette: isPlayer ? 
                            { skin: '#d7a55f', helmet: 'white', suit: 'white' } :
                            { skin: 'yellow', helmet: 'gold', suit: 'gold' }
                    });
                    // Add fromNetwork as a separate type extension
                    const updateWithNetwork = updateCharacter as ICharacter & { fromNetwork?: boolean };
                    updateWithNetwork.fromNetwork = true;
                    this.dispatch(UpdateStateEvent.characterPosition, updateWithNetwork);

                    // Mark position as occupied
                    markPositionOccupied(position.x, position.y);
                } catch (error) {
                    console.error(`[StoryExecutor] Error updating position for ${charData.name}:`, error);
                }
                continue; // Skip to next character
            }
        }

        // Now spawn all other characters
        for (const charData of characters) {
            // Skip player and Data as they were handled above
            if (charData.name?.toLowerCase() === 'player' ||
                charData.name === 'Data' ||
                charData.name?.toLowerCase() === 'data') {
                continue;
            }

            try {
                // Find spawn position based on location description
                const position = this.findSpawnPosition(charData.location, map, occupiedPositions);

                if (!position) {
                    // This is a critical error - the AI needs to know positioning failed
                    throw new CharacterPositioningError(
                        charData.name,
                        charData.location,
                        availableRooms,
                        { width: map[0]?.length || 50, height: map.length || 50 }
                    );
                }

                // Validate and correct position to be within map bounds
                const mapWidth = map[0]?.length || 50;
                const mapHeight = map.length || 50;
                
                if (position.x < 0 || position.x >= mapWidth || position.y < 0 || position.y >= mapHeight) {
                    console.error(`[Character Position] ERROR: Position (${position.x}, ${position.y}) is outside map bounds for ${charData.name}!`);
                    console.error(`[Character Position] Map bounds: 0-${mapWidth - 1} x 0-${mapHeight - 1}`);
                    
                    // Try to find a safe fallback position
                    const safePos = this.findSafePosition(map, occupiedPositions);
                    if (safePos) {
                        console.log(`[Character Position] Using safe fallback position (${safePos.x}, ${safePos.y}) for ${charData.name}`);
                        position.x = safePos.x;
                        position.y = safePos.y;
                    } else {
                        // Force position to nearest valid boundary
                        position.x = Math.max(0, Math.min(position.x, mapWidth - 1));
                        position.y = Math.max(0, Math.min(position.y, mapHeight - 1));
                        console.error(`[Character Position] Forced ${charData.name} to boundary position (${position.x}, ${position.y})`);
                    }
                }

                console.log(`[Character Position] Spawning ${charData.name} at position (${position.x}, ${position.y})`);

                const extendedCharData = charData as ExtendedCharacterData;
                
                // Create character using base stats
                const newCharacter = this.createCharacterFromBase({
                    name: charData.name,
                    race: charData.race || 'human',
                    description: charData.description || '',
                    position: position,
                    direction: this.mapDirection(charData.orientation || 'down'),
                    player: extendedCharData.player || 'ai',
                    team: extendedCharData.team || this.determineTeam(extendedCharData),
                    palette: charData.palette || {
                        skin: '#d7a55f',
                        helmet: '#808080',
                        suit: '#404040'
                    }
                });

                // Add character to game
                // Note: Character spawning during story initialization doesn't follow turn rules
                this.dispatch(UpdateStateEvent.addCharacter, newCharacter);

                // Mark position as occupied
                markPositionOccupied(position.x, position.y);
            } catch (error) {
                console.error(`[StoryExecutor] Error spawning character ${charData.name}:`, error);
            }
        }
    }

    /**
     * Find a safe walkable position in the map
     */
    private findSafePosition(map: MapCell[][], occupiedPositions?: Set<string>): { x: number; y: number } | null {
        // Try center first
        const centerX = Math.floor((map[0]?.length || 50) / 2);
        const centerY = Math.floor(map.length / 2);

        // Search in expanding circles from center
        for (let radius = 0; radius < Math.max(map.length, map[0]?.length || 0); radius++) {
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    const y = centerY + dy;
                    const x = centerX + dx;
                    if (y >= 0 && y < map.length && map[0] && x >= 0 && x < map[0].length) {
                        const cell = map[y]?.[x];
                        const posKey = `${x},${y}`;
                        if (cell && cell.locations && !cell.locations.includes('wall') &&
                            !cell.content?.blocker && (!occupiedPositions || !occupiedPositions.has(posKey))) {
                            return { x, y };
                        }
                    }
                }
            }
        }

        return null;
    }

    /**
     * Find a room position by name with fuzzy matching
     */
    private findRoomPosition(roomName: string, map: MapCell[][], occupiedPositions?: Set<string>): { x: number; y: number } | null {
        const lowerRoomName = roomName.toLowerCase().trim();
        console.log(`[Character Position] Searching for room: "${roomName}" (normalized: "${lowerRoomName}")`);
        
        // Normalize room name by replacing common separators
        const normalizedSearchName = lowerRoomName.replace(/[\-\/]/g, ' ').replace(/\s+/g, ' ').trim();

        // Try to find matching room cells and collect them
        const roomCells: Array<{ x: number; y: number }> = [];
        
        for (let y = 0; y < map.length; y++) {
            const row = map[y];
            if (!row) continue;
            for (let x = 0; x < row.length; x++) {
                const cell = row[x];
                if (!cell) continue;
                
                if (cell.locations && cell.locations.some((loc: string) => {
                    const normalizedLoc = loc.toLowerCase().replace(/[\-\/]/g, ' ').replace(/\s+/g, ' ').trim();
                    // Check if normalized names match or contain each other
                    return normalizedLoc === normalizedSearchName || 
                           normalizedLoc.includes(normalizedSearchName) || 
                           normalizedSearchName.includes(normalizedLoc);
                })) {
                    if (!cell.content?.blocker) {
                        roomCells.push({ x, y });
                    }
                }
            }
        }
        
        // If we found room cells, try to find an unoccupied one
        if (roomCells.length > 0) {
            console.log(`[Character Position] Found ${roomCells.length} cells for room "${roomName}"`);
            
            // First try to find an unoccupied cell
            for (const cell of roomCells) {
                const posKey = `${cell.x},${cell.y}`;
                if (!occupiedPositions || !occupiedPositions.has(posKey)) {
                    console.log(`[Character Position] Found unoccupied cell for room "${roomName}" at (${cell.x}, ${cell.y})`);
                    return cell;
                }
            }
            
            // If all cells are occupied, try to find the least crowded one
            // by cycling through available cells
            const index = Math.floor(Math.random() * roomCells.length);
            const selectedCell = roomCells[index];
            if (selectedCell) {
                console.log(`[Character Position] All ${roomCells.length} cells have characters, distributing to cell ${index} at (${selectedCell.x}, ${selectedCell.y})`);
                return selectedCell;
            }
            // Fallback to first cell if random selection failed
            return roomCells[0] || null;
        }

        // If no match yet, try matching the last part of the room name (after separator)
        const roomParts = roomName.split(/[\-\/]/g).map(p => p.trim()).filter(p => p.length > 0);
        if (roomParts.length > 1) {
            const lastPart = roomParts[roomParts.length - 1]?.toLowerCase();
            if (!lastPart) return null;
            console.log(`[Character Position] Trying to match last part: "${lastPart}"`);
            
            for (let y = 0; y < map.length; y++) {
                const row = map[y];
                if (!row) continue;
                for (let x = 0; x < row.length; x++) {
                    const cell = row[x];
                    if (!cell) continue;
                    if (cell.locations && cell.locations.some((loc: string) => {
                        const locLower = loc.toLowerCase();
                        return locLower.includes(lastPart);
                    })) {
                        const posKey = `${x},${y}`;
                        if (!cell.content?.blocker && (!occupiedPositions || !occupiedPositions.has(posKey))) {
                            console.log(`[Character Position] Found match for room part "${lastPart}" at (${x}, ${y})`);
                            return { x, y };
                        }
                    }
                }
            }
        }

        // Try matching individual words
        const roomWords = normalizedSearchName.split(/[\s\-\/]+/);
        if (roomWords.length > 1) {
            for (const word of roomWords) {
                if (word.length < 3) continue; // Skip short words
                for (let y = 0; y < map.length; y++) {
                    const row = map[y];
                    if (!row) continue;
                    for (let x = 0; x < row.length; x++) {
                        const cell = row[x];
                        if (!cell) continue;
                        if (cell.locations && cell.locations.some((loc: string) =>
                            loc.toLowerCase().includes(word)
                        )) {
                            const posKey = `${x},${y}`;
                            if (!cell.content?.blocker && (!occupiedPositions || !occupiedPositions.has(posKey))) {
                                console.log(`[Character Position] Found word match for "${word}" from "${roomName}" at (${x}, ${y})`);
                                return { x, y };
                            }
                        }
                    }
                }
            }
        }

        console.log(`[Character Position] No match found for room "${roomName}"`);
        return null;
    }
    
    /**
     * Get list of available room names from the map
     */
    private getAvailableRooms(map: MapCell[][]): string[] {
        const rooms = new Set<string>();
        for (let y = 0; y < map.length; y++) {
            const row = map[y];
            if (!row) continue;
            for (let x = 0; x < row.length; x++) {
                const cell = row[x];
                if (cell?.locations) {
                    cell.locations.forEach((loc: string) => {
                        if (loc !== 'wall' && loc !== 'floor') {
                            rooms.add(loc);
                        }
                    });
                }
            }
        }
        return Array.from(rooms);
    }

    /**
     * Find a suitable spawn position based on location description
     */
    private findSpawnPosition(location: string, map: MapCell[][], occupiedPositions?: Set<string>): { x: number; y: number } | null {
        console.log(`[Character Position] Finding spawn position for location: "${location}"`);
        console.log(`[Character Position] Map dimensions: ${map?.length || 0}x${map?.[0]?.length || 0}`);

        // Log all available room names for debugging
        const availableRooms = new Set<string>();
        for (let y = 0; y < map.length; y++) {
            const row = map[y];
            if (!row) continue;
            for (let x = 0; x < row.length; x++) {
                const cell = row[x];
                if (cell?.locations) {
                    cell.locations.forEach((loc: string) => {
                        if (loc !== 'wall' && loc !== 'floor') {
                            availableRooms.add(loc);
                        }
                    });
                }
            }
        }
        console.log(`[Character Position] Available rooms on map:`, Array.from(availableRooms));

        // Parse location string
        // Could be: "room name", "near character", "x,y coordinates", "center", "near_player", "room/player", etc.

        // Handle special case: "location/something" - extract just the location part
        if (location.includes('/')) {
            const parts = location.split('/');
            const roomName = parts[0]?.trim() || location;
            console.log(`[Character Position] Location "${location}" contains '/', extracting room: "${roomName}"`);

            // Try to find the room
            const roomPos = this.findRoomPosition(roomName, map, occupiedPositions);
            if (roomPos) {
                console.log(`[Character Position] Found room "${roomName}" at (${roomPos.x}, ${roomPos.y})`);
                return roomPos;
            }
        }

        // Handle special cases
        if (location === 'center') {
            // Find a walkable position near the center of the map
            const firstRow = map[0];
            const mapWidth = firstRow?.length || 50;
            const centerX = Math.floor(mapWidth / 2);
            const centerY = Math.floor(map.length / 2);

            // Search in expanding circles from center
            for (let radius = 0; radius < 10; radius++) {
                for (let dy = -radius; dy <= radius; dy++) {
                    for (let dx = -radius; dx <= radius; dx++) {
                        const y = centerY + dy;
                        const x = centerX + dx;
                        const row = map[y];
                        if (y >= 0 && y < map.length && row && x >= 0 && x < row.length) {
                            const cell = row[x];
                            const posKey = `${x},${y}`;
                            if (cell && cell.locations && !cell.locations.includes('wall') &&
                                !cell.content?.blocker && (!occupiedPositions || !occupiedPositions.has(posKey))) {
                                console.log(`[Character Position] Found center position at (${x}, ${y})`);
                                return { x, y };
                            }
                        }
                    }
                }
            }
        }

        if (location === 'near_player') {
            // Try to find a position adjacent to the player's current position
            // This is a simplified version - in reality we'd need to check the actual player position
            const playerPos = this.findSpawnPosition('center', map);
            if (playerPos) {
                const offsets: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0]];
                for (const [dx, dy] of offsets) {
                    const x = playerPos.x + dx;
                    const y = playerPos.y + dy;
                    if (y >= 0 && y < map.length && map[0] && x >= 0 && x < map[0].length) {
                        const cell = map[y]?.[x];
                        const posKey = `${x},${y}`;
                        if (cell && cell.locations && !cell.locations.includes('wall') &&
                            !cell.content?.blocker && (!occupiedPositions || !occupiedPositions.has(posKey))) {
                            return { x, y };
                        }
                    }
                }
            }
        }

        // Try coordinates
        const coordMatch = location.match(/(\d+),\s*(\d+)/);
        if (coordMatch) {
            return {
                x: parseInt(coordMatch[1] || '0', 10),
                y: parseInt(coordMatch[2] || '0', 10)
            };
        }

        // Try to find room by name (with fuzzy matching)
        const roomPos = this.findRoomPosition(location, map, occupiedPositions);
        if (roomPos) {
            return roomPos;
        }

        // Default to first walkable position if nothing found
        console.log(`[Character Position] WARNING: Could not find valid position for "${location}", searching for first walkable cell`);

        // Find the first walkable cell in the map
        for (let y = 0; y < map.length; y++) {
            const row = map[y];
            if (!row) continue;
            for (let x = 0; x < row.length; x++) {
                const cell = row[x];
                if (!cell) continue;
                const posKey = `${x},${y}`;
                if (cell.locations && !cell.locations.includes('wall') &&
                    !cell.content?.blocker && (!occupiedPositions || !occupiedPositions.has(posKey))) {
                    console.log(`[Character Position] Using fallback position (${x}, ${y}) - first walkable cell found`);
                    return { x, y };
                }
            }
        }

        // Absolute fallback - center of actual map bounds
        const fallbackX = Math.floor((map[0]?.length || 50) / 2);
        const fallbackY = Math.floor(map.length / 2);
        console.log(`[Character Position] ERROR: No walkable cells found! Using map center (${fallbackX}, ${fallbackY})`);
        return { x: fallbackX, y: fallbackY };
    }

    /**
     * Determine team based on character data
     */
    private determineTeam(charData: ExtendedCharacterData): string {
        // Check faction or alignment
        if (charData.faction) {
            return charData.faction;
        }

        // Check if hostile based on description
        const desc = ((charData.description || '') as string).toLowerCase();
        if (desc.includes('enemy') || desc.includes('hostile') || desc.includes('enemigo')) {
            return 'enemy';
        }

        if (desc.includes('ally') || desc.includes('friend') || desc.includes('aliado')) {
            return 'player';
        }

        // Default to neutral/enemy
        return 'neutral';
    }

    /**
     * Resolve item spawn location
     */
    private resolveItemLocation(location: string): {
        type: 'character' | 'ground';
        character?: ICharacter;
        position?: { x: number; y: number };
    } {
        // Check if it's a character name
        // This would need access to current state
        // For now, return ground position

        const coordMatch = location.match(/(\d+),\s*(\d+)/);
        if (coordMatch) {
            return {
                type: 'ground',
                position: {
                    x: parseInt(coordMatch[1] || '0', 10),
                    y: parseInt(coordMatch[2] || '0', 10)
                }
            };
        }

        // Default to ground at center
        return {
            type: 'ground',
            position: { x: 25, y: 25 }
        };
    }

    /**
     * Ensure player and Data characters always exist after map generation
     * This is a safety check to prevent these critical characters from being lost
     */
    private async ensurePlayerAndDataExist(map: MapCell[][]): Promise<void> {
        // Track occupied positions
        const occupiedPositions = new Set<string>();

        // Find a safe spawn position in the first room or any walkable cell
        const findSafePosition = (excludePositions?: Set<string>): { x: number; y: number } | null => {
            // Try to find a walkable cell near the center
            const centerX = map[0] ? Math.floor(map[0].length / 2) : 25;
            const centerY = Math.floor(map.length / 2) || 25;

            for (let radius = 0; radius < 15; radius++) {
                for (let dy = -radius; dy <= radius; dy++) {
                    for (let dx = -radius; dx <= radius; dx++) {
                        const y = centerY + dy;
                        const x = centerX + dx;
                        if (y >= 0 && y < map.length && x >= 0 && x < (map[0]?.length || 0)) {
                            const cell = map[y]?.[x];
                            const posKey = `${x},${y}`;
                            if (cell && cell.locations && !cell.locations.includes('wall') &&
                                (!excludePositions || !excludePositions.has(posKey))) {
                                return { x, y };
                            }
                        }
                    }
                }
            }
            return null; // No valid position found
        };

        // Try to create player if missing
        // Note: We can't directly check state from here, so we'll use a try-add approach
        // The UpdateStateEvent.addCharacter already handles duplicates gracefully (warns and skips)
        const playerPosition = findSafePosition(occupiedPositions);
        if (playerPosition) {
            occupiedPositions.add(`${playerPosition.x},${playerPosition.y}`);
            // Try to ensure player exists - this is a safety net
            // The actual state management will prevent duplicates
            const playerCharacter = this.createCharacterFromBase({
                name: 'player',
                race: 'human',
                description: 'The player character',
                position: playerPosition,
                player: 'human',
                team: 'player',
                palette: {
                    skin: '#d7a55f',
                    helmet: 'white',
                    suit: 'white'
                }
            });
            this.dispatch(UpdateStateEvent.addCharacter, playerCharacter);
        }

        // Try to create Data if missing - find an adjacent position to player
        let dataPosition: { x: number, y: number } | null = null;

        if (playerPosition) {
            // Try to find an adjacent position to the player
            const offsets: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]];
            for (const [dx, dy] of offsets) {
                const x = playerPosition.x + dx;
                const y = playerPosition.y + dy;
                if (y >= 0 && y < map.length && x >= 0 && x < (map[0]?.length || 0)) {
                    const cell = map[y]?.[x];
                    const posKey = `${x},${y}`;
                    if (cell && cell.locations && !cell.locations.includes('wall') &&
                        !occupiedPositions.has(posKey)) {
                        dataPosition = { x, y };
                        break;
                    }
                }
            }
        }

        // If no adjacent position found, find any safe position
        if (!dataPosition) {
            dataPosition = findSafePosition(occupiedPositions);
        }

        // Ensure Data exists
        if (dataPosition) {
            const dataCharacter = this.createCharacterFromBase({
                name: 'Data',
                race: 'robot',
                description: 'An advanced synthetic companion',
                position: dataPosition,
                player: 'human',
                team: 'player',
                palette: {
                    skin: 'yellow',
                    helmet: 'gold',
                    suit: 'gold'
                }
            });
            this.dispatch(UpdateStateEvent.addCharacter, dataCharacter);
        }
    }
}