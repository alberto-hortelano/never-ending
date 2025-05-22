import type { IState, ICell } from '../interfaces';
import type { DeepReadonly } from "../helpers/types";

export enum GameEvent {
    /** Start the game */
    play = 'play',
    /** A new map has arrived from the server */
    map = 'map',
    /** A new set of characters has arrived from the server */
    characters = 'characters',
    /** A character is set as player */
    player = 'player',
    /** A Movable changes cell */
    position = 'position',
    /** A speech has arrived from the server with the source and the target */
    speech = 'speech',
    /** A set of valid cells has arrived from the server. This are cells where the characters can move */
    validCells = 'validCells',
}

export interface GameEventsMap {
    [GameEvent.play]: boolean;
    [GameEvent.map]: DeepReadonly<IState['map']>;
    [GameEvent.characters]: DeepReadonly<IState['characters']>;
    [GameEvent.player]: DeepReadonly<object>;
    [GameEvent.position]: DeepReadonly<ICell>;
    [GameEvent.speech]: DeepReadonly<string>;
    [GameEvent.validCells]: DeepReadonly<string[]>;
}
