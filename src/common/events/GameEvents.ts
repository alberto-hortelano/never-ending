import type { IState } from '../interfaces';
import type { DeepReadonly } from "../helpers/types";

export enum GameEvent {
    /** Start the game */
    play = 'GameEvent.play',
    /** A new set of characters has arrived from the server */
    characters = 'GameEvent.characters',
}

export interface GameEventsMap {
    [GameEvent.play]: boolean;
    [GameEvent.characters]: DeepReadonly<IState['characters']>;
}
