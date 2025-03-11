import type { Cell, ICharacter, ISpeech } from "../interfaces.js";
import { EventBus, EventCallback } from "./EventBus.js";

enum ServerEvent {
    // A new map has arrived from the server
    map = 'map',
    // A new set of characters has arrived from the server
    characters = 'characters',
    // A character is set as player
    player = 'player',
    // A speech has arrived from the server with the source and the target
    speech = 'speech',
    // A set of valid cells has arrived from the server. This are cells where the characters can move
    validCells = 'validCells',
}

export class ServerEventBus extends EventBus {
    readonly events = ServerEvent;

    override listen(eventName: ServerEvent.map, listener: object, cb: EventCallback<Cell[][]>): void;
    override listen(eventName: ServerEvent.characters, listener: object, cb: EventCallback<ICharacter[]>): void;
    override listen(eventName: ServerEvent.player, listener: object, cb: EventCallback<ICharacter>): void;
    override listen(eventName: ServerEvent.speech, listener: object, cb: EventCallback<ISpeech>): void;
    override listen(eventName: ServerEvent.validCells, listener: object, cb: EventCallback<string[]>): void;
    override listen<T>(
        eventName: ServerEvent,
        listener: object,
        cb: EventCallback<T>
    ): void {
        super.listen(eventName, listener, cb);
    }

    override dispatch(eventName: ServerEvent.map, eventData: Cell[][]): void;
    override dispatch(eventName: ServerEvent.characters, eventData: ICharacter[]): void;
    override dispatch(eventName: ServerEvent.player, eventData: ICharacter): void;
    override dispatch(eventName: ServerEvent.speech, eventData: ISpeech): void;
    override dispatch(eventName: ServerEvent.validCells, eventData: string[]): void;
    override dispatch<T>(
        eventName: ServerEvent,
        eventData: T
    ): void {
        super.dispatch(eventName, eventData);
    }
}
