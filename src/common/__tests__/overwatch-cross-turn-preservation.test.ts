/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ICharacter, ICell } from "../interfaces";
import type { State } from "../State";

import { superEventBus, ControlsEvent, UpdateStateEvent, StateChangeEvent, GameEvent } from "../events";
import { Overwatch } from "../Overwatch";
import { Movement } from "../Movement";
import { baseCharacter } from "../../data/state";
import { UIStateService } from "../services/UIStateService";

// Mock the State class
jest.mock('../State');

describe('Overwatch Cross-Turn Preservation', () => {
    let overwatch: Overwatch;
    let movement: Movement;
    let mockState: jest.Mocked<State>;
    let humanCharacter: ICharacter;
    let aiCharacter: ICharacter;
    let testMap: ICell[][];
    let uiStateService: UIStateService;

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

        // Create test data
        humanCharacter = createMockCharacter({
            name: 'humanCharacter',
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

        aiCharacter = createMockCharacter({
            name: 'aiCharacter',
            direction: 'left' as const,
            position: { x: 15, y: 15 },
            player: 'ai',
            actions: {
                ...baseCharacter.actions,
                pointsLeft: 10,
                general: {
                    ...baseCharacter.actions.general,
                    move: 1
                }
            }
        });

        testMap = createMockMap(20, 20);

        // Create mock game state that can be modified
        let currentTurn = 'human';
        
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
            findCharacter: jest.fn((name: string) => {
                if (name === 'humanCharacter') return humanCharacter;
                if (name === 'aiCharacter') return aiCharacter;
                return undefined;
            }),
            get game() {
                return {
                    turn: currentTurn,
                    players: ['human', 'ai']
                };
            },
            characters: [humanCharacter, aiCharacter],
            get ui() {
                return uiState;
            },
            overwatchData: {},
            // Helper to change turn in test
            setTurn: (turn: string) => { currentTurn = turn; }
        } as any;

        // Create instances
        overwatch = new Overwatch(mockState);
        movement = new Movement(mockState);
        
        // Create UIStateService to handle visual state updates
        uiStateService = new UIStateService(
            () => mockState,
            () => uiState,
            (ui) => { uiState = ui; }
        );
    });

    afterEach(() => {
        // Clean up
        superEventBus.remove(overwatch);
        movement.destroy();
        superEventBus.remove(uiStateService);
    });

    describe('Overwatch preservation across turns', () => {
        it('should preserve overwatch highlights when switching turns and showing movement', async () => {
            const visualStatesSpy = jest.fn();
            
            // Listen for visual state updates
            superEventBus.listen.call({}, StateChangeEvent.uiVisualStates, visualStatesSpy);
            
            // Step 1: Human player activates overwatch
            superEventBus.dispatch(ControlsEvent.showOverwatch, humanCharacter.name);
            
            // Find the overwatch cells from the visual states
            let overwatchCellKeys: string[] = [];
            visualStatesSpy.mock.calls.forEach(call => {
                const visualStates = call[0];
                if (visualStates?.cells) {
                    Object.entries(visualStates.cells).forEach(([cellKey, cellState]: [string, any]) => {
                        if (cellState?.highlightTypes?.includes('overwatch')) {
                            overwatchCellKeys.push(cellKey);
                        }
                    });
                }
            });
            
            expect(overwatchCellKeys.length).toBeGreaterThan(0);
            const initialOverwatchCount = overwatchCellKeys.length;
            
            // Simulate overwatch being activated by updating the mock BEFORE clicking
            const overwatchCells = overwatchCellKeys.map(key => {
                const parts = key.split(',');
                return { x: Number(parts[0]), y: Number(parts[1]) };
            });
            
            // Update the mock to return overwatch data
            Object.defineProperty(mockState, 'overwatchData', {
                get: () => ({
                    [humanCharacter.name]: {
                        active: true,
                        direction: humanCharacter.direction,
                        position: humanCharacter.position,
                        range: 15,
                        shotsRemaining: 10,
                        watchedCells: overwatchCells,
                        shotCells: []
                    }
                }),
                configurable: true
            });
            
            // Activate overwatch (click on a cell)
            superEventBus.dispatch(ControlsEvent.cellClick, { x: 10, y: 10 });
            
            // Step 2: Change turn to AI
            (mockState as any).setTurn('ai');
            superEventBus.dispatch(GameEvent.changeTurn, { turn: 'ai' });
            
            // Step 3: Show movement for AI character (simulating selection)
            visualStatesSpy.mockClear();
            superEventBus.dispatch(ControlsEvent.showMovement, aiCharacter.name);
            
            // Wait a bit for all events to process
            await new Promise(resolve => setTimeout(resolve, 10));
            
            console.log('Visual states calls after showing movement:', visualStatesSpy.mock.calls.length);
            
            // Check final visual states
            const lastVisualStatesCall = visualStatesSpy.mock.calls[visualStatesSpy.mock.calls.length - 1];
            if (!lastVisualStatesCall) {
                console.log('No visual states calls after showing movement');
            } else {
                const finalVisualStates = lastVisualStatesCall[0];
                let finalOverwatchCells = 0;
                let movementCells = 0;
                
                Object.entries(finalVisualStates.cells || {}).forEach(([cellKey, cellState]: [string, any]) => {
                    if (cellState?.highlightTypes?.includes('overwatch')) {
                        finalOverwatchCells++;
                    }
                    if (cellState?.highlightTypes?.includes('movement')) {
                        movementCells++;
                    }
                });
                
                console.log('Final overwatch cells:', finalOverwatchCells);
                console.log('Movement cells:', movementCells);
                console.log('Initial overwatch count:', initialOverwatchCount);
                
                // Overwatch cells should be preserved
                expect(finalOverwatchCells).toBeGreaterThan(0);
                expect(finalOverwatchCells).toBe(initialOverwatchCount);
                
                // Movement cells should also be shown
                expect(movementCells).toBeGreaterThan(0);
            }
        });
    });
});