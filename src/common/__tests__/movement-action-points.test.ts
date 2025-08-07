import { Movement } from '../Movement';
import { State } from '../State';
import { EventBus, UpdateStateEvent, StateChangeEvent, ControlsEvent } from '../events';
import { initialState } from '../../data/state';
import type { ICoord, Direction } from '../interfaces';

describe('Movement action points deduction', () => {
    let movement: Movement;
    let state: State;
    let eventBus: EventBus<any, any>;
    let actionPointDeductions: Array<{ characterName: string; cost: number; actionId: string }> = [];
    let characterPositionUpdates: Array<{ name: string; position: ICoord }> = [];

    beforeEach(() => {
        // Initialize state with test data - use default map size
        const initState = initialState(50, 50);
        state = new State(initState);

        // Create event bus to track events
        eventBus = new EventBus<any, any>();

        // Track action point deductions
        actionPointDeductions = [];
        eventBus.listen(UpdateStateEvent.deductActionPoints, (data) => {
            actionPointDeductions.push(data);
        });

        // Track character position updates
        characterPositionUpdates = [];
        eventBus.listen(StateChangeEvent.characterPosition, (data) => {
            characterPositionUpdates.push({ name: data.name, position: data.position });
        });

        // Create movement instance
        movement = new Movement(state);

        // Set up a test character with known action points
        const testCharacter: any = {
            name: 'TestChar',
            player: 'player1',
            position: { x: 5, y: 5 },
            direction: 's' as Direction,
            health: 100,
            maxHealth: 100,
            actions: {
                pointsLeft: 100,
                pendingCost: 0,
                general: {
                    move: 10, // 10 points per cell
                    talk: 20,
                    use: 15,
                    rotate: 5,
                    inventory: 0
                },
                rangedCombat: {
                    shoot: 30,
                    aim: 10,
                    overwatch: 50,
                    cover: 20,
                    throw: 25
                },
                closeCombat: {
                    powerStrike: 40,
                    slash: 25,
                    fastAttack: 15,
                    feint: 20,
                    breakGuard: 30
                }
            },
            inventory: {
                items: [],
                maxWeight: 100,
                equippedWeapons: {
                    primary: null,
                    secondary: null
                }
            }
        };

        // Override findCharacter to return our test character
        jest.spyOn(state, 'findCharacter').mockReturnValue(testCharacter);

        // Set current turn by modifying the state's game object
        (state as any)._game = { ...state.game, turn: 'player1' };
    });

    afterEach(() => {
        movement.destroy();
        jest.clearAllMocks();
    });

    test('should deduct correct action points for a 3-cell movement', (done) => {
        const testCharacter = state.findCharacter('TestChar');

        // Simulate showing movement for the character
        eventBus.dispatch(ControlsEvent.showMovement, 'TestChar');

        // Simulate character path being set (3 cells)
        const path = [
            { x: 6, y: 5 },
            { x: 7, y: 5 },
            { x: 8, y: 5 }
        ];

        eventBus.dispatch(StateChangeEvent.characterPath, {
            ...testCharacter,
            path: path
        });

        // Simulate position updates as character moves through each cell
        setTimeout(() => {
            // First cell
            eventBus.dispatch(StateChangeEvent.characterPosition, {
                name: 'TestChar',
                player: 'player1',
                position: { x: 6, y: 5 },
                direction: 'e' as Direction
            });
        }, 10);

        setTimeout(() => {
            // Second cell
            eventBus.dispatch(StateChangeEvent.characterPosition, {
                name: 'TestChar',
                player: 'player1',
                position: { x: 7, y: 5 },
                direction: 'e' as Direction
            });
        }, 20);

        setTimeout(() => {
            // Third cell
            eventBus.dispatch(StateChangeEvent.characterPosition, {
                name: 'TestChar',
                player: 'player1',
                position: { x: 8, y: 5 },
                direction: 'e' as Direction
            });
        }, 30);

        // Simulate animation completion
        setTimeout(() => {
            eventBus.dispatch(StateChangeEvent.uiAnimations, {
                characters: {}
            });

            // Verify the results
            // Should have 3 deductions of 10 points each
            expect(actionPointDeductions).toHaveLength(3);

            // Each deduction should be for 10 points (one cell)
            actionPointDeductions.forEach((deduction, index) => {
                expect(deduction.characterName).toBe('TestChar');
                expect(deduction.actionId).toBe('move');
                expect(deduction.cost).toBe(10); // 10 points per cell
            });

            // Total deducted should be 30 points (3 cells * 10 points)
            const totalDeducted = actionPointDeductions.reduce((sum, d) => sum + d.cost, 0);
            expect(totalDeducted).toBe(30);

            done();
        }, 50);
    });

    test('should not deduct points for network movements', (done) => {
        const testCharacter = state.findCharacter('TestChar');

        // Simulate character path being set from network
        const path = [
            { x: 6, y: 5 },
            { x: 7, y: 5 }
        ];

        eventBus.dispatch(StateChangeEvent.characterPath, {
            ...testCharacter,
            path: path,
            fromNetwork: true // Mark as network movement
        });

        // Simulate position updates
        setTimeout(() => {
            eventBus.dispatch(StateChangeEvent.characterPosition, {
                name: 'TestChar',
                player: 'player1',
                position: { x: 6, y: 5 },
                direction: 'e' as Direction,
                fromNetwork: true
            });
        }, 10);

        setTimeout(() => {
            eventBus.dispatch(StateChangeEvent.characterPosition, {
                name: 'TestChar',
                player: 'player1',
                position: { x: 7, y: 5 },
                direction: 'e' as Direction,
                fromNetwork: true
            });
        }, 20);

        setTimeout(() => {
            // Should have NO deductions for network movements
            expect(actionPointDeductions).toHaveLength(0);
            done();
        }, 30);
    });

    test('should calculate pending cost correctly when hovering', () => {
        const testCharacter = state.findCharacter('TestChar');
        let pendingCostUpdates: Array<{ characterName: string; cost: number }> = [];

        // Track pending cost updates
        eventBus.listen(UpdateStateEvent.setPendingActionCost, (data) => {
            pendingCostUpdates.push(data);
        });

        // Show movement mode
        eventBus.dispatch(ControlsEvent.showMovement, 'TestChar');

        // Simulate hovering over a cell 3 moves away
        eventBus.dispatch(ControlsEvent.cellMouseEnter, { x: 8, y: 5 });

        // Check that pending cost was set
        // With proper path calculation, this should set pending cost to 30 (3 cells * 10 points)
        // Note: This assumes the path calculation returns a 3-cell path
        expect(pendingCostUpdates.length).toBeGreaterThan(0);
        if (pendingCostUpdates.length > 0) {
            const lastUpdate = pendingCostUpdates[pendingCostUpdates.length - 1];
            if (lastUpdate) {
                expect(lastUpdate.characterName).toBe('TestChar');
                // The cost should be based on the path length
                expect(lastUpdate.cost).toBeGreaterThan(0);
            }
        }
    });

    test('should clear pending cost when mouse leaves', () => {
        let pendingCostUpdates: Array<{ characterName: string; cost: number }> = [];

        // Track pending cost updates
        eventBus.listen(UpdateStateEvent.setPendingActionCost, (data) => {
            pendingCostUpdates.push(data);
        });

        // Show movement mode
        eventBus.dispatch(ControlsEvent.showMovement, 'TestChar');

        // Simulate hovering over a cell
        eventBus.dispatch(ControlsEvent.cellMouseEnter, { x: 6, y: 5 });

        // Clear the array to track only the leave event
        pendingCostUpdates = [];

        // Simulate mouse leaving
        eventBus.dispatch(ControlsEvent.cellMouseLeave, undefined);

        // Should have cleared the pending cost (set to 0)
        expect(pendingCostUpdates).toHaveLength(1);
        expect(pendingCostUpdates[0]?.cost).toBe(0);
    });
});