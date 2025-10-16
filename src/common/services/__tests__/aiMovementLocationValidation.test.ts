import { AIController } from '../AIController';
import { AILocationResolver } from '../AILocationResolver';
import { EventBus } from '../../events';
import { ICharacter, ICell, Direction } from '../../interfaces';
import { State } from '../../State';

// Mock the AIGameEngineService
jest.mock('../AIGameEngineService', () => ({
    AIGameEngineService: {
        getInstance: jest.fn(() => ({
            requestAIAction: jest.fn().mockResolvedValue({
                command: {
                    type: 'movement',
                    characters: [{ name: 'Enemy Guard', location: '10,10' }]
                },
                messages: []
            })
        }))
    }
}));

// Mock localStorage for tests
const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    clear: jest.fn(),
    removeItem: jest.fn(),
    length: 0,
    key: jest.fn()
};
(global as any).localStorage = localStorageMock;

describe('AI Movement Location Validation', () => {
    let aiController: any;
    let eventBus: EventBus<any, any>;
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        // Create a test map with rooms
        const testMap: ICell[][] = Array(30).fill(null).map((_, y) =>
            Array(30).fill(null).map((_, x) => {
                // Create different room areas
                const cell: ICell = {
                    position: { x, y },
                    locations: [],
                    elements: [],
                    content: null
                };

                // Define room areas
                if (x >= 5 && x <= 10 && y >= 5 && y <= 10) {
                    cell.locations = ['Ship - Cargo Bay'];
                } else if (x >= 15 && x <= 20 && y >= 5 && y <= 10) {
                    cell.locations = ['Ship - Bridge'];
                } else if (x >= 5 && x <= 10 && y >= 15 && y <= 20) {
                    cell.locations = ['Ship - Engineering'];
                } else {
                    cell.locations = ['floor'];
                }

                return cell;
            })
        );

        // Create test state
        const testState = {
            game: {
                turn: 'ai',
                players: ['human', 'ai'],
                playerInfo: {
                    'human': { name: 'Player', isAI: false },
                    'ai': { name: 'AI', isAI: true }
                }
            },
            map: testMap,
            characters: [
                {
                    name: 'Jim',
                    race: 'human',
                    description: 'The player character',
                    controller: 'human',
                    faction: 'player',
                    position: { x: 7, y: 7 }, // In Cargo Bay
                    location: '',
                    blocker: true,
                    direction: 'bottom' as Direction,
                    action: 'idle',
                    path: [],
                    health: 100,
                    maxHealth: 100,
                    palette: {
                        skin: '#d7a55f',
                        helmet: '#808080',
                        suit: '#404040'
                    },
                    actions: {
                        pointsLeft: 100,
                        pendingCost: 0,
                        general: { move: 20, talk: 10, use: 10, inventory: 5 },
                        rangedCombat: { shoot: 20, aim: 10, overwatch: 30, cover: 10, throw: 15 },
                        closeCombat: { powerStrike: 25, slash: 20, fastAttack: 15, feint: 10, breakGuard: 20 }
                    },
                    inventory: {
                        maxWeight: 20,
                        items: [],
                        equippedWeapons: { primary: null, secondary: null }
                    }
                } as unknown as ICharacter,
                {
                    name: 'Enemy Guard',
                    race: 'human',
                    description: 'An enemy guard',
                    controller: 'ai',
                    faction: 'enemy',
                    position: { x: 17, y: 7 }, // In Bridge
                    location: '',
                    blocker: true,
                    direction: 'bottom' as Direction,
                    action: 'idle',
                    path: [],
                    health: 100,
                    maxHealth: 100,
                    palette: {
                        skin: '#d7a55f',
                        helmet: 'red',
                        suit: 'red'
                    },
                    actions: {
                        pointsLeft: 100,
                        pendingCost: 0,
                        general: { move: 20, talk: 10, use: 10, inventory: 5 },
                        rangedCombat: { shoot: 20, aim: 10, overwatch: 30, cover: 10, throw: 15 },
                        closeCombat: { powerStrike: 25, slash: 20, fastAttack: 15, feint: 10, breakGuard: 20 }
                    },
                    inventory: {
                        maxWeight: 20,
                        items: [],
                        equippedWeapons: { primary: null, secondary: null }
                    }
                } as unknown as ICharacter,
                {
                    name: 'Rusty',
                    race: 'robot',
                    description: 'AI companion',
                    controller: 'human',
                    faction: 'player',
                    position: { x: 8, y: 8 }, // In Cargo Bay
                    location: '',
                    blocker: true,
                    direction: 'bottom' as Direction,
                    action: 'idle',
                    path: [],
                    health: 100,
                    maxHealth: 100,
                    palette: {
                        skin: 'yellow',
                        helmet: 'gold',
                        suit: 'gold'
                    },
                    actions: {
                        pointsLeft: 100,
                        pendingCost: 0,
                        general: { move: 20, talk: 10, use: 10, inventory: 5 },
                        rangedCombat: { shoot: 20, aim: 10, overwatch: 30, cover: 10, throw: 15 },
                        closeCombat: { powerStrike: 25, slash: 20, fastAttack: 15, feint: 10, breakGuard: 20 }
                    },
                    inventory: {
                        maxWeight: 20,
                        items: [],
                        equippedWeapons: { primary: null, secondary: null }
                    }
                } as unknown as ICharacter
            ],
            visuals: {
                board: {
                    mapWidth: 30,
                    mapHeight: 30,
                    centerPosition: { x: 15, y: 15 },
                    hasPopupActive: false
                },
                cells: {},
                characters: {}
            },
            doors: {},
            inventory: {},
            ui: {
                cursor: { x: 0, y: 0 },
                popupState: {},
                transient: {},
                interactionMode: 'default'
            },
            conversation: { messages: [], pendingConversation: null },
            storyState: {
                selectedOrigin: null,
                factionRelations: {},
                events: []
            },
            combat: {
                activeCombats: {},
                projectiles: []
            },
            multiplayer: {
                isMultiplayer: false,
                roomName: null,
                isHost: true,
                hostPlayerId: 'human',
                connectedPlayers: new Set<string>()
            },
            animations: []
        } as any;

        eventBus = new EventBus();
        jest.spyOn(eventBus, 'dispatch');
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        // Create AI controller
        const state = new State(testState);
        aiController = AIController.getInstance();
        aiController.setGameState(state);
        (aiController as any).eventBus = eventBus;
        (aiController as any).dispatch = eventBus.dispatch.bind(eventBus);
    });

    afterEach(() => {
        jest.clearAllMocks();
        consoleErrorSpy.mockRestore();
    });

    describe('Valid Location Formats', () => {
        test('should accept valid room names', () => {
            const character = (aiController as any).state.characters[1]; // Enemy Guard
            const location = AILocationResolver.resolveLocation('Ship - Cargo Bay', (aiController as any).state, character);

            expect(location).toBeTruthy();
            if (location) {
                expect(location.x).toBeGreaterThanOrEqual(5);
                expect(location.x).toBeLessThanOrEqual(10);
                expect(location.y).toBeGreaterThanOrEqual(5);
                expect(location.y).toBeLessThanOrEqual(10);
            }
        });

        test('should accept valid character names', () => {
            const character = (aiController as any).state.characters[1]; // Enemy Guard
            const location = AILocationResolver.resolveLocation('Jim', (aiController as any).state, character);

            expect(location).toEqual({ x: 7, y: 7 });
        });

        test('should accept room names without building prefix', () => {
            const character = (aiController as any).state.characters[1];
            const location = AILocationResolver.resolveLocation('cargo bay', (aiController as any).state, character);

            expect(location).toBeTruthy();
            // Should find the cargo bay
            if (location) {
                expect(location.x).toBeGreaterThanOrEqual(5);
                expect(location.x).toBeLessThanOrEqual(10);
            }
        });
    });

    describe('Invalid Location Formats', () => {
        test('should throw error for relative directions', () => {
            const character = (aiController as any).state.characters[1];

            // Test cardinal directions
            expect(() => {
                AILocationResolver.resolveLocation('north', (aiController as any).state, character);
            }).toThrow(/Invalid location format.*not directions/);

            expect(() => {
                AILocationResolver.resolveLocation('south', (aiController as any).state, character);
            }).toThrow(/Invalid location format.*not directions/);

            expect(() => {
                AILocationResolver.resolveLocation('east', (aiController as any).state, character);
            }).toThrow(/Invalid location format.*not directions/);

            expect(() => {
                AILocationResolver.resolveLocation('west', (aiController as any).state, character);
            }).toThrow(/Invalid location format.*not directions/);
        });

        test('should throw error for diagonal directions', () => {
            const character = (aiController as any).state.characters[1];

            expect(() => {
                AILocationResolver.resolveLocation('northeast', (aiController as any).state, character);
            }).toThrow(/Invalid location format.*not directions/);

            expect(() => {
                AILocationResolver.resolveLocation('south-west', (aiController as any).state, character);
            }).toThrow(/Invalid location format.*not directions/);
        });

        test('should throw error for alternative direction names', () => {
            const character = (aiController as any).state.characters[1];

            expect(() => {
                AILocationResolver.resolveLocation('up', (aiController as any).state, character);
            }).toThrow(/Invalid location format.*not directions/);

            expect(() => {
                AILocationResolver.resolveLocation('down', (aiController as any).state, character);
            }).toThrow(/Invalid location format.*not directions/);

            expect(() => {
                AILocationResolver.resolveLocation('left', (aiController as any).state, character);
            }).toThrow(/Invalid location format.*not directions/);

            expect(() => {
                AILocationResolver.resolveLocation('right', (aiController as any).state, character);
            }).toThrow(/Invalid location format.*not directions/);
        });

        test('should throw error for arbitrary coordinates', () => {
            const character = (aiController as any).state.characters[1];

            expect(() => {
                AILocationResolver.resolveLocation('15,15', (aiController as any).state, character);
            }).toThrow(/Invalid location format.*Movement locations must be room names or character names/);
        });

        test('should throw error for coordinates with spaces', () => {
            const character = (aiController as any).state.characters[1];

            expect(() => {
                AILocationResolver.resolveLocation('10, 10', (aiController as any).state, character);
            }).toThrow(/Invalid location format.*Movement locations must be room names or character names/);
        });

        test('should throw error for non-existent room names', () => {
            const character = (aiController as any).state.characters[1];

            expect(() => {
                AILocationResolver.resolveLocation('Nonexistent Room', (aiController as any).state, character);
            }).toThrow(/Could not resolve location.*Available rooms/);
        });

        test('should throw error for non-existent character names', () => {
            const character = (aiController as any).state.characters[1];

            expect(() => {
                AILocationResolver.resolveLocation('Unknown Character', (aiController as any).state, character);
            }).toThrow(/Could not resolve location.*Available characters/);
        });

        test('should throw error for empty location', () => {
            const character = (aiController as any).state.characters[1];

            expect(() => {
                AILocationResolver.resolveLocation('', (aiController as any).state, character);
            }).toThrow(/Invalid location: location is empty or null/);
        });

        test('should throw error when state is not initialized', () => {
            const character = (aiController as any).state.characters[1];
            (aiController as any).state = null;

            expect(() => {
                AILocationResolver.resolveLocation('Ship - Bridge', (aiController as any).state, character);
            }).toThrow(/Cannot resolve location: game state is not initialized/);
        });
    });

    describe('Movement Execution with Invalid Locations', () => {
        test('should handle errors gracefully in executeMovement', async () => {
            const character = (aiController as any).state.characters[1];
            const command = {
                type: 'movement',
                characters: [{
                    name: 'Enemy Guard',
                    location: '999,999' // Out of bounds coordinates
                }]
            };

            const endTurnSpy = jest.spyOn((aiController as any).turnManager, 'endTurn').mockImplementation();

            await (aiController as any).commandExecutor?.executeMovement(command, character);

            // Should log error
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('[AI] ExecuteMovement - Failed to resolve location'),
                expect.any(Error)
            );

            // Should end the turn
            expect(endTurnSpy).toHaveBeenCalled();
        });

        test('should not crash when movement location is invalid', async () => {
            const character = (aiController as any).state.characters[1];
            const command = {
                type: 'movement',
                characters: [{
                    name: 'Enemy Guard',
                    location: 'Invalid Location'
                }]
            };

            const endTurnSpy = jest.spyOn((aiController as any).turnManager, 'endTurn').mockImplementation();

            // Should not throw, but handle gracefully
            await expect((aiController as any).commandExecutor?.executeMovement(command, character))
                .resolves.toBeUndefined();

            expect(endTurnSpy).toHaveBeenCalled();
        });

        test('should continue processing other characters after error', async () => {
            (aiController as any).isProcessingMultipleCharacters = true;
            const character = (aiController as any).state.characters[1];
            const command = {
                type: 'movement',
                characters: [{
                    name: 'Enemy Guard',
                    location: '25,25' // Invalid
                }]
            };

            const endTurnSpy = jest.spyOn((aiController as any).turnManager, 'endTurn').mockImplementation();

            await (aiController as any).commandExecutor?.executeMovement(command, character);

            // Should NOT end turn when processing multiple characters
            expect(endTurnSpy).not.toHaveBeenCalled();
        });
    });

    describe('Error Messages', () => {
        test('should provide helpful error message with available rooms', () => {
            const character = (aiController as any).state.characters[1];

            try {
                AILocationResolver.resolveLocation('Unknown Place', (aiController as any).state, character);
                fail('Should have thrown error');
            } catch (error: any) {
                expect(error.message).toContain('Available rooms:');
                expect(error.message).toContain('Ship - Cargo Bay');
                expect(error.message).toContain('Ship - Bridge');
                expect(error.message).toContain('Ship - Engineering');
            }
        });

        test('should provide helpful error message with available characters', () => {
            const character = (aiController as any).state.characters[1];

            try {
                AILocationResolver.resolveLocation('Unknown Person', (aiController as any).state, character);
                fail('Should have thrown error');
            } catch (error: any) {
                expect(error.message).toContain('Available characters:');
                expect(error.message).toContain('Jim');
                expect(error.message).toContain('Enemy Guard');
                expect(error.message).toContain('Rusty');
            }
        });

        test('should provide specific error for coordinate format', () => {
            const character = (aiController as any).state.characters[1];

            try {
                AILocationResolver.resolveLocation('20,20', (aiController as any).state, character);
                fail('Should have thrown error');
            } catch (error: any) {
                expect(error.message).toContain('Invalid location format');
                expect(error.message).toContain('Movement locations must be room names or character names');
                expect(error.message).toContain('not coordinates');
            }
        });
    });
});