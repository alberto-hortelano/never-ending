import type { IState } from "../interfaces";
import { EventBus, UpdateStateEventsMap, StateChangeEventsMap, GameEvent, GameEventsMap, StateChangeEvent } from "../events";
import { DeepReadonly } from "../helpers/types";

export class GameState extends EventBus<UpdateStateEventsMap & GameEventsMap, StateChangeEventsMap> {
    #game: IState['game'] = { turn: '', players: [] };
    private onSave?: () => void;

    constructor(onSave?: () => void) {
        super();
        this.onSave = onSave;
        this.listen(GameEvent.changeTurn, (data) => this.onChangeTurn(data));
    }

    private onChangeTurn(data: GameEventsMap[GameEvent.changeTurn]) {
        this.#game = { ...this.#game, ...data };
        this.dispatch(StateChangeEvent.game, structuredClone(this.#game));
    }

    set game(game: IState['game']) {
        this.#game = game;
        this.dispatch(StateChangeEvent.game, structuredClone(this.#game));
        this.onSave?.();
    }

    get game(): DeepReadonly<IState['game']> {
        return this.#game;
    }

    getCurrentTurn(): string {
        return this.#game.turn;
    }

    getPlayers(): DeepReadonly<string[]> {
        return this.#game.players;
    }
}