import { EventBus } from '../events/EventBus';
import { UpdateStateEvent, UpdateStateEventsMap } from '../events';
import type { AICommand, MapCommand, StorylineCommand } from './AICommandParser';
import type { ICharacter, IItem, IWeapon, IRoom, IDoor, Direction } from '../interfaces';
import type { IStoryState } from '../interfaces/IStory';
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
        console.log('[StoryExecutor] Executing map command');
        console.log('[StoryExecutor] Map command details:', {
            hasPalette: !!command.palette,
            buildingCount: command.buildings?.length || 0,
            doorCount: command.doors?.length || 0,
            characterCount: command.characters?.length || 0
        });
        
        if (command.buildings) {
            console.log('[StoryExecutor] Buildings to generate:', command.buildings.map(b => ({
                name: b.name,
                roomCount: b.rooms?.length || 0
            })));
        }
        
        try {
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
                    
                    rooms.push({
                        name: `${building.name} - ${room.name}`,
                        size: sizeMap[room.size] || 5
                    });
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
            // but their positions (10,10 and 11,10) might be in walls after map generation
            // The best approach is to remove them first, then re-add them with valid positions
            
            // First, remove the existing player and Data
            this.dispatch(UpdateStateEvent.removeCharacter, { characterName: 'player' });
            this.dispatch(UpdateStateEvent.removeCharacter, { characterName: 'Data' });
            console.log('[StoryExecutor] Removed existing player and Data to reposition them');
            
            // Now add them back with valid positions in the first room
            const firstRoomName = rooms.length > 0 ? rooms[0]!.name : 'floor';
            
            // Prepend player and Data to the characters list for spawning
            if (!command.characters) {
                command.characters = [];
            }
            
            // Add player and Data at the beginning of the character list
            // They'll be spawned with proper positions based on the room
            // Using 'any' type to include custom fields
            const playerChar: any = {
                name: 'player',
                location: firstRoomName,
                race: 'human',
                player: 'human',  // Mark as human-controlled
                team: 'player'
            };
            
            const dataChar: any = {
                name: 'Data',
                location: firstRoomName,
                race: 'synth',
                player: 'human',  // Also controlled by human player
                team: 'player'
            };
            
            command.characters.unshift(playerChar, dataChar);
            
            console.log('[StoryExecutor] Added player and Data to spawn list for room:', firstRoomName);
            
            // Handle door generation if included in map command
            if (command.doors && command.doors.length > 0) {
                await this.generateDoorsFromMap(command.doors, newMap);
            }
            
            // Handle character spawning if included in map command
            if (command.characters && command.characters.length > 0) {
                await this.spawnCharactersFromMap(command.characters, newMap);
            }
            
            // Update terrain palette if specified
            if (command.palette?.terrain) {
                // This would update CSS variables or terrain rendering
                console.log('[StoryExecutor] Setting terrain color:', command.palette.terrain);
            }
            
            console.log('[StoryExecutor] Map generation complete - map updated');
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
        console.log('[StoryExecutor] Storyline details:', {
            hasTitle: !!command.storyline?.title,
            hasDescription: !!command.storyline?.description,
            objectiveCount: command.storyline?.objectives?.length || 0,
            triggerAction: command.trigger_action
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
                        await this.spawnCharactersFromMap(command.actionData.characters, []);
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
                            type: itemData.type as any
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
                            items: [...currentInventory.items, item]
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
    private async generateDoorsFromMap(doors: any[], map: any): Promise<void> {
        console.log(`[StoryExecutor] Generating ${doors.length} doors...`);
        console.log('[StoryExecutor] Door positions:', doors.map(d => ({
            position: d.position,
            type: d.type,
            locked: d.locked
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
                    map[cellY][cellX].doors.push(door);
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
    private async spawnCharactersFromMap(characters: any[], map: any): Promise<void> {
        console.log(`[StoryExecutor] Spawning ${characters.length} characters...`);
        console.log('[StoryExecutor] Characters to spawn:', characters.map(c => ({
            name: c.name,
            race: c.race,
            location: c.location
        })));
        
        // Check if player and Data already exist before spawning
        console.log('[StoryExecutor] Note: player and Data should already exist in state from getEmptyState()');
        
        for (const charData of characters) {
            try {
                // Find spawn position based on location description
                const position = this.findSpawnPosition(charData.location, map);
                
                if (!position) {
                    console.warn(`[StoryExecutor] Could not find spawn position for ${charData.name}`);
                    continue;
                }
                
                // Create character
                const newCharacter: Partial<ICharacter> = {
                    name: charData.name,
                    race: charData.race || 'human',
                    description: charData.description || '',
                    position: position,
                    direction: this.mapDirection(charData.orientation || 'down') as Direction,
                    player: charData.player || 'ai', // Use provided player value or default to AI
                    team: charData.team || this.determineTeam(charData), // Use provided team or determine it
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
                
                console.log(`[StoryExecutor] Spawned character ${charData.name} at`, position);
            } catch (error) {
                console.error(`[StoryExecutor] Error spawning character ${charData.name}:`, error);
            }
        }
    }
    
    /**
     * Find a suitable spawn position based on location description
     */
    private findSpawnPosition(location: string, map: any): { x: number, y: number } | null {
        // Parse location string
        // Could be: "room name", "near character", "x,y coordinates", "center", "near_player", etc.
        
        // Handle special cases
        if (location === 'center') {
            // Find a walkable position near the center of the map
            const centerX = Math.floor(map[0].length / 2);
            const centerY = Math.floor(map.length / 2);
            
            // Search in expanding circles from center
            for (let radius = 0; radius < 10; radius++) {
                for (let dy = -radius; dy <= radius; dy++) {
                    for (let dx = -radius; dx <= radius; dx++) {
                        const y = centerY + dy;
                        const x = centerX + dx;
                        if (y >= 0 && y < map.length && x >= 0 && x < map[0].length) {
                            const cell = map[y][x];
                            if (cell && cell.locations && !cell.locations.includes('wall') && !cell.content?.blocker) {
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
                    if (y >= 0 && y < map.length && x >= 0 && x < map[0].length) {
                        const cell = map[y][x];
                        if (cell && cell.locations && !cell.locations.includes('wall') && !cell.content?.blocker) {
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
        
        // Find room by name and get a random walkable cell
        for (let y = 0; y < map.length; y++) {
            for (let x = 0; x < map[y].length; x++) {
                const cell = map[y][x];
                if (cell.locations && cell.locations.some((loc: string) => 
                    loc.toLowerCase().includes(location.toLowerCase())
                )) {
                    if (!cell.content?.blocker) {
                        return { x, y };
                    }
                }
            }
        }
        
        // Default to center if nothing found
        return { x: 25, y: 25 };
    }
    
    /**
     * Determine team based on character data
     */
    private determineTeam(charData: any): string {
        // Check faction or alignment
        if (charData.faction) {
            return charData.faction;
        }
        
        // Check if hostile based on description
        const desc = (charData.description || '').toLowerCase();
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
        character?: any,
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
}