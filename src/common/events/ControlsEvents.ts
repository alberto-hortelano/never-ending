import type { IMovable, ICoord, ICharacter } from "../interfaces";
import type { DeepReadonly } from "../helpers/types";

/** Controls Events */
export enum ControlsEvent {
    moveCharacter = 'ControlsEvent.moveCharacter',
    direction = 'ControlsEvent.direction',
    cellClick = 'ControlsEvent.cellClick',
}

export interface ControlsEventsMap {
    [ControlsEvent.direction]: IMovable['direction'];
    [ControlsEvent.cellClick]: DeepReadonly<ICoord>;
    [ControlsEvent.moveCharacter]: DeepReadonly<ICharacter>;
}
