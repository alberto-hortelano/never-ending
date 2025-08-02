import { EventBus } from '../events/EventBus';
import { Movement } from '../Movement';
import { State } from '../State';
import { UpdateStateEvent, StateChangeEvent } from '../events';

describe('Character Defeat Infinite Loop Fix', () => {
    let state: State;
    let movement: Movement;
    let eventBus: EventBus<any, any>;

    beforeEach(() => {
        eventBus = new EventBus();
        state = new State();
        movement = new Movement(state);
    });

    afterEach(() => {
        movement.destroy();
    });

    it('should not create infinite loop when character is defeated', () => {
        const defeatedCharacter = {
            name: 'TestChar',
            player: 'Player1',
            position: { x: 5, y: 5 },
            direction: 'down',
            health: 0, // Defeated
            maxHealth: 100,
            path: [], // Already empty path
            actions: {
                pointsLeft: 100,
                pendingCost: 0,
                general: { move: 5, talk: 10, use: 10, rotate: 0, inventory: 10 },
                rangedCombat: { shoot: 20, aim: 10, overwatch: 30, cover: 10, throw: 15 },
                closeCombat: { powerStrike: 20, slash: 15, fastAttack: 10, feint: 15, breakGuard: 25 }
            },
            inventory: {
                items: [],
                equippedWeapons: { primary: null, secondary: null },
                maxWeight: 100
            }
        } as any;

        // Set up spy to count how many times UpdateStateEvent.characterPath is dispatched
        const updatePathSpy = jest.fn();
        eventBus.listen(UpdateStateEvent.characterPath, updatePathSpy);

        // Dispatch the characterPath event for a defeated character with empty path
        eventBus.dispatch(StateChangeEvent.characterPath, defeatedCharacter);

        // Should not dispatch UpdateStateEvent.characterPath since path is already empty
        expect(updatePathSpy).not.toHaveBeenCalled();
    });

    it('should clear path once when defeated character has a path', () => {
        const defeatedCharacterWithPath = {
            name: 'TestChar',
            player: 'Player1',
            position: { x: 5, y: 5 },
            direction: 'down',
            health: 0, // Defeated
            maxHealth: 100,
            path: [{ x: 6, y: 5 }, { x: 7, y: 5 }], // Has a path
            actions: {
                pointsLeft: 100,
                pendingCost: 0,
                general: { move: 5, talk: 10, use: 10, rotate: 0, inventory: 10 },
                rangedCombat: { shoot: 20, aim: 10, overwatch: 30, cover: 10, throw: 15 },
                closeCombat: { powerStrike: 20, slash: 15, fastAttack: 10, feint: 15, breakGuard: 25 }
            },
            inventory: {
                items: [],
                equippedWeapons: { primary: null, secondary: null },
                maxWeight: 100
            }
        } as any;

        // Set up spy to count how many times UpdateStateEvent.characterPath is dispatched
        const updatePathSpy = jest.fn();
        eventBus.listen(UpdateStateEvent.characterPath, updatePathSpy);

        // Dispatch the characterPath event for a defeated character with a path
        eventBus.dispatch(StateChangeEvent.characterPath, defeatedCharacterWithPath);

        // Should dispatch UpdateStateEvent.characterPath exactly once to clear the path
        expect(updatePathSpy).toHaveBeenCalledTimes(1);
        expect(updatePathSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                name: 'TestChar',
                path: []
            })
        );
    });
});