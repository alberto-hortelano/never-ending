import type { ICoord, ICharacter } from "../interfaces";
import type { DeepReadonly } from "../helpers/types";

/** Controls Events */
export enum ControlsEvent {
    showActions = 'ControlsEvent.showActions',
    showMovement = 'ControlsEvent.showMovement',
    cellClick = 'ControlsEvent.cellClick',
    moveCharacter = 'ControlsEvent.moveCharacter',
}

export interface ControlsEventsMap {
    [ControlsEvent.showActions]: ICharacter['name'];
    [ControlsEvent.showMovement]: ICharacter['name'];
    [ControlsEvent.cellClick]: DeepReadonly<ICoord>;
    [ControlsEvent.moveCharacter]: DeepReadonly<ICharacter>;
}
