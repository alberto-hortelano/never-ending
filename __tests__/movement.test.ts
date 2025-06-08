
import { superEventBus, ControlsEvent, StateChangeEvent, GUIEvent } from "../src/common/events";
import { Movement } from "../src/common/Movement";
import { State } from "../src/common/State";
import { initialState } from "../src/data";
import { mockHelpers } from "../src/data/state";

describe('Move character', () => {
    const miniState = initialState(4, 4, { position: { x: 1, y: 2 } });
    const testFn = jest.fn((...args) => console.log(args))
    superEventBus.listen(StateChangeEvent.map, testFn);
    superEventBus.listen(StateChangeEvent.characters, testFn);
    const state = new State(miniState);
    new Movement(mockHelpers.movement, state);

    test('From character show movement to movement end', () => {
        superEventBus.listen(GUIEvent.cellHighlight, testFn);
        superEventBus.dispatch(ControlsEvent.showMovement, state.player!.name);
    })
})