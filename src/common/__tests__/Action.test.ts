import { Action } from '../Action';
import { State } from '../State';
import { EventBus, ActionEvent, StateChangeEvent, UpdateStateEvent, GameEvent } from '../events';
import type { ActionEventsMap, StateChangeEventsMap, UpdateStateEventsMap, GameEventsMap } from '../events';
import { initialState } from '../../data/state';

// Type aliases for the test event bus
type TestListenEvents = ActionEventsMap & StateChangeEventsMap & GameEventsMap;
type TestDispatchEvents = ActionEventsMap & UpdateStateEventsMap & StateChangeEventsMap & GameEventsMap;

describe('Action service', () => {
    let state: State;
    let eventBus: EventBus<TestListenEvents, TestDispatchEvents>;

    beforeEach(() => {
        // Clear all event listeners before each test
        EventBus.reset()

        // Use the existing initialState function with test data
        // This creates a state with characters: player, data, and enemy
        const testState = initialState(20, 20,
            { name: 'Jim', controller: 'human', faction: 'player' },
            [
                { name: 'data', controller: 'ai', faction: 'player' },
                { name: 'enemy', controller: 'ai', faction: 'enemy' }
            ]
        );

        state = new State(testState);
        new Action(state); // Creates the action service instance
        eventBus = new EventBus<TestListenEvents, TestDispatchEvents>();
    });

    describe('handleActionRequest', () => {
        test('should return correct action points for each character', (done) => {
            const updates: ActionEventsMap[ActionEvent.update][] = [];

            eventBus.listen(ActionEvent.update, (data) => {
                updates.push(data);

                if (updates.length === 2) {
                    // Check that each character has their own points
                    expect(updates[0]?.characterName).toBe('Jim');
                    expect(updates[0]?.characterActions.pointsLeft).toBe(100);

                    expect(updates[1]?.characterName).toBe('data');
                    expect(updates[1]?.characterActions.pointsLeft).toBe(100);

                    done();
                }
            });

            // Request data for characters
            eventBus.dispatch(ActionEvent.request, 'Jim');
            eventBus.dispatch(ActionEvent.request, 'data');
        });

        test('should return fresh data from state, not cached data', (done) => {
            let updateCount = 0;

            eventBus.listen(ActionEvent.update, (data) => {
                updateCount++;

                if (updateCount === 1) {
                    // First request - player should have 100 points
                    expect(data.characterName).toBe('Jim');
                    expect(data.characterActions.pointsLeft).toBe(100);

                    // Now deduct points via proper event
                    eventBus.dispatch(UpdateStateEvent.deductActionPoints, {
                        characterName: 'Jim',
                        actionId: 'move',
                        cost: 20
                    });

                    // Wait a bit then request again
                    setTimeout(() => {
                        eventBus.dispatch(ActionEvent.request, 'Jim');
                    }, 10);
                } else if (updateCount === 2) {
                    // Second request - should show fresh data (80 points)
                    expect(data.characterName).toBe('Jim');
                    expect(data.characterActions.pointsLeft).toBe(80);
                    done();
                }
            });

            eventBus.dispatch(ActionEvent.request, 'Jim');
        });
    });

    describe('Multiple characters action points bug', () => {
        test('moving one character should not affect other characters action points', (done) => {
            const updates: { [key: string]: ActionEventsMap[ActionEvent.update][] } = {
                Jim: [],
                data: []
            };

            // Listen for all updates
            eventBus.listen(ActionEvent.update, (data) => {
                if (data.characterName in updates) {
                    updates[data.characterName]!.push(data);
                }
            });

            // Step 1: Request initial state for both characters
            eventBus.dispatch(ActionEvent.request, 'Jim');
            eventBus.dispatch(ActionEvent.request, 'data');

            setTimeout(() => {
                // Verify initial state
                expect(updates.Jim!.length).toBeGreaterThan(0);
                expect(updates.data!.length).toBeGreaterThan(0);
                expect(updates.Jim![0]?.characterActions.pointsLeft).toBe(100);
                expect(updates.data![0]?.characterActions.pointsLeft).toBe(100);

                // Clear updates
                updates.Jim = [];
                updates.data = [];

                // Step 2: Deduct 20 points from player (simulating movement)
                eventBus.dispatch(UpdateStateEvent.deductActionPoints, {
                    characterName: 'Jim',
                    actionId: 'move',
                    cost: 20
                });

                setTimeout(() => {
                    // player should have received an update
                    expect(updates.Jim!.length).toBeGreaterThan(0);
                    expect(updates.Jim![0]?.characterActions.pointsLeft).toBe(80);

                    // data should NOT have received any updates
                    expect(updates.data!.length).toBe(0);

                    // Clear updates
                    updates.Jim = [];
                    updates.data = [];

                    // Step 3: Request data character's info (simulating clicking on data)
                    eventBus.dispatch(ActionEvent.request, 'data');

                    setTimeout(() => {
                        // data should still have 100 points
                        expect(updates.data!.length).toBe(1);
                        expect(updates.data![0]?.characterActions.pointsLeft).toBe(100);

                        // Verify final state in State object
                        const playerChar = state.characters.find(c => c.name === 'Jim');
                        const dataChar = state.characters.find(c => c.name === 'data');

                        expect(playerChar?.actions.pointsLeft).toBe(80);
                        expect(dataChar?.actions.pointsLeft).toBe(100);

                        done();
                    }, 10);
                }, 10);
            }, 10);
        });

        test('each character should maintain independent action points', (done) => {
            const updates: ActionEventsMap[ActionEvent.update][] = [];

            eventBus.listen(ActionEvent.update, (data) => {
                updates.push(data);
            });

            // Test human player's turn
            eventBus.dispatch(UpdateStateEvent.deductActionPoints, {
                characterName: 'Jim',
                actionId: 'move',
                cost: 20
            });

            // Change turn to AI
            eventBus.dispatch(GameEvent.changeTurn, {
                turn: 'ai',
                previousTurn: 'human'
            });

            setTimeout(() => {
                // Now deduct from AI characters
                eventBus.dispatch(UpdateStateEvent.deductActionPoints, {
                    characterName: 'data',
                    actionId: 'shoot',
                    cost: 40
                });

                eventBus.dispatch(UpdateStateEvent.deductActionPoints, {
                    characterName: 'enemy',
                    actionId: 'move',
                    cost: 60
                });

                setTimeout(() => {
                    // Request fresh data for all characters
                    updates.length = 0;

                    eventBus.dispatch(ActionEvent.request, 'Jim');
                    eventBus.dispatch(ActionEvent.request, 'data');
                    eventBus.dispatch(ActionEvent.request, 'enemy');

                    setTimeout(() => {
                        expect(updates.length).toBe(3);

                        const playerUpdate = updates.find(u => u.characterName === 'Jim');
                        const dataUpdate = updates.find(u => u.characterName === 'data');
                        const enemyUpdate = updates.find(u => u.characterName === 'enemy');

                        expect(playerUpdate?.characterActions.pointsLeft).toBe(80);  // 100 - 20
                        expect(dataUpdate?.characterActions.pointsLeft).toBe(60);  // 100 - 40
                        expect(enemyUpdate?.characterActions.pointsLeft).toBe(40); // 100 - 60

                        done();
                    }, 10);
                }, 10);
            }, 10);
        });
    });

    describe('State change events', () => {
        test('should update cache when state changes', (done) => {
            const updates: ActionEventsMap[ActionEvent.update][] = [];

            eventBus.listen(ActionEvent.update, (data) => {
                updates.push(data);
            });

            // Get the player character and modify their action points for the test
            const playerChar = state.characters.find(c => c.name === 'Jim');
            if (!playerChar) throw new Error('Player character not found');

            const modifiedPlayer = {
                ...playerChar,
                actions: {
                    ...playerChar.actions,
                    pointsLeft: 75
                }
            };

            // Directly dispatch a state change event
            eventBus.dispatch(StateChangeEvent.characterActions, modifiedPlayer);

            setTimeout(() => {
                // Should have received an update
                expect(updates.length).toBe(1);
                expect(updates[0]?.characterName).toBe('Jim');
                expect(updates[0]?.characterActions.pointsLeft).toBe(75);

                // Now request the data to verify it uses fresh state data
                updates.length = 0;
                eventBus.dispatch(ActionEvent.request, 'Jim');

                setTimeout(() => {
                    // Should get the current state value (from state, not the 75 we set via event)
                    expect(updates.length).toBe(1);
                    expect(updates[0]?.characterActions.pointsLeft).toBe(100); // Original state value
                    done();
                }, 10);
            }, 10);
        });
    });
});