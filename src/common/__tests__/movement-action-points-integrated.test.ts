import { Movement } from '../Movement';
import { State } from '../State';
import { EventBus, UpdateStateEvent, StateChangeEvent, ControlsEvent } from '../events';
import { initialState } from '../../data/state';
import { InteractionModeManager } from '../InteractionModeManager';
import { animationService } from '../services/AnimationService';
import type { ICoord, Direction, ICharacter } from '../interfaces';

// Mock animation service to prevent actual animations
jest.mock('../services/AnimationService', () => ({
    animationService: {
        createMovementAnimation: jest.fn().mockReturnValue({
            type: 'movement',
            characterId: 'TestChar',
            steps: []
        }),
        startAnimation: jest.fn()
    }
}));

// Mock the calculatePath and getReachableCells functions
jest.mock('../helpers/map', () => ({
    ...jest.requireActual('../helpers/map'),
    calculatePath: jest.fn((from, to) => {
        // Simple path calculation for testing
        const path = [];
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const steps = Math.max(Math.abs(dx), Math.abs(dy));
        
        for (let i = 1; i <= steps; i++) {
            path.push({
                x: from.x + Math.round((dx / steps) * i),
                y: from.y + Math.round((dy / steps) * i)
            });
        }
        return path;
    }),
    getReachableCells: jest.fn(() => {
        // Return a simple grid of reachable cells
        return [
            { x: 6, y: 5 },
            { x: 7, y: 5 },
            { x: 8, y: 5 },
            { x: 5, y: 6 },
            { x: 5, y: 7 },
            { x: 5, y: 8 }
        ];
    })
}));

describe('Movement action points - integrated test', () => {
    let movement: Movement;
    let state: State;
    let eventBus: EventBus<any, any>;
    let deductionEvents: Array<{ characterName: string; cost: number; actionId: string }> = [];

    beforeEach(() => {
        // Reset singletons
        EventBus.reset();
        InteractionModeManager.resetInstance();
        
        // Initialize state with a simple map
        const initState = initialState(20, 20);
        
        // Add a test character to the state
        const testCharacter: ICharacter = {
            name: 'TestChar',
            player: 'player1',
            position: { x: 5, y: 5 },
            direction: 's' as Direction,
            race: 'human',
            health: 100,
            maxHealth: 100,
            description: 'Test character',
            action: 'idle',
            palette: { skin: '#fff', helmet: '#000', suit: '#00' },
            location: 'test',
            blocker: true,
            path: [],
            actions: {
                pointsLeft: 100,
                pendingCost: 0,
                general: {
                    move: 10, // 10 points per cell
                    talk: 20,
                    use: 15,
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
        
        // Replace the characters in the initial state
        initState.characters = [testCharacter];
        initState.game.turn = 'player1';
        
        state = new State(initState);
        
        // Create Movement instance after state
        movement = new Movement(state);
        
        // Create event bus for listening to events
        eventBus = new EventBus<any, any>();
        
        // Track deduction events
        deductionEvents = [];
        eventBus.listen(UpdateStateEvent.deductActionPoints, (data) => {
            deductionEvents.push(data);
        });
    });

    afterEach(() => {
        movement.destroy();
        jest.clearAllMocks();
    });

    test('should deduct action points when character moves along a path', () => {
        // Get the test character from state
        const testChar = state.findCharacter('TestChar');
        expect(testChar).toBeDefined();
        
        // First, initiate movement mode by showing movement
        movement.dispatch(ControlsEvent.showMovement, 'TestChar');
        
        // Click on a destination to trigger path creation
        const destination = { x: 8, y: 5 };
        movement.dispatch(ControlsEvent.cellClick, destination);
        
        // At this point, Movement should have dispatched UpdateStateEvent.characterPath
        // which triggers onCharacterPath internally
        
        // Now we need to simulate the animation system updating positions
        // Movement tracks these position updates and deducts points for each
        
        // Simulate first position update
        eventBus.dispatch(StateChangeEvent.characterPosition, {
            name: 'TestChar',
            player: 'player1',
            position: { x: 6, y: 5 },
            direction: 'e' as Direction
        });
        
        // Check that action points were deducted
        expect(deductionEvents.length).toBe(1);
        expect(deductionEvents[0]).toEqual({
            characterName: 'TestChar',
            actionId: 'move',
            cost: 10
        });
        
        // Simulate second position update
        eventBus.dispatch(StateChangeEvent.characterPosition, {
            name: 'TestChar',
            player: 'player1',
            position: { x: 7, y: 5 },
            direction: 'e' as Direction
        });
        
        expect(deductionEvents.length).toBe(2);
        expect(deductionEvents[1]).toEqual({
            characterName: 'TestChar',
            actionId: 'move',
            cost: 10
        });
        
        // Simulate third position update
        eventBus.dispatch(StateChangeEvent.characterPosition, {
            name: 'TestChar',
            player: 'player1',
            position: { x: 8, y: 5 },
            direction: 'e' as Direction
        });
        
        expect(deductionEvents.length).toBe(3);
        expect(deductionEvents[2]).toEqual({
            characterName: 'TestChar',
            actionId: 'move',
            cost: 10
        });
        
        // Total cost should be 30 (3 cells * 10 points)
        const totalCost = deductionEvents.reduce((sum, e) => sum + e.cost, 0);
        expect(totalCost).toBe(30);
    });

    test('should calculate and set pending cost when hovering over cells', () => {
        let pendingCostEvents: Array<{ characterName: string; cost: number }> = [];
        
        eventBus.listen(UpdateStateEvent.setPendingActionCost, (data) => {
            pendingCostEvents.push(data);
        });
        
        // First, initiate movement mode
        movement.dispatch(ControlsEvent.showMovement, 'TestChar');
        
        // Hover over a cell that's 3 cells away
        movement.dispatch(ControlsEvent.cellMouseEnter, { x: 8, y: 5 });
        
        // Should have set pending cost for 3 cells
        expect(pendingCostEvents.length).toBeGreaterThan(0);
        const lastEvent = pendingCostEvents[pendingCostEvents.length - 1];
        expect(lastEvent!.characterName).toBe('TestChar');
        expect(lastEvent!.cost).toBe(30); // 3 cells * 10 points
    });

    test('should clear pending cost when mouse leaves', () => {
        let pendingCostEvents: Array<{ characterName: string; cost: number }> = [];
        
        eventBus.listen(UpdateStateEvent.setPendingActionCost, (data) => {
            pendingCostEvents.push(data);
        });
        
        // First, initiate movement mode
        movement.dispatch(ControlsEvent.showMovement, 'TestChar');
        
        // Hover over a cell
        movement.dispatch(ControlsEvent.cellMouseEnter, { x: 7, y: 5 });
        
        // Clear the array to track only the leave event
        pendingCostEvents = [];
        
        // Mouse leaves
        movement.dispatch(ControlsEvent.cellMouseLeave, { x: 7, y: 5 });
        
        // Should have cleared the pending cost
        expect(pendingCostEvents.length).toBe(1);
        expect(pendingCostEvents[0]!.characterName).toBe('TestChar');
        expect(pendingCostEvents[0]!.cost).toBe(0);
    });
});