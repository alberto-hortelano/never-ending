import type { DeepReadonly } from "./helpers/types";
import type { IPositionable } from "./interfaces";
// import type { State } from "./State";

import { GameEvent, EventBus, UpdateStateEvent, ControlsEvent, GameEventsMap, ControlsEventsMap, UpdateStateEventsMap } from "./events";

export interface IMovement {
    locate(positionable: DeepReadonly<IPositionable>): IPositionable;
}

export class Movement extends EventBus<GameEventsMap & ControlsEventsMap, UpdateStateEventsMap> {

    constructor(
        private movement: IMovement,
        // private state: State,
    ) {
        super();
        this.listen(GameEvent.characters, characters => this.onCharacters(characters));
        this.listen(ControlsEvent.direction, direction => this.onDirection(direction));
        this.listen(ControlsEvent.cellClick, position => this.onCellClick(position));
    }
    private onCharacters(characters: GameEventsMap[GameEvent.characters]) {
        characters.forEach(character => {
            console.log('>>> - Movement - onCharacters - character:', character)
            const position = this.movement.locate(character);
            const positionedCharacter = { ...character, ...position };
            this.dispatch(UpdateStateEvent.characterPosition, positionedCharacter);
        });
    }
    private onDirection(direction: ControlsEventsMap[ControlsEvent.direction]) {
        this.dispatch(UpdateStateEvent.playerDirection, direction);
    }
    private onCellClick(position: ControlsEventsMap[ControlsEvent.cellClick]) {
        console.log('>>> - Movement - onCellClick - position:', position)
    }
};
