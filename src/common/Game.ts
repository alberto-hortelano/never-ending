import type { State } from "./State";

import { EventBus, BaseEvent } from "./events";

export class Game extends EventBus {
    constructor(
        private state: State,
    ) {
        super();
        this.dispatch(BaseEvent.map, this.state.map);
        this.dispatch(BaseEvent.characters, this.state.characters);
    }
};
