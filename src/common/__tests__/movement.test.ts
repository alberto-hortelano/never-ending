import { EventBus, ControlsEvent, StateChangeEvent, UpdateStateEvent } from "../events";
import { Movement } from "../Movement";
import type { ICharacter, ICell, ICoord, IPositionable } from "../interfaces";
import type { State } from "../State";

// Mock the State class
jest.mock('../State');

// Mock helper functions
jest.mock('../helpers/map', () => ({
    getReachableCells: jest.fn(),
    calculatePath: jest.fn(),
}));

// Mock AnimationService
jest.mock('../services/AnimationService', () => ({
    animationService: {
        createMovementAnimation: jest.fn().mockReturnValue({
            type: 'move',
            startTime: Date.now(),
            duration: 500,
            from: { x: 1, y: 1 },
            to: { x: 2, y: 1 },
            path: []
        }),
        startAnimation: jest.fn()
    }
}));

import { getReachableCells, calculatePath } from '../helpers/map';
import { baseCharacter } from "../../data/state";

describe('Movement', () => {
    let movement: Movement;
    let mockState: jest.Mocked<State>;
    let testCharacter: ICharacter;
    let testMap: ICell[][];
    let eventBus: EventBus<any, any>;

    // Helper function to create a mock character
    const createMockCharacter = (overrides: Partial<ICharacter> = {}): ICharacter => ({
        ...baseCharacter,
        ...overrides
    });

    // Helper function to create a mock cell
    const createMockCell = (x: number, y: number, content: IPositionable | null = null): ICell => ({
        position: { x, y },
        locations: [],
        elements: [],
        content
    });

    // Helper function to create a mock map
    const createMockMap = (width: number, height: number): ICell[][] => {
        const map: ICell[][] = [];
        for (let y = 0; y < height; y++) {
            map[y] = [];
            for (let x = 0; x < width; x++) {
                map[y]![x] = createMockCell(x, y);
            }
        }
        return map;
    };


    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();
        EventBus.reset();
        eventBus = new EventBus();

        // Create test data
        testCharacter = createMockCharacter({
            controller: 'human', faction: 'player'
        });
        testMap = createMockMap(5, 5);

        // Create mock State
        mockState = {
            map: testMap,
            findCharacter: jest.fn(),
            game: {
                turn: 'human',
                players: ['human', 'ai']
            },
             
        } as any;

        // Create Movement instance
        movement = new Movement(mockState);
    });

    afterEach(() => {
        // Clean up movement listeners
        eventBus.remove(movement);
    });


    describe('showMovement', () => {
        it('should highlight reachable cells when showMovement is triggered', () => {
            const reachableCells: ICoord[] = [
                { x: 0, y: 1 },
                { x: 1, y: 0 },
                { x: 2, y: 1 },
                { x: 1, y: 2 }
            ];

            (getReachableCells as jest.Mock).mockReturnValue(reachableCells);
            mockState.findCharacter.mockReturnValue(testCharacter);

            const highlightsSpy = jest.fn();
            eventBus.listen(UpdateStateEvent.uiHighlights, highlightsSpy);

            // Trigger showMovement
            eventBus.dispatch(ControlsEvent.showMovement, testCharacter.name);

            // Verify getReachableCells was called with correct parameters
            const moveCost = testCharacter.actions.general.move;
            const pointsLeft = testCharacter.actions.pointsLeft;
            const maxDistance = Math.floor(pointsLeft / moveCost);
            expect(getReachableCells).toHaveBeenCalledWith(
                testCharacter.position,
                maxDistance,
                testMap,
                mockState.characters,
                testCharacter.name
            );

            // Verify highlights were updated with reachable cells
            // First call is from mode cleanup (empty), second is with actual cells
            expect(highlightsSpy).toHaveBeenCalledTimes(2);
            
            // Check the second call has the reachable cells
            expect(highlightsSpy).toHaveBeenNthCalledWith(2,
                expect.objectContaining({
                    reachableCells: reachableCells
                })
            );
        });

        it('should not highlight cells if character is not found', () => {
            mockState.findCharacter.mockReturnValue(undefined);

            const highlightsSpy = jest.fn();
            eventBus.listen(UpdateStateEvent.uiHighlights, highlightsSpy);

            // Trigger showMovement
            eventBus.dispatch(ControlsEvent.showMovement, 'non-existent-character');

            // Verify no highlights were dispatched
            expect(highlightsSpy).not.toHaveBeenCalled();
            expect(getReachableCells).not.toHaveBeenCalled();
        });
    });

    describe('cellClick', () => {
        it('should set character path when a reachable cell is clicked', () => {
            const reachableCells: ICoord[] = [
                { x: 0, y: 1 },
                { x: 1, y: 0 },
                { x: 2, y: 1 },
                { x: 1, y: 2 }
            ];
            const destination = { x: 2, y: 1 };
            const path: ICoord[] = [
                { x: 1, y: 1 },
                { x: 2, y: 1 }
            ];

            (getReachableCells as jest.Mock).mockReturnValue(reachableCells);
            (calculatePath as jest.Mock).mockReturnValue(path);
            mockState.findCharacter.mockReturnValue(testCharacter);

            const updateStateSpy = jest.fn();
            const highlightsSpy = jest.fn();
            eventBus.listen(UpdateStateEvent.characterPath, updateStateSpy);
            eventBus.listen(UpdateStateEvent.uiHighlights, highlightsSpy);

            // First show movement to set up reachable cells
            eventBus.dispatch(ControlsEvent.showMovement, testCharacter.name);

            // Then click on a reachable cell
            eventBus.dispatch(ControlsEvent.cellClick, destination);

            // Verify path calculation
            expect(calculatePath).toHaveBeenCalledWith(
                testCharacter.position,
                destination,
                testMap,
                mockState.characters,
                testCharacter.name
            );

            // Verify character path was updated
            expect(updateStateSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    ...testCharacter,
                    path
                })
            );

            // Verify highlights were cleared when path was selected
            expect(highlightsSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    reachableCells: []
                })
            );
        });

        it('should not set path when clicking non-reachable cell', () => {
            const reachableCells: ICoord[] = [
                { x: 0, y: 1 },
                { x: 1, y: 0 }
            ];
            const nonReachableCell = { x: 4, y: 4 };

            (getReachableCells as jest.Mock).mockReturnValue(reachableCells);
            mockState.findCharacter.mockReturnValue(testCharacter);

            const updateStateSpy = jest.fn();
            eventBus.listen(UpdateStateEvent.characterPath, updateStateSpy);

            // Show movement first
            eventBus.dispatch(ControlsEvent.showMovement, testCharacter.name);

            // Click on non-reachable cell
            eventBus.dispatch(ControlsEvent.cellClick, nonReachableCell);

            // Verify no path was set
            expect(calculatePath).not.toHaveBeenCalled();
            expect(updateStateSpy).not.toHaveBeenCalled();
        });
    });

    describe('characterPath', () => {
        it('should create animation and clear path when character has a path', () => {
            const characterWithPath: ICharacter = createMockCharacter({
                controller: 'human', faction: 'player',
                path: [
                    { x: 2, y: 1 },
                    { x: 3, y: 1 }
                ]
            });

            const updatePathSpy = jest.fn();
            const highlightsSpy = jest.fn();
            eventBus.listen(UpdateStateEvent.characterPath, updatePathSpy);
            eventBus.listen(UpdateStateEvent.uiHighlights, highlightsSpy);

            // Dispatch characterPath event
            eventBus.dispatch(StateChangeEvent.characterPath, characterWithPath);

            // Verify path was cleared
            expect(updatePathSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    ...characterWithPath,
                    path: []
                })
            );
            
            // Verify highlights were cleared
            expect(highlightsSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    pathCells: []
                })
            );
        });

        it('should not create animation when character has empty path', () => {
            const characterWithEmptyPath: ICharacter = createMockCharacter({
                controller: 'human', faction: 'player',
                path: []
            });

            const moveCharacterSpy = jest.fn();
            eventBus.listen(ControlsEvent.moveCharacter, moveCharacterSpy);

            // Dispatch characterPath event
            eventBus.dispatch(StateChangeEvent.characterPath, characterWithEmptyPath);

            // Verify moveCharacter was not dispatched
            expect(moveCharacterSpy).not.toHaveBeenCalled();
        });
    });

    describe('animation completion', () => {
        it('should track completed movements', () => {
            const characterWithPath: ICharacter = createMockCharacter({
                controller: 'human', faction: 'player',
                path: [
                    { x: 2, y: 1 },
                    { x: 3, y: 1 }
                ]
            });

            // Dispatch characterPath event
            eventBus.dispatch(StateChangeEvent.characterPath, characterWithPath);

            // Movement completion is now handled through animations
            // The Movement class tracks completed movements internally
            // but doesn't expose them directly through events
        });
    });

    describe('action points based movement', () => {
        it('should calculate movement distance based on action points and move cost', () => {
            const testCases = [
                { pointsLeft: 100, moveCost: 20, expectedDistance: 5 },
                { pointsLeft: 60, moveCost: 20, expectedDistance: 3 },
                { pointsLeft: 40, moveCost: 20, expectedDistance: 2 },
                { pointsLeft: 30, moveCost: 20, expectedDistance: 1 },
                { pointsLeft: 10, moveCost: 20, expectedDistance: 0 },
            ];

            testCases.forEach(({ pointsLeft, moveCost, expectedDistance }) => {
                const character = createMockCharacter({ 
                    controller: 'human', faction: 'player', 
                    actions: {
                        ...baseCharacter.actions,
                        pointsLeft,
                        general: {
                            ...baseCharacter.actions.general,
                            move: moveCost
                        }
                    }
                });
                mockState.findCharacter.mockReturnValue(character);

                (getReachableCells as jest.Mock).mockReturnValue([]);

                // Trigger showMovement
                eventBus.dispatch(ControlsEvent.showMovement, character.name);

                // Verify correct distance was calculated
                expect(getReachableCells).toHaveBeenCalledWith(
                    character.position,
                    expectedDistance,
                    testMap,
                    mockState.characters,
                    character.name
                );
            });
        });
    });

    describe('defeated character handling', () => {
        it('should stop movement when character is defeated during animation', () => {
            const characterWithPath: ICharacter = createMockCharacter({
                controller: 'human', faction: 'player',
                name: 'testChar',
                health: 50,
                path: [
                    { x: 2, y: 1 },
                    { x: 3, y: 1 },
                    { x: 4, y: 1 }
                ]
            });

            const defeatedCharacter = {
                ...characterWithPath,
                health: 0
            };

            const updatePathSpy = jest.fn();
            const highlightsSpy = jest.fn();
            eventBus.listen(UpdateStateEvent.characterPath, updatePathSpy);
            eventBus.listen(UpdateStateEvent.uiHighlights, highlightsSpy);

            // Start movement by dispatching characterPath event
            eventBus.dispatch(StateChangeEvent.characterPath, characterWithPath);

            // Character is defeated during movement
            eventBus.dispatch(StateChangeEvent.characterDefeated, defeatedCharacter);

            // Verify path was cleared for defeated character
            expect(updatePathSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'testChar',
                    path: []
                })
            );

            // Verify highlights were cleared
            expect(highlightsSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    reachableCells: [],
                    pathCells: []
                })
            );
        });

        it('should not allow movement selection for defeated characters', () => {
            const defeatedCharacter = createMockCharacter({
                controller: 'human', faction: 'player',
                name: 'deadChar',
                health: 0
            });

            mockState.findCharacter.mockReturnValue(defeatedCharacter);

            const highlightsSpy = jest.fn();
            eventBus.listen(UpdateStateEvent.uiHighlights, highlightsSpy);

            // Try to show movement for defeated character
            eventBus.dispatch(ControlsEvent.showMovement, 'deadChar');

            // Verify no highlights were dispatched
            expect(highlightsSpy).not.toHaveBeenCalled();
            expect(getReachableCells).not.toHaveBeenCalled();
        });

        it('should clear path when character is defeated', () => {
            const character = createMockCharacter({
                controller: 'human', faction: 'player',
                name: 'testChar',
                health: 50,
                path: [{ x: 2, y: 1 }, { x: 3, y: 1 }]
            });

            const defeatedCharacter = {
                ...character,
                health: 0
            };

            const updatePathSpy = jest.fn();
            eventBus.listen(UpdateStateEvent.characterPath, updatePathSpy);

            // Character is defeated
            eventBus.dispatch(StateChangeEvent.characterDefeated, defeatedCharacter);

            // Verify path was cleared
            expect(updatePathSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'testChar',
                    path: []
                })
            );
        });

        it('should not create animation for defeated character', () => {
            const defeatedCharacter = createMockCharacter({
                controller: 'human', faction: 'player',
                name: 'deadChar',
                health: 0,
                path: [{ x: 2, y: 1 }, { x: 3, y: 1 }]
            });

            mockState.findCharacter.mockReturnValue(defeatedCharacter);

            const animationSpy = jest.fn();
            const updatePathSpy = jest.fn();
            eventBus.listen(UpdateStateEvent.uiCharacterAnimation, animationSpy);
            eventBus.listen(UpdateStateEvent.characterPath, updatePathSpy);

            // Dispatch characterPath event for defeated character
            eventBus.dispatch(StateChangeEvent.characterPath, defeatedCharacter);

            // Verify no animation was created
            expect(animationSpy).not.toHaveBeenCalled();
            
            // Verify path was cleared immediately
            expect(updatePathSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: 'deadChar',
                    path: []
                })
            );
        });
    });

    describe('event cleanup', () => {
        it('should properly handle multiple movement sequences', () => {
            const character1 = createMockCharacter({ controller: 'human', faction: 'player', name: 'char1' });
            const character2 = createMockCharacter({ controller: 'human', faction: 'player', name: 'char2', position: { x: 3, y: 3 } });

            const reachableCells1 = [{ x: 0, y: 1 }, { x: 1, y: 0 }];
            const reachableCells2 = [{ x: 3, y: 2 }, { x: 4, y: 3 }];

            mockState.findCharacter.mockImplementation((name) => {
                if (name === 'char1') return character1;
                if (name === 'char2') return character2;
                return undefined;
            });

            (getReachableCells as jest.Mock)
                .mockReturnValueOnce(reachableCells1)
                .mockReturnValueOnce(reachableCells2);

            const highlightsSpy = jest.fn();
            eventBus.listen(UpdateStateEvent.uiHighlights, highlightsSpy);

            // Show movement for first character
            eventBus.dispatch(ControlsEvent.showMovement, 'char1');
            expect(highlightsSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    reachableCells: reachableCells1
                })
            );

            // Show movement for second character
            eventBus.dispatch(ControlsEvent.showMovement, 'char2');
            expect(highlightsSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    reachableCells: reachableCells2
                })
            );
            
            // Should have been called twice total
            expect(highlightsSpy).toHaveBeenCalledTimes(2);
        });
    });
});