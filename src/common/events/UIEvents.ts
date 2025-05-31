import type { DeepReadonly } from "../helpers/types";
import type { ICharacter, ICoord } from "../interfaces";

/** Events to communicate with UI */
export enum GUIEvent {
    cellHighlight = 'GUIEvent.cellHighlight',
    cellReset = 'GUIEvent.cellReset',
    movementEnd = 'GUIEvent.movementEnd',
}

export interface GUIEventsMap {
    [GUIEvent.cellHighlight]: DeepReadonly<ICoord>;
    [GUIEvent.cellReset]: DeepReadonly<ICoord>;
    [GUIEvent.movementEnd]: ICharacter['name'];
}
