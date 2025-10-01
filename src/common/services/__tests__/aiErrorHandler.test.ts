import { AIErrorHandler, ErrorFeedback, RetryResult } from '../AIErrorHandler';
import { AICommandValidator } from '../AICommandValidator';
import { AIContextBuilder } from '../AIContextBuilder';
import { AIGameEngineService } from '../AIGameEngineService';
import { State } from '../../State';
import { IState, ICharacter, ICell, Direction } from '../../interfaces';

// Mock the dependencies
jest.mock('../AIGameEngineService');

// Helper function to create mock state
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
        map: Array(10).fill(null).map((_, y) =>
            Array(10).fill(null).map((_, x) => {
                const cell: ICell = {
                    position: { x, y },
                    locations: x < 5 ? ['Bridge'] : ['Cargo Bay'],
                    elements: [],
                    content: null
                };
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
                position: { x: 2, y: 2 },
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
                name: 'Enemy Guard',
                race: 'human',
                description: 'Hostile soldier',
                controller: 'ai',
                faction: 'enemy',
                position: { x: 7, y: 7 },
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
            visualStates: { characters: {}, cells: {}, board: { mapWidth: 10, mapHeight: 10, hasPopupActive: false } },
            transientUI: { popups: {}, projectiles: [], highlights: { reachableCells: [], pathCells: [], targetableCells: [] } },
            interactionMode: { type: 'normal' }
        }
    } as IState;

    return new State(testState);
}

