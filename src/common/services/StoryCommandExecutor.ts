import { EventBus } from '../events/EventBus';
import { UpdateStateEvent } from '../events';
import type { AICommand, MapCommand, StorylineCommand } from './AICommandParser';
import type { ICharacter, IItem, IWeapon, IRoom } from '../interfaces';
import type { IStoryState } from '../interfaces/IStory';
import { MapGenerator } from '../helpers/MapGenerator';
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

export class StoryCommandExecutor extends EventBus {
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
     * Execute a map generation command from AI
     * This replaces the current map with a new one
     */
    public async executeMapCommand(command: MapCommand, _storyState?: IStoryState): Promise<void> {
        console.log('[StoryExecutor] Executing map command:', command);
        
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
            (this as any).dispatch(UpdateStateEvent.map, newMap);
            
            // Handle character spawning if included in map command
            if (command.characters && command.characters.length > 0) {
                await this.spawnCharactersFromMap(command.characters, newMap);
            }
            
            // Update terrain palette if specified
            if (command.palette?.terrain) {
                // This would update CSS variables or terrain rendering
                console.log('[StoryExecutor] Setting terrain color:', command.palette.terrain);
            }
            
            console.log('[StoryExecutor] Map generation complete');
        } catch (error) {
            console.error('[StoryExecutor] Error executing map command:', error);
        }
    }
    
    /**
     * Execute a storyline command - updates narrative state
     */
    public async executeStorylineCommand(command: StorylineCommand, storyState?: IStoryState): Promise<void> {
        console.log('[StoryExecutor] Executing storyline command:', command);
        
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
            (this as any).dispatch(UpdateStateEvent.storyState, {
                journalEntries: [...currentEntries, journalEntry]
            });
        }
        
        // Display as message
        (this as any).dispatch(UpdateStateEvent.updateMessages, [{
            role: 'narrator',
            content: command.content
        }]);
        
        // Could trigger specific game events based on storyline
        if (command.description) {
            // Check for chapter transitions
            if (command.description.includes('chapter') || command.description.includes('capítulo')) {
                const currentChapter = storyState?.currentChapter || 1;
                (this as any).dispatch(UpdateStateEvent.storyState, {
                    currentChapter: currentChapter + 1
                });
            }
        }
    }
    
    /**
     * Spawn items or weapons at locations
     */
    public async executeItemSpawnCommand(command: ItemSpawnCommand): Promise<void> {
        console.log('[StoryExecutor] Executing item spawn command:', command);
        
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
                    
                    (this as any).dispatch(UpdateStateEvent.updateInventory, {
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
    }
    
    /**
     * Spawn characters as part of map generation
     */
    private async spawnCharactersFromMap(characters: any[], map: any): Promise<void> {
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
                    direction: charData.orientation || 'bottom',
                    player: 'ai', // NPCs are AI-controlled
                    team: this.determineTeam(charData),
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
                
                // Add character to game
                (this as any).dispatch(UpdateStateEvent.addCharacter, newCharacter);
                
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
        // Could be: "room name", "near character", "x,y coordinates", etc.
        
        // Try coordinates first
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