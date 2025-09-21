 
import type { ICharacter, ICell, Direction } from "../interfaces";
import type { State } from "../State";

import { EventBus, ControlsEvent, UpdateStateEvent } from "../events";
import { Overwatch } from "../Overwatch";
import { Movement } from "../Movement";
import { baseCharacter } from "../../data/state";

// Mock the State class
jest.mock('../State');

describe('Overwatch Movement Mode Conflict', () => {
    let overwatch: Overwatch;
    let movement: Movement;
    let mockState: jest.Mocked<State>;
    let testCharacter: ICharacter;
    let testMap: ICell[][];
    let eventBus: EventBus<any, any>;

    // Helper function to create a mock character
    const createMockCharacter = (overrides: Partial<ICharacter> = {}): ICharacter => ({
        ...baseCharacter,
        health: 100,
        maxHealth: 100,
        ...overrides
    });

    // Helper function to create a mock cell
    const createMockCell = (x: number, y: number): ICell => ({
        position: { x, y },
        locations: [],
        elements: [],
        content: null
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

    // Helper removed - using eventBus directly

    beforeEach(() => {
        // Clear all mocks and event listeners before each test
        jest.clearAllMocks();
        EventBus.reset();
        eventBus = new EventBus();

        // Create test data
        testCharacter = createMockCharacter({
            name: 'testCharacter',
            direction: 'right' as Direction,
            position: { x: 5, y: 5 },
            player: 'human',
            actions: {
                ...baseCharacter.actions,
                pointsLeft: 10,
                general: {
                    ...baseCharacter.actions.general,
                    move: 1
                },
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

        testMap = createMockMap(15, 15);

        // Create mock State
        const mockOverwatchDataMap = new Map();
        let mockInteractionMode = { type: 'normal' as const };
        mockState = {
            map: testMap,
            findCharacter: jest.fn(),
            get game() {
                return {
                    turn: 'human',
                    players: ['human', 'ai']
                };
            },
            characters: [testCharacter],
            get overwatchData() {
                const obj: any = {};
                mockOverwatchDataMap.forEach((value, key) => {
                    obj[key] = value;
                });
                return obj;
            },
            get ui() {
                return {
                    interactionMode: mockInteractionMode,
                    visualStates: {
                        cells: {},
                        characters: {}
                    },
                    highlights: {}
                };
            },
            _setInteractionMode: (mode: any) => { mockInteractionMode = mode; },
            _overwatchData: mockOverwatchDataMap
        } as any;

        // Create instances
        overwatch = new Overwatch(mockState);
        movement = new Movement(mockState);

        // Event listeners cleaned up via EventBus.reset()
    });

    afterEach(() => {
        // Event listeners cleaned up via EventBus.reset() in beforeEach
        // Clean up service listeners
        eventBus.remove(overwatch);
        movement.destroy();
    });

    // Helper to create a test listener and track it
    // Helper removed - using eventBus directly

    describe('Bug: Movement mode interferes with Overwatch activation', () => {
        it('should reproduce the bug when selecting character then clicking overwatch', () => {
            const interactionModeSpy = jest.fn();
            const highlightsSpy = jest.fn();
            const cellVisualSpy = jest.fn();

            eventBus.listen(UpdateStateEvent.uiInteractionMode, interactionModeSpy);
            eventBus.listen(UpdateStateEvent.uiHighlights, highlightsSpy);
            eventBus.listen(UpdateStateEvent.uiCellVisualBatch, cellVisualSpy);

            mockState.findCharacter.mockReturnValue(testCharacter);

            // Step 1: Character is selected, which automatically shows movement
            // (simulating what happens in BottomBar when a character is selected)
            eventBus.dispatch(ControlsEvent.showMovement, testCharacter.name);
            
            // Update the mock state to reflect movement mode
            (mockState as any)._setInteractionMode({ type: 'moving', data: { characterId: testCharacter.name } });

            // Verify movement mode is active
            expect(interactionModeSpy).toHaveBeenCalledWith({
                type: 'moving',
                data: { characterId: testCharacter.name }
            });

            // Verify movement cells are highlighted (with proper matcher)
            const movementHighlightCall = highlightsSpy.mock.calls.find(call =>
                call[0].reachableCells && call[0].reachableCells.length > 0
            );
            expect(movementHighlightCall).toBeTruthy();

            // Clear spies
            interactionModeSpy.mockClear();
            highlightsSpy.mockClear();
            cellVisualSpy.mockClear();

            // Step 2: User clicks overwatch without moving
            eventBus.dispatch(ControlsEvent.showOverwatch, testCharacter.name);

            // Check if overwatch mode was set
            const overwatchModeCall = interactionModeSpy.mock.calls.find(call => 
                call[0].type === 'overwatch'
            );

            // Verify the bug: movement mode might interfere
            expect(overwatchModeCall).toBeTruthy();
            
            // Check if overwatch cells are highlighted
            const overwatchCellsCall = cellVisualSpy.mock.calls.find(call =>
                call[0].updates?.some((update: any) => 
                    update.visualState?.highlightTypes?.includes('overwatch')
                )
            );

            expect(overwatchCellsCall).toBeTruthy();

            // The bug manifests as conflicting states or weird visual behavior
            // Check if movement highlights were cleared properly
            const clearHighlightsCall = highlightsSpy.mock.calls.find(call =>
                call[0].reachableCells !== undefined && 
                call[0].reachableCells.length === 0
            );

            // With the fix, this should pass
            expect(clearHighlightsCall).toBeTruthy();
        });

        it('should work correctly when character moves first then uses overwatch', () => {
            const interactionModeSpy = jest.fn();
            const deductPointsSpy = jest.fn();

            eventBus.listen(UpdateStateEvent.uiInteractionMode, interactionModeSpy);
            eventBus.listen(UpdateStateEvent.deductActionPoints, deductPointsSpy);

            mockState.findCharacter.mockReturnValue(testCharacter);

            // Step 1: Show movement
            eventBus.dispatch(ControlsEvent.showMovement, testCharacter.name);

            expect(interactionModeSpy).toHaveBeenCalledWith({
                type: 'moving',
                data: { characterId: testCharacter.name }
            });

            // Step 2: Move character one cell
            eventBus.dispatch(ControlsEvent.cellClick, { x: 6, y: 5 });

            // Step 3: Wait for movement to complete
            // Update character position and actions
            const movedCharacter = {
                ...testCharacter,
                position: { x: 6, y: 5 },
                actions: {
                    ...testCharacter.actions,
                    pointsLeft: 9 // After moving one cell
                }
            };
            mockState.findCharacter.mockReturnValue(movedCharacter);

            // Clear spies
            interactionModeSpy.mockClear();

            // Step 4: Now activate overwatch
            eventBus.dispatch(ControlsEvent.showOverwatch, movedCharacter.name);

            // Verify overwatch mode is set correctly
            expect(interactionModeSpy).toHaveBeenCalledWith({
                type: 'overwatch',
                data: expect.objectContaining({
                    characterId: movedCharacter.name,
                    weapon: movedCharacter.inventory.equippedWeapons.primary,
                    remainingPoints: 9
                })
            });

            // Confirm overwatch activation
            eventBus.dispatch(ControlsEvent.cellClick, { x: 8, y: 5 });

            // Verify action points are deducted correctly
            expect(deductPointsSpy).toHaveBeenCalledWith({
                characterName: movedCharacter.name,
                actionId: 'overwatch',
                cost: 9 // All remaining points
            });
        });

        it('should clear movement mode before activating overwatch', () => {
            const interactionModeSpy = jest.fn();
            const highlightsSpy = jest.fn();

            eventBus.listen(UpdateStateEvent.uiInteractionMode, interactionModeSpy);
            eventBus.listen(UpdateStateEvent.uiHighlights, highlightsSpy);

            mockState.findCharacter.mockReturnValue(testCharacter);

            // Activate movement mode
            eventBus.dispatch(ControlsEvent.showMovement, testCharacter.name);
            
            // Update the mock state to reflect movement mode
            (mockState as any)._setInteractionMode({ type: 'moving', data: { characterId: testCharacter.name } });

            // Clear spies
            interactionModeSpy.mockClear();
            highlightsSpy.mockClear();

            // Activate overwatch
            eventBus.dispatch(ControlsEvent.showOverwatch, testCharacter.name);

            // Verify movement highlights are cleared
            const movementClearCall = highlightsSpy.mock.calls.find(call =>
                call[0].reachableCells !== undefined &&
                call[0].reachableCells.length === 0
            );

            // This assertion might fail if the bug is present
            // Movement mode should be cleared before overwatch is shown
            expect(movementClearCall).toBeTruthy();

            // Verify we're now in overwatch mode
            const overwatchModeCall = interactionModeSpy.mock.calls.find(call =>
                call[0].type === 'overwatch'
            );
            expect(overwatchModeCall).toBeTruthy();
        });

        it('should not mix movement and overwatch visual states', () => {
            const cellVisualSpy = jest.fn();
            const characterVisualSpy = jest.fn();

            eventBus.listen(UpdateStateEvent.uiCellVisualBatch, cellVisualSpy);
            eventBus.listen(UpdateStateEvent.uiCharacterVisual, characterVisualSpy);

            mockState.findCharacter.mockReturnValue(testCharacter);

            // Activate movement mode
            eventBus.dispatch(ControlsEvent.showMovement, testCharacter.name);

            // Store movement visual state
            const _movementCellCalls = cellVisualSpy.mock.calls.length;

            // Clear spies
            cellVisualSpy.mockClear();
            characterVisualSpy.mockClear();

            // Activate overwatch
            eventBus.dispatch(ControlsEvent.showOverwatch, testCharacter.name);

            // Check if movement cells were cleared before overwatch cells were added
            const cellUpdates = cellVisualSpy.mock.calls;
            
            // There should be updates to clear old highlights and add new ones
            expect(cellUpdates.length).toBeGreaterThan(0);

            // Character should have overwatch visual state
            const overwatchVisualCall = characterVisualSpy.mock.calls.find(call =>
                call[0].visualState?.temporaryClasses?.includes('overwatch')
            );
            expect(overwatchVisualCall).toBeTruthy();

            // Character should not have movement-related classes when in overwatch
            const latestCharacterVisual = characterVisualSpy.mock.calls[characterVisualSpy.mock.calls.length - 1];
            if (latestCharacterVisual) {
                const classes = latestCharacterVisual[0].visualState?.temporaryClasses || [];
                expect(classes).not.toContain('walk');
                expect(classes).not.toContain('moving');
            }
        });
    });
});