import type { IState, ICharacter, IMessage, IPositionable } from "./common/interfaces";

import { playerData } from "./common/__tests__/data";
import { Controls } from "./common/Controls";
import { Game } from "./common/Game";
import { IMovement, Movement } from "./common/Movement";
import { State } from "./common/State";
// import { IGraphics, UI } from "./common/UI";
import { GameEvent, EventBus, GameEventsMap } from "./common/events";

const play = () => {
    // Test data
    const playerPosition = { x: 0, y: 0 };
    // Mocks
    // const printMap = () => {
    // }
    const locate = (positionable: IPositionable) => {
        positionable.cell = state.map[playerPosition.y]![playerPosition.x]!;
        return positionable;
    }
    const mockHelpers: {
        // graphics: IGraphics,
        movement: IMovement,
    } = {
        // graphics: {
        //     printMap,
        // },
        movement: {
            locate,
        }
    }
    const initState = (): IState => {
        // State
        const map = State.fillMap(1, 1);
        const characters: ICharacter[] = [playerData];
        const messages: IMessage[] = [];
        const initialState: IState = {
            map,
            characters,
            messages,
        };
        return initialState;
    }

    const initialState = initState();
    const state = new State(initialState);
    const borders = state.getBorders();
    state.setWalls(borders.map(cell => cell.position));
    const movement = new Movement(mockHelpers.movement);
    const controls = new Controls();
    // const ui = new UI(mockHelpers.graphics);
    const game = new Game(state);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).game = {
        state,
        movement,
        controls,
        // ui,
        game,
    }
}

(async () => {
    const eventBus = new EventBus<GameEventsMap>();
    eventBus.listen(GameEvent.play, play);
})();
