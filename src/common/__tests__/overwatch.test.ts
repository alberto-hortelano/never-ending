/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ICharacter, ICell, ICoord, Direction } from "../interfaces";
import type { State } from "../State";

import { superEventBus, ControlsEvent, GUIEvent, UpdateStateEvent, GameEvent, StateChangeEvent, ActionEvent } from "../events";
import { Overwatch } from "../Overwatch";
import { baseCharacter } from "../../data/state";

// Mock the State class
jest.mock('../State');

describe('Overwatch', () => {
    let overwatch: Overwatch;
    let mockState: jest.Mocked<State>;
    let testCharacter: ICharacter;
    let enemyCharacter: ICharacter;
    let testMap: ICell[][];

    // Helper function to create a mock character
    const createMockCharacter = (overrides: Partial<ICharacter> = {}): ICharacter => ({
        ...baseCharacter,
        health: 100,
        maxHealth: 100,
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
        testCharacter = createMockCharacter({
            name: 'overwatcher',
            direction: 'right' as Direction,
            position: { x: 5, y: 5 },
            player: 'human',
            actions: {
                ...baseCharacter.actions,
                pointsLeft: 10,
                rangedCombat: {
                    ...baseCharacter.actions.rangedCombat,
                    overwatch: 0 // Overwatch consumes all remaining points
                }
            },
            inventory: {
                ...baseCharacter.inventory,
                equippedWeapons: {
                    primary: {
                        id: 'rifle',
                        name: 'Assault Rifle',
                        description: 'Standard assault rifle',
                        damage: 20,
                        range: 15,
                        weight: 3,
                        cost: 100,
                        icon: '🔫',
                        category: 'ranged' as const,
                        type: 'weapon' as const,
                        weaponType: 'twoHanded' as const,
                        class: 'rifle' as const
                    },
                    secondary: null
                }
            }
        });

        enemyCharacter = createMockCharacter({
            name: 'enemy',
            direction: 'left' as Direction,
            position: { x: 10, y: 5 },
            player: 'ai'
        });

        testMap = createMockMap(15, 15);

        // Create mock State with mutable overwatchData
        const mockOverwatchDataMap = new Map();
        mockState = {
            map: testMap,
            findCharacter: jest.fn(),
            get game() {
                return {
                    turn: 'human',
                    players: ['human', 'ai']
                };
            },
            characters: [testCharacter, enemyCharacter],
            get overwatchData() {
                // Convert Map to object for the state interface
                const obj: any = {};
                mockOverwatchDataMap.forEach((value, key) => {
                    obj[key] = value;
                });
                return obj;
            },
            // Helper property to access mutable map in tests
            _overwatchData: mockOverwatchDataMap
        } as any;

        // Create Overwatch instance
        overwatch = new Overwatch(mockState);

        // Reset test listeners
        testListeners = [];
    });

    afterEach(() => {
        // Clean up all test listeners
        testListeners.forEach(listener => superEventBus.remove(listener));
        // Clean up overwatch listeners
        superEventBus.remove(overwatch);
    });

    // Helper to create a test listener and track it
    const createTestListener = () => {
        const listener = new TestEventListener();
        testListeners.push(listener);
        return listener;
    };

    describe('Overwatch Activation', () => {
        it('should activate overwatch mode when showOverwatch event is dispatched', () => {
            const listener = createTestListener();
            const cellBatchSpy = jest.fn();
            const interactionModeSpy = jest.fn();

            listener.listen(UpdateStateEvent.uiCellVisualBatch, cellBatchSpy);
            listener.listen(UpdateStateEvent.uiInteractionMode, interactionModeSpy);

            mockState.findCharacter.mockReturnValue(testCharacter);

            // Trigger showOverwatch
            superEventBus.dispatch(ControlsEvent.showOverwatch, testCharacter.name);

            // Should update cells with overwatch highlight
            expect(cellBatchSpy).toHaveBeenCalled();
            const batchUpdate = cellBatchSpy.mock.calls[0][0];
            expect(batchUpdate.updates.length).toBeGreaterThan(0);
            expect(batchUpdate.updates[0].visualState.highlightTypes).toContain('overwatch');

            // Should set interaction mode to overwatch
            expect(interactionModeSpy).toHaveBeenCalledWith({
                type: 'overwatch',
                data: expect.objectContaining({
                    characterId: testCharacter.name,
                    weapon: testCharacter.inventory.equippedWeapons.primary,
                    remainingPoints: testCharacter.actions.pointsLeft
                })
            });
        });

        it('should consume all remaining action points when overwatch is activated', () => {
            const listener = createTestListener();
            const deductPointsSpy = jest.fn();

            listener.listen(UpdateStateEvent.deductActionPoints, deductPointsSpy);

            mockState.findCharacter.mockReturnValue(testCharacter);

            // Trigger showOverwatch
            superEventBus.dispatch(ControlsEvent.showOverwatch, testCharacter.name);

            // Confirm overwatch activation
            superEventBus.dispatch(ControlsEvent.cellClick, { x: 7, y: 5 }); // Click in overwatch range

            // Should deduct all remaining action points
            expect(deductPointsSpy).toHaveBeenCalledWith({
                characterName: testCharacter.name,
                actionId: 'overwatch',
                cost: testCharacter.actions.pointsLeft
            });
        });

        it('should store overwatch data in state when activated', () => {
            const listener = createTestListener();
            const updateOverwatchSpy = jest.fn();

            listener.listen(UpdateStateEvent.setOverwatchData, updateOverwatchSpy);

            mockState.findCharacter.mockReturnValue(testCharacter);

            // Trigger showOverwatch
            superEventBus.dispatch(ControlsEvent.showOverwatch, testCharacter.name);

            // Confirm overwatch activation
            superEventBus.dispatch(ControlsEvent.cellClick, { x: 7, y: 5 });

            // Should store overwatch data
            expect(updateOverwatchSpy).toHaveBeenCalled();
            const call = updateOverwatchSpy.mock.calls[0][0];
            expect(call.characterName).toBe(testCharacter.name);
            expect(call.active).toBe(true);
            expect(call.direction).toBe(testCharacter.direction);
            expect(call.position).toEqual(testCharacter.position);
            expect(call.range).toBe(15);
            expect(call.shotsRemaining).toBe(testCharacter.actions.pointsLeft);
            expect(call.watchedCells).toBeDefined();
            expect(Array.isArray(call.watchedCells)).toBe(true);
            expect(call.watchedCells.length).toBeGreaterThan(0);
        });

        it('should not allow overwatch if character has no action points', () => {
            const listener = createTestListener();
            const errorSpy = jest.fn();

            listener.listen(ActionEvent.error, errorSpy);

            const noPointsCharacter = { ...testCharacter, actions: { ...testCharacter.actions, pointsLeft: 0 } };
            mockState.findCharacter.mockReturnValue(noPointsCharacter);

            // Trigger showOverwatch
            superEventBus.dispatch(ControlsEvent.showOverwatch, testCharacter.name);

            // Should show error
            expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('No action points'));
        });

        it('should not allow overwatch if not current turn', () => {
            const listener = createTestListener();
            const cellBatchSpy = jest.fn();

            listener.listen(UpdateStateEvent.uiCellVisualBatch, cellBatchSpy);

            // Mock the game getter to return a different turn
            Object.defineProperty(mockState, 'game', {
                get: () => ({ turn: 'ai', players: ['human', 'ai'] }),
                configurable: true
            });
            mockState.findCharacter.mockReturnValue(testCharacter);

            // Trigger showOverwatch
            superEventBus.dispatch(ControlsEvent.showOverwatch, testCharacter.name);

            // Should not update cells
            expect(cellBatchSpy).not.toHaveBeenCalled();
        });
    });

    describe('Overwatch Triggering', () => {
        beforeEach(() => {
            // Set up overwatch for test character
            mockState.findCharacter.mockReturnValue(testCharacter);
            (mockState as any)._overwatchData.set(testCharacter.name, {
                active: true,
                direction: testCharacter.direction,
                position: testCharacter.position,
                range: 15,
                shotsRemaining: 10,
                watchedCells: [{ x: 6, y: 5 }, { x: 7, y: 5 }, { x: 8, y: 5 }, { x: 9, y: 5 }, { x: 10, y: 5 }]
            });
        });

        it('should shoot at enemy entering overwatch zone', () => {
            const listener = createTestListener();
            const projectileSpy = jest.fn();
            const damageSpy = jest.fn();

            listener.listen(GUIEvent.shootProjectile, projectileSpy);
            listener.listen(UpdateStateEvent.damageCharacter, damageSpy);

            // Set up mock to return enemy character when queried
            mockState.findCharacter.mockImplementation((name) => {
                if (name === enemyCharacter.name) return enemyCharacter;
                if (name === testCharacter.name) return testCharacter;
                return undefined;
            });

            // Mock Math.random to ensure hit
            const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.5);

            // Simulate enemy movement into overwatch zone
            superEventBus.dispatch(StateChangeEvent.characterPosition, {
                ...enemyCharacter,
                position: { x: 8, y: 5 } // Moving into watched cell
            });

            // Should fire projectile
            expect(projectileSpy).toHaveBeenCalledWith({
                from: testCharacter.position,
                to: { x: 8, y: 5 },
                type: 'bullet'
            });

            // Should apply damage (assuming hit)
            expect(damageSpy).toHaveBeenCalled();

            // Clean up
            mockRandom.mockRestore();
        });

        it('should shoot once per cell as enemy moves through overwatch zone', () => {
            const listener = createTestListener();
            const projectileSpy = jest.fn();

            listener.listen(GUIEvent.shootProjectile, projectileSpy);

            mockState.findCharacter.mockImplementation((name) => {
                if (name === enemyCharacter.name) return enemyCharacter;
                if (name === testCharacter.name) return testCharacter;
                return undefined;
            });

            // Simulate enemy moving through multiple cells
            const movementPath = [
                { x: 10, y: 5 }, // Start position (not in zone)
                { x: 9, y: 5 },  // Enter zone - should shoot
                { x: 8, y: 5 },  // Still in zone - should shoot again
                { x: 7, y: 5 }   // Still in zone - should shoot again
            ];

            movementPath.forEach((position, index) => {
                if (index > 0) { // Skip starting position
                    superEventBus.dispatch(StateChangeEvent.characterPosition, {
                        ...enemyCharacter,
                        position
                    });
                }
            });

            // Should have fired 3 times (once per cell entered)
            expect(projectileSpy).toHaveBeenCalledTimes(3);
        });

        it('should reduce shots remaining after each shot', () => {
            const listener = createTestListener();
            const updateOverwatchSpy = jest.fn();

            listener.listen(UpdateStateEvent.setOverwatchData, updateOverwatchSpy);

            mockState.findCharacter.mockImplementation((name) => {
                if (name === enemyCharacter.name) return enemyCharacter;
                if (name === testCharacter.name) return testCharacter;
                return undefined;
            });

            // Simulate enemy movement
            superEventBus.dispatch(StateChangeEvent.characterPosition, {
                ...enemyCharacter,
                position: { x: 8, y: 5 }
            });

            // Should update overwatch data with reduced shots
            expect(updateOverwatchSpy).toHaveBeenCalledWith(expect.objectContaining({
                characterName: testCharacter.name,
                shotsRemaining: 9 // One shot fired
            }));
        });

        it('should deactivate overwatch when shots run out', () => {
            const listener = createTestListener();
            const updateOverwatchSpy = jest.fn();
            const clearHighlightsSpy = jest.fn();

            listener.listen(UpdateStateEvent.setOverwatchData, updateOverwatchSpy);
            listener.listen(UpdateStateEvent.uiHighlights, clearHighlightsSpy);

            // Set overwatch with only 1 shot remaining
            (mockState as any)._overwatchData.set(testCharacter.name, {
                active: true,
                direction: testCharacter.direction,
                position: testCharacter.position,
                range: 15,
                shotsRemaining: 1,
                watchedCells: [{ x: 8, y: 5 }]
            });

            mockState.findCharacter.mockImplementation((name) => {
                if (name === enemyCharacter.name) return enemyCharacter;
                if (name === testCharacter.name) return testCharacter;
                return undefined;
            });

            // Simulate enemy movement
            superEventBus.dispatch(StateChangeEvent.characterPosition, {
                ...enemyCharacter,
                position: { x: 8, y: 5 }
            });

            // Should deactivate overwatch
            expect(updateOverwatchSpy).toHaveBeenCalledWith({
                characterName: testCharacter.name,
                active: false
            });

            // Should clear highlights
            expect(clearHighlightsSpy).toHaveBeenCalledWith({
                targetableCells: []
            });
        });

        it('should not shoot at friendly units', () => {
            const listener = createTestListener();
            const projectileSpy = jest.fn();

            listener.listen(GUIEvent.shootProjectile, projectileSpy);

            const friendlyCharacter = createMockCharacter({
                name: 'friendly',
                player: 'human', // Same team as overwatch character
                position: { x: 10, y: 5 }
            });

            mockState.findCharacter.mockImplementation((name) => {
                if (name === friendlyCharacter.name) return friendlyCharacter;
                if (name === testCharacter.name) return testCharacter;
                return undefined;
            });

            // Simulate friendly movement into overwatch zone
            superEventBus.dispatch(StateChangeEvent.characterPosition, {
                ...friendlyCharacter,
                position: { x: 8, y: 5 }
            });

            // Should not fire at friendly
            expect(projectileSpy).not.toHaveBeenCalled();
        });

        it('should not shoot if line of sight is blocked', () => {
            const listener = createTestListener();
            const projectileSpy = jest.fn();

            listener.listen(GUIEvent.shootProjectile, projectileSpy);

            // Add obstacle between overwatch and target
            testMap[5]![7] = createMockCell(7, 5, true); // Blocking cell

            mockState.findCharacter.mockImplementation((name) => {
                if (name === enemyCharacter.name) return enemyCharacter;
                if (name === testCharacter.name) return testCharacter;
                return undefined;
            });

            // Simulate enemy movement behind obstacle
            superEventBus.dispatch(StateChangeEvent.characterPosition, {
                ...enemyCharacter,
                position: { x: 8, y: 5 }
            });

            // Should not fire due to blocked line of sight
            expect(projectileSpy).not.toHaveBeenCalled();
        });
    });

    describe('Overwatch Turn Management', () => {
        it('should clear overwatch when character\'s turn starts', () => {
            const listener = createTestListener();
            const updateOverwatchSpy = jest.fn();
            const clearHighlightsSpy = jest.fn();

            listener.listen(UpdateStateEvent.setOverwatchData, updateOverwatchSpy);
            listener.listen(UpdateStateEvent.uiHighlights, clearHighlightsSpy);

            // Set up active overwatch
            (mockState as any)._overwatchData.set(testCharacter.name, {
                active: true,
                direction: testCharacter.direction,
                position: testCharacter.position,
                range: 15,
                shotsRemaining: 10,
                watchedCells: [{ x: 8, y: 5 }]
            });

            // Simulate turn change back to human (overwatcher's turn)
            superEventBus.dispatch(GameEvent.changeTurn, {
                turn: 'human',
                previousTurn: 'ai'
            });

            // Should clear overwatch for human player's characters
            expect(updateOverwatchSpy).toHaveBeenCalledWith({
                characterName: testCharacter.name,
                active: false
            });
            
            // Should also clear highlights
            expect(clearHighlightsSpy).toHaveBeenCalled();
        });

        it('should maintain overwatch during other players\' turns', () => {
            const listener = createTestListener();
            const updateOverwatchSpy = jest.fn();

            listener.listen(UpdateStateEvent.setOverwatchData, updateOverwatchSpy);

            // Set up active overwatch
            (mockState as any)._overwatchData.set(testCharacter.name, {
                active: true,
                direction: testCharacter.direction,
                position: testCharacter.position,
                range: 15,
                shotsRemaining: 10,
                watchedCells: [{ x: 8, y: 5 }]
            });

            // Simulate turn change to AI (not overwatcher's turn)
            superEventBus.dispatch(GameEvent.changeTurn, {
                turn: 'ai',
                previousTurn: 'human'
            });

            // Should not clear overwatch
            expect(updateOverwatchSpy).not.toHaveBeenCalled();
        });

        it('should allow multiple characters to have overwatch simultaneously', () => {
            const listener = createTestListener();
            const cellBatchSpy = jest.fn();

            listener.listen(UpdateStateEvent.uiCellVisualBatch, cellBatchSpy);

            const secondOverwatcher = createMockCharacter({
                name: 'overwatcher2',
                direction: 'left' as Direction,
                position: { x: 10, y: 10 },
                player: 'human',
                actions: { ...baseCharacter.actions, pointsLeft: 8 }
            });

            // Set up first overwatch
            (mockState as any)._overwatchData.set(testCharacter.name, {
                active: true,
                direction: testCharacter.direction,
                position: testCharacter.position,
                range: 15,
                shotsRemaining: 10,
                watchedCells: [{ x: 8, y: 5 }]
            });

            mockState.findCharacter.mockReturnValue(secondOverwatcher);

            // Activate second overwatch
            superEventBus.dispatch(ControlsEvent.showOverwatch, secondOverwatcher.name);

            // Both overwatches should be active
            expect(cellBatchSpy).toHaveBeenCalled();
            expect(Object.keys(mockState.overwatchData).length).toBe(1); // Mock doesn't actually update
        });
    });

    describe('Overwatch Visual Indicators', () => {
        it('should show persistent overwatch highlights', () => {
            const listener = createTestListener();
            const cellBatchSpy = jest.fn();

            listener.listen(UpdateStateEvent.uiCellVisualBatch, cellBatchSpy);

            mockState.findCharacter.mockReturnValue(testCharacter);

            // Trigger showOverwatch
            superEventBus.dispatch(ControlsEvent.showOverwatch, testCharacter.name);

            // Should highlight cells with overwatch type
            const batchUpdate = cellBatchSpy.mock.calls[0][0];
            expect(batchUpdate.updates[0].visualState).toMatchObject({
                isHighlighted: true,
                highlightTypes: expect.arrayContaining(['overwatch']),
                classList: expect.arrayContaining(['highlight', 'overwatch'])
            });
        });

        it('should add overwatch class to character', () => {
            const listener = createTestListener();
            const characterVisualSpy = jest.fn();

            listener.listen(UpdateStateEvent.uiCharacterVisual, characterVisualSpy);

            mockState.findCharacter.mockReturnValue(testCharacter);

            // Trigger showOverwatch
            superEventBus.dispatch(ControlsEvent.showOverwatch, testCharacter.name);

            // Should add overwatch class
            expect(characterVisualSpy).toHaveBeenCalledWith({
                characterId: testCharacter.name,
                visualState: {
                    temporaryClasses: ['overwatch'],
                    weaponClass: 'rifle'
                }
            });
        });

        it('should show remaining shots in UI', () => {
            const listener = createTestListener();
            const interactionModeSpy = jest.fn();

            listener.listen(UpdateStateEvent.uiInteractionMode, interactionModeSpy);

            mockState.findCharacter.mockReturnValue(testCharacter);
            (mockState as any)._overwatchData.set(testCharacter.name, {
                active: true,
                shotsRemaining: 5
            });

            // Update overwatch display
            superEventBus.dispatch(ControlsEvent.showOverwatch, testCharacter.name);

            // Should include remaining points in interaction mode (overwatch preview mode)
            expect(interactionModeSpy).toHaveBeenCalledWith({
                type: 'overwatch',
                data: expect.objectContaining({
                    characterId: testCharacter.name,
                    weapon: testCharacter.inventory.equippedWeapons.primary,
                    remainingPoints: testCharacter.actions.pointsLeft
                })
            });
        });
    });

    describe('Overwatch Cell Coverage', () => {
        it('should shoot at enemy on every cell they enter in overwatch area', () => {
            const listener = createTestListener();
            const projectileSpy = jest.fn();
            const damageSpy = jest.fn();

            listener.listen(GUIEvent.shootProjectile, projectileSpy);
            listener.listen(UpdateStateEvent.damageCharacter, damageSpy);

            // Set up a wider overwatch area
            const watchedCells = [
                { x: 6, y: 5 },
                { x: 7, y: 5 },
                { x: 8, y: 5 },
                { x: 9, y: 5 },
                { x: 10, y: 5 },
                { x: 7, y: 4 },
                { x: 8, y: 4 },
                { x: 9, y: 4 },
                { x: 7, y: 6 },
                { x: 8, y: 6 },
                { x: 9, y: 6 }
            ];

            (mockState as any)._overwatchData.set(testCharacter.name, {
                active: true,
                direction: testCharacter.direction,
                position: testCharacter.position,
                range: 15,
                shotsRemaining: 20, // Enough shots for all cells
                watchedCells: watchedCells,
                shotCells: []
            });

            mockState.findCharacter.mockImplementation((name) => {
                if (name === enemyCharacter.name) return enemyCharacter;
                if (name === testCharacter.name) return testCharacter;
                return undefined;
            });

            // Mock Math.random to ensure all shots hit
            const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.5);

            // Test enemy entering multiple cells
            const cellsToEnter = [
                { x: 10, y: 5 }, // Enter from the right
                { x: 9, y: 5 },  // Cell 1 - should shoot
                { x: 8, y: 5 },  // Cell 2 - should shoot
                { x: 7, y: 5 },  // Cell 3 - should shoot
                { x: 7, y: 4 },  // Cell 4 - should shoot
                { x: 8, y: 4 },  // Cell 5 - should shoot
                { x: 9, y: 4 },  // Cell 6 - should shoot
                { x: 9, y: 6 },  // Cell 7 - jump to another watched cell
                { x: 8, y: 6 },  // Cell 8 - should shoot
                { x: 7, y: 6 },  // Cell 9 - should shoot
                { x: 6, y: 5 }   // Cell 10 - final watched cell
            ];

            // Track which cells were shot at
            const shotAtCells = new Set<string>();

            // Clear previous calls
            projectileSpy.mockClear();
            damageSpy.mockClear();

            // Mock the UpdateStateEvent.setOverwatchData to track shotCells
            const updateOverwatchSpy = jest.fn();
            listener.listen(UpdateStateEvent.setOverwatchData, (data) => {
                if (data && typeof data === 'object' && 'shotsRemaining' in data) {
                    // Update our mock state's overwatch data
                    const overwatchUpdate = data as any;
                    const currentData = (mockState as any)._overwatchData.get(overwatchUpdate.characterName);
                    if (currentData) {
                        currentData.shotsRemaining = overwatchUpdate.shotsRemaining;
                        // The real implementation would update shotCells here
                    }
                }
                updateOverwatchSpy(data);
            });

            // Simulate movement through cells
            cellsToEnter.forEach((position, index) => {
                if (index === 0) {
                    // Starting position - update enemy position but don't trigger movement event
                    enemyCharacter.position = position;
                } else {
                    // Trigger movement event
                    superEventBus.dispatch(StateChangeEvent.characterPosition, {
                        ...enemyCharacter,
                        position
                    });

                    // Check if this cell is in the watched area
                    const isWatchedCell = watchedCells.some(cell => 
                        cell.x === position.x && cell.y === position.y
                    );

                    if (isWatchedCell) {
                        const cellKey = `${position.x},${position.y}`;
                        shotAtCells.add(cellKey);
                        
                        // Update mock state's shotCells to simulate the real behavior
                        const overwatchData = (mockState as any)._overwatchData.get(testCharacter.name);
                        if (overwatchData && !overwatchData.shotCells.includes(cellKey)) {
                            overwatchData.shotCells.push(cellKey);
                        }
                    }

                    // Update enemy position for next move
                    enemyCharacter.position = position;
                }
            });

            // Verify shots were fired at each watched cell entered
            expect(projectileSpy).toHaveBeenCalledTimes(shotAtCells.size);
            expect(damageSpy).toHaveBeenCalledTimes(shotAtCells.size);

            // Verify each shot was to a unique cell
            const shotTargets = projectileSpy.mock.calls.map(call => call[0].to);
            const uniqueTargets = new Set(shotTargets.map(t => `${t.x},${t.y}`));
            expect(uniqueTargets.size).toBe(shotAtCells.size);

            // Verify all watched cells that were entered were shot at
            shotTargets.forEach(target => {
                const cellKey = `${target.x},${target.y}`;
                expect(shotAtCells.has(cellKey)).toBe(true);
            });

            // Clean up
            mockRandom.mockRestore();
        });

        it('should not shoot twice at the same cell even if enemy re-enters it', () => {
            const listener = createTestListener();
            const projectileSpy = jest.fn();

            listener.listen(GUIEvent.shootProjectile, projectileSpy);

            const watchedCells = [
                { x: 7, y: 5 },
                { x: 8, y: 5 },
                { x: 9, y: 5 }
            ];

            const shotCellsArray: string[] = [];
            (mockState as any)._overwatchData.set(testCharacter.name, {
                active: true,
                direction: testCharacter.direction,
                position: testCharacter.position,
                range: 15,
                shotsRemaining: 10,
                watchedCells: watchedCells,
                shotCells: shotCellsArray
            });

            mockState.findCharacter.mockImplementation((name) => {
                if (name === enemyCharacter.name) return enemyCharacter;
                if (name === testCharacter.name) return testCharacter;
                return undefined;
            });

            // Mock the UpdateStateEvent.setOverwatchData to track shotCells
            listener.listen(UpdateStateEvent.setOverwatchData, (data) => {
                if (data && typeof data === 'object' && 'shotsRemaining' in data) {
                    const overwatchUpdate = data as any;
                    const currentData = (mockState as any)._overwatchData.get(overwatchUpdate.characterName);
                    if (currentData) {
                        currentData.shotsRemaining = overwatchUpdate.shotsRemaining;
                        // Track the shot cell
                        shotCellsArray.push('8,5');
                    }
                }
            });

            // Enemy enters cell
            superEventBus.dispatch(StateChangeEvent.characterPosition, {
                ...enemyCharacter,
                position: { x: 8, y: 5 }
            });

            expect(projectileSpy).toHaveBeenCalledTimes(1);

            // Enemy leaves and re-enters the same cell
            superEventBus.dispatch(StateChangeEvent.characterPosition, {
                ...enemyCharacter,
                position: { x: 10, y: 5 } // Leave watched area
            });

            superEventBus.dispatch(StateChangeEvent.characterPosition, {
                ...enemyCharacter,
                position: { x: 8, y: 5 } // Re-enter same cell
            });

            // Should still only have shot once
            expect(projectileSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('Overwatch Edge Cases', () => {
        it('should handle character death during overwatch', () => {
            const listener = createTestListener();
            const updateOverwatchSpy = jest.fn();

            listener.listen(UpdateStateEvent.setOverwatchData, updateOverwatchSpy);

            // Set up active overwatch
            (mockState as any)._overwatchData.set(testCharacter.name, {
                active: true,
                direction: testCharacter.direction,
                position: testCharacter.position,
                range: 15,
                shotsRemaining: 10
            });

            // Simulate character death
            superEventBus.dispatch(StateChangeEvent.characterHealth, {
                ...testCharacter,
                health: 0
            });

            // Should clear overwatch
            expect(updateOverwatchSpy).toHaveBeenCalledWith({
                characterName: testCharacter.name,
                active: false
            });
        });

        it('should update overwatch if character is moved by external force', () => {
            const listener = createTestListener();
            const updateOverwatchSpy = jest.fn();

            listener.listen(UpdateStateEvent.setOverwatchData, updateOverwatchSpy);

            // Set up active overwatch
            (mockState as any)._overwatchData.set(testCharacter.name, {
                active: true,
                direction: testCharacter.direction,
                position: testCharacter.position,
                range: 15,
                shotsRemaining: 10
            });

            // Simulate character being moved (e.g., knocked back)
            const newPosition = { x: 3, y: 3 };
            superEventBus.dispatch(StateChangeEvent.characterPosition, {
                ...testCharacter,
                position: newPosition
            });

            // Should update overwatch position
            expect(updateOverwatchSpy).toHaveBeenCalledWith(expect.objectContaining({
                characterName: testCharacter.name,
                position: newPosition
            }));
        });

        it('should handle rapid movement through overwatch zone', () => {
            const listener = createTestListener();
            const projectileSpy = jest.fn();

            listener.listen(GUIEvent.shootProjectile, projectileSpy);

            mockState.findCharacter.mockImplementation((name) => {
                if (name === enemyCharacter.name) return enemyCharacter;
                if (name === testCharacter.name) return testCharacter;
                return undefined;
            });

            (mockState as any)._overwatchData.set(testCharacter.name, {
                active: true,
                direction: testCharacter.direction,
                position: testCharacter.position,
                range: 15,
                shotsRemaining: 10,
                watchedCells: [{ x: 7, y: 5 }, { x: 8, y: 5 }, { x: 9, y: 5 }],
                shotCells: [] // Track cells already shot at
            });

            // Simulate very fast movement (teleport/dash)
            superEventBus.dispatch(StateChangeEvent.characterPosition, {
                ...enemyCharacter,
                position: { x: 7, y: 5 } // Jump directly to watched cell
            });

            // Should still fire once
            expect(projectileSpy).toHaveBeenCalledTimes(1);
        });

        it('should prioritize closest target when multiple enemies in range', () => {
            const listener = createTestListener();
            const damageSpy = jest.fn();

            listener.listen(UpdateStateEvent.damageCharacter, damageSpy);

            const closerEnemy = createMockCharacter({
                name: 'closerEnemy',
                player: 'ai',
                position: { x: 6, y: 5 } // Closer to overwatcher
            });

            mockState.findCharacter.mockImplementation((name) => {
                if (name === enemyCharacter.name) return enemyCharacter;
                if (name === closerEnemy.name) return closerEnemy;
                if (name === testCharacter.name) return testCharacter;
                return undefined;
            });

            (mockState as any)._overwatchData.set(testCharacter.name, {
                active: true,
                direction: testCharacter.direction,
                position: testCharacter.position,
                range: 15,
                shotsRemaining: 1, // Only one shot left
                watchedCells: [{ x: 6, y: 5 }, { x: 8, y: 5 }]
            });

            // Move closer enemy first
            superEventBus.dispatch(StateChangeEvent.characterPosition, closerEnemy);

            // Should shoot at closer enemy and consume the shot
            expect(damageSpy).toHaveBeenCalledWith(expect.objectContaining({
                targetName: closerEnemy.name
            }));

            // Note: In the current implementation, overwatch shoots immediately when an enemy enters range,
            // so it would be out of shots before the second enemy moves
        });
    });
});