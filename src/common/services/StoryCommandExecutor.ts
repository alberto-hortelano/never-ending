import { EventBus } from '../events/EventBus';
import { UpdateStateEvent, UpdateStateEventsMap } from '../events';
import type { AICommand, MapCommand, StorylineCommand, CharacterCommand } from './AICommandParser';
import type { ICharacter, IItem, IWeapon, IRoom, IDoor, Direction, IStoryState, ItemType, Race, Action } from '../interfaces';
import { MapGenerator } from '../helpers/MapGenerator';
import { DoorService } from './DoorService';
import { weapons as availableWeapons, items as availableItems } from '../../data/state';

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

interface CharacterData {
    name: string;
    location?: string;
    race?: string;
    player?: string;
    team?: string;
    faction?: string;
    personality?: string;
    [key: string]: unknown;
}

interface MapCell {
    room?: string;
    terrain?: string;
    wall?: boolean;
    door?: boolean;
    locations?: string[];
    [key: string]: unknown;
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
     * Maps AI direction values to game direction values
     */
    private mapDirection(direction: string): string {
        const directionMap: { [key: string]: string } = {
            'top': 'up',
            'bottom': 'down',
            'left': 'left',
            'right': 'right',
            'top-left': 'up-left',
            'top-right': 'up-right',
            'bottom-left': 'down-left',
            'bottom-right': 'down-right'
        };
        return directionMap[direction] || direction;
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
                    palette: undefined,
                    player: 'human',  // Mark as human-controlled
                    team: 'player'
                };
                command.characters.unshift(playerChar as any);
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
                    palette: undefined,
                    player: 'human',  // Also controlled by human player
                    team: 'player'
                };
                command.characters.unshift(dataChar as any);
            }
            
            // Handle door generation if included in map command
            if (command.doors && command.doors.length > 0) {
                await this.generateDoorsFromMap(command.doors, newMap as unknown as MapCell[][]);
            }
            
            // Handle character spawning if included in map command
            if (command.characters && command.characters.length > 0) {
                await this.spawnCharactersFromMap(command.characters, newMap as unknown as MapCell[][]);
            }
            
            // Update terrain palette if specified
            if (command.palette?.terrain) {
                // This would update CSS variables or terrain rendering
            }
            
            // SAFETY CHECK: Ensure player and Data always exist after map generation
            // This is a critical failsafe to prevent them from being lost
            await this.ensurePlayerAndDataExist(newMap as unknown as MapCell[][]);
            
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
        const storyline = (command as any).storyline;
        console.log('[StoryExecutor] Storyline details:', {
            hasTitle: !!storyline?.title,
            hasDescription: !!storyline?.description,
            objectiveCount: storyline?.objectives?.length || 0,
            triggerAction: (command as any).trigger_action
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
                    console.log('[StoryExecutor] Requesting new map generation');
                    // This would trigger AI to generate a new map based on description
                    break;
                    
                case 'character':
                    // Spawn new characters
                    if (command.actionData?.characters) {
                        await this.spawnCharactersFromMap((command.actionData as any).characters, [] as unknown as MapCell[][]);
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
                            items: [...((currentInventory as any).items || []), item],
                            maxWeight: (currentInventory as any).maxWeight || 50,
                            equippedWeapons: (currentInventory as any).equippedWeapons || { primary: null, secondary: null }
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
                    (map[cellY][cellX] as any).doors!.push(door);
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
    private async spawnCharactersFromMap(characters: CharacterCommand['characters'], map: MapCell[][]): Promise<void> {
        // Track occupied positions to avoid overlapping
        const occupiedPositions = new Set<string>();
        
        // Helper to mark position as occupied
        const markPositionOccupied = (x: number, y: number): void => {
            occupiedPositions.add(`${x},${y}`);
        };
        
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
                        console.warn(`[StoryExecutor] Could not find spawn position for ${charData.name}`);
                        continue;
                    }
                    
                    console.log(`[Character Position] Updating ${charData.name} position to (${position.x}, ${position.y})`);
                    
                    // Update the existing character's position
                    // For now, just dispatch with minimal info - the state handler should handle this
                    this.dispatch(UpdateStateEvent.characterPosition, {
                        name: isPlayer ? 'player' : 'Data',
                        position: position,
                        race: 'human' as Race,
                        description: '',
                        action: 'idle' as Action,
                        player: isPlayer ? 'human' : 'ai',
                        direction: 'down' as Direction,
                        location: '',
                        path: [],
                        blocker: true,
                        palette: { skin: '', helmet: '', suit: '' },
                        inventory: { items: [], maxWeight: 50, equippedWeapons: { primary: null, secondary: null } },
                        actions: { 
                            pointsLeft: 0, 
                            general: { move: 0, talk: 0, use: 0, inventory: 0 },
                            rangedCombat: { shoot: 0, aim: 0, overwatch: 0, cover: 0, throw: 0 },
                            closeCombat: { powerStrike: 0, slash: 0, fastAttack: 0, feint: 0, breakGuard: 0 }
                        },
                        health: 100,
                        maxHealth: 100
                    } as ICharacter);
                    
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
                    console.warn(`[Character Position] ERROR: Could not find spawn position for ${charData.name} at location "${charData.location}"`);
                    continue;
                }
                
                // Validate position is within map bounds
                if (position.x < 0 || position.x >= (map[0]?.length || 0) || 
                    position.y < 0 || position.y >= map.length) {
                    console.error(`[Character Position] ERROR: Position (${position.x}, ${position.y}) is outside map bounds for ${charData.name}!`);
                    console.error(`[Character Position] Map bounds: 0-${(map[0]?.length || 0) - 1} x 0-${map.length - 1}`);
                    // Try to find a safe fallback position
                    const safePos = this.findSafePosition(map, occupiedPositions);
                    if (safePos) {
                        console.log(`[Character Position] Using safe fallback position (${safePos.x}, ${safePos.y}) for ${charData.name}`);
                        position.x = safePos.x;
                        position.y = safePos.y;
                    } else {
                        console.error(`[Character Position] No safe position found for ${charData.name}, skipping character`);
                        continue;
                    }
                }
                
                console.log(`[Character Position] Spawning ${charData.name} at position (${position.x}, ${position.y})`);
                
                // Create character
                const newCharacter: Partial<ICharacter> = {
                    name: charData.name,
                    race: (charData.race || 'human') as Race,
                    description: charData.description || '',
                    position: position,
                    direction: this.mapDirection(charData.orientation || 'down') as Direction,
                    player: (charData as any).player || 'ai', // Use provided player value or default to AI
                    team: (charData as any).team || this.determineTeam(charData), // Use provided team or determine it
                    health: 100,
                    maxHealth: 100,
                    palette: charData.palette || {
                        skin: '#d7a55f',
                        helmet: '#808080',
                        suit: '#404040'
                    },
                    inventory: {
                        items: [],
                        maxWeight: 50,
                        equippedWeapons: { primary: null, secondary: null }
                    }
                };
                
                // Add character to game (we know name and position are set)
                this.dispatch(UpdateStateEvent.addCharacter, newCharacter as Partial<ICharacter> & { name: string; position: { x: number; y: number } });
                
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
    private findSafePosition(map: MapCell[][], occupiedPositions?: Set<string>): { x: number, y: number } | null {
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
                            !(cell as any).content?.blocker && (!occupiedPositions || !occupiedPositions.has(posKey))) {
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
    private findRoomPosition(roomName: string, map: MapCell[][], occupiedPositions?: Set<string>): { x: number, y: number } | null {
        const lowerRoomName = roomName.toLowerCase().trim();
        console.log(`[Character Position] Searching for room: "${roomName}" (normalized: "${lowerRoomName}")`);
        
        // First try exact match
        for (let y = 0; y < map.length; y++) {
            const row = map[y];
            if (!row) continue;
            for (let x = 0; x < row.length; x++) {
                const cell = row[x];
                if (!cell) continue;
                if (cell.locations && cell.locations.some((loc: string) => 
                    loc.toLowerCase() === lowerRoomName
                )) {
                    const posKey = `${x},${y}`;
                    if (!(cell as any).content?.blocker && (!occupiedPositions || !occupiedPositions.has(posKey))) {
                        console.log(`[Character Position] Found exact match for room "${roomName}" at (${x}, ${y})`);
                        return { x, y };
                    }
                }
            }
        }
        
        // Try partial match (room name is contained in cell location)
        for (let y = 0; y < map.length; y++) {
            const row = map[y];
            if (!row) continue;
            for (let x = 0; x < row.length; x++) {
                const cell = row[x];
                if (!cell) continue;
                if (cell.locations && cell.locations.some((loc: string) => 
                    loc.toLowerCase().includes(lowerRoomName) || lowerRoomName.includes(loc.toLowerCase())
                )) {
                    const posKey = `${x},${y}`;
                    if (!(cell as any).content?.blocker && (!occupiedPositions || !occupiedPositions.has(posKey))) {
                        console.log(`[Character Position] Found partial match for room "${roomName}" at (${x}, ${y})`);
                        return { x, y };
                    }
                }
            }
        }
        
        // Try matching individual words
        const roomWords = lowerRoomName.split(/[\s\-\/]+/);
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
                            if (!(cell as any).content?.blocker && (!occupiedPositions || !occupiedPositions.has(posKey))) {
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
     * Find a suitable spawn position based on location description
     */
    private findSpawnPosition(location: string, map: MapCell[][], occupiedPositions?: Set<string>): { x: number, y: number } | null {
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
        
        // Handle special case: "location/player" means near player in that location
        if (location.includes('/player')) {
            console.log(`[Character Position] Location "${location}" appears to be near player format`);
            // Extract the room name part
            const roomName = location.replace('/player', '').trim();
            console.log(`[Character Position] Looking for room: "${roomName}" to place near player`);
            
            // Try to find the room first
            const roomPos = this.findRoomPosition(roomName, map, occupiedPositions);
            if (roomPos) {
                console.log(`[Character Position] Found room "${roomName}" at (${roomPos.x}, ${roomPos.y}), placing near player`);
                // Try to find a position adjacent to this room position
                const offsets: [number, number][] = [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]];
                for (const [dx, dy] of offsets) {
                    const x = roomPos.x + dx;
                    const y = roomPos.y + dy;
                    if (y >= 0 && y < map.length && map[0] && x >= 0 && x < map[0].length) {
                        const cell = map[y]?.[x];
                        const posKey = `${x},${y}`;
                        if (cell && cell.locations && !cell.locations.includes('wall') && 
                            !(cell as any).content?.blocker && (!occupiedPositions || !occupiedPositions.has(posKey))) {
                            return { x, y };
                        }
                    }
                }
                // If no adjacent position found, return the room position itself
                return roomPos;
            }
        }
        
        // Handle special cases
        if (location === 'center') {
            // Find a walkable position near the center of the map
            const centerX = map[0] ? Math.floor(map[0].length / 2) : Math.floor(map.length / 2);
            const centerY = Math.floor(map.length / 2);
            
            // Search in expanding circles from center
            for (let radius = 0; radius < 10; radius++) {
                for (let dy = -radius; dy <= radius; dy++) {
                    for (let dx = -radius; dx <= radius; dx++) {
                        const y = centerY + dy;
                        const x = centerX + dx;
                        if (y >= 0 && y < map.length && map[0] && x >= 0 && x < map[0].length) {
                            const cell = map[y]?.[x];
                            const posKey = `${x},${y}`;
                            if (cell && cell.locations && !cell.locations.includes('wall') && 
                                !(cell as any).content?.blocker && (!occupiedPositions || !occupiedPositions.has(posKey))) {
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
                            !(cell as any).content?.blocker && (!occupiedPositions || !occupiedPositions.has(posKey))) {
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
                    !(cell as any).content?.blocker && (!occupiedPositions || !occupiedPositions.has(posKey))) {
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
    private determineTeam(charData: CharacterData): string {
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
        type: 'character' | 'ground',
        character?: CharacterData,
        position?: { x: number, y: number }
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
        const findSafePosition = (excludePositions?: Set<string>): { x: number, y: number } | null => {
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
            this.dispatch(UpdateStateEvent.addCharacter, {
                    name: 'player',
                    race: 'human',
                    description: 'The player character',
                    position: playerPosition,
                    direction: 'down' as Direction,
                    player: 'human',
                    team: 'player',
                    health: 100,
                    maxHealth: 100,
                    palette: {
                        skin: '#d7a55f',
                        helmet: 'white',
                        suit: 'white'
                    },
                    inventory: {
                        items: [],
                        maxWeight: 50,
                        equippedWeapons: { primary: null, secondary: null }
                    },
                    blocker: true,
                    action: 'idle',
                    path: [],
                    location: '',
                    actions: {
                        pointsLeft: 100,
                        general: {
                            move: 20,
                            talk: 0,
                            use: 5,
                            inventory: 20,
                        },
                        rangedCombat: {
                            shoot: 20,
                            aim: 20,
                            overwatch: 20,
                            cover: 20,
                            throw: 20,
                        },
                        closeCombat: {
                            powerStrike: 25,
                            slash: 20,
                            fastAttack: 15,
                            feint: 20,
                            breakGuard: 20,
                        }
                    }
                });
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
        this.dispatch(UpdateStateEvent.addCharacter, {
                name: 'Data',
                race: 'robot',
                description: 'An advanced synthetic companion',
                position: dataPosition,
                direction: 'down' as Direction,
                player: 'human',
                team: 'player',
                health: 100,
                maxHealth: 100,
                palette: {
                    skin: 'yellow',
                    helmet: 'gold',
                    suit: 'gold'
                },
                inventory: {
                    items: [],
                    maxWeight: 50,
                    equippedWeapons: { primary: null, secondary: null }
                },
                blocker: true,
                action: 'idle',
                path: [],
                location: '',
                actions: {
                    pointsLeft: 100,
                    general: {
                        move: 20,
                        talk: 0,
                        use: 5,
                        inventory: 20,
                    },
                    rangedCombat: {
                        shoot: 20,
                        aim: 20,
                        overwatch: 20,
                        cover: 20,
                        throw: 20,
                    },
                    closeCombat: {
                        powerStrike: 25,
                        slash: 20,
                        fastAttack: 15,
                        feint: 20,
                        breakGuard: 20,
                    }
                }
            });
        }
    }
}