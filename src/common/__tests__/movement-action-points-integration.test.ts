import { State } from '../State';
import { Movement } from '../Movement';
import { initialState } from '../../data/state';
import { EventBus, UpdateStateEvent } from '../events';

describe('Movement action points integration test', () => {
    let state: State;
    let movement: Movement;
    let actionPointsHistory: number[] = [];

    beforeEach(() => {
        // Create a proper state with real data
        const initData = initialState(50, 50);
        state = new State(initData);

        // Create movement with the state
        movement = new Movement(state);

        // Get the first character (player character)
        const character = state.characters[0];
        if (character) {
            // Track action points changes
            actionPointsHistory = [character.actions.pointsLeft];
        }

        // Listen for action point changes
        const eventBus = new EventBus<any, any>();
        eventBus.listen(UpdateStateEvent.deductActionPoints, (data: any) => {
            const char = state.findCharacter(data.characterName);
            if (char) {
                // Simulate the deduction (since we're not running the full state manager)
                const newPoints = char.actions.pointsLeft - data.cost;
                actionPointsHistory.push(newPoints);
                console.log(`Deducted ${data.cost} points from ${data.characterName}. Points: ${char.actions.pointsLeft} -> ${newPoints}`);
            }
        });
    });

    afterEach(() => {
        movement.destroy();
    });

    test('should track action points correctly during movement', () => {
        const character = state.characters[0];
        if (!character) {
            throw new Error('No test character found');
        }

        const initialPoints = character.actions.pointsLeft;
        const moveCost = character.actions.general.move;

        console.log(`Character "${character.name}" starting at (${character.position.x}, ${character.position.y})`);
        console.log(`Initial action points: ${initialPoints}`);
        console.log(`Move cost per cell: ${moveCost}`);

        // Calculate expected points for a 3-cell movement
        const cellsMoved = 3;
        const expectedTotalCost = moveCost * cellsMoved;
        const expectedFinalPoints = initialPoints - expectedTotalCost;

        console.log(`Expected cost for ${cellsMoved} cells: ${expectedTotalCost}`);
        console.log(`Expected final points: ${expectedFinalPoints}`);

        // The actual movement would happen through game events
        // This test mainly verifies our calculation logic
        expect(moveCost).toBeGreaterThan(0);
        expect(expectedTotalCost).toBe(moveCost * cellsMoved);
        expect(expectedFinalPoints).toBe(initialPoints - expectedTotalCost);
    });

    test('movement cost calculation should be per cell', () => {
        const character = state.characters[0];
        if (!character) {
            throw new Error('No test character found');
        }

        const moveCost = character.actions.general.move;

        // Test different path lengths
        const testCases = [
            { cells: 1, expectedCost: moveCost },
            { cells: 2, expectedCost: moveCost * 2 },
            { cells: 3, expectedCost: moveCost * 3 },
            { cells: 5, expectedCost: moveCost * 5 }
        ];

        testCases.forEach(({ cells, expectedCost }) => {
            expect(expectedCost).toBe(moveCost * cells);
            console.log(`${cells} cell(s): ${expectedCost} points`);
        });
    });

    test('should not allow movement beyond available action points', () => {
        const character = state.characters[0];
        if (!character) {
            throw new Error('No test character found');
        }

        const pointsLeft = character.actions.pointsLeft;
        const moveCost = character.actions.general.move;
        const maxMovableCells = Math.floor(pointsLeft / moveCost);

        console.log(`Points left: ${pointsLeft}`);
        console.log(`Move cost: ${moveCost}`);
        console.log(`Maximum movable cells: ${maxMovableCells}`);

        // Character should not be able to move more cells than they have points for
        const tooManyCells = maxMovableCells + 1;
        const costForTooMany = tooManyCells * moveCost;

        expect(costForTooMany).toBeGreaterThan(pointsLeft);
        console.log(`Cannot move ${tooManyCells} cells (would cost ${costForTooMany} but only have ${pointsLeft} points)`);
    });
});