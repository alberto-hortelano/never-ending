import type { ICharacter, ICell, ICoord, Direction } from "../interfaces";
import type { State } from "../State";

import { superEventBus, ControlsEvent, GUIEvent } from "../events";
import { Shoot } from "../Shoot";

// Mock the State class
jest.mock('../State');

describe('Shoot', () => {
    let shoot: Shoot;
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
        direction: 'right',
        path: [],
        location: '',
        position: { x: 5, y: 5 },
        blocker: true,
        ...overrides
    });

    // Helper function to create a mock cell
    const createMockCell = (x: number, y: number, blocker: boolean = false): ICell => ({
        position: { x, y },
        locations: [],
        elements: [],
        content: blocker ? { position: { x, y }, location: '', blocker: true } : null
    });

    // Helper function to create a mock map
    const createMockMap = (width: number, height: number, obstacles: ICoord[] = []): ICell[][] => {
        const map: ICell[][] = [];
        for (let y = 0; y < height; y++) {
            map[y] = [];
            for (let x = 0; x < width; x++) {
                const isObstacle = obstacles.some(o => o.x === x && o.y === y);
                map[y]![x] = createMockCell(x, y, isObstacle);
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
        testMap = createMockMap(15, 15);

        // Create mock State
        mockState = {
            map: testMap,
            findCharacter: jest.fn(),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;

        // Create Shoot instance
        shoot = new Shoot(mockState);

        // Reset test listeners
        testListeners = [];
    });

    afterEach(() => {
        // Clean up all test listeners
        testListeners.forEach(listener => superEventBus.remove(listener));
        // Clean up shoot listeners
        superEventBus.remove(shoot);
    });

    // Helper to create a test listener and track it
    const createTestListener = () => {
        const listener = new TestEventListener();
        testListeners.push(listener);
        return listener;
    };

    describe('calculateVisibleCells', () => {
        it('should calculate visible cells in a cone in front of the character', () => {
            const visibleCells = shoot.calculateVisibleCells(
                testMap,
                { x: 5, y: 5 },
                'right',
                5,
                90
            );

            // Should see cells to the right within 90 degree cone
            expect(visibleCells.length).toBeGreaterThan(0);

            // Check that cells directly in front are visible
            const directlyInFront = visibleCells.find(vc => vc.coord.x === 7 && vc.coord.y === 5);
            expect(directlyInFront).toBeDefined();
            expect(directlyInFront!.intensity).toBeGreaterThan(0.5);

            // Check that cells behind are not visible
            const behind = visibleCells.find(vc => vc.coord.x === 3 && vc.coord.y === 5);
            expect(behind).toBeUndefined();
        });

        it('should apply distance falloff to visibility', () => {
            const visibleCells = shoot.calculateVisibleCells(
                testMap,
                { x: 5, y: 5 },
                'right',
                10,
                90
            );

            const nearCell = visibleCells.find(vc => vc.coord.x === 6 && vc.coord.y === 5);
            const farCell = visibleCells.find(vc => vc.coord.x === 10 && vc.coord.y === 5);

            expect(nearCell!.intensity).toBeGreaterThan(farCell!.intensity);
        });

        it('should apply angle falloff to visibility', () => {
            const visibleCells = shoot.calculateVisibleCells(
                testMap,
                { x: 5, y: 5 },
                'right',
                5,
                120  // Wider angle to ensure we catch edge cells
            );

            const centerCell = visibleCells.find(vc => vc.coord.x === 7 && vc.coord.y === 5);
            const edgeCell = visibleCells.find(vc => vc.coord.x === 7 && vc.coord.y === 6);

            expect(centerCell).toBeDefined();
            expect(edgeCell).toBeDefined();
            expect(centerCell!.intensity).toBeGreaterThan(edgeCell!.intensity);
        });

        it('should handle different directions correctly', () => {
            const directions: Direction[] = ['up', 'right', 'down', 'left'];
            const expectedCells: Partial<Record<Direction, ICoord>> = {
                'up': { x: 5, y: 3 },
                'right': { x: 7, y: 5 },
                'down': { x: 5, y: 7 },
                'left': { x: 3, y: 5 }
            };

            directions.forEach(direction => {
                const visibleCells = shoot.calculateVisibleCells(
                    testMap,
                    { x: 5, y: 5 },
                    direction,
                    5,
                    90
                );

                const expectedCell = expectedCells[direction];
                if (!expectedCell) {
                    throw new Error(`Expected cell not found for direction: ${direction}`);
                }
                const foundCell = visibleCells.find(vc =>
                    vc.coord.x === expectedCell.x && vc.coord.y === expectedCell.y
                );

                expect(foundCell).toBeDefined();
                expect(foundCell!.intensity).toBeGreaterThan(0.5);
            });
        });

        it('should block visibility when obstacles are present', () => {
            const mapWithObstacle = createMockMap(15, 15, [{ x: 7, y: 5 }]);

            const visibleCells = shoot.calculateVisibleCells(
                mapWithObstacle,
                { x: 5, y: 5 },
                'right',
                10,
                90
            );

            // Cell with obstacle should not be visible
            const obstacleCell = visibleCells.find(vc => vc.coord.x === 7 && vc.coord.y === 5);
            expect(obstacleCell).toBeUndefined();

            // Cells behind obstacle should not be visible
            const behindObstacle = visibleCells.find(vc => vc.coord.x === 9 && vc.coord.y === 5);
            expect(behindObstacle).toBeUndefined();

            // Cells before obstacle should be visible
            const beforeObstacle = visibleCells.find(vc => vc.coord.x === 6 && vc.coord.y === 5);
            expect(beforeObstacle).toBeDefined();
        });

        it('should handle different field of vision angles', () => {
            const narrow = shoot.calculateVisibleCells(
                testMap,
                { x: 5, y: 5 },
                'right',
                5,
                30
            );

            const wide = shoot.calculateVisibleCells(
                testMap,
                { x: 5, y: 5 },
                'right',
                5,
                120
            );

            expect(wide.length).toBeGreaterThan(narrow.length);
        });

        it('should not include cells outside of range', () => {
            const visibleCells = shoot.calculateVisibleCells(
                testMap,
                { x: 5, y: 5 },
                'right',
                3,
                90
            );

            // Should not see cells beyond range 3
            const tooFar = visibleCells.find(vc => {
                const dx = vc.coord.x - 5;
                const dy = vc.coord.y - 5;
                return Math.sqrt(dx * dx + dy * dy) > 3;
            });

            expect(tooFar).toBeUndefined();
        });
    });

    describe('showShooting event', () => {
        it('should highlight visible cells when showShooting is triggered', () => {
            mockState.findCharacter.mockReturnValue(testCharacter);

            const cellHighlightSpy = jest.fn();
            const listener = createTestListener();
            listener.listen(GUIEvent.cellHighlightIntensity, cellHighlightSpy);

            // Trigger showShooting
            superEventBus.dispatch(ControlsEvent.showShooting, testCharacter.name);

            // Verify cells were highlighted
            expect(cellHighlightSpy).toHaveBeenCalled();

            // Check that intensity values are correct
            const calls = cellHighlightSpy.mock.calls;
            calls.forEach(([data]) => {
                expect(data.intensity).toBeGreaterThan(0);
                expect(data.intensity).toBeLessThanOrEqual(1);
            });
        });

        it('should not highlight cells if character is not found', () => {
            mockState.findCharacter.mockReturnValue(undefined);

            const cellHighlightSpy = jest.fn();
            const listener = createTestListener();
            listener.listen(GUIEvent.cellHighlightIntensity, cellHighlightSpy);

            // Trigger showShooting
            superEventBus.dispatch(ControlsEvent.showShooting, 'non-existent-character');

            // Verify no cells were highlighted
            expect(cellHighlightSpy).not.toHaveBeenCalled();
        });
    });

    describe('cellClick event', () => {
        it('should clear highlights when clicking on a visible cell', () => {
            mockState.findCharacter.mockReturnValue(testCharacter);

            const cellResetSpy = jest.fn();
            const listener = createTestListener();
            listener.listen(GUIEvent.cellReset, cellResetSpy);

            // First show shooting range
            superEventBus.dispatch(ControlsEvent.showShooting, testCharacter.name);

            // Then click on a visible cell (directly in front)
            superEventBus.dispatch(ControlsEvent.cellClick, { x: 7, y: 5 });

            // Verify highlights were cleared
            expect(cellResetSpy).toHaveBeenCalled();
        });

        it('should not clear highlights when clicking on non-visible cell', () => {
            mockState.findCharacter.mockReturnValue(testCharacter);

            const cellResetSpy = jest.fn();
            const listener = createTestListener();
            listener.listen(GUIEvent.cellReset, cellResetSpy);

            // Show shooting range
            superEventBus.dispatch(ControlsEvent.showShooting, testCharacter.name);

            // Click on a cell behind the character (not visible)
            superEventBus.dispatch(ControlsEvent.cellClick, { x: 1, y: 5 });

            // Verify highlights were not cleared
            expect(cellResetSpy).not.toHaveBeenCalled();
        });
    });

    describe('edge cases', () => {
        it('should handle character at map edge', () => {
            const edgeCharacter = createMockCharacter({ position: { x: 0, y: 0 }, direction: 'down' });
            mockState.findCharacter.mockReturnValue(edgeCharacter);

            const cellHighlightSpy = jest.fn();
            const listener = createTestListener();
            listener.listen(GUIEvent.cellHighlightIntensity, cellHighlightSpy);

            // Should not crash when character is at edge
            superEventBus.dispatch(ControlsEvent.showShooting, edgeCharacter.name);

            // Should still highlight some cells (facing down from top-left corner)
            expect(cellHighlightSpy).toHaveBeenCalled();
        });

        it('should handle zero range', () => {
            const visibleCells = shoot.calculateVisibleCells(
                testMap,
                { x: 5, y: 5 },
                'right',
                0,
                90
            );

            expect(visibleCells).toHaveLength(0);
        });

        it('should filter out cells with very low intensity', () => {
            const visibleCells = shoot.calculateVisibleCells(
                testMap,
                { x: 5, y: 5 },
                'right',
                10,
                90
            );

            // All cells should have meaningful intensity
            visibleCells.forEach(vc => {
                expect(vc.intensity).toBeGreaterThan(0.01);
            });
        });
    });
});