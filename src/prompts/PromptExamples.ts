/**
 * Type-safe prompt examples for AI commands
 * This file ensures that all AI prompt examples have the correct fields
 * and will cause compile errors if interfaces change
 */

import type {
    SpeechCommand,
    CharacterCommand,
    MapCommand,
    MovementCommand,
    AttackCommand
} from '../common/services/AICommandParser';
import { MAIN_CHARACTER_NAME, COMPANION_DROID_NAME } from '../common/constants';

// ==========================================
// SPEECH COMMAND EXAMPLES
// ==========================================

/**
 * Speech commands are used for dialogue and narration
 * Required fields: type, source, content
 * Optional fields: answers, target (for NPC-to-NPC), command (action after dialogue)
 */
export const speechExamples: SpeechCommand[] = [
    // Narration example
    {
        type: 'speech',
        source: 'Narrator',
        content: 'The damaged cruiser drifts through the debris field, its emergency lights casting eerie shadows.',
    },
    // Player dialogue with choices
    {
        type: 'speech',
        source: 'Captain Vega',
        content: 'You have two choices: surrender your cargo, or we take it by force.',
        answers: ['Never!', 'Lets negotiate', 'Attack first']
    },
    // Ending conversation
    {
        type: 'speech',
        source: 'Guard',
        content: 'Move along, nothing to see here.',
        answers: [] // Empty array shows "Continue" button
    },
    // NPC to NPC conversation
    {
        type: 'speech',
        source: 'Enemy Captain',
        content: 'Guard the entrance, no one gets through!',
        target: 'Enemy Guard' // ONLY for NPC-to-NPC
    },
    // Speech that triggers action after closing
    {
        type: 'speech',
        source: 'Raider',
        content: 'Enough talk!',
        answers: [],
        command: {
            type: 'attack',
            characters: [{ name: 'Raider', target: MAIN_CHARACTER_NAME }]
        }
    }
];

// ==========================================
// CHARACTER COMMAND EXAMPLES
// ==========================================

/**
 * Character commands spawn new characters
 * ALL fields shown here are REQUIRED (except palette which has defaults)
 * - name: Character identifier
 * - race: 'human' | 'alien' | 'robot'
 * - description: Background info
 * - faction: 'player' | 'enemy' | 'neutral'
 * - speed: 'slow' | 'medium' | 'fast'
 * - orientation: 'top' | 'right' | 'bottom' | 'left'
 * - location: Room name or character name to spawn near
 * - palette: Colors (optional, will use defaults if not provided)
 */
export const characterExamples: CharacterCommand[] = [
    // Player character (always required in initialization)
    {
        type: 'character',
        characters: [{
            name: MAIN_CHARACTER_NAME,
            race: 'human',
            description: 'The main protagonist',
            faction: 'player',
            speed: 'medium',
            orientation: 'bottom',
            location: 'Bridge',
            palette: {
                skin: '#d7a55f',
                helmet: 'white',
                suit: 'white'
            }
        }]
    },
    // Companion character
    {
        type: 'character',
        characters: [{
            name: COMPANION_DROID_NAME,
            race: 'robot',
            description: 'Your loyal companion droid',
            faction: 'player',
            speed: 'medium',
            orientation: 'bottom',
            location: MAIN_CHARACTER_NAME, // Spawn near player
            palette: {
                skin: 'yellow',
                helmet: 'gold',
                suit: 'gold'
            }
        }]
    },
    // Enemy characters
    {
        type: 'character',
        characters: [
            {
                name: 'Raider Captain',
                race: 'human',
                description: 'Leader of the raider crew',
                faction: 'enemy',
                speed: 'medium',
                orientation: 'left',
                location: 'Cargo Bay',
                palette: {
                    skin: '#8b4513',
                    helmet: 'darkred',
                    suit: 'black'
                }
            },
            {
                name: 'Raider Guard',
                race: 'alien',
                description: 'Heavily armed alien mercenary',
                faction: 'enemy',
                speed: 'slow',
                orientation: 'right',
                location: 'Raider Captain', // Spawn near their leader
                palette: {
                    skin: 'green',
                    helmet: 'darkgreen',
                    suit: 'darkgray'
                }
            }
        ]
    },
    // Neutral NPC
    {
        type: 'character',
        characters: [{
            name: 'Survivor',
            race: 'human',
            description: 'A scared crew member hiding in the maintenance shaft',
            faction: 'neutral',
            speed: 'fast',
            orientation: 'top',
            location: 'Engineering',
            palette: {
                skin: '#fdbcb4',
                helmet: 'gray',
                suit: 'orange'
            }
        }]
    }
];

// ==========================================
// MAP COMMAND EXAMPLES
// ==========================================

/**
 * Map commands generate new game maps
 * Used ONLY for: new game, transition doors, major story changes
 * NEVER use for normal gameplay on existing map
 */
