// import type { DeepReadonly } from "../helpers/types";

// import type { ICell, ICharacter, IState } from "../interfaces";

// export type EventCallback<T extends TypedEvent> = (data: EventsMap[T]) => void;

// export enum TypedEvent {
//     // A new map has arrived from the server
//     map = 'map',
//     // A new set of characters has arrived from the server
//     characters = 'characters',
//     // A character is set as player
//     player = 'player',
//     // A Movable changes cell
//     position = 'position',
//     // A speech has arrived from the server with the source and the target
//     speech = 'speech',
//     // A set of valid cells has arrived from the server. This are cells where the characters can move
//     validCells = 'validCells',
//     // State
//     state = 'state',
//     // Request to modify a character position
//     stateCharacterPosition = 'stateCharacterPosition',
// }

// export interface EventsMap {
//     [TypedEvent.map]: DeepReadonly<IState['map']>;
//     [TypedEvent.characters]: DeepReadonly<IState['characters']>;
//     [TypedEvent.player]: DeepReadonly<object>;
//     [TypedEvent.position]: DeepReadonly<ICell>;
//     [TypedEvent.speech]: DeepReadonly<string>;
//     [TypedEvent.validCells]: DeepReadonly<string[]>;
//     // State
//     [TypedEvent.state]: DeepReadonly<ICharacter>;
//     [TypedEvent.stateCharacterPosition]: DeepReadonly<ICharacter>;
// }

// export class EventBus {
//     static listeners = new Map<string, Map<object, EventCallback<TypedEvent>>>();

//     listen(eventName: TypedEvent.map, cb: EventCallback<TypedEvent.map>): void;
//     listen(eventName: TypedEvent.characters, cb: EventCallback<TypedEvent.characters>): void;
//     listen(eventName: TypedEvent.player, cb: EventCallback<TypedEvent.player>): void;
//     listen(eventName: TypedEvent.position, cb: EventCallback<TypedEvent.position>): void;
//     listen(eventName: TypedEvent.speech, cb: EventCallback<TypedEvent.speech>): void;
//     listen(eventName: TypedEvent.validCells, cb: EventCallback<TypedEvent.validCells>): void;
//     // State
//     listen(eventName: TypedEvent.stateCharacterPosition, cb: EventCallback<TypedEvent.stateCharacterPosition>): void;
//     listen<T extends TypedEvent>(
//         eventName: T,
//         cb: EventCallback<T>
//     ): void {
//         let listeners = EventBus.listeners.get(eventName);
//         if (!listeners) {
//             listeners = new Map();
//             EventBus.listeners.set(eventName, listeners);
//         }
//         if (listeners.has(this)) {
//             throw new Error(`Listener ${eventName} already set for ${this.constructor?.name}`);
//         }
//         // Type assertion needed here because we're storing callbacks for different event types
//         listeners.set(this, cb as EventCallback<TypedEvent>);
//     }

//     dispatch(eventName: TypedEvent.map, eventData?: EventsMap[TypedEvent.map]): void;
//     dispatch(eventName: TypedEvent.characters, eventData?: EventsMap[TypedEvent.characters]): void;
//     dispatch(eventName: TypedEvent.player, eventData?: EventsMap[TypedEvent.player]): void;
//     dispatch(eventName: TypedEvent.position, eventData?: EventsMap[TypedEvent.position]): void;
//     dispatch(eventName: TypedEvent.speech, eventData?: EventsMap[TypedEvent.speech]): void;
//     dispatch(eventName: TypedEvent.validCells, eventData?: EventsMap[TypedEvent.validCells]): void;
//     // State
//     dispatch(eventName: TypedEvent.stateCharacterPosition, eventData?: EventsMap[TypedEvent.stateCharacterPosition]): void;
//     dispatch<T extends TypedEvent>(
//         eventName: T,
//         eventData: EventsMap[T]
//     ): void {
//         const listenerCbs = EventBus.listeners.get(eventName);
//         if (!listenerCbs) {
//             console.error(this.constructor.name, ': No listeners for', eventName, EventBus.listeners);
//             // if (eventName === 'log' && Array.isArray(eventData)) {
//             //     console.log(...eventData);
//             // }
//             return;
//         }

//         listenerCbs.forEach((cb, listener) => {
//             if (!cb) {
//                 throw new Error(`No callback for event ${eventName} at ${listener.constructor?.name}`);
//             }

//             cb(eventData);
//         });
//     }

//     /**
//      * Remove all event listeners for the specified target
//      * @param target - The object whose listeners should be removed
//      */
//     remove(target: object): void {
//         EventBus.listeners.forEach(listener => listener.delete(target));
//     }
// }
