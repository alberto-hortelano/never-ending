import { superEventBus, ControlsEvent, StateChangeEvent, GUIEvent, UpdateStateEvent } from "../events";
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

import { getReachableCells, calculatePath } from '../helpers/map';

describe('Movement', () => {
    let movement: Movement;
    let mockState: jest.Mocked<State>;
    let testCharacter: ICharacter;
    let testMap: ICell[][];

    // Helper function to create a mock character
    const createMockCharacter = (overrides: Partial<ICharacter> = {}): ICharacter => ({
        name: 'test-character',
        race: 'human',
        description: 'test character',
        action: 'iddle',
        palette: {
            skin: 'green',
            helmet: 'red',
            suit: 'blue'
        },
        speed: 'medium',
        direction: 'down',
        path: [],
        location: '',
        position: { x: 1, y: 1 },
        blocker: true,
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
        testCharacter = createMockCharacter();
        testMap = createMockMap(5, 5);

        // Create mock State
        mockState = {
            map: testMap,
            findCharacter: jest.fn(),
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

            const cellHighlightSpy = jest.fn();
            const listener = createTestListener();
            listener.listen(GUIEvent.cellHighlight, cellHighlightSpy);

            // Trigger showMovement
            superEventBus.dispatch(ControlsEvent.showMovement, testCharacter.name);

            // Verify getReachableCells was called with correct parameters
            expect(getReachableCells).toHaveBeenCalledWith(
                testCharacter.position,
                Movement.speed[testCharacter.speed],
                testMap
            );

            // Verify all reachable cells were highlighted
            expect(cellHighlightSpy).toHaveBeenCalledTimes(reachableCells.length);
            reachableCells.forEach((cell, index) => {
                expect(cellHighlightSpy).toHaveBeenNthCalledWith(
                    index + 1,
                    cell
                );
            });
        });

        it('should not highlight cells if character is not found', () => {
            mockState.findCharacter.mockReturnValue(undefined);

            const cellHighlightSpy = jest.fn();
            const listener = createTestListener();
            listener.listen(GUIEvent.cellHighlight, cellHighlightSpy);

            // Trigger showMovement
            superEventBus.dispatch(ControlsEvent.showMovement, 'non-existent-character');

            // Verify no cells were highlighted
            expect(cellHighlightSpy).not.toHaveBeenCalled();
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
            const cellResetSpy = jest.fn();
            const listener = createTestListener();
            listener.listen(UpdateStateEvent.characterPath, updateStateSpy);
            listener.listen(GUIEvent.cellReset, cellResetSpy);

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

            // Verify non-path cells were reset
            const nonPathCells = reachableCells.filter(
                c => !path.find(p => p.x === c.x && p.y === c.y)
            );
            expect(cellResetSpy).toHaveBeenCalledTimes(nonPathCells.length);
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
        it('should dispatch moveCharacter event when character has a path', () => {
            const characterWithPath: ICharacter = createMockCharacter({
                path: [
                    { x: 2, y: 1 },
                    { x: 3, y: 1 }
                ]
            });

            const moveCharacterSpy = jest.fn();
            const listener = createTestListener();
            listener.listen(ControlsEvent.moveCharacter, moveCharacterSpy);

            // Dispatch characterPath event
            superEventBus.dispatch(StateChangeEvent.characterPath, characterWithPath);

            // Verify moveCharacter was dispatched with correct data
            expect(moveCharacterSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    ...characterWithPath,
                    path: [{ x: 3, y: 1 }], // Path without first position
                    position: { x: 2, y: 1 }, // First position from path
                    direction: 'right' // Moving right from x:1 to x:2
                })
            );
        });

        it('should not dispatch moveCharacter when character has empty path', () => {
            const characterWithEmptyPath: ICharacter = createMockCharacter({
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

    describe('movementEnd', () => {
        it('should update character position when movement ends', () => {
            const movingCharacter: ICharacter = createMockCharacter({
                path: [
                    { x: 2, y: 1 },
                    { x: 3, y: 1 }
                ]
            });

            mockState.findCharacter.mockReturnValue(movingCharacter);

            const updatePathSpy = jest.fn();
            const updatePositionSpy = jest.fn();
            const cellResetSpy = jest.fn();
            const listener = createTestListener();
            listener.listen(UpdateStateEvent.characterPath, updatePathSpy);
            listener.listen(UpdateStateEvent.characterPosition, updatePositionSpy);
            listener.listen(GUIEvent.cellReset, cellResetSpy);

            // Trigger movement end
            superEventBus.dispatch(GUIEvent.movementEnd, movingCharacter.name);

            // Verify path was updated (first position removed) with new position
            expect(updatePathSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    ...movingCharacter,
                    path: [{ x: 3, y: 1 }],
                    position: { x: 2, y: 1 }, // Now includes the updated position
                    direction: 'right' // Moving right from x:1 to x:2
                })
            );

            // Verify position was updated
            expect(updatePositionSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    ...movingCharacter,
                    position: { x: 2, y: 1 },
                    direction: 'right' // Moving right from x:1 to x:2
                })
            );

            // Verify cell was reset
            expect(cellResetSpy).toHaveBeenCalledWith(
                { x: 2, y: 1 }
            );
        });

        it('should handle character with empty path', () => {
            const characterWithEmptyPath: ICharacter = createMockCharacter({
                path: []
            });

            mockState.findCharacter.mockReturnValue(characterWithEmptyPath);

            const updatePathSpy = jest.fn();
            const updatePositionSpy = jest.fn();
            const listener = createTestListener();
            listener.listen(UpdateStateEvent.characterPath, updatePathSpy);
            listener.listen(UpdateStateEvent.characterPosition, updatePositionSpy);

            // Trigger movement end
            superEventBus.dispatch(GUIEvent.movementEnd, characterWithEmptyPath.name);

            // Verify no updates were made
            expect(updatePathSpy).not.toHaveBeenCalled();
            expect(updatePositionSpy).not.toHaveBeenCalled();
        });

        it('should not update if character is not found', () => {
            mockState.findCharacter.mockReturnValue(undefined);

            const updatePathSpy = jest.fn();
            const updatePositionSpy = jest.fn();
            const listener = createTestListener();
            listener.listen(UpdateStateEvent.characterPath, updatePathSpy);
            listener.listen(UpdateStateEvent.characterPosition, updatePositionSpy);

            // Trigger movement end
            superEventBus.dispatch(GUIEvent.movementEnd, 'non-existent-character');

            // Verify no updates were made
            expect(updatePathSpy).not.toHaveBeenCalled();
            expect(updatePositionSpy).not.toHaveBeenCalled();
        });
    });

    describe('speed values', () => {
        it('should have correct speed values', () => {
            expect(Movement.speed).toEqual({
                'verySlow': 2,
                'slow': 3,
                'medium': 14,
                'fast': 5,
                'veryFast': 6
            });
        });

        it('should use correct speed value for different character speeds', () => {
            const speeds: Array<ICharacter['speed']> = ['verySlow', 'slow', 'medium', 'fast', 'veryFast'];

            speeds.forEach(speed => {
                const character = createMockCharacter({ speed });
                mockState.findCharacter.mockReturnValue(character);

                (getReachableCells as jest.Mock).mockReturnValue([]);

                // Trigger showMovement
                superEventBus.dispatch(ControlsEvent.showMovement, character.name);

                // Verify correct speed value was used
                expect(getReachableCells).toHaveBeenCalledWith(
                    character.position,
                    Movement.speed[speed],
                    testMap
                );
            });
        });
    });

    describe('event cleanup', () => {
        it('should properly handle multiple movement sequences', () => {
            const character1 = createMockCharacter({ name: 'char1' });
            const character2 = createMockCharacter({ name: 'char2', position: { x: 3, y: 3 } });

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

            const cellHighlightSpy = jest.fn();
            const cellResetSpy = jest.fn();
            const listener = createTestListener();
            listener.listen(GUIEvent.cellHighlight, cellHighlightSpy);
            listener.listen(GUIEvent.cellReset, cellResetSpy);

            // Show movement for first character
            superEventBus.dispatch(ControlsEvent.showMovement, 'char1');
            expect(cellHighlightSpy).toHaveBeenCalledTimes(reachableCells1.length);

            // Show movement for second character (should reset first character's highlights)
            superEventBus.dispatch(ControlsEvent.showMovement, 'char2');
            expect(cellHighlightSpy).toHaveBeenCalledTimes(reachableCells1.length + reachableCells2.length);
        });
    });
});