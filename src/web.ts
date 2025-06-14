/* eslint-disable @typescript-eslint/no-explicit-any */
import './components';
import { Movement } from "./common/Movement";
import { State } from "./common/State";
import { GameEvent, EventBus } from "./common/events";
import { initialState, mockHelpers } from './data/state';

// Initialize global CSS variables
document.documentElement.style.setProperty('--cell-width', '4dvh');
document.documentElement.style.setProperty('--size', 'calc(var(--cell-width, 2dvh) * 0.007)');

const play = () => {
    const state = new State(initialState(100, 100));
    const movement = new Movement(mockHelpers.movement, state);

    (window as any).game = {
        state,
        movement,
        eventBus,
    };
    (window as any).di = (e: string, data: any) => eventBus.dispatch(e, data)
}
const eventBus = new EventBus<any, any>();
eventBus.listen(GameEvent.play, play);
