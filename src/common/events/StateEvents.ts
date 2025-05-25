import type { ICharacter, IState } from '../interfaces';
import type { DeepReadonly } from "../helpers/types";

/** Events to update state */
export enum UpdateStateEvent {
    /** Update character position */
    characterPosition = 'UpdateStateEvent.characterPosition',
    characterPath = 'UpdateStateEvent.characterPath',
    playerDirection = 'UpdateStateEvent.playerDirection',
}

export interface UpdateStateEventsMap {
    [UpdateStateEvent.characterPosition]: DeepReadonly<ICharacter>;
    [UpdateStateEvent.characterPath]: DeepReadonly<ICharacter>;
    [UpdateStateEvent.playerDirection]: DeepReadonly<ICharacter['direction']>;
}

/** Events to update state */
export enum StateChangeEvent {
    /** Update character position */
    map = 'StateChangeEvent.map',
    characters = 'StateChangeEvent.characters',
    player = 'StateChangeEvent.player',
    messages = 'StateChangeEvent.messages',
}

export interface StateChangeEventsMap {
    [StateChangeEvent.map]: DeepReadonly<IState['map']>;
    [StateChangeEvent.characters]: DeepReadonly<IState['characters']>;
    [StateChangeEvent.player]: DeepReadonly<ICharacter>;
    [StateChangeEvent.messages]: DeepReadonly<IState['messages']>;
}
