import type { ICharacter } from '../interfaces';
import type { DeepReadonly } from "../helpers/types";

/** Events from UI, Only Component can dispatch */
export enum ComponentEvent {
    characterPosition = 'characterPosition',
    playerDirection = 'playerDirection',
}

export interface ComponentEventsMap {
    [ComponentEvent.characterPosition]: DeepReadonly<ICharacter>;
    [ComponentEvent.playerDirection]: DeepReadonly<ICharacter['direction']>;
}