describe('AIErrorHandler', () => {
    let errorHandler: AIErrorHandler;
    let mockValidator: AICommandValidator;
    let mockContextBuilder: AIContextBuilder;
    let mockGameEngineService: any;
    let mockState: State;

    beforeEach(() => {
        jest.clearAllMocks();

        mockState = createMockState();
        mockContextBuilder = new AIContextBuilder(mockState);
        mockValidator = new AICommandValidator(mockState);

        // Create mock game engine service
        mockGameEngineService = {
            sendMessage: jest.fn(),
            requestAIAction: jest.fn(),
            requestDialogueResponse: jest.fn()
        };

        errorHandler = new AIErrorHandler(
            mockValidator,
            mockGameEngineService
        );
    });

    describe('executeWithRetry', () => {
        it('should succeed immediately with a valid command', async () => {
            const validCommand = {
                type: 'movement',
                characters: [
                    { name: 'Jim', location: 'Cargo Bay' }
                ]
            };

            const result = await errorHandler.executeWithRetry(
                validCommand,
                {},
                mockState,
                'en'
            );

            expect(result.success).toBe(true);
            expect(result.command).toBeDefined();
            expect(result.attempts).toBe(1);
            expect(mockGameEngineService.requestAIAction).not.toHaveBeenCalled();
        });

        it('should retry with invalid command and succeed after correction', async () => {
            const invalidCommand = {
                type: 'movement',
                characters: [
                    { name: 'NonExistent', location: 'InvalidRoom' }
                ]
            };

            const correctedCommand = {
                type: 'movement',
                characters: [
                    { name: 'Jim', location: 'Cargo Bay' }
                ]
            };

            // Mock AI correction response
            mockGameEngineService.requestAIAction.mockResolvedValueOnce({
                command: correctedCommand
            });

            const result = await errorHandler.executeWithRetry(
                invalidCommand,
                {
                    existingCharacters: ['Jim', 'Enemy Guard'],
                    availableLocations: ['Bridge', 'Cargo Bay']
                },
                mockState,
                'en'
            );

            expect(result.success).toBe(true);
            expect(result.attempts).toBe(2);
            expect(mockGameEngineService.requestAIAction).toHaveBeenCalledTimes(1);
        });

        it('should fail after max retries', async () => {
            const invalidCommand = {
                type: 'movement',
                characters: [
                    { name: 'NonExistent', location: 'InvalidRoom' }
                ]
            };

            // Mock AI always returning invalid commands
            mockGameEngineService.requestAIAction.mockResolvedValue({
                command: invalidCommand
            });

            const result = await errorHandler.executeWithRetry(
                invalidCommand,
                {},
                mockState,
                'en'
            );

            expect(result.success).toBe(false);
            expect(result.finalErrors).toBeDefined();
            expect(result.attempts).toBe(3);
            expect(mockGameEngineService.requestAIAction).toHaveBeenCalledTimes(2); // MAX_RETRIES - 1
        });

        it('should handle AI response with markdown code blocks', async () => {
            const invalidCommand = {
                type: 'movement',
                characters: [{ name: 'InvalidName' }]
            };

            const correctedCommand = {
                type: 'movement',
                characters: [{ name: 'Jim', location: 'Bridge' }]
            };

            // Mock AI response with markdown
            mockGameEngineService.requestAIAction.mockResolvedValueOnce({
                command: correctedCommand
            });

            const result = await errorHandler.executeWithRetry(
                invalidCommand,
                { existingCharacters: ['Jim'], availableLocations: ['Bridge'] },
                mockState,
                'en'
            );

            expect(result.success).toBe(true);
            expect(result.command).toEqual(correctedCommand);
        });

        it('should handle multiple validation errors', async () => {
            const invalidCommand = {
                type: 'character',
                characters: [{
                    name: 'New Guy',
                    // Missing required fields: race, description, faction, speed, orientation, location
                }]
            };

            const correctedCommand = {
                type: 'character',
                characters: [{
                    name: 'New Guy',
                    race: 'human',
                    description: 'A new character',
                    faction: 'neutral',
                    speed: 'medium',
                    orientation: 'bottom',
                    location: 'Bridge'
                }]
            };

            mockGameEngineService.requestAIAction.mockResolvedValueOnce({
                command: correctedCommand
            });

            const result = await errorHandler.executeWithRetry(
                invalidCommand,
                {
                    existingCharacters: ['Jim', 'Enemy Guard'],
                    availableLocations: ['Bridge', 'Cargo Bay']
                },
                mockState,
                'en'
            );

            expect(result.success).toBe(true);
            expect(result.attempts).toBe(2);

            // Verify error feedback was sent to AI
            const callArgs = mockGameEngineService.requestAIAction.mock.calls[0];
            expect(callArgs[0]).toHaveProperty('validationErrors');
            expect(callArgs[1]).toContain('COMMAND VALIDATION ERRORS');
            expect(callArgs[1]).toContain('Required field missing');
        });
    });

    describe('formatErrorFeedback', () => {
        it('should format error feedback for display', () => {
            const errorFeedback: ErrorFeedback = {
                originalCommand: { type: 'test' },
                errors: [
                    {
                        field: 'characters[0].name',
                        value: 'InvalidName',
                        error: 'Character does not exist',
                        suggestions: ['Jim', 'Enemy Guard']
                    },
                    {
                        field: 'characters[0].location',
                        value: undefined,
                        error: 'Required field missing',
                        suggestions: ['Bridge', 'Cargo Bay']
                    }
                ],
                retryCount: 1,
                maxRetries: 3
            };

            const formatted = errorHandler.formatErrorFeedback(errorFeedback);

            expect(formatted).toContain('Command Validation Failed (Attempt 1/3)');
            expect(formatted).toContain('Error 1: characters[0].name');
            expect(formatted).toContain('Character does not exist');
            expect(formatted).toContain('Jim, Enemy Guard');
            expect(formatted).toContain('Error 2: characters[0].location');
            expect(formatted).toContain('Required field missing');
        });
    });

    describe('Error prompt building', () => {
        it('should build comprehensive error prompts', async () => {
            const invalidCommand = {
                type: 'attack',
                characters: [
                    { name: 'Jim', target: 'NonExistentEnemy' }
                ]
            };

            // We'll capture the arguments sent to the AI
            let capturedContext: any;
            let capturedPrompt: any;
            mockGameEngineService.requestAIAction.mockImplementation(async (context: any, prompt: any) => {
                capturedContext = context;
                capturedPrompt = prompt;
                return {
                    command: {
                        type: 'attack',
                        characters: [{ name: 'Jim', target: 'Enemy Guard' }]
                    }
                };
            });

            await errorHandler.executeWithRetry(
                invalidCommand,
                {
                    currentCharacter: { name: 'Jim', position: { x: 2, y: 2 }, faction: 'player' },
                    existingCharacters: ['Jim', 'Enemy Guard'],
                    availableLocations: ['Bridge', 'Cargo Bay']
                },
                mockState,
                'en'
            );

            expect(capturedContext).toBeDefined();
            expect(capturedPrompt).toBeDefined();

            // Check context has validation errors
            expect(capturedContext.validationErrors).toBeDefined();
            expect(capturedContext.validationErrors).toHaveLength(1);

            // Check error feedback in prompt
            expect(capturedPrompt).toContain('COMMAND VALIDATION ERRORS');
            expect(capturedPrompt).toContain('Target does not exist');
            expect(capturedPrompt).toContain('Valid options:');
        });
    });

    describe('AI response parsing', () => {
        it('should handle various AI response formats', async () => {
            const testCases = [
                {
                    name: 'plain JSON',
                    response: '{"type":"movement","characters":[{"name":"Jim","location":"Bridge"}]}',
                    expected: { type: 'movement', characters: [{ name: 'Jim', location: 'Bridge' }] }
                },
                {
                    name: 'JSON with explanation',
                    response: 'Here is the corrected command: {"type":"movement","characters":[{"name":"Jim","location":"Bridge"}]} This should work.',
                    expected: { type: 'movement', characters: [{ name: 'Jim', location: 'Bridge' }] }
                },
                {
                    name: 'JSON in markdown',
                    response: '```json\n{"type":"movement","characters":[{"name":"Jim","location":"Bridge"}]}\n```',
                    expected: { type: 'movement', characters: [{ name: 'Jim', location: 'Bridge' }] }
                },
                {
                    name: 'formatted JSON',
                    response: '{\n  "type": "movement",\n  "characters": [\n    {\n      "name": "Jim",\n      "location": "Bridge"\n    }\n  ]\n}',
                    expected: { type: 'movement', characters: [{ name: 'Jim', location: 'Bridge' }] }
                }
            ];

            for (const testCase of testCases) {
                mockGameEngineService.requestAIAction.mockResolvedValueOnce({
                    command: testCase.expected
                });

                const result = await errorHandler.executeWithRetry(
                    { type: 'invalid' },
                    { existingCharacters: ['Jim'], availableLocations: ['Bridge'] },
                    mockState,
                    'en'
                );

                expect(result.command).toEqual(testCase.expected);
            }
        });

        it('should handle parse errors gracefully', async () => {
            mockGameEngineService.requestAIAction.mockResolvedValueOnce({
                // No command field - will fail parsing
            });

            const result = await errorHandler.executeWithRetry(
                { type: 'invalid' },
                {},
                mockState,
                'en'
            );

            expect(result.success).toBe(false);
            expect(result.attempts).toBe(2); // First attempt + one retry that failed to parse
        });
    });
});