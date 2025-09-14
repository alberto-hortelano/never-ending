import { EventBus } from '../events/EventBus';
import { UpdateStateEvent, UpdateStateEventsMap, ConversationEvent, ConversationEventsMap } from '../events';
import type { AICommand, MapCommand, StorylineCommand } from './AICommandParser';
import type { ICharacter, IItem, IWeapon, IDoor, Direction, IStoryState, ItemType, ICell } from '../interfaces';
import { DoorService } from './DoorService';
import { weapons as availableWeapons, items as availableItems } from '../../data/state';
import { CharacterPositioningError } from '../errors/CharacterPositioningError';
import { MAIN_CHARACTER_NAME, COMPANION_DROID_NAME, PLAYER_TEAM, HUMAN_PLAYER } from '../constants';
import { i18n } from '../i18n/i18n';
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

export class StoryCommandExecutor extends EventBus<{}, UpdateStateEventsMap & ConversationEventsMap> {
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
    public async executeMapCommand(command: MapCommand, _storyState?: IStoryState, seed?: number): Promise<void> {
        try {
            // Generate the new map using the service
            const mapResult = this.mapGenerationService.generateMap(
                command.buildings,
                seed
            );
            const newMap = mapResult.cells;

            // Update the map state
            this.dispatch(UpdateStateEvent.map, newMap);

            // Player and Data already exist in state from getEmptyState()
            // We need to ensure they are preserved and properly positioned

            // Ensure player characters are in the list
            const characters = command.characters || [];
            const playerChars = this.characterSpawningService.ensurePlayerCharacters();

            // Add player characters if not already present
            for (const playerChar of playerChars) {
                const exists = characters.some(c =>
                    c.name?.toLowerCase() === playerChar.name.toLowerCase()
                );
                if (!exists) {
                    const firstRoomName = mapResult.rooms.length > 0 ? mapResult.rooms[0]!.name : 'floor';
                    characters.unshift({
                        ...playerChar,
                        location: firstRoomName,
                        speed: 'medium' as const,
                        orientation: 'bottom' as const
                    } as any);
                }
            }

            // Handle door generation if included in map command
            if (command.doors && command.doors.length > 0) {
                await this.generateDoorsFromMap(command.doors, newMap as MapCell[][]);
            }

            // Handle character spawning if included in map command
            if (characters.length > 0) {
                await this.spawnCharactersFromMap(
                    characters as CharacterSpawnData[],
                    newMap as MapCell[][]
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
     * Execute a storyline command - updates narrative state and triggers action
     */
    public async executeStorylineCommand(command: StorylineCommand, storyState?: IStoryState): Promise<void> {

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

        // If storyline has an action, display it through the conversation UI
        if (command.action) {
            this.showStorylinePopup(command);
        } else {
            // No action, just display as a simple message
            this.dispatch(UpdateStateEvent.updateMessages, [{
                role: 'assistant',
                content: command.content
            }]);
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

    private showStorylinePopup(command: StorylineCommand): void {
        // Show the popup for the storyline
        this.dispatch(UpdateStateEvent.uiPopup, {
            popupId: 'main-popup',
            popupState: {
                type: 'conversation',
                visible: true,
                position: undefined,
                data: {
                    title: 'Historia'
                }
            }
        });

        // Wait for popup to be ready, then dispatch conversation update
        setTimeout(() => {
            this.dispatch(ConversationEvent.update, {
                type: 'storyline',
                source: i18n.t('conversation.narrator'),
                content: command.content,
                answers: [i18n.t('common.accept'), i18n.t('common.reject')],
                action: command.action,
                actionData: command.actionData
            });
        }, 200);
    }

    /**
     * Spawn items or weapons at locations
     */
    public async executeItemSpawnCommand(command: ItemSpawnCommand): Promise<void> {

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

                }
            } catch (error) {
                // Silently skip failed item spawns
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

            } catch (error) {
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
    private async spawnCharactersFromMap(characters: CharacterSpawnData[], map: MapCell[][]): Promise<void> {
        const occupiedPositions = new Set<string>();
        const availableRooms = this.characterSpawningService.getAvailableRooms(map as ICell[][]);

        // Handle player characters first
        for (const charData of characters) {
            const isPlayer = charData.name?.toLowerCase() === MAIN_CHARACTER_NAME.toLowerCase();
            const isData = charData.name === COMPANION_DROID_NAME ||
                          charData.name?.toLowerCase() === COMPANION_DROID_NAME.toLowerCase();

            if (isPlayer || isData) {
                await this.spawnPlayerCharacter(
                    charData,
                    map as ICell[][],
                    occupiedPositions,
                    availableRooms,
                    isPlayer
                );
                continue;
            }
        }

        // Spawn non-player characters
        for (const charData of characters) {
            if (charData.name?.toLowerCase() === MAIN_CHARACTER_NAME.toLowerCase() ||
                charData.name === COMPANION_DROID_NAME ||
                charData.name?.toLowerCase() === COMPANION_DROID_NAME.toLowerCase()) {
                continue;
            }

            await this.spawnNonPlayerCharacter(
                charData,
                map as ICell[][],
                occupiedPositions,
                availableRooms
            );
        }
    }

    private async spawnPlayerCharacter(
        charData: CharacterSpawnData,
        map: ICell[][],
        occupiedPositions: Set<string>,
        availableRooms: string[],
        isPlayer: boolean
    ): Promise<void> {
        try {
            const position = this.characterSpawningService.findSpawnPosition(
                charData.location,
                map,
                occupiedPositions
            );

            if (!position) {
                throw new CharacterPositioningError(
                    charData.name,
                    charData.location,
                    availableRooms,
                    { width: map[0]?.length || 50, height: map.length || 50 }
                );
            }

            const character = this.characterSpawningService.createCharacterFromBase({
                name: isPlayer ? MAIN_CHARACTER_NAME : COMPANION_DROID_NAME,
                position: position,
                race: isPlayer ? 'human' : 'robot',
                player: HUMAN_PLAYER,
                team: PLAYER_TEAM,
                palette: isPlayer ?
                    { skin: '#d7a55f', helmet: 'white', suit: 'white' } :
                    { skin: 'yellow', helmet: 'gold', suit: 'gold' }
            });

            const updateWithNetwork = character as ICharacter & { fromNetwork?: boolean };
            updateWithNetwork.fromNetwork = true;
            this.dispatch(UpdateStateEvent.characterPosition, updateWithNetwork);

            occupiedPositions.add(`${position.x},${position.y}`);
        } catch (error) {
            // Re-throw for critical player characters
            throw error;
        }
    }

    private async spawnNonPlayerCharacter(
        charData: CharacterSpawnData,
        map: ICell[][],
        occupiedPositions: Set<string>,
        availableRooms: string[]
    ): Promise<void> {
        try {
            const position = this.characterSpawningService.findSpawnPosition(
                charData.location,
                map,
                occupiedPositions
            );

            if (!position) {
                throw new CharacterPositioningError(
                    charData.name,
                    charData.location,
                    availableRooms,
                    { width: map[0]?.length || 50, height: map.length || 50 }
                );
            }

            const mapBounds = { width: map[0]?.length || 50, height: map.length || 50 };
            this.characterSpawningService.validatePosition(position, mapBounds);

            const newCharacter = this.characterSpawningService.createCharacterFromBase({
                name: charData.name,
                race: charData.race || 'human',
                description: charData.description || '',
                position: position,
                direction: this.mapDirection(charData.orientation || 'down'),
                player: charData.player || 'ai',
                team: charData.team || this.characterSpawningService.determineTeam(charData),
                palette: charData.palette || {
                    skin: '#d7a55f',
                    helmet: '#808080',
                    suit: '#404040'
                }
            });

            this.dispatch(UpdateStateEvent.addCharacter, newCharacter);
            occupiedPositions.add(`${position.x},${position.y}`);
        } catch (error) {
            // Silently skip failed NPC spawns
        }
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