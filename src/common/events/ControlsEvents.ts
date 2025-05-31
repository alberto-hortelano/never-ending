import type { IMovable, ICoord, ICharacter } from "../interfaces";
import type { DeepReadonly } from "../helpers/types";

/** Controls Events */
export enum ControlsEvent {
    showMovement = 'ControlsEvent.showMovement',
    direction = 'ControlsEvent.direction',
    cellClick = 'ControlsEvent.cellClick',
    moveCharacter = 'ControlsEvent.moveCharacter',
}

export interface ControlsEventsMap {
    [ControlsEvent.showMovement]: DeepReadonly<ICharacter>;
    [ControlsEvent.direction]: IMovable['direction'];
    [ControlsEvent.cellClick]: DeepReadonly<ICoord>;
    [ControlsEvent.moveCharacter]: DeepReadonly<ICharacter>;
}
