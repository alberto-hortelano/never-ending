import type { DeepReadonly } from "./helpers/types";
import type { IPositionable } from "./interfaces";
// import type { State } from "./State";

import { EventsMap, BaseEvent, EventBus, StateEvent, ControlsEvent } from "./events";

export interface IMovement {
    locate(positionable: DeepReadonly<IPositionable>): IPositionable;
}

export class Movement extends EventBus {

    constructor(
        private movement: IMovement,
        // private state: State,
    ) {
        super();
        this.listen(BaseEvent.characters, characters => this.onCharacters(characters));
        this.listen(ControlsEvent.direction, direction => this.onDirection(direction));
        this.listen(ControlsEvent.cellClick, position => this.onCellClick(position));
    }
    private onCharacters(characters: EventsMap[BaseEvent.characters]) {
        characters.forEach(character => {
            const position = this.movement.locate(character);
            const positionedCharacter = { ...character, ...position };
            this.dispatch(StateEvent.characterPosition, positionedCharacter);
        });
    }
    private onDirection(direction: EventsMap[ControlsEvent.direction]) {
        this.dispatch(StateEvent.playerDirection, direction);
    }
    private onCellClick(position: EventsMap[ControlsEvent.cellClick]) {
        console.log('>>> - Movement - onCellClick - position:', position)
    }
};
