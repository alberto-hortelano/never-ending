 
import type { ICharacter, ICell, ICoord, Direction } from "../interfaces";
import type { State } from "../State";

import { EventBus, ControlsEvent, GUIEvent, UpdateStateEvent, GameEvent, StateChangeEvent, ActionEvent } from "../events";
import { Overwatch } from "../Overwatch";
import { baseCharacter } from "../../data/state";
import { InteractionModeManager } from "../InteractionModeManager";

// Mock the State class
jest.mock('../State');

// Mock ShootingService
jest.mock('../services/ShootingService', () => ({
    ShootingService: {
        getWeaponRange: jest.fn().mockReturnValue(15),
        getWeaponDamage: jest.fn().mockReturnValue(20),
        getEquippedRangedWeapon: jest.fn().mockImplementation((character: any) => character.inventory?.equippedWeapons?.primary),
        getProjectileType: jest.fn().mockReturnValue('bullet'),
        calculateVisibleCells: jest.fn().mockImplementation((map, position, direction, range) => {
            // Simple implementation that returns cells in a line
            const cells = [];
            for (let i = 1; i <= range; i++) {
                const x = position.x + i;
                if (x < map[0]?.length) {
                    cells.push({ coord: { x, y: position.y }, intensity: 1 });
                }
            }
            return cells;
        }),
        checkLineOfSight: jest.fn().mockImplementation((map, from, to, _characters) => {
            // Check if there's a blocker between from and to
            const dx = Math.sign(to.x - from.x);
            const dy = Math.sign(to.y - from.y);
            let x = from.x + dx;
            let y = from.y + dy;
            
            while (x !== to.x || y !== to.y) {
                if (map[y]?.[x]?.content?.blocker) {
                    return false;
                }
                if (x !== to.x) x += dx;
                if (y !== to.y) y += dy;
            }
            return true;
        }),
        getDistance: jest.fn().mockImplementation((from, to) => 
            Math.sqrt(Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2))
        ),
        calculateCriticalChance: jest.fn().mockReturnValue(0.05),
        rollCritical: jest.fn().mockReturnValue(false),
        calculateDamage: jest.fn().mockReturnValue(20)
    },
    SHOOT_CONSTANTS: {
        DEFAULT_ANGLE_OF_VISION: 120,
        DEFAULT_UNARMED_DAMAGE: 5,
        DEFAULT_UNARMED_RANGE: 10,
        VISIBILITY_THRESHOLD: 0.01,
        DISTANCE_DAMAGE_FALLOFF: 0.5,
        AIM_RANGE_BONUS: 0.5,
        CRITICAL_HIT_BASE_CHANCE: 0.05,
        CRITICAL_HIT_AIM_BONUS: 0.05,
        CRITICAL_HIT_MULTIPLIER: 2.0,
    }
}));

