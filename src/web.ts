/* eslint-disable @typescript-eslint/no-explicit-any */
import './components';
import { Movement } from "./common/Movement";
import { Talk } from "./common/Talk";
import { State } from "./common/State";
import { GameEvent, EventBus } from "./common/events";
import { initialState } from './data/state';

// Initialize global CSS variables
document.documentElement.style.setProperty('--cell-width', '4dvh');
document.documentElement.style.setProperty('--size', 'calc(var(--cell-width, 2dvh) * 0.007)');

const play = () => {
    const state = new State(initialState(50, 50));
    const movement = new Movement(state);
    const talk = new Talk(state);

    (window as any).game = {
        state,
        movement,
        talk,
        eventBus,
    };
    (window as any).di = (e: string, data: any) => eventBus.dispatch(e, data)
}
const eventBus = new EventBus<any, any>();
eventBus.listen(GameEvent.play, play);
