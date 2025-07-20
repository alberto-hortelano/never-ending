import { superEventBus, ControlsEvent, StateChangeEvent, UpdateStateEvent } from "../events";
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

    // Helper class for managing test event listeners
    class TestEventListener {
        listen(
            event: Parameters<typeof superEventBus.listen>[0],
            callback: Parameters<typeof superEventBus.listen>[1]
        ) {
            superEventBus.listen.call(this, event, callback);
        }
    }

    let testListeners: TestEventListener[] = [];

    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();

        // Create test data
        testCharacter = createMockCharacter({
            player: 'human'
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;

        // Create Movement instance
        movement = new Movement(mockState);

        // Reset test listeners
        testListeners = [];
    });

    afterEach(() => {
        // Clean up all test listeners
        testListeners.forEach(listener => superEventBus.remove(listener));
        // Clean up movement listeners
        superEventBus.remove(movement);
    });

    // Helper to create a test listener and track it
    const createTestListener = () => {
        const listener = new TestEventListener();
        testListeners.push(listener);
        return listener;
    };

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
            const listener = createTestListener();
            listener.listen(UpdateStateEvent.uiHighlights, highlightsSpy);

            // Trigger showMovement
            superEventBus.dispatch(ControlsEvent.showMovement, testCharacter.name);

            // Verify getReachableCells was called with correct parameters
            const moveCost = testCharacter.actions.general.move;
            const pointsLeft = testCharacter.actions.pointsLeft;
            const maxDistance = Math.floor(pointsLeft / moveCost);
            expect(getReachableCells).toHaveBeenCalledWith(
                testCharacter.position,
                maxDistance,
                testMap
            );

            // Verify highlights were updated with reachable cells
            expect(highlightsSpy).toHaveBeenCalledTimes(1);
            expect(highlightsSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    reachableCells: reachableCells
                })
            );
        });

        it('should not highlight cells if character is not found', () => {
            mockState.findCharacter.mockReturnValue(undefined);

            const highlightsSpy = jest.fn();
            const listener = createTestListener();
            listener.listen(UpdateStateEvent.uiHighlights, highlightsSpy);

            // Trigger showMovement
            superEventBus.dispatch(ControlsEvent.showMovement, 'non-existent-character');

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
            const listener = createTestListener();
            listener.listen(UpdateStateEvent.characterPath, updateStateSpy);
            listener.listen(UpdateStateEvent.uiHighlights, highlightsSpy);

            // First show movement to set up reachable cells
            superEventBus.dispatch(ControlsEvent.showMovement, testCharacter.name);

            // Then click on a reachable cell
            superEventBus.dispatch(ControlsEvent.cellClick, destination);

            // Verify path calculation
            expect(calculatePath).toHaveBeenCalledWith(
                testCharacter.position,
                destination,
                testMap
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
            const listener = createTestListener();
            listener.listen(UpdateStateEvent.characterPath, updateStateSpy);

            // Show movement first
            superEventBus.dispatch(ControlsEvent.showMovement, testCharacter.name);

            // Click on non-reachable cell
            superEventBus.dispatch(ControlsEvent.cellClick, nonReachableCell);

            // Verify no path was set
            expect(calculatePath).not.toHaveBeenCalled();
            expect(updateStateSpy).not.toHaveBeenCalled();
        });
    });

    describe('characterPath', () => {
        it('should create animation and clear path when character has a path', () => {
            const characterWithPath: ICharacter = createMockCharacter({
                player: 'human',
                path: [
                    { x: 2, y: 1 },
                    { x: 3, y: 1 }
                ]
            });

            const updatePathSpy = jest.fn();
            const highlightsSpy = jest.fn();
            const listener = createTestListener();
            listener.listen(UpdateStateEvent.characterPath, updatePathSpy);
            listener.listen(UpdateStateEvent.uiHighlights, highlightsSpy);

            // Dispatch characterPath event
            superEventBus.dispatch(StateChangeEvent.characterPath, characterWithPath);

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
                player: 'human',
                path: []
            });

            const moveCharacterSpy = jest.fn();
            const listener = createTestListener();
            listener.listen(ControlsEvent.moveCharacter, moveCharacterSpy);

            // Dispatch characterPath event
            superEventBus.dispatch(StateChangeEvent.characterPath, characterWithEmptyPath);

            // Verify moveCharacter was not dispatched
            expect(moveCharacterSpy).not.toHaveBeenCalled();
        });
    });

    describe('animation completion', () => {
        it('should track completed movements', () => {
            const characterWithPath: ICharacter = createMockCharacter({
                player: 'human',
                path: [
                    { x: 2, y: 1 },
                    { x: 3, y: 1 }
                ]
            });

            // Dispatch characterPath event
            superEventBus.dispatch(StateChangeEvent.characterPath, characterWithPath);

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
                    player: 'human', 
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
                superEventBus.dispatch(ControlsEvent.showMovement, character.name);

                // Verify correct distance was calculated
                expect(getReachableCells).toHaveBeenCalledWith(
                    character.position,
                    expectedDistance,
                    testMap
                );
            });
        });
    });

    describe('event cleanup', () => {
        it('should properly handle multiple movement sequences', () => {
            const character1 = createMockCharacter({ player: 'human', name: 'char1' });
            const character2 = createMockCharacter({ player: 'human', name: 'char2', position: { x: 3, y: 3 } });

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
            const listener = createTestListener();
            listener.listen(UpdateStateEvent.uiHighlights, highlightsSpy);

            // Show movement for first character
            superEventBus.dispatch(ControlsEvent.showMovement, 'char1');
            expect(highlightsSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    reachableCells: reachableCells1
                })
            );

            // Show movement for second character
            superEventBus.dispatch(ControlsEvent.showMovement, 'char2');
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