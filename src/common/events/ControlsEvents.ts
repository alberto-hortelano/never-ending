import type { IMovable, ICoord } from "../interfaces";
import type { DeepReadonly } from "../helpers/types";

/** Controls Events */
export enum ControlsEvent {
    direction = 'direction',
    cellClick = 'cellClick',
}

export interface ControlsEventsMap {
    [ControlsEvent.direction]: IMovable['direction'];
    [ControlsEvent.cellClick]: DeepReadonly<ICoord>;
}
