import type { ICharacter } from '../interfaces';
import type { DeepReadonly } from "../helpers/types";

/** Events to update state */
export enum StateEvent {
    /** Update character position */
    characterPosition = 'characterPosition',
    playerDirection = 'playerDirection',
}

export interface StateEventsMap {
    [StateEvent.characterPosition]: DeepReadonly<ICharacter>;
    [StateEvent.playerDirection]: DeepReadonly<ICharacter['direction']>;
}
