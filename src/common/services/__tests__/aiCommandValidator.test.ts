import { AICommandValidator, ValidationError, ValidationResult } from '../AICommandValidator';
import { State } from '../../State';
import { IState, ICharacter, ICell, Direction } from '../../interfaces';
import { AIContextBuilder } from '../AIContextBuilder';

// Helper function to create a mock state with test data
function createMockState(): State {
    const testState = {
        game: {
            turn: 'human',
            players: ['human', 'ai'],
            playerInfo: {
                human: { name: 'Player', isAI: false },
                ai: { name: 'AI', isAI: true }
            }
        },
        map: Array(30).fill(null).map((_, y) =>
            Array(30).fill(null).map((_, x) => {
                const cell: ICell = {
                    position: { x, y },
                    locations: [],
                    elements: [],
                    content: null
                };

                // Create specific rooms
                if (x >= 5 && x <= 10 && y >= 5 && y <= 10) {
                    cell.locations = ['Bridge'];
                } else if (x >= 15 && x <= 20 && y >= 5 && y <= 10) {
                    cell.locations = ['Cargo Bay'];
                } else if (x >= 5 && x <= 10 && y >= 15 && y <= 20) {
                    cell.locations = ['Engineering'];
                } else if (x >= 15 && x <= 20 && y >= 15 && y <= 20) {
                    cell.locations = ['Medical Bay'];
                } else {
                    cell.locations = ['floor'];
                }

                return cell;
            })
        ),
        characters: [
            {
                name: 'Jim',
                race: 'human',
                description: 'The main character',
                controller: 'human',
                faction: 'player',
                position: { x: 7, y: 7 },
                location: 'Bridge',
                blocker: true,
                direction: 'bottom' as Direction,
                action: 'idle',
                path: [],
                health: 100,
                maxHealth: 100,
                palette: { skin: '#d7a55f', helmet: 'white', suit: 'white' },
                actions: {
                    pointsLeft: 100,
                    general: { move: 20, talk: 10, use: 10, inventory: 5 },
                    rangedCombat: { shoot: 25, aim: 10, overwatch: 30, cover: 10, throw: 15 },
                    closeCombat: { powerStrike: 25, slash: 20, fastAttack: 15, feint: 10, breakGuard: 20 }
                },
                inventory: {
                    maxWeight: 20,
                    items: [],
                    equippedWeapons: { primary: null, secondary: null }
                }
            } as ICharacter,
            {
                name: 'Data',
                race: 'robot',
                description: 'Companion droid',
                controller: 'human',
                faction: 'player',
                position: { x: 8, y: 8 },
                location: 'Bridge',
                blocker: true,
                direction: 'bottom' as Direction,
                action: 'idle',
                path: [],
                health: 100,
                maxHealth: 100,
                palette: { skin: 'yellow', helmet: 'gold', suit: 'gold' },
                actions: {
                    pointsLeft: 100,
                    general: { move: 20, talk: 10, use: 10, inventory: 5 },
                    rangedCombat: { shoot: 25, aim: 10, overwatch: 30, cover: 10, throw: 15 },
                    closeCombat: { powerStrike: 25, slash: 20, fastAttack: 15, feint: 10, breakGuard: 20 }
                },
                inventory: {
                    maxWeight: 20,
                    items: [],
                    equippedWeapons: { primary: null, secondary: null }
                }
            } as ICharacter,
            {
                name: 'Enemy Guard',
                race: 'human',
                description: 'Hostile soldier',
                controller: 'ai',
                faction: 'enemy',
                position: { x: 17, y: 7 },
                location: 'Cargo Bay',
                blocker: true,
                direction: 'left' as Direction,
                action: 'idle',
                path: [],
                health: 80,
                maxHealth: 80,
                palette: { skin: '#8b4513', helmet: 'darkred', suit: 'black' },
                actions: {
                    pointsLeft: 100,
                    general: { move: 20, talk: 10, use: 10, inventory: 5 },
                    rangedCombat: { shoot: 25, aim: 10, overwatch: 30, cover: 10, throw: 15 },
                    closeCombat: { powerStrike: 25, slash: 20, fastAttack: 15, feint: 10, breakGuard: 20 }
                },
                inventory: {
                    maxWeight: 20,
                    items: [],
                    equippedWeapons: { primary: null, secondary: null }
                }
            } as ICharacter
        ],
        messages: [],
        overwatchData: {},
        doors: {},
        ui: {
            animations: { characters: {} },
            visualStates: { characters: {}, cells: {}, board: { mapWidth: 30, mapHeight: 30, hasPopupActive: false } },
            transientUI: { popups: {}, projectiles: [], highlights: { reachableCells: [], pathCells: [], targetableCells: [] } },
            interactionMode: { type: 'normal' }
        }
    } as IState;

    return new State(testState);
}