export const mapExamples: MapCommand[] = [
    {
        type: 'map',
        palette: {
            terrain: '#1a1a2e'
        },
        buildings: [{
            name: 'Damaged Cruiser',
            rooms: [
                { name: 'Bridge', size: 'medium' },
                { name: 'Cargo Bay', size: 'big' },
                { name: 'Engineering', size: 'medium' },
                { name: 'Med Bay', size: 'small' }
            ],
            position: { x: 20, y: 20 },
            palette: {
                floor: '#2d2d2d',
                innerWalls: '#4a4a4a',
                outerWalls: '#6b6b6b'
            }
        }],
        characters: [
            {
                name: MAIN_CHARACTER_NAME,
                race: 'human',
                description: 'The main protagonist',
                faction: 'player',
                speed: 'medium',
                orientation: 'bottom',
                location: 'Bridge',
                palette: {
                    skin: '#d7a55f',
                    helmet: 'white',
                    suit: 'white'
                }
            },
            {
                name: COMPANION_DROID_NAME,
                race: 'robot',
                description: 'Your loyal companion',
                faction: 'player',
                speed: 'medium',
                orientation: 'bottom',
                location: MAIN_CHARACTER_NAME,
                palette: {
                    skin: 'yellow',
                    helmet: 'gold',
                    suit: 'gold'
                }
            }
        ]
    }
];

// ==========================================
// MOVEMENT COMMAND EXAMPLES
// ==========================================

/**
 * Movement commands reposition characters on current map
 * Location can be: room name, character name, or "center"
 * NEVER use coordinates like "10,15" or directions like "north"
 */
export const movementExamples: MovementCommand[] = [
    // Move to a room
    {
        type: 'movement',
        characters: [
            { name: 'Guard', location: 'Cargo Bay' }
        ]
    },
    // Move multiple characters
    {
        type: 'movement',
        characters: [
            { name: 'Enemy Captain', location: 'Bridge' },
            { name: 'Enemy Guard', location: 'Enemy Captain' } // Move to captain's location
        ]
    },
    // Companion follows player
    {
        type: 'movement',
        characters: [
            { name: COMPANION_DROID_NAME, location: MAIN_CHARACTER_NAME }
        ]
    }
];

// ==========================================
// ATTACK COMMAND EXAMPLES
// ==========================================

/**
 * Attack commands initiate combat
 * Simple structure: attacker name and target name
 */
export const attackExamples: AttackCommand[] = [
    {
        type: 'attack',
        characters: [
            { name: 'Raider', target: MAIN_CHARACTER_NAME }
        ]
    },
    {
        type: 'attack',
        characters: [
            { name: 'Guard 1', target: 'Intruder' },
            { name: 'Guard 2', target: 'Intruder' }
        ]
    }
];

// ==========================================
// EXPORT FUNCTIONS FOR PROMPT INJECTION
// ==========================================

/**
 * Get formatted speech command examples for prompts
 */
export function getSpeechExamples(): string {
    return JSON.stringify(speechExamples, null, 2);
}

/**
 * Get formatted character command examples for prompts
 * This ensures all required fields are always included
 */
export function getCharacterExamples(): string {
    return JSON.stringify(characterExamples, null, 2);
}

/**
 * Get formatted map command examples for prompts
 */
export function getMapExamples(): string {
    return JSON.stringify(mapExamples, null, 2);
}

/**
 * Get a complete example set for initialization
 */
export function getInitializationExample(
    mainCharName: string = MAIN_CHARACTER_NAME,
    companionName?: string
): string {
    const commands = [];

    // Map generation
    commands.push({
        type: 'map',
        palette: { terrain: '#1a1a2e' },
        buildings: [{
            name: 'Starting Location',
            rooms: [
                { name: 'Bridge', size: 'medium' },
                { name: 'Cargo Bay', size: 'big' }
            ],
            position: { x: 25, y: 25 },
            palette: {
                floor: '#2d2d2d',
                innerWalls: '#4a4a4a',
                outerWalls: '#6b6b6b'
            }
        }],
        characters: [
            {
                name: mainCharName,
                race: 'human',
                description: 'The main protagonist',
                faction: 'player',
                speed: 'medium',
                orientation: 'bottom',
                location: 'Bridge'
            }
        ]
    });

    // Character spawning (if companion exists)
    if (companionName) {
        commands.push({
            type: 'character',
            characters: [{
                name: companionName,
                race: 'robot',
                description: 'Companion',
                faction: 'player',
                speed: 'medium',
                orientation: 'bottom',
                location: mainCharName
            }]
        });
    }

    // Initial narrative
    commands.push({
        type: 'speech',
        source: 'Narrator',
        content: 'Your story begins...'
    });

    return JSON.stringify({ commands }, null, 2);
}

/**
 * Validate that a command has all required fields
 * Returns true if valid, or an error message if not
 */
export function validateCharacterCommand(char: any): true | string {
    const required = ['name', 'race', 'description', 'faction', 'speed', 'orientation', 'location'];
    const missing = required.filter(field => !(field in char));

    if (missing.length > 0) {
        return `Character missing required fields: ${missing.join(', ')}`;
    }

    // Validate enum values
    if (!['human', 'alien', 'robot'].includes(char.race)) {
        return `Invalid race: ${char.race}. Must be: human, alien, or robot`;
    }

    if (!['player', 'enemy', 'neutral'].includes(char.faction)) {
        return `Invalid faction: ${char.faction}. Must be: player, enemy, or neutral`;
    }

    if (!['slow', 'medium', 'fast'].includes(char.speed)) {
        return `Invalid speed: ${char.speed}. Must be: slow, medium, or fast`;
    }

    if (!['top', 'right', 'bottom', 'left'].includes(char.orientation)) {
        return `Invalid orientation: ${char.orientation}. Must be: top, right, bottom, or left`;
    }

    return true;
}