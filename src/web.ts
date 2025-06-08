import './components';
import { Movement } from "./common/Movement";
import { State } from "./common/State";
import { GameEvent, EventBus } from "./common/events";
import { mockHelpers } from './data/state';
import { initialState } from './data';
import { ICharacter } from './common/interfaces';

// Initialize global CSS variables
document.documentElement.style.setProperty('--cell-width', '5dvh');
document.documentElement.style.setProperty('--size', 'calc(var(--cell-width, 2dvh) * 0.007)');

const play = () => {
    const data: Partial<ICharacter> = {
        name: 'data',
        race: 'robot',
        position: { x: 5, y: 5 },
        palette: {
            skin: 'gold',
            helmet: 'gold',
            suit: 'gold',
        }
    };
    const player: Partial<ICharacter> = {
        name: 'player',
        race: 'human',
        position: { x: 4, y: 5 },
        palette: {
            skin: '#d7a55f',
            helmet: 'white',
            suit: 'white',
        }
    };
    const baseState = initialState(40, 50, player, [data]);
    const state = new State(baseState);
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