describe('AICommandValidator', () => {
    let validator: AICommandValidator;
    let mockState: State;
    let mockContextBuilder: AIContextBuilder;

    beforeEach(() => {
        mockState = createMockState();
        mockContextBuilder = new AIContextBuilder(mockState);
        validator = new AICommandValidator(mockState);
    });

    describe('Movement Command Validation', () => {
        it('should validate a correct movement command', () => {
            const command = {
                type: 'movement',
                characters: [
                    { name: 'Jim', location: 'Cargo Bay' }
                ]
            };

            const result = validator.validateCommand(command);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.command).toBeDefined();
        });

        it('should collect multiple errors in movement command', () => {
            const command = {
                type: 'movement',
                characters: [
                    { name: 'NonExistent', location: 'InvalidRoom' }
                ]
            };

            const result = validator.validateCommand(command);

            expect(result.isValid).toBe(false);
            expect(result.errors).toHaveLength(2);

            expect(result.errors).toContainEqual({
                field: 'characters[0].name',
                value: 'NonExistent',
                error: 'Character does not exist',
                suggestions: ['Jim', 'Data', 'Enemy Guard']
            });

            expect(result.errors).toContainEqual({
                field: 'characters[0].location',
                value: 'InvalidRoom',
                error: 'Location does not exist',
                suggestions: expect.arrayContaining(['Bridge', 'Cargo Bay', 'Engineering', 'Medical Bay'])
            });
        });

        it('should reject coordinates as locations', () => {
            const command = {
                type: 'movement',
                characters: [
                    { name: 'Jim', location: '10,15' }
                ]
            };

            const result = validator.validateCommand(command);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContainEqual({
                field: 'characters[0].location',
                value: '10,15',
                error: 'Coordinates are not allowed. Use room names or character names',
                suggestions: expect.arrayContaining(['Bridge', 'Cargo Bay'])
            });
        });

        it('should reject directions as locations', () => {
            const command = {
                type: 'movement',
                characters: [
                    { name: 'Jim', location: 'north' }
                ]
            };

            const result = validator.validateCommand(command);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContainEqual({
                field: 'characters[0].location',
                value: 'north',
                error: 'Directions are not allowed. Use room names or character names',
                suggestions: expect.arrayContaining(['Bridge', 'Cargo Bay'])
            });
        });

        it('should allow character names as locations', () => {
            const command = {
                type: 'movement',
                characters: [
                    { name: 'Data', location: 'Jim' }
                ]
            };

            const result = validator.validateCommand(command);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
    });

    describe('Character Creation Command Validation', () => {
        it('should validate a correct character command', () => {
            const command = {
                type: 'character',
                characters: [{
                    name: 'New Guard',
                    race: 'human',
                    description: 'A new guard',
                    faction: 'enemy',
                    speed: 'medium',
                    orientation: 'left',
                    location: 'Bridge',
                    palette: {
                        skin: '#d7a55f',
                        helmet: 'red',
                        suit: '#404040'
                    }
                }]
            };

            const result = validator.validateCommand(command);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should validate all required fields and enums', () => {
            const command = {
                type: 'character',
                characters: [{
                    name: 'New Guy',
                    race: 'invalid_race',
                    // missing: description, faction, speed, orientation, location
                    palette: {
                        skin: 'not_a_color',
                        helmet: '#gg0000',  // invalid hex
                        suit: 'blue'
                    }
                }]
            };

            const result = validator.validateCommand(command);

            expect(result.isValid).toBe(false);

            // Check for missing required fields
            expect(result.errors).toContainEqual({
                field: 'characters[0].description',
                value: undefined,
                error: 'Required field missing',
                suggestions: undefined
            });

            expect(result.errors).toContainEqual({
                field: 'characters[0].faction',
                value: undefined,
                error: 'Required field missing',
                suggestions: ['player', 'enemy', 'neutral']
            });

            expect(result.errors).toContainEqual({
                field: 'characters[0].speed',
                value: undefined,
                error: 'Required field missing',
                suggestions: ['slow', 'medium', 'fast']
            });

            expect(result.errors).toContainEqual({
                field: 'characters[0].orientation',
                value: undefined,
                error: 'Required field missing',
                suggestions: ['top', 'right', 'bottom', 'left']
            });

            expect(result.errors).toContainEqual({
                field: 'characters[0].location',
                value: undefined,
                error: 'Required field missing',
                suggestions: expect.arrayContaining(['Bridge', 'Cargo Bay'])
            });

            // Check for invalid enum values
            expect(result.errors).toContainEqual({
                field: 'characters[0].race',
                value: 'invalid_race',
                error: 'Invalid race value',
                suggestions: ['human', 'alien', 'robot']
            });

            // Check for invalid palette colors
            expect(result.errors).toContainEqual({
                field: 'characters[0].palette.skin',
                value: 'not_a_color',
                error: 'Invalid color format. Use hex code (#rrggbb) or color name',
                suggestions: expect.arrayContaining(['#d7a55f', 'white', 'black', 'red', 'blue', 'green', 'yellow', 'gold'])
            });

            expect(result.errors).toContainEqual({
                field: 'characters[0].palette.helmet',
                value: '#gg0000',
                error: 'Invalid hex color format',
                suggestions: ['#rrggbb format or color names']
            });
        });

        it('should reject duplicate character names', () => {
            const command = {
                type: 'character',
                characters: [{
                    name: 'Jim',  // Already exists
                    race: 'human',
                    description: 'Another Jim',
                    faction: 'enemy',
                    speed: 'medium',
                    orientation: 'left',
                    location: 'Bridge'
                }]
            };

            const result = validator.validateCommand(command);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContainEqual({
                field: 'characters[0].name',
                value: 'Jim',
                error: 'Character with this name already exists',
                suggestions: undefined
            });
        });
    });

    describe('Speech Command Validation', () => {
        it('should validate a correct speech command', () => {
            const command = {
                type: 'speech',
                source: 'Jim',
                content: 'Hello, how are you?',
                answers: ['Good', 'Bad', 'Leave me alone']
            };

            const result = validator.validateCommand(command);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should detect missing required fields', () => {
            const command = {
                type: 'speech',
                source: 'Jim'
                // missing content
            };

            const result = validator.validateCommand(command);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContainEqual({
                field: 'content',
                value: undefined,
                error: 'Required field missing',
                suggestions: undefined
            });
        });

        it('should validate answers is an array', () => {
            const command = {
                type: 'speech',
                source: 'Jim',
                content: 'Hello',
                answers: 'Not an array'
            };

            const result = validator.validateCommand(command);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContainEqual({
                field: 'answers',
                value: 'Not an array',
                error: 'Answers must be an array of strings',
                suggestions: undefined
            });
        });
    });

    describe('Attack Command Validation', () => {
        it('should validate a correct attack command', () => {
            const command = {
                type: 'attack',
                characters: [
                    { name: 'Jim', target: 'Enemy Guard' }
                ]
            };

            const result = validator.validateCommand(command);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should detect non-existent attacker and target', () => {
            const command = {
                type: 'attack',
                characters: [
                    { name: 'NonExistent', target: 'AlsoNonExistent' }
                ]
            };

            const result = validator.validateCommand(command);

            expect(result.isValid).toBe(false);
            expect(result.errors).toHaveLength(2);

            expect(result.errors).toContainEqual({
                field: 'characters[0].name',
                value: 'NonExistent',
                error: 'Attacker does not exist',
                suggestions: ['Jim', 'Data', 'Enemy Guard']
            });

            expect(result.errors).toContainEqual({
                field: 'characters[0].target',
                value: 'AlsoNonExistent',
                error: 'Target does not exist',
                suggestions: ['Jim', 'Data', 'Enemy Guard']
            });
        });
    });

    describe('General Command Validation', () => {
        it('should reject invalid command type', () => {
            const command = {
                type: 'invalid_type'
            };

            const result = validator.validateCommand(command);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContainEqual({
                field: 'type',
                value: 'invalid_type',
                error: 'Invalid command type',
                suggestions: ['movement', 'attack', 'speech', 'character', 'map']
            });
        });

        it('should reject non-object commands', () => {
            const result = validator.validateCommand('not an object');

            expect(result.isValid).toBe(false);
            expect(result.errors).toContainEqual({
                field: 'command',
                value: 'not an object',
                error: 'Command must be a JSON object',
                suggestions: undefined
            });
        });

        it('should reject commands without type', () => {
            const command = {
                characters: []
            };

            const result = validator.validateCommand(command);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContainEqual({
                field: 'type',
                value: undefined,
                error: 'Command type is required',
                suggestions: ['movement', 'attack', 'speech', 'character', 'map']
            });
        });
    });
});