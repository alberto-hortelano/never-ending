import { EventBus } from '../events/EventBus';
import { UpdateStateEvent, UpdateStateEventsMap } from '../events';
import type { AICommand, MapCommand } from './AICommandParser';
import type { ICharacter, IItem, IWeapon, IDoor, Direction, IStoryState, ItemType, ICell, ICoord } from '../interfaces';
import { DoorService } from './DoorService';
import { weapons as availableWeapons, items as availableItems } from '../../data/state';
import { CharacterPositioningError } from '../errors/CharacterPositioningError';
import { MAIN_CHARACTER_NAME, COMPANION_DROID_NAME, PLAYER_FACTION, HUMAN_CONTROLLER } from '../constants';
import { CharacterSpawningService, type CharacterSpawnData } from './CharacterSpawningService';
import { MapGenerationService } from './MapGenerationService';

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

// Map cell with additional properties for door support
interface MapCell extends ICell {
    room?: string;
    terrain?: string;
    wall?: boolean;
    door?: boolean;
    doors?: IDoor[];
}

export class StoryCommandExecutor extends EventBus<UpdateStateEventsMap, UpdateStateEventsMap> {
    private static instance: StoryCommandExecutor;
    private characterSpawningService: CharacterSpawningService;
    private mapGenerationService: MapGenerationService;

    private constructor() {
        super();
        this.characterSpawningService = CharacterSpawningService.getInstance();
        this.mapGenerationService = MapGenerationService.getInstance();
    }

    public static getInstance(): StoryCommandExecutor {
        if (!StoryCommandExecutor.instance) {
            StoryCommandExecutor.instance = new StoryCommandExecutor();
        }
        return StoryCommandExecutor.instance;
    }

    /**
     * Execute a map generation command from AI
     * This replaces the current map with a new one
     */
    public async executeMapCommand(command: MapCommand, storyState?: IStoryState, seed?: number): Promise<void> {
        try {
            // Generate the new map using the service
            const mapResult = this.mapGenerationService.generateMap(
                command.buildings,
                seed
            );
            const newMap = mapResult.cells;

            // Update the map state
            this.dispatch(UpdateStateEvent.map, newMap);

            // Note: We don't clear existing characters here because they're needed
            // for state management. Instead, we'll ensure proper names are used.

            // Get companion name from origin story if available
            const companionName = storyState?.selectedOrigin?.startingCompanion?.name || COMPANION_DROID_NAME;

            // Ensure player characters are in the list with correct names
            const characters = command.characters || [];

            // Check if main character exists in command
            const hasPlayer = characters.some(c =>
                c.name?.toLowerCase() === MAIN_CHARACTER_NAME.toLowerCase()
            );

            // Check if companion exists in command (using origin story name)
            const hasCompanion = characters.some(c =>
                c.name?.toLowerCase() === companionName.toLowerCase()
            );

            // Add player character if not present
            if (!hasPlayer) {
                if (mapResult.rooms.length === 0) {
                    throw new Error('Cannot spawn player character: No rooms available in the map');
                }
                const firstRoomName = mapResult.rooms[0]!.name;
                characters.unshift({
                    name: MAIN_CHARACTER_NAME,
                    race: 'human',
                    description: 'The player character',
                    location: firstRoomName,
                    speed: 'medium' as const,
                    orientation: 'bottom' as const,
                    palette: { skin: '#d7a55f', helmet: 'white', suit: 'white' }
                } as typeof command.characters[0]);
            }

            // Add companion if not present (using origin story name)
            // Note: If "Data" exists but we need "Rusty", we'll handle that during spawning
            if (!hasCompanion && companionName !== COMPANION_DROID_NAME) {
                // Only add if it's a different companion than the default "Data"
                if (mapResult.rooms.length === 0) {
                    throw new Error('Cannot spawn companion character: No rooms available in the map');
                }
                const firstRoomName = mapResult.rooms[0]!.name;
                characters.unshift({
                    name: companionName,  // Use the origin story companion name
                    race: 'robot',
                    description: storyState?.selectedOrigin?.startingCompanion?.description || 'Your robot companion',
                    location: firstRoomName,
                    speed: 'medium' as const,
                    orientation: 'bottom' as const,
                    palette: { skin: 'yellow', helmet: 'gold', suit: 'gold' }
                } as typeof command.characters[0]);
            }

            // Handle door generation if included in map command
            if (command.doors && command.doors.length > 0) {
                await this.generateDoorsFromMap(command.doors, newMap as MapCell[][]);
            }

            // Handle character spawning if included in map command
            if (characters.length > 0) {
                await this.spawnCharactersFromMap(
                    characters as CharacterSpawnData[],
                    newMap as MapCell[][],
                    storyState
                );
            }

            // Update terrain palette if specified
            if (command.palette?.terrain) {
                // This would update CSS variables or terrain rendering
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new Error(`Failed to execute map command: ${errorMessage}`);
        }
    }


    /**
     * Spawn items or weapons at locations
     */
    public async executeItemSpawnCommand(command: ItemSpawnCommand): Promise<void> {

        for (const itemData of command.items) {
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

            }
        }
    }

