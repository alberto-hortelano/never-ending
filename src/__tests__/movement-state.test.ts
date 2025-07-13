import type { ICharacter, ICell, IState } from "../common/interfaces";
import type { DeepReadonly } from "../common/helpers/types";

import { superEventBus, ControlsEvent, StateChangeEvent, GUIEvent, UpdateStateEvent } from "../common/events";
import { Movement } from "../common/Movement";
import { State } from "../common/State";
import { baseCharacter } from "../data/state";

describe('Movement State Integration', () => {
    let state: State;
    let movement: Movement;
    let testCharacter: ICharacter;
    let testMap: ICell[][];

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

    const createMockCharacter = (overrides: Partial<ICharacter> = {}): ICharacter => ({
        ...baseCharacter,
        ...overrides
    });

    const createMockCell = (x: number, y: number): ICell => ({
        position: { x, y },
        locations: [`cell-${x}-${y}`],
        elements: [],
        content: null
    });

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

    // Helper to create a test listener and track it
    const createTestListener = () => {
        const listener = new TestEventListener();
        testListeners.push(listener);
        return listener;
    };

    beforeEach(() => {
        jest.clearAllMocks();

        testCharacter = createMockCharacter({
            player: 'human'
        });
        testMap = createMockMap(5, 5);

        const initialState: IState = {
            game: {
                turn: 'human',
                players: ['human', 'ai']
            },
            map: testMap,
            characters: [testCharacter],
            messages: []
        };

        state = new State(initialState);
        movement = new Movement(state);

        // Reset test listeners
        testListeners = [];
    });

    afterEach(() => {
        // Clean up all test listeners
        testListeners.forEach(listener => superEventBus.remove(listener));
        // Clean up movement and state listeners
        superEventBus.remove(movement);
        superEventBus.remove(state);
    });

    describe('Character Movement State Changes', () => {
        it('should update character position in state when position event is dispatched', () => {
            const newPosition = { x: 3, y: 3 };
            const newDirection = 'left' as const;

            // Verify initial state
            expect(state.characters[0]?.position).toEqual({ x: 1, y: 1 });
            expect(state.characters[0]?.direction).toBe('down');

            // Dispatch position update
            superEventBus.dispatch(UpdateStateEvent.characterPosition, {
                ...testCharacter,
                position: newPosition,
                direction: newDirection
            });

            // Verify state was updated
            const updatedCharacter = state.findCharacter(testCharacter.name);
            expect(updatedCharacter?.position).toEqual(newPosition);
            expect(updatedCharacter?.direction).toBe(newDirection);
        });

        it('should update character path in state and trigger movement', (done) => {
            const path = [{ x: 2, y: 1 }, { x: 3, y: 1 }];

            // Listen for the character path change event
            const pathListener = createTestListener();
            pathListener.listen(StateChangeEvent.characterPath, (data) => {
                const character = data as DeepReadonly<ICharacter>;
                expect(character.name).toBe(testCharacter.name);
                expect(character.path).toEqual(path);
                done();
            });

            // Dispatch path update
            superEventBus.dispatch(UpdateStateEvent.characterPath, {
                ...testCharacter,
                path: [...path]
            });
        });

        it('should trigger moveCharacter event when path is set', (done) => {
            const path = [{ x: 2, y: 1 }];

            // Listen for move character event
            const moveListener = createTestListener();
            moveListener.listen(ControlsEvent.moveCharacter, (data) => {
                const character = data as DeepReadonly<ICharacter>;
                expect(character.name).toBe(testCharacter.name);
                expect(character.position).toEqual(path[0]);
                expect(character.path).toEqual([]); // Path without first position
                expect(character.direction).toBe('right'); // Moving right from x:1 to x:2
                done();
            });

            // Dispatch path update
            superEventBus.dispatch(UpdateStateEvent.characterPath, {
                ...testCharacter,
                path: [...path]
            });
        });

        it('should complete a full movement cycle', (done) => {
            const targetPosition = { x: 2, y: 1 };
            let pathSet = false;
            let moveTriggered = false;

            // Listen for path being set
            const pathListener = createTestListener();
            pathListener.listen(StateChangeEvent.characterPath, (data) => {
                const character = data as DeepReadonly<ICharacter>;
                if (character.path.length > 0) {
                    pathSet = true;
                }
            });

            // Listen for move command
            const moveListener = createTestListener();
            moveListener.listen(ControlsEvent.moveCharacter, (data) => {
                const character = data as DeepReadonly<ICharacter>;
                moveTriggered = true;

                // Simulate movement animation ending
                setTimeout(() => {
                    superEventBus.dispatch(GUIEvent.movementEnd, character.name);
                }, 10);
            });

            // Listen for position update
            const positionListener = createTestListener();
            positionListener.listen(UpdateStateEvent.characterPosition, () => {
                // Verify final state after movement
                setTimeout(() => {
                    const finalCharacter = state.findCharacter(testCharacter.name);
                    expect(finalCharacter?.position).toEqual(targetPosition);
                    expect(finalCharacter?.path).toEqual([]);
                    expect(pathSet).toBe(true);
                    expect(moveTriggered).toBe(true);
                    done();
                }, 20);
            });

            // Start movement by setting path
            superEventBus.dispatch(UpdateStateEvent.characterPath, {
                ...testCharacter,
                path: [targetPosition]
            });
        });

        it('should maintain direction when character continues moving after first step', (done) => {
            // Character starts at (1,1) facing down, moves right to (2,1), then up to (2,0)
            const path = [
                { x: 2, y: 1 }, // Move right
                { x: 2, y: 0 }  // Then move up
            ];

            let moveCount = 0;
            const expectedDirections = ['right', 'up'];
            const expectedPositions = [
                { x: 2, y: 1 },
                { x: 2, y: 0 }
            ];

            const moveListener = createTestListener();
            moveListener.listen(ControlsEvent.moveCharacter, (data) => {
                const character = data as DeepReadonly<ICharacter>;

                // Verify direction and position for each move
                expect(character.direction).toBe(expectedDirections[moveCount]);
                expect(character.position).toEqual(expectedPositions[moveCount]);

                // Simulate movement animation ending
                setTimeout(() => {
                    superEventBus.dispatch(GUIEvent.movementEnd, character.name);
                }, 10);

                moveCount++;

                if (moveCount === 2) {
                    // Verify character maintains correct direction after movement
                    setTimeout(() => {
                        const finalCharacter = state.findCharacter(testCharacter.name);
                        expect(finalCharacter?.direction).toBe('up');
                        expect(finalCharacter?.position).toEqual({ x: 2, y: 0 });
                        done();
                    }, 50);
                }
            });

            // Start movement
            superEventBus.dispatch(UpdateStateEvent.characterPath, {
                ...testCharacter,
                path: [...path]
            });
        });

        it('should calculate correct direction for each movement', () => {
            const testCases = [
                { from: { x: 1, y: 1 }, to: { x: 2, y: 1 }, expectedDirection: 'right' },
                { from: { x: 2, y: 1 }, to: { x: 1, y: 1 }, expectedDirection: 'left' },
                { from: { x: 1, y: 1 }, to: { x: 1, y: 2 }, expectedDirection: 'down' },
                { from: { x: 1, y: 2 }, to: { x: 1, y: 1 }, expectedDirection: 'up' },
            ];

            testCases.forEach(({ from, to, expectedDirection }) => {
                const character = createMockCharacter({ player: 'human', position: from });

                let directionChecked = false;
                const dirListener = createTestListener();
                dirListener.listen(ControlsEvent.moveCharacter, (data) => {
                    const char = data as DeepReadonly<ICharacter>;
                    if (char.name === character.name) {
                        expect(char.direction).toBe(expectedDirection);
                        directionChecked = true;
                    }
                });

                // Update state with character at starting position
                const testState = new State({
                    game: {
                        turn: 'human',
                        players: ['human', 'ai']
                    },
                    map: testMap,
                    characters: [character],
                    messages: []
                });
                const testMovement = new Movement(testState);

                // Trigger movement
                superEventBus.dispatch(UpdateStateEvent.characterPath, {
                    ...character,
                    path: [to]
                });

                // Cleanup
                superEventBus.remove(testState);
                superEventBus.remove(testMovement);

                expect(directionChecked).toBe(true);
            });
        });
    });

    describe('State Persistence', () => {
        it('should maintain character state through movement events', () => {
            const character = state.findCharacter(testCharacter.name);
            expect(character).toBeDefined();
            expect(character?.name).toBe(testCharacter.name);
            expect(character?.race).toBe(testCharacter.race);
            expect(character?.palette).toEqual(testCharacter.palette);

            superEventBus.dispatch(UpdateStateEvent.characterPosition, {
                ...testCharacter,
                position: { x: 3, y: 3 },
                direction: 'left'
            });

            const updatedCharacter = state.findCharacter(testCharacter.name);
            expect(updatedCharacter?.name).toBe(testCharacter.name);
            expect(updatedCharacter?.race).toBe(testCharacter.race);
            expect(updatedCharacter?.palette).toEqual(testCharacter.palette);
            expect(updatedCharacter?.position).toEqual({ x: 3, y: 3 });
            expect(updatedCharacter?.direction).toBe('left');
        });

        it('should handle multiple characters independently', () => {
            // Clean up existing state and movement first
            superEventBus.remove(movement);
            superEventBus.remove(state);

            const character1 = createMockCharacter({
                player: 'human',
                name: 'test-character-1',
                position: { x: 1, y: 1 }
            });
            const character2 = createMockCharacter({
                player: 'human',
                name: 'test-character-2',
                position: { x: 3, y: 3 }
            });

            // Create state with both characters
            const multiState = new State({
                game: {
                    turn: 'human',
                    players: ['human', 'ai']
                },
                map: testMap,
                characters: [character1, character2],
                messages: []
            });
            const multiMovement = new Movement(multiState);

            // Update first character
            superEventBus.dispatch(UpdateStateEvent.characterPosition, {
                ...character1,
                position: { x: 2, y: 2 },
                direction: 'right'
            });

            // Update second character
            superEventBus.dispatch(UpdateStateEvent.characterPosition, {
                ...character2,
                position: { x: 4, y: 4 },
                direction: 'up'
            });

            // Verify both characters were updated independently
            const char1 = multiState.findCharacter(character1.name);
            const char2 = multiState.findCharacter(character2.name);

            expect(char1?.position).toEqual({ x: 2, y: 2 });
            expect(char1?.direction).toBe('right');
            expect(char2?.position).toEqual({ x: 4, y: 4 });
            expect(char2?.direction).toBe('up');

            // Cleanup
            superEventBus.remove(multiState);
            superEventBus.remove(multiMovement);

            // Restore original state and movement for afterEach cleanup
            state = new State({
                game: {
                    turn: 'human',
                    players: ['human', 'ai']
                },
                map: testMap,
                characters: [testCharacter],
                messages: []
            });
            movement = new Movement(state);
        });
    });
});