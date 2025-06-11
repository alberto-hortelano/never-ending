import './components';
import { Movement } from "./common/Movement";
import { State } from "./common/State";
import { GameEvent, EventBus } from "./common/events";
import { initialState, mockHelpers } from './data/state';
// import { IState } from './common/interfaces';

// Initialize global CSS variables
document.documentElement.style.setProperty('--cell-width', '2dvh');
document.documentElement.style.setProperty('--size', 'calc(var(--cell-width, 2dvh) * 0.007)');

// const loadState = () => {
//     try {
//         const localState = localStorage.getItem('state');
//         if (localState) {
//             const state: IState = JSON.parse(localState);
//             return state;
//         }
//     } catch (error) {
//         console.error('Game - constructor - error:', error)
//     }
//     return baseState;
// }

const play = () => {
    const state = new State(initialState(40, 50));
    const movement = new Movement(mockHelpers.movement, state);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).game = {
        state,
        movement,
        eventBus,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).di = (e: string, data: any) => eventBus.dispatch(e, data)
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const eventBus = new EventBus<any, any>();
eventBus.listen(GameEvent.play, play);