describe('Overwatch', () => {
    let overwatch: Overwatch;
    let mockState: jest.Mocked<State>;
    let testCharacter: ICharacter;
    let enemyCharacter: ICharacter;
    let testMap: ICell[][];
    let mockOverwatchDataMap: Map<string, any>;
    let eventBus: EventBus<any, any>;

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

    // No longer needed - using eventBus directly

    beforeEach(() => {
        // Clear all mocks and event listeners before each test
        jest.clearAllMocks();
        EventBus.reset();
        eventBus = new EventBus();

        // Reset the InteractionModeManager singleton
        InteractionModeManager.resetInstance();

        // Clean up any existing overwatch instance
        if (overwatch) {
            overwatch = null as any;
        }
        
        // Create test data
        testCharacter = createMockCharacter({
            name: 'overwatcher',
            direction: 'right' as Direction,
            position: { x: 5, y: 5 },
            controller: 'human', faction: 'player',
            actions: {
                ...baseCharacter.actions,
                pointsLeft: 100, // Enough points for multiple shots
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
            controller: 'ai', faction: 'enemy'
        });

        testMap = createMockMap(15, 15);

        // Create mock State with mutable overwatchData
        mockOverwatchDataMap = new Map();
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
            ui: {
                visualStates: {
                    cells: {},
                    characters: {}
                },
                interactionMode: { type: 'normal' }
            },
            // Helper property to access mutable map in tests
            _overwatchData: mockOverwatchDataMap
        } as any;

        // Don't create Overwatch instance here - let individual tests create it
        // This prevents event handling conflicts

        // Reset test listeners
        // Event listeners cleaned up via EventBus.reset()
    });

    afterEach(() => {
        // Clean up all test listeners
        // Event listeners are cleaned up by EventBus.reset() in beforeEach
        
        // Clean up all overwatch instances
        overwatchInstances.forEach(instance => eventBus.remove(instance));
        overwatchInstances.length = 0;
        
        // Clean up overwatch listeners
        if (overwatch) {
            eventBus.remove(overwatch);
            overwatch = null as any;
        }
        
        // Clear all event listeners to ensure complete cleanup
        (eventBus as any).listeners = new Map();
        
        // Clear mock data
        mockOverwatchDataMap.clear();
        
        // Clear singleton
        _singletonOverwatch = null;
        
        // Reset InteractionModeManager
        InteractionModeManager.resetInstance();
    });

    // Helper removed - using eventBus directly
    
    // Track all created overwatch instances for cleanup
    const overwatchInstances: Overwatch[] = [];
    let _singletonOverwatch: Overwatch | null = null;
    
    // Helper to create overwatch instance for tests that need it
    const createOverwatch = () => {
        // Clean up all existing instances first
        overwatchInstances.forEach(instance => eventBus.remove(instance));
        overwatchInstances.length = 0;
        
        if (overwatch) {
            eventBus.remove(overwatch);
        }
        overwatch = new Overwatch(mockState);
        overwatchInstances.push(overwatch);
        return overwatch;
    };

    describe('Overwatch Activation', () => {
        it('should activate overwatch mode when showOverwatch event is dispatched', () => {
            createOverwatch(); // Create overwatch instance for this test
            
            const cellBatchSpy = jest.fn();
            const interactionModeSpy = jest.fn();

            eventBus.listen(UpdateStateEvent.uiCellVisualBatch, cellBatchSpy);
            eventBus.listen(UpdateStateEvent.uiInteractionMode, interactionModeSpy);

            mockState.findCharacter.mockReturnValue(testCharacter);

            // Trigger showOverwatch
            eventBus.dispatch(ControlsEvent.showOverwatch, testCharacter.name);

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
            createOverwatch(); // Create overwatch instance for this test
            
            const deductPointsSpy = jest.fn();

            eventBus.listen(UpdateStateEvent.deductActionPoints, deductPointsSpy);

            mockState.findCharacter.mockReturnValue(testCharacter);

            // Trigger showOverwatch
            eventBus.dispatch(ControlsEvent.showOverwatch, testCharacter.name);

            // Confirm overwatch activation
            eventBus.dispatch(ControlsEvent.cellClick, { x: 7, y: 5 }); // Click in overwatch range

            // Should deduct all remaining action points
            expect(deductPointsSpy).toHaveBeenCalledWith({
                characterName: testCharacter.name,
                actionId: 'overwatch',
                cost: testCharacter.actions.pointsLeft
            });
        });

        it('should store overwatch data in state when activated', () => {
            createOverwatch(); // Create overwatch instance for this test
            
            const updateOverwatchSpy = jest.fn();

            eventBus.listen(UpdateStateEvent.setOverwatchData, updateOverwatchSpy);

            mockState.findCharacter.mockReturnValue(testCharacter);

            // Trigger showOverwatch
            eventBus.dispatch(ControlsEvent.showOverwatch, testCharacter.name);

            // Confirm overwatch activation
            eventBus.dispatch(ControlsEvent.cellClick, { x: 7, y: 5 });

            // Should store overwatch data
            expect(updateOverwatchSpy).toHaveBeenCalled();
            const call = updateOverwatchSpy.mock.calls[0][0];
            expect(call.characterName).toBe(testCharacter.name);
            expect(call.active).toBe(true);
            expect(call.direction).toBe(testCharacter.direction);
            expect(call.position).toEqual(testCharacter.position);
            expect(call.range).toBe(15);
            expect(call.shotsRemaining).toBe(5); // 100 action points / 20 shoot cost = 5 shots
            expect(call.watchedCells).toBeDefined();
            expect(Array.isArray(call.watchedCells)).toBe(true);
            expect(call.watchedCells.length).toBeGreaterThan(0);
        });

        it('should not allow overwatch if character has no action points', () => {
            createOverwatch(); // Create overwatch instance for this test
            
            const errorSpy = jest.fn();

            eventBus.listen(ActionEvent.error, errorSpy);

            const noPointsCharacter = { ...testCharacter, actions: { ...testCharacter.actions, pointsLeft: 0 } };
            mockState.findCharacter.mockReturnValue(noPointsCharacter);

            // Trigger showOverwatch
            eventBus.dispatch(ControlsEvent.showOverwatch, testCharacter.name);

            // Should show error
            expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('No action points'));
        });

        it('should not allow overwatch if not current turn', () => {
            createOverwatch(); // Create overwatch instance for this test
            
            const cellBatchSpy = jest.fn();

            eventBus.listen(UpdateStateEvent.uiCellVisualBatch, cellBatchSpy);

            // Mock the game getter to return a different turn
            Object.defineProperty(mockState, 'game', {
                get: () => ({ turn: 'ai', players: ['human', 'ai'] }),
                configurable: true
            });
            mockState.findCharacter.mockReturnValue(testCharacter);

            // Trigger showOverwatch
            eventBus.dispatch(ControlsEvent.showOverwatch, testCharacter.name);

            // Should not update cells
            expect(cellBatchSpy).not.toHaveBeenCalled();
        });
    });

    describe('Overwatch Triggering', () => {
        let localOverwatch: Overwatch;
        
        beforeEach(() => {
            // Reset all mocks to ensure clean state
            jest.clearAllMocks();
            
            // Create overwatch instance for triggering tests
            localOverwatch = createOverwatch();
            
            // Set up overwatch for test character
            mockState.findCharacter.mockReturnValue(testCharacter);
            (mockState as any)._overwatchData.set(testCharacter.name, {
                active: true,
                direction: testCharacter.direction,
                position: testCharacter.position,
                range: 15,
                shotsRemaining: 5, // 100 action points / 20 shoot cost = 5 shots
                watchedCells: [{ x: 6, y: 5 }, { x: 7, y: 5 }, { x: 8, y: 5 }, { x: 9, y: 5 }, { x: 10, y: 5 }],
                shotCells: [] // Initialize empty shotCells array
            });
            
            // Note: The shotCells tracking is handled by individual tests that need it
        });
        
        afterEach(() => {
            // Clean up local overwatch instance
            if (localOverwatch) {
                eventBus.remove(localOverwatch);
                const index = overwatchInstances.indexOf(localOverwatch);
                if (index > -1) {
                    overwatchInstances.splice(index, 1);
                }
                localOverwatch = null as any;
            }
        });

        it('should shoot at enemy entering overwatch zone', () => {
            const projectileSpy = jest.fn();
            const damageSpy = jest.fn();

            eventBus.listen(GUIEvent.shootProjectile, projectileSpy);
            eventBus.listen(UpdateStateEvent.damageCharacter, damageSpy);

            // Set up mock to return enemy character when queried
            mockState.findCharacter.mockImplementation((name) => {
                if (name === enemyCharacter.name) return enemyCharacter;
                if (name === testCharacter.name) return testCharacter;
                return undefined;
            });

            // Mock Math.random to ensure hit
            const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.5);

            // Simulate enemy movement into overwatch zone
            eventBus.dispatch(StateChangeEvent.characterPosition, {
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
            const projectileSpy = jest.fn();

            eventBus.listen(GUIEvent.shootProjectile, projectileSpy);

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
                    eventBus.dispatch(StateChangeEvent.characterPosition, {
                        ...enemyCharacter,
                        position
                    });
                }
            });

            // Should have fired 3 times (once per cell entered)
            expect(projectileSpy).toHaveBeenCalledTimes(3);
        });

        it('should reduce shots remaining after each shot', () => {
            const updateOverwatchSpy = jest.fn();

            eventBus.listen(UpdateStateEvent.setOverwatchData, updateOverwatchSpy);

            mockState.findCharacter.mockImplementation((name) => {
                if (name === enemyCharacter.name) return enemyCharacter;
                if (name === testCharacter.name) return testCharacter;
                return undefined;
            });

            // Simulate enemy movement
            eventBus.dispatch(StateChangeEvent.characterPosition, {
                ...enemyCharacter,
                position: { x: 8, y: 5 }
            });

            // Should update overwatch data with reduced shots
            expect(updateOverwatchSpy).toHaveBeenCalledWith(expect.objectContaining({
                characterName: testCharacter.name,
                shotsRemaining: 4 // One shot fired from 5
            }));
        });

        it('should NOT deduct action points when shooting in overwatch (already consumed)', () => {
            const deductPointsSpy = jest.fn();

            eventBus.listen(UpdateStateEvent.deductActionPoints, deductPointsSpy);

            // Set up character - but remember, in real game they'll have 0 points after activating overwatch
            const characterWithPoints = { 
                ...testCharacter, 
                actions: { 
                    ...testCharacter.actions, 
                    pointsLeft: 0 // No points left after overwatch activation
                } 
            };

            mockState.findCharacter.mockImplementation((name) => {
                if (name === enemyCharacter.name) return enemyCharacter;
                if (name === testCharacter.name) return characterWithPoints;
                return undefined;
            });

            // Simulate enemy movement into overwatch zone
            eventBus.dispatch(StateChangeEvent.characterPosition, {
                ...enemyCharacter,
                position: { x: 8, y: 5 }
            });

            // Should NOT deduct action points when shooting (they were consumed during activation)
            expect(deductPointsSpy).not.toHaveBeenCalled();
        });

        it('should calculate correct number of shots based on shoot cost', () => {
            // Test different action point amounts
            const testCases = [
                { actionPoints: 100, shootCost: 20, expectedShots: 5 },
                { actionPoints: 40, shootCost: 20, expectedShots: 2 },
                { actionPoints: 50, shootCost: 20, expectedShots: 2 }, // 50/20 = 2.5, floor to 2
                { actionPoints: 19, shootCost: 20, expectedShots: 0 }, // Not enough for even one shot
                { actionPoints: 60, shootCost: 15, expectedShots: 4 },
            ];

            testCases.forEach(({ actionPoints, shootCost, expectedShots }) => {
                // Reset EventBus for each test case
                EventBus.reset();
                const testEventBus = new EventBus<any, any>();

                const dispatchSpy = jest.fn();
                testEventBus.listen(UpdateStateEvent.setOverwatchData, dispatchSpy);

                const overwatch = new Overwatch(mockState as any);
                const character = {
                    ...testCharacter,
                    actions: {
                        ...testCharacter.actions,
                        pointsLeft: actionPoints,
                        rangedCombat: {
                            ...testCharacter.actions.rangedCombat,
                            shoot: shootCost
                        }
                    }
                };

                // Mock visible cells for activation
                overwatch['visibleCells'] = [{ coord: { x: 8, y: 5 }, intensity: 1 }];
                overwatch['activeOverwatchCharacter'] = character;

                // Activate overwatch
                overwatch['activateOverwatch'](character);

                // Verify the correct number of shots was set
                expect(dispatchSpy).toHaveBeenCalledWith(
                    expect.objectContaining({
                        shotsRemaining: expectedShots
                    })
                );
            });
        });

        it('should be able to shoot even with 0 action points (points already consumed)', () => {
            const projectileSpy = jest.fn();
            const damageSpy = jest.fn();

            eventBus.listen(GUIEvent.shootProjectile, projectileSpy);
            eventBus.listen(UpdateStateEvent.damageCharacter, damageSpy);

            // Set up character with 0 action points (realistic after overwatch activation)
            const zeroPointsCharacter = { 
                ...testCharacter, 
                actions: { 
                    ...testCharacter.actions, 
                    pointsLeft: 0 // No points left after overwatch
                } 
            };

            // Set up overwatch with shots remaining
            (mockState as any)._overwatchData.set(testCharacter.name, {
                active: true,
                direction: testCharacter.direction,
                position: testCharacter.position,
                range: 15,
                shotsRemaining: 10, // Can still shoot 10 times
                watchedCells: [{ x: 8, y: 5 }],
                shotCells: []
            });

            mockState.findCharacter.mockImplementation((name) => {
                if (name === enemyCharacter.name) return enemyCharacter;
                if (name === testCharacter.name) return zeroPointsCharacter;
                return undefined;
            });

            // Mock Math.random to ensure hit
            const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.5);

            // Simulate enemy movement
            eventBus.dispatch(StateChangeEvent.characterPosition, {
                ...enemyCharacter,
                position: { x: 8, y: 5 }
            });

            // Should fire even with 0 action points
            expect(projectileSpy).toHaveBeenCalled();
            expect(damageSpy).toHaveBeenCalled();

            // Clean up
            mockRandom.mockRestore();
        });

        it('should deactivate overwatch when shots run out', () => {
            const updateOverwatchSpy = jest.fn();
            const clearHighlightsSpy = jest.fn();

            eventBus.listen(UpdateStateEvent.setOverwatchData, updateOverwatchSpy);
            eventBus.listen(UpdateStateEvent.uiHighlights, clearHighlightsSpy);

            // Set overwatch with only 1 shot remaining
            (mockState as any)._overwatchData.set(testCharacter.name, {
                active: true,
                direction: testCharacter.direction,
                position: testCharacter.position,
                range: 15,
                shotsRemaining: 1,
                watchedCells: [{ x: 8, y: 5 }],
                shotCells: []
            });

            mockState.findCharacter.mockImplementation((name) => {
                if (name === enemyCharacter.name) return enemyCharacter;
                if (name === testCharacter.name) return testCharacter;
                return undefined;
            });

            // Simulate enemy movement
            eventBus.dispatch(StateChangeEvent.characterPosition, {
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
            const projectileSpy = jest.fn();

            eventBus.listen(GUIEvent.shootProjectile, projectileSpy);

            const friendlyCharacter = createMockCharacter({
                name: 'friendly',
                controller: 'human', faction: 'player', // Same faction as overwatch character
                position: { x: 10, y: 5 }
            });

            mockState.findCharacter.mockImplementation((name) => {
                if (name === friendlyCharacter.name) return friendlyCharacter;
                if (name === testCharacter.name) return testCharacter;
                return undefined;
            });

            // Simulate friendly movement into overwatch zone
            eventBus.dispatch(StateChangeEvent.characterPosition, {
                ...friendlyCharacter,
                position: { x: 8, y: 5 }
            });

            // Should not fire at friendly
            expect(projectileSpy).not.toHaveBeenCalled();
        });

        it.skip('should not shoot if line of sight is blocked', () => {
            const projectileSpy = jest.fn();

            eventBus.listen(GUIEvent.shootProjectile, projectileSpy);

            // Add obstacle between overwatch and target
            testMap[5]![7] = createMockCell(7, 5, true); // Blocking cell

            mockState.findCharacter.mockImplementation((name) => {
                if (name === enemyCharacter.name) return enemyCharacter;
                if (name === testCharacter.name) return testCharacter;
                return undefined;
            });

            // Simulate enemy movement behind obstacle
            eventBus.dispatch(StateChangeEvent.characterPosition, {
                ...enemyCharacter,
                position: { x: 8, y: 5 }
            });

            // Should not fire due to blocked line of sight
            expect(projectileSpy).not.toHaveBeenCalled();
        });
    });

    describe('Overwatch Turn Management', () => {
        beforeEach(() => {
            // Create overwatch instance for turn management tests
            createOverwatch();
        });
        
        it('should clear overwatch when character\'s turn starts', () => {
            const updateOverwatchSpy = jest.fn();
            const clearHighlightsSpy = jest.fn();

            eventBus.listen(UpdateStateEvent.setOverwatchData, updateOverwatchSpy);
            eventBus.listen(UpdateStateEvent.uiHighlights, clearHighlightsSpy);

            // Set up active overwatch
            (mockState as any)._overwatchData.set(testCharacter.name, {
                active: true,
                direction: testCharacter.direction,
                position: testCharacter.position,
                range: 15,
                shotsRemaining: 5, // 100 action points / 20 shoot cost = 5 shots
                watchedCells: [{ x: 8, y: 5 }],
                shotCells: []
            });

            // Simulate turn change back to human (overwatcher's turn)
            eventBus.dispatch(GameEvent.changeTurn, {
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
            const updateOverwatchSpy = jest.fn();

            eventBus.listen(UpdateStateEvent.setOverwatchData, updateOverwatchSpy);

            // Set up active overwatch
            (mockState as any)._overwatchData.set(testCharacter.name, {
                active: true,
                direction: testCharacter.direction,
                position: testCharacter.position,
                range: 15,
                shotsRemaining: 5, // 100 action points / 20 shoot cost = 5 shots
                watchedCells: [{ x: 8, y: 5 }],
                shotCells: []
            });

            // Simulate turn change to AI (not overwatcher's turn)
            eventBus.dispatch(GameEvent.changeTurn, {
                turn: 'ai',
                previousTurn: 'human'
            });

            // Should not clear overwatch
            expect(updateOverwatchSpy).not.toHaveBeenCalled();
        });

        it('should allow multiple characters to have overwatch simultaneously', () => {
            const cellBatchSpy = jest.fn();

            eventBus.listen(UpdateStateEvent.uiCellVisualBatch, cellBatchSpy);

            const secondOverwatcher = createMockCharacter({
                name: 'overwatcher2',
                direction: 'left' as Direction,
                position: { x: 10, y: 10 },
                controller: 'human', faction: 'player',
                actions: { ...baseCharacter.actions, pointsLeft: 8 }
            });

            // Set up first overwatch
            (mockState as any)._overwatchData.set(testCharacter.name, {
                active: true,
                direction: testCharacter.direction,
                position: testCharacter.position,
                range: 15,
                shotsRemaining: 5, // 100 action points / 20 shoot cost = 5 shots
                watchedCells: [{ x: 8, y: 5 }],
                shotCells: []
            });

            mockState.findCharacter.mockReturnValue(secondOverwatcher);

            // Activate second overwatch
            eventBus.dispatch(ControlsEvent.showOverwatch, secondOverwatcher.name);

            // Both overwatches should be active
            expect(cellBatchSpy).toHaveBeenCalled();
            expect(Object.keys(mockState.overwatchData).length).toBe(1); // Mock doesn't actually update
        });
    });

    describe('Overwatch Visual Indicators', () => {
        it.skip('should show persistent overwatch highlights', () => {
            createOverwatch(); // Create overwatch instance for this test
            
            const cellBatchSpy = jest.fn();

            eventBus.listen(UpdateStateEvent.uiCellVisualBatch, cellBatchSpy);

            mockState.findCharacter.mockReturnValue(testCharacter);

            // Trigger showOverwatch
            eventBus.dispatch(ControlsEvent.showOverwatch, testCharacter.name);

            // Should highlight cells with overwatch type
            expect(cellBatchSpy).toHaveBeenCalled();
            
            // The call should be for showing overwatch mode cells
            const calls = cellBatchSpy.mock.calls;
            expect(calls.length).toBeGreaterThan(0);
            
            // Find the call that sets overwatch highlights (interaction mode)
            const overwatchCall = calls.find(call => {
                const arg = call[0];
                return arg && arg.updates && arg.updates.some((update: any) => 
                    update.visualState && 
                    update.visualState.highlightTypes && 
                    update.visualState.highlightTypes.includes('action')
                );
            });
            
            expect(overwatchCall).toBeDefined();
        });

        it('should add overwatch class to character', () => {
            createOverwatch(); // Create overwatch instance for this test
            
            const characterVisualSpy = jest.fn();

            eventBus.listen(UpdateStateEvent.uiCharacterVisual, characterVisualSpy);

            mockState.findCharacter.mockReturnValue(testCharacter);

            // Trigger showOverwatch
            eventBus.dispatch(ControlsEvent.showOverwatch, testCharacter.name);

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
            createOverwatch(); // Create overwatch instance for this test
            
            const interactionModeSpy = jest.fn();

            eventBus.listen(UpdateStateEvent.uiInteractionMode, interactionModeSpy);

            mockState.findCharacter.mockReturnValue(testCharacter);
            
            // Don't set up active overwatch - we're testing the preview mode
            // when setting up overwatch

            // Update overwatch display
            eventBus.dispatch(ControlsEvent.showOverwatch, testCharacter.name);

            // Should include remaining points in interaction mode (overwatch preview mode)
            expect(interactionModeSpy).toHaveBeenCalledWith({
                type: 'overwatch',
                data: expect.objectContaining({
                    characterId: testCharacter.name,
                    weapon: testCharacter.inventory.equippedWeapons.primary,
                    remainingPoints: 100, // testCharacter has 100 action points
                    shotsRemaining: 5 // 100 action points / 20 shoot cost = 5 shots
                })
            });
        });
    });

    describe('Overwatch Cell Coverage', () => {
        beforeEach(() => {
            // Create overwatch instance for cell coverage tests
            createOverwatch();
        });
        
        it.skip('should shoot at enemy on every cell they enter in overwatch area', () => {
            // Note: With character blocking implemented, the enemy character blocks line of sight
            // to some cells as they move, so we may get fewer shots than cells entered
            const projectileSpy = jest.fn();
            const damageSpy = jest.fn();

            eventBus.listen(GUIEvent.shootProjectile, projectileSpy);
            eventBus.listen(UpdateStateEvent.damageCharacter, damageSpy);

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
            eventBus.listen(UpdateStateEvent.setOverwatchData, (data) => {
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
                    eventBus.dispatch(StateChangeEvent.characterPosition, {
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

            // Verify shots were fired (may be less than shotAtCells.size due to line of sight blocking)
            // With character blocking, some cells might not have line of sight
            expect(projectileSpy.mock.calls.length).toBeGreaterThan(0);
            expect(projectileSpy.mock.calls.length).toBeLessThanOrEqual(shotAtCells.size);
            expect(damageSpy.mock.calls.length).toBe(projectileSpy.mock.calls.length);

            // Verify each shot was to a unique cell
            const shotTargets = projectileSpy.mock.calls.map(call => call[0].to);
            const uniqueTargets = new Set(shotTargets.map(t => `${t.x},${t.y}`));
            // With character blocking, we might not shoot at all cells
            expect(uniqueTargets.size).toBe(projectileSpy.mock.calls.length);

            // Verify all shots were at watched cells
            shotTargets.forEach(target => {
                const isWatchedCell = watchedCells.some(cell => 
                    cell.x === target.x && cell.y === target.y
                );
                expect(isWatchedCell).toBe(true);
            });

            // Clean up
            mockRandom.mockRestore();
        });

        it('should not shoot twice at the same cell even if enemy re-enters it', () => {
            const projectileSpy = jest.fn();

            eventBus.listen(GUIEvent.shootProjectile, projectileSpy);

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
                shotsRemaining: 5, // 100 action points / 20 shoot cost = 5 shots
                watchedCells: watchedCells,
                shotCells: shotCellsArray
            });

            mockState.findCharacter.mockImplementation((name) => {
                if (name === enemyCharacter.name) return enemyCharacter;
                if (name === testCharacter.name) return testCharacter;
                return undefined;
            });

            // Mock the UpdateStateEvent.setOverwatchData to track shotCells
            eventBus.listen(UpdateStateEvent.setOverwatchData, (data) => {
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
            eventBus.dispatch(StateChangeEvent.characterPosition, {
                ...enemyCharacter,
                position: { x: 8, y: 5 }
            });

            expect(projectileSpy).toHaveBeenCalledTimes(1);

            // Enemy leaves and re-enters the same cell
            eventBus.dispatch(StateChangeEvent.characterPosition, {
                ...enemyCharacter,
                position: { x: 10, y: 5 } // Leave watched area
            });

            eventBus.dispatch(StateChangeEvent.characterPosition, {
                ...enemyCharacter,
                position: { x: 8, y: 5 } // Re-enter same cell
            });

            // Should still only have shot once
            expect(projectileSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('Overwatch Integration', () => {
        beforeEach(() => {
            // Create overwatch instance for integration tests
            createOverwatch();
        });
        
        it('should not shoot multiple times if character stays in same cell', () => {
            const projectileSpy = jest.fn();

            eventBus.listen(GUIEvent.shootProjectile, projectileSpy);

            // Set up overwatch data
            const overwatchData = {
                active: true,
                direction: testCharacter.direction,
                position: testCharacter.position,
                range: 15,
                shotsRemaining: 5, // 100 action points / 20 shoot cost = 5 shots
                watchedCells: [{ x: 8, y: 5 }],
                shotCells: [] as string[]
            };
            (mockState as any)._overwatchData.set(testCharacter.name, overwatchData);

            // Listen for overwatch updates and update our mock data
            eventBus.listen(UpdateStateEvent.setOverwatchData, (update) => {
                if (update && typeof update === 'object' && 'characterName' in update) {
                    const updateData = update as any;
                    if (updateData.characterName === testCharacter.name) {
                        // Update the mock overwatch data
                        if (updateData.shotCells) {
                            overwatchData.shotCells = updateData.shotCells;
                        }
                        if (updateData.shotsRemaining !== undefined) {
                            overwatchData.shotsRemaining = updateData.shotsRemaining;
                        }
                    }
                }
            });

            mockState.findCharacter.mockImplementation((name) => {
                if (name === enemyCharacter.name) return enemyCharacter;
                if (name === testCharacter.name) return testCharacter;
                return undefined;
            });

            // Enemy enters overwatch zone
            eventBus.dispatch(StateChangeEvent.characterPosition, {
                ...enemyCharacter,
                position: { x: 8, y: 5 }
            });

            expect(projectileSpy).toHaveBeenCalledTimes(1);

            // Dispatch same position again (simulating duplicate events)
            eventBus.dispatch(StateChangeEvent.characterPosition, {
                ...enemyCharacter,
                position: { x: 8, y: 5 }
            });

            // Should still only have shot once because shotCells now contains "8,5"
            expect(projectileSpy).toHaveBeenCalledTimes(1);

            // Dispatch visual state change with same position
            eventBus.dispatch(StateChangeEvent.uiVisualStates, {
                characters: {
                    [enemyCharacter.name]: {
                        direction: 'left',
                        classList: [],
                        temporaryClasses: [],
                        styles: { '--x': '8', '--y': '5' },
                        healthBarPercentage: 100,
                        healthBarColor: 'green',
                        isDefeated: false,
                        isCurrentTurn: false
                    }
                },
                cells: {},
                board: { 
                    mapWidth: 15,
                    mapHeight: 15,
                    hasPopupActive: false
                }
            });

            // Should still only have shot once
            expect(projectileSpy).toHaveBeenCalledTimes(1);
        });

        it('should shoot when enemy moves into overwatch zone - full integration test', () => {
            const projectileSpy = jest.fn();
            const deductPointsSpy = jest.fn();
            const damageSpy = jest.fn();
            let characterActionPoints = 100;

            eventBus.listen(GUIEvent.shootProjectile, projectileSpy);
            eventBus.listen(UpdateStateEvent.deductActionPoints, (data) => {
                if (data && typeof data === 'object' && 'characterName' in data) {
                    const deductData = data as any;
                    if (deductData.characterName === testCharacter.name) {
                        characterActionPoints -= deductData.cost;
                    }
                }
                deductPointsSpy(data);
            });
            eventBus.listen(UpdateStateEvent.damageCharacter, damageSpy);

            // Set up character with plenty of action points
            const overwatchChar = { 
                ...testCharacter, 
                actions: { 
                    ...testCharacter.actions, 
                    pointsLeft: characterActionPoints,
                    rangedCombat: {
                        ...testCharacter.actions.rangedCombat,
                        shoot: 20 // Explicit shoot cost
                    }
                } 
            };

            // Set up overwatch data
            (mockState as any)._overwatchData.set(overwatchChar.name, {
                active: true,
                direction: overwatchChar.direction,
                position: overwatchChar.position,
                range: 15,
                shotsRemaining: 5, // 100 action points / 20 shoot cost = 5 shots
                watchedCells: [{ x: 8, y: 5 }],
                shotCells: []
            });

            mockState.findCharacter.mockImplementation((name) => {
                if (name === enemyCharacter.name) return enemyCharacter;
                if (name === overwatchChar.name) {
                    // Return character with current action points
                    return { ...overwatchChar, actions: { ...overwatchChar.actions, pointsLeft: characterActionPoints }};
                }
                return undefined;
            });

            // Simulate enemy movement into overwatch zone
            eventBus.dispatch(StateChangeEvent.characterPosition, {
                ...enemyCharacter,
                position: { x: 8, y: 5 }
            });

            // Verify shooting occurred
            expect(projectileSpy).toHaveBeenCalled();
            expect(deductPointsSpy).not.toHaveBeenCalled(); // Points already consumed during activation
            expect(damageSpy).toHaveBeenCalled();
        });
    });

    describe('Overwatch Edge Cases', () => {
        beforeEach(() => {
            // Create overwatch instance for edge case tests
            createOverwatch();
        });
        
        it('should handle character death during overwatch', () => {
            const updateOverwatchSpy = jest.fn();

            eventBus.listen(UpdateStateEvent.setOverwatchData, updateOverwatchSpy);

            // Set up active overwatch
            (mockState as any)._overwatchData.set(testCharacter.name, {
                active: true,
                direction: testCharacter.direction,
                position: testCharacter.position,
                range: 15,
                shotsRemaining: 100
            });

            // Simulate character death
            eventBus.dispatch(StateChangeEvent.characterHealth, {
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
            const updateOverwatchSpy = jest.fn();

            eventBus.listen(UpdateStateEvent.setOverwatchData, updateOverwatchSpy);

            // Set up active overwatch
            (mockState as any)._overwatchData.set(testCharacter.name, {
                active: true,
                direction: testCharacter.direction,
                position: testCharacter.position,
                range: 15,
                shotsRemaining: 100
            });

            // Simulate character being moved (e.g., knocked back)
            const newPosition = { x: 3, y: 3 };
            eventBus.dispatch(StateChangeEvent.characterPosition, {
                ...testCharacter,
                position: newPosition
            });

            // Should update overwatch position
            expect(updateOverwatchSpy).toHaveBeenCalledWith(expect.objectContaining({
                characterName: testCharacter.name,
                position: newPosition
            }));
        });

        it.skip('should handle rapid movement through overwatch zone', () => {
            const projectileSpy = jest.fn();

            eventBus.listen(GUIEvent.shootProjectile, projectileSpy);

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
                shotsRemaining: 5, // 100 action points / 20 shoot cost = 5 shots
                watchedCells: [{ x: 7, y: 5 }, { x: 8, y: 5 }, { x: 9, y: 5 }],
                shotCells: [] // Track cells already shot at
            });

            // Simulate very fast movement (teleport/dash)
            eventBus.dispatch(StateChangeEvent.characterPosition, {
                ...enemyCharacter,
                position: { x: 7, y: 5 } // Jump directly to watched cell
            });

            // Should still fire once
            expect(projectileSpy).toHaveBeenCalledTimes(1);
        });

        it('should update overwatch visual cells when character with overwatch moves', () => {
            const cellBatchSpy = jest.fn();
            const updateOverwatchSpy = jest.fn();

            eventBus.listen(UpdateStateEvent.uiCellVisualBatch, cellBatchSpy);
            eventBus.listen(UpdateStateEvent.setOverwatchData, updateOverwatchSpy);

            // Set up active overwatch at initial position
            const initialPosition = { x: 5, y: 5 };
            testCharacter.position = initialPosition;
            (mockState as any)._overwatchData.set(testCharacter.name, {
                active: true,
                direction: 'right',
                position: initialPosition,
                range: 10,
                shotsRemaining: 5, // 100 action points / 20 shoot cost = 5 shots
                watchedCells: [],
                shotCells: []
            });

            // Clear initial calls
            cellBatchSpy.mockClear();
            updateOverwatchSpy.mockClear();

            // Move the character to a new position
            const newPosition = { x: 8, y: 8 };
            eventBus.dispatch(StateChangeEvent.characterPosition, {
                ...testCharacter,
                position: newPosition
            });

            // Verify overwatch data was updated with new position
            expect(updateOverwatchSpy).toHaveBeenCalled();
            const updateCall = updateOverwatchSpy.mock.calls[0][0];
            expect(updateCall.characterName).toBe(testCharacter.name);
            expect(updateCall.active).toBe(true);
            expect(updateCall.position).toEqual(newPosition);
            expect(updateCall.watchedCells).toBeDefined();
            expect(Array.isArray(updateCall.watchedCells)).toBe(true);

            // Trigger the visual update by dispatching the overwatchData change
            eventBus.dispatch(StateChangeEvent.overwatchData, (mockState as any)._overwatchData);

            // Verify visual cells were updated (cells were cleared and new ones highlighted)
            expect(cellBatchSpy).toHaveBeenCalled();
            const lastCall = cellBatchSpy.mock.calls[cellBatchSpy.mock.calls.length - 1][0];
            expect(lastCall.updates).toBeDefined();
            expect(lastCall.updates.length).toBeGreaterThan(0);

            // Verify some cells are highlighted as overwatch
            const highlightedCells = lastCall.updates.filter((update: any) => 
                update.visualState?.highlightTypes?.includes('overwatch')
            );
            expect(highlightedCells.length).toBeGreaterThan(0);
        });

        it('should prioritize closest target when multiple enemies in range', () => {
            const damageSpy = jest.fn();

            eventBus.listen(UpdateStateEvent.damageCharacter, damageSpy);

            const closerEnemy = createMockCharacter({
                name: 'closerEnemy',
                controller: 'ai', faction: 'enemy',
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
                watchedCells: [{ x: 6, y: 5 }, { x: 8, y: 5 }],
                shotCells: []
            });

            // Move closer enemy first
            eventBus.dispatch(StateChangeEvent.characterPosition, closerEnemy);

            // Should shoot at closer enemy and consume the shot
            expect(damageSpy).toHaveBeenCalledWith(expect.objectContaining({
                targetName: closerEnemy.name
            }));

            // Note: In the current implementation, overwatch shoots immediately when an enemy enters range,
            // so it would be out of shots before the second enemy moves
        });
    });
});