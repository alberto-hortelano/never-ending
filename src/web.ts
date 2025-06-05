import './components';
import { Controls } from "./common/Controls";
import { Movement } from "./common/Movement";
import { State } from "./common/State";
import { GameEvent, EventBus } from "./common/events";
import { mockHelpers } from './data/state';
import { initialState } from './data';

const play = () => {
    const baseState = initialState(40, 50, { name: 'player', position: { x: 4, y: 5 } });
    const state = new State(baseState);
    const movement = new Movement(mockHelpers.movement, state);
    const controls = new Controls();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).game = {
        state,
        movement,
        controls,
        eventBus,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).di = (e: string, data: any) => eventBus.dispatch(e, data)
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const eventBus = new EventBus<any, any>();
eventBus.listen(GameEvent.play, play);
