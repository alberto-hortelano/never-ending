import type { IState, ICell } from '../interfaces';
import type { DeepReadonly } from "../helpers/types";

export enum BaseEvent {
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

export interface BaseEventsMap {
    [BaseEvent.play]: boolean;
    [BaseEvent.map]: DeepReadonly<IState['map']>;
    [BaseEvent.characters]: DeepReadonly<IState['characters']>;
    [BaseEvent.player]: DeepReadonly<object>;
    [BaseEvent.position]: DeepReadonly<ICell>;
    [BaseEvent.speech]: DeepReadonly<string>;
    [BaseEvent.validCells]: DeepReadonly<string[]>;
}
