import type { State } from "./State";

import { EventBus, GameEvent, GameEventsMap } from "./events";

export class Game extends EventBus<GameEventsMap, GameEventsMap> {
    constructor(
        private state: State,
    ) {
        super();
        this.dispatch(GameEvent.map, this.state.map);
        this.dispatch(GameEvent.characters, this.state.characters);
    }
};