    /**
     * Generate doors from AI map command
     */
    private async generateDoorsFromMap(doors: MapCommand['doors'], map: MapCell[][]): Promise<void> {
        if (!doors) return;

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

            } catch (_error) {
                // Skip failed door generation
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
    private async spawnCharactersFromMap(characters: CharacterSpawnData[], map: MapCell[][], storyState?: IStoryState): Promise<void> {
        const occupiedPositions = new Set<string>();
        const availableRooms = this.characterSpawningService.getAvailableRooms(map as ICell[][]);

        // Get companion name from origin story if available
        const companionName = storyState?.selectedOrigin?.startingCompanion?.name || COMPANION_DROID_NAME;

        // If we have a different companion than the default "Data", remove "Data" first
        if (companionName !== COMPANION_DROID_NAME) {
            this.dispatch(UpdateStateEvent.removeCharacter, { characterName: COMPANION_DROID_NAME });
        }

        // Handle player characters first
        // Keep track of spawned characters to avoid duplicates
        const spawnedNames = new Set<string>();
        const spawnedCharacters: Array<{ name: string; position: ICoord }> = [];

        for (const charData of characters) {
            const isPlayer = charData.name?.toLowerCase() === MAIN_CHARACTER_NAME.toLowerCase();
            const isCompanion = charData.name === companionName ||
                charData.name?.toLowerCase() === companionName.toLowerCase();

            if (isPlayer || isCompanion) {
                // Skip if already spawned
                const characterName = isPlayer ? MAIN_CHARACTER_NAME : companionName;
                if (spawnedNames.has(characterName.toLowerCase())) {
                    console.log(`[StoryCommandExecutor] Skipping duplicate spawn of ${characterName}`);
                    continue;
                }

                try {
                    const position = await this.spawnPlayerCharacter(
                        charData,
                        map as ICell[][],
                        occupiedPositions,
                        availableRooms,
                        isPlayer,
                        companionName,
                        spawnedCharacters
                    );
                    spawnedNames.add(characterName.toLowerCase());
                    if (position) {
                        spawnedCharacters.push({ name: characterName, position });
                    }
                } catch (error) {
                    console.error(`[StoryCommandExecutor] Failed to spawn player character ${characterName}:`, error);
                    throw error;
                }
                continue;
            }
        }

        // Spawn non-player characters
        for (const charData of characters) {
            const companionName = storyState?.selectedOrigin?.startingCompanion?.name || COMPANION_DROID_NAME;
            if (charData.name?.toLowerCase() === MAIN_CHARACTER_NAME.toLowerCase() ||
                charData.name === companionName ||
                charData.name?.toLowerCase() === companionName.toLowerCase() ||
                spawnedNames.has(charData.name?.toLowerCase() || '')) {
                if (spawnedNames.has(charData.name?.toLowerCase() || '')) {
                    console.log(`[StoryCommandExecutor] Skipping duplicate spawn of NPC ${charData.name}`);
                }
                continue;
            }

            try {
                const position = await this.spawnNonPlayerCharacter(
                    charData,
                    map as ICell[][],
                    occupiedPositions,
                    availableRooms,
                    spawnedCharacters
                );
                spawnedNames.add(charData.name?.toLowerCase() || '');
                if (position && charData.name) {
                    spawnedCharacters.push({ name: charData.name, position });
                }
            } catch (error) {
                console.error(`[StoryCommandExecutor] Failed to spawn NPC ${charData.name}:`, error);
                throw error;
            }
        }
    }

    private async spawnPlayerCharacter(
        charData: CharacterSpawnData,
        map: ICell[][],
        occupiedPositions: Set<string>,
        availableRooms: string[],
        isPlayer: boolean,
        companionName?: string,
        existingCharacters?: Array<{ name: string; position: ICoord }>
    ): Promise<ICoord> {
        const characterName = isPlayer ? MAIN_CHARACTER_NAME : (charData.name || companionName || COMPANION_DROID_NAME);
        console.log(`[StoryCommandExecutor] Attempting to spawn player character: "${characterName}" at location: "${charData.location}"`);

        const position = this.characterSpawningService.findSpawnPosition(
            charData.location,
            map,
            occupiedPositions,
            existingCharacters
        );

        if (!position) {
            console.error(`[StoryCommandExecutor] Failed to find spawn position for ${characterName} at location: "${charData.location}"`);
            throw new CharacterPositioningError(
                charData.name,
                charData.location,
                availableRooms,
                { width: map[0]?.length || 50, height: map.length || 50 }
            );
        }

        // Validate position is within bounds
        const mapBounds = { width: map[0]?.length || 50, height: map.length || 50 };
        if (position.x < 0 || position.x >= mapBounds.width || position.y < 0 || position.y >= mapBounds.height) {
            console.error(`[StoryCommandExecutor] ERROR: Position (${position.x}, ${position.y}) is outside map bounds (${mapBounds.width}x${mapBounds.height}) for character ${characterName}`);
            throw new CharacterPositioningError(
                characterName,
                `Invalid position (${position.x}, ${position.y})`,
                availableRooms,
                mapBounds
            );
        }

        console.log(`[StoryCommandExecutor] Spawning ${characterName} at valid position (${position.x}, ${position.y})`);

        const character = this.characterSpawningService.createCharacterFromBase({
            name: characterName,
            position: position,
            race: isPlayer ? 'human' : (charData.race || 'robot'),
            controller: HUMAN_CONTROLLER,
            faction: PLAYER_FACTION,
            palette: isPlayer ?
                { skin: '#d7a55f', helmet: 'white', suit: 'white' } :
                (charData.palette || { skin: 'yellow', helmet: 'gold', suit: 'gold' })
        });

        // Use addCharacter for new characters instead of characterPosition
        const updateWithNetwork = character as ICharacter & { fromNetwork?: boolean };
        updateWithNetwork.fromNetwork = true;
        this.dispatch(UpdateStateEvent.addCharacter, updateWithNetwork);

        occupiedPositions.add(`${position.x},${position.y}`);
        console.log(`[StoryCommandExecutor] Successfully spawned ${characterName}`);
        return position;
    }

    private async spawnNonPlayerCharacter(
        charData: CharacterSpawnData,
        map: ICell[][],
        occupiedPositions: Set<string>,
        availableRooms: string[],
        existingCharacters?: Array<{ name: string; position: ICoord }>
    ): Promise<ICoord> {
        console.log(`[StoryCommandExecutor] Attempting to spawn NPC: "${charData.name}" at location: "${charData.location}"`);

        const position = this.characterSpawningService.findSpawnPosition(
            charData.location,
            map,
            occupiedPositions,
            existingCharacters
        );

        if (!position) {
            console.error(`[StoryCommandExecutor] Failed to find spawn position for ${charData.name} at location: "${charData.location}"`);
            throw new CharacterPositioningError(
                charData.name,
                charData.location,
                availableRooms,
                { width: map[0]?.length || 50, height: map.length || 50 }
            );
        }

        const mapBounds = { width: map[0]?.length || 50, height: map.length || 50 };

        // Validate position is within bounds
        if (position.x < 0 || position.x >= mapBounds.width || position.y < 0 || position.y >= mapBounds.height) {
            console.error(`[StoryCommandExecutor] ERROR: Position (${position.x}, ${position.y}) is outside map bounds (${mapBounds.width}x${mapBounds.height}) for NPC ${charData.name}`);
            throw new CharacterPositioningError(
                charData.name,
                `Invalid position (${position.x}, ${position.y})`,
                availableRooms,
                mapBounds
            );
        }

        console.log(`[StoryCommandExecutor] Spawning NPC ${charData.name} at valid position (${position.x}, ${position.y})`);

        // Determine controller assignment based on faction
        let assignedController = charData.controller || 'ai'; // Default to AI for NPCs
        if (charData.faction === 'enemy') {
            assignedController = 'ai';
        } else if (charData.faction === 'player') {
            assignedController = 'human';
        }
        // neutral faction remains with default or specified player

        const newCharacter = this.characterSpawningService.createCharacterFromBase({
            name: charData.name,
            race: charData.race || 'human',
            description: charData.description || '',
            position: position,
            direction: this.mapDirection(charData.orientation || 'down'),
            controller: assignedController,
            faction: charData.faction || this.characterSpawningService.determineFaction(charData),
            palette: charData.palette || {
                skin: '#d7a55f',
                helmet: '#808080',
                suit: '#404040'
            }
        });

        console.log(`[StoryCommandExecutor] Spawning NPC ${charData.name} with faction ${charData.faction} assigned to controller ${assignedController}`);

        this.dispatch(UpdateStateEvent.addCharacter, newCharacter);
        occupiedPositions.add(`${position.x},${position.y}`);
        console.log(`[StoryCommandExecutor] Successfully spawned NPC ${charData.name}`);
        return position;
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

}