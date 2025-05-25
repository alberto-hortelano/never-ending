import type { DeepReadonly } from "./helpers/types";
import type { IPositionable, IState, Speed } from "./interfaces";
// import type { State } from "./State";

import { GameEvent, EventBus, UpdateStateEvent, ControlsEvent, GameEventsMap, ControlsEventsMap, UpdateStateEventsMap } from "./events";

export interface IMovement {
    locate(positionable: DeepReadonly<IPositionable>): IPositionable;
}

export class Movement extends EventBus<GameEventsMap & ControlsEventsMap, UpdateStateEventsMap> {
    static readonly speed: Record<Speed, number> = {
        'verySlow': 0.5,
        'slow': 1,
        'medium': 2,
        'fast': 3,
        'veryFast': 4,
    };

    constructor(
        private movement: IMovement,
        private state: DeepReadonly<IState>,
    ) {
        super();
        this.listen(GameEvent.characters, characters => this.onCharacters(characters));
        this.listen(ControlsEvent.direction, direction => this.onDirection(direction));
        this.listen(ControlsEvent.cellClick, position => this.onCellClick(position));
        this.listen(ControlsEvent.moveCharacter, character => this.onMoveCharacter(character));
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
    private onMoveCharacter(character: ControlsEventsMap[ControlsEvent.moveCharacter]) {
        console.log('>>> - Movement - onCellClick - character:', character)
        const map = this.state.map;
        console.log('>>> - Movement - onMoveCharacter - map:', map)
    }
};
