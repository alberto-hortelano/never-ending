import type { IState, ICharacter, IMessage, IPositionable } from "./common/interfaces";

import './components';
import { playerData } from "./common/__tests__/data";
import { Controls } from "./common/Controls";
import { IMovement, Movement } from "./common/Movement";
import { State } from "./common/State";
import { GameEvent, EventBus, ControlsEvent } from "./common/events";
import { fillMap, getBorders, setWalls } from "./common/helpers/map";

const play = () => {
    // Mocks
    const locate = (positionable: IPositionable) => {
        return positionable;
    }
    const mockHelpers: {
        movement: IMovement,
    } = {
        movement: {
            locate,
        }
    }
    const initState = (): IState => {
        // State
        const map = fillMap(20, 30);
        const characters: ICharacter[] = [playerData];
        const messages: IMessage[] = [];
        const initialState: IState = {
            map,
            characters,
            player: playerData,
            messages,
        };
        return initialState;
    }

    const initialState = initState();
    const borders = getBorders(initialState.map);
    setWalls(initialState.map, borders.map(cell => cell.position));
    const state = new State(initialState);
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

    console.log('>>> - setTimeout - state.player:', state.player)
    setTimeout(() => {
        eventBus.dispatch(ControlsEvent.showMovement, state.player)
    }, 400);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const eventBus = new EventBus<any, any>();
eventBus.listen(GameEvent.play, play);
