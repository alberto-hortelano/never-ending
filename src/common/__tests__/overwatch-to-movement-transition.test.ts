 
import type { ICharacter, ICell } from "../interfaces";
import type { State } from "../State";

import { EventBus, ControlsEvent, UpdateStateEvent, StateChangeEvent } from "../events";
import { Overwatch } from "../Overwatch";
import { Movement } from "../Movement";
import { baseCharacter } from "../../data/state";
import { UIStateService } from "../services/UIStateService";

// Mock the State class
jest.mock('../State');

describe('Overwatch to Movement Transition', () => {
    let overwatch: Overwatch;
    let movement: Movement;
    let mockState: jest.Mocked<State>;
    let testCharacter: ICharacter;
    let testMap: ICell[][];
    let uiStateService: UIStateService;
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

    beforeEach(() => {
        // Clear all mocks before each test
        jest.clearAllMocks();
        EventBus.reset();
        eventBus = new EventBus();

        // Create test data
        testCharacter = createMockCharacter({
            name: 'testCharacter',
            direction: 'right' as const,
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
                    overwatch: 0
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

        testMap = createMockMap(20, 20);

        // Create mutable UI state
        let uiState = {
            interactionMode: { type: 'normal' },
            visualStates: {
                cells: {},
                characters: {}
            },
            highlights: {
                reachableCells: [],
                pathCells: [],
                targetableCells: []
            }
        };

        // Create mock State
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
            get ui() {
                return uiState;
            },
            overwatchData: {}
        } as any;

        // Create instances
        overwatch = new Overwatch(mockState);
        movement = new Movement(mockState);
        
        // Create UIStateService to handle visual state updates
        uiStateService = new UIStateService(
            () => mockState as any,
            () => uiState as any,
            (ui) => { uiState = ui as any; }
        );
    });

    afterEach(() => {
        // Clean up
        eventBus.remove(overwatch);
        movement.destroy();
        eventBus.remove(uiStateService);
    });

    describe('Transition from Overwatch to Movement', () => {
        it('should clear overwatch highlights when switching to movement mode', () => {
            const cellVisualBatchSpy = jest.fn();
            const highlightsSpy = jest.fn();
            const visualStatesSpy = jest.fn();
            
            // Listen for updates
            eventBus.listen.call({}, UpdateStateEvent.uiCellVisualBatch, cellVisualBatchSpy);
            eventBus.listen.call({}, UpdateStateEvent.uiHighlights, highlightsSpy);
            eventBus.listen.call({}, StateChangeEvent.uiVisualStates, visualStatesSpy);
            
            mockState.findCharacter.mockReturnValue(testCharacter);
            
            // Step 1: Activate overwatch
            eventBus.dispatch(ControlsEvent.showOverwatch, testCharacter.name);
            
            // Check that overwatch highlights were set
            const overwatchHighlightsCall = highlightsSpy.mock.calls.find(call =>
                call[0].targetableCells && call[0].targetableCells.length > 0
            );
            expect(overwatchHighlightsCall).toBeTruthy();
            
            // Check that overwatch cells have visual state
            const overwatchCellsCall = cellVisualBatchSpy.mock.calls.find(call =>
                call[0].updates?.some((update: any) => 
                    update.visualState?.highlightTypes?.includes('overwatch')
                )
            );
            expect(overwatchCellsCall).toBeTruthy();
            
            console.log('Mock state overwatchData:', mockState.overwatchData);
            console.log('UI state cells before movement:', Object.keys(mockState.ui.visualStates.cells).length);
            
            // The UIState instance will automatically handle the cell visual updates
            // No need to manually update the mock state
            
            // Clear spies
            cellVisualBatchSpy.mockClear();
            highlightsSpy.mockClear();
            visualStatesSpy.mockClear();
            
            // Step 2: Switch to movement mode
            eventBus.dispatch(ControlsEvent.showMovement, testCharacter.name);
            
            console.log('Visual states calls after movement:', visualStatesSpy.mock.calls.length);
            console.log('Highlights calls:', highlightsSpy.mock.calls.length);
            
            
            // Check that all highlights were cleared first
            const clearAllHighlightsCall = highlightsSpy.mock.calls.find(call =>
                call[0].reachableCells?.length === 0 &&
                call[0].pathCells?.length === 0 &&
                call[0].targetableCells?.length === 0
            );
            expect(clearAllHighlightsCall).toBeTruthy();
            
            // Check that movement highlights were then set
            const movementHighlightsCall = highlightsSpy.mock.calls.find(call =>
                call[0].reachableCells && call[0].reachableCells.length > 0
            );
            expect(movementHighlightsCall).toBeTruthy();
            
            // Check the final state directly
            console.log('Final UI state cells:', Object.keys(mockState.ui.visualStates.cells).length);
            const finalOverwatchCells = Object.entries(mockState.ui.visualStates.cells || {})
                .filter(([_, cellState]: [string, any]) => 
                    cellState?.highlightTypes?.includes('overwatch')
                ).length;
            console.log('Final overwatch cells:', finalOverwatchCells);
            expect(finalOverwatchCells).toBe(0);
        });
    });
});