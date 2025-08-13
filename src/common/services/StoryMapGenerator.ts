import type { IRoom } from '../interfaces';
import type { IOriginStory } from '../interfaces/IStory';
import { MapGenerator } from '../helpers/MapGenerator';

interface MapTemplate {
    missionType: 'combat' | 'exploration' | 'infiltration' | 'diplomacy';
    environment: 'spaceship' | 'station' | 'planet' | 'settlement' | 'ruins';
    rooms: IRoom[];
    palette?: {
        terrain?: string;
        buildings?: any[];
    };
}

export class StoryMapGenerator {
    private static instance: StoryMapGenerator;
    
    private constructor() {
        // AI service would be initialized here if needed
    }
    
    public static getInstance(): StoryMapGenerator {
        if (!StoryMapGenerator.instance) {
            StoryMapGenerator.instance = new StoryMapGenerator();
        }
        return StoryMapGenerator.instance;
    }
    
    /**
     * Generate a map based on the origin story and current chapter
     */
    public async generateStoryMap(
        origin: IOriginStory,
        chapter: number,
        missionType?: string
    ): Promise<{ map: number[][], rooms: IRoom[] }> {
        // Get map template based on origin and chapter
        const template = this.getMapTemplate(origin, chapter, missionType);
        
        // Generate the physical map
        const mapGen = new MapGenerator(50, 50);
        const startPos = { x: 25, y: 25 };
        mapGen.generateMap(template.rooms, startPos);
        
        return {
            map: mapGen.getCells().map(row => row.map(cell => cell.content?.blocker ? 0 : 1)),
            rooms: template.rooms
        };
    }
    
    /**
     * Get map template based on origin story
     */
    private getMapTemplate(origin: IOriginStory, chapter: number, _missionType?: string): MapTemplate {
        // Default templates based on origin
        const templates: Record<string, MapTemplate[]> = {
            deserter: [
                {
                    missionType: 'combat',
                    environment: 'spaceship',
                    rooms: [
                        { size: 7, name: 'Bridge' },
                        { size: 5, name: 'Corridors' },
                        { size: 7, name: 'Engineering' },
                        { size: 5, name: 'Armory' },
                        { size: 3, name: 'MedBay' },
                        { size: 7, name: 'Cargo Hold' }
                    ]
                },
                {
                    missionType: 'infiltration',
                    environment: 'station',
                    rooms: [
                        { size: 5, name: 'Docking Bay' },
                        { size: 7, name: 'Security' },
                        { size: 5, name: 'Command Center' },
                        { size: 3, name: 'Comms Room' },
                        { size: 7, name: 'Barracks' }
                    ]
                }
            ],
            scavenger: [
                {
                    missionType: 'exploration',
                    environment: 'ruins',
                    rooms: [
                        { size: 7, name: 'Ancient Hall' },
                        { size: 5, name: 'Collapsed Wing' },
                        { size: 9, name: 'Vault' },
                        { size: 3, name: 'Power Core' },
                        { size: 7, name: 'Lab' },
                        { size: 5, name: 'Storage' }
                    ]
                },
                {
                    missionType: 'combat',
                    environment: 'settlement',
                    rooms: [
                        { size: 7, name: 'Market' },
                        { size: 5, name: 'Salvage Yard' },
                        { size: 5, name: 'Workshop' },
                        { size: 3, name: 'Office' },
                        { size: 7, name: 'Warehouse' }
                    ]
                }
            ],
            investigator: [
                {
                    missionType: 'infiltration',
                    environment: 'station',
                    rooms: [
                        { size: 5, name: 'Reception' },
                        { size: 7, name: 'Casino Floor' },
                        { size: 5, name: 'VIP Lounge' },
                        { size: 3, name: 'Security Office' },
                        { size: 7, name: 'Penthouse' },
                        { size: 5, name: 'Service Area' }
                    ]
                },
                {
                    missionType: 'diplomacy',
                    environment: 'settlement',
                    rooms: [
                        { size: 7, name: 'Court' },
                        { size: 5, name: 'Evidence Room' },
                        { size: 5, name: 'Interrogation' },
                        { size: 3, name: 'Archives' },
                        { size: 7, name: 'Precinct' }
                    ]
                }
            ],
            rebel: [
                {
                    missionType: 'combat',
                    environment: 'spaceship',
                    rooms: [
                        { size: 7, name: 'Hangar' },
                        { size: 5, name: 'Crew Quarters' },
                        { size: 7, name: 'Command Deck' },
                        { size: 3, name: 'Weapons Bay' },
                        { size: 5, name: 'Engine Room' },
                        { size: 7, name: 'Cargo Bay' }
                    ]
                },
                {
                    missionType: 'infiltration',
                    environment: 'station',
                    rooms: [
                        { size: 5, name: 'Maintenance' },
                        { size: 7, name: 'Reactor Core' },
                        { size: 5, name: 'Control Room' },
                        { size: 3, name: 'Sabotage Point' },
                        { size: 7, name: 'Escape Route' }
                    ]
                }
            ],
            survivor: [
                {
                    missionType: 'exploration',
                    environment: 'ruins',
                    rooms: [
                        { size: 7, name: 'Colony Square' },
                        { size: 5, name: 'Medical Center' },
                        { size: 7, name: 'Residential' },
                        { size: 3, name: 'Supply Cache' },
                        { size: 5, name: 'Admin Building' },
                        { size: 5, name: 'Shelter' }
                    ]
                },
                {
                    missionType: 'diplomacy',
                    environment: 'settlement',
                    rooms: [
                        { size: 7, name: 'Town Hall' },
                        { size: 5, name: 'Market' },
                        { size: 5, name: 'Inn' },
                        { size: 3, name: 'Clinic' },
                        { size: 7, name: 'Community Center' }
                    ]
                }
            ]
        };
        
        // Get templates for this origin
        const originTemplates = templates[origin.id];
        const fallbackTemplates = templates.deserter;
        const selectedTemplates = originTemplates || fallbackTemplates;
        
        if (!selectedTemplates || selectedTemplates.length === 0) {
            // Return a default template if nothing found
            return {
                missionType: 'exploration',
                environment: 'spaceship',
                rooms: [
                    { size: 7, name: 'Main Hall' },
                    { size: 5, name: 'Corridor' },
                    { size: 5, name: 'Storage' }
                ]
            };
        }
        
        // Select template based on chapter or mission type
        const templateIndex = Math.min(chapter - 1, selectedTemplates.length - 1);
        const template = selectedTemplates[templateIndex];
        return template || {
            missionType: 'exploration' as const,
            environment: 'spaceship' as const,
            rooms: [
                { size: 7, name: 'Main Hall' },
                { size: 5, name: 'Corridor' },
                { size: 5, name: 'Storage' }
            ]
        };
    }
    
    /**
     * Generate dynamic room names based on faction/story context
     */
    public generateRoomNames(
        baseTemplate: IRoom[],
        faction?: string,
        _missionContext?: string
    ): IRoom[] {
        // Add faction-specific prefixes or modify room names
        const factionPrefixes: Record<string, string> = {
            'rogue_military': 'Military',
            'syndicate': 'Syndicate',
            'technomancers': 'Tech',
            'rebel_coalition': 'Rebel',
            'free_worlds': 'Colonial'
        };
        
        const prefix = faction ? factionPrefixes[faction] : '';
        
        return baseTemplate.map(room => ({
            ...room,
            name: prefix ? `${prefix} ${room.name}` : room.name
        }));
    }
}