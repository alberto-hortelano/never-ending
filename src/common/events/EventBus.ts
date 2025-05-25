/* eslint-disable @typescript-eslint/no-explicit-any */
import type { GameEventsMap } from "./GameEvents";
import type { StateChangeEventsMap, UpdateStateEventsMap } from "./StateEvents";
import type { ControlsEventsMap } from "./ControlsEvents";
import type { ComponentEventsMap } from "./ComponentEvents";

type EventsMap =
    GameEventsMap &
    UpdateStateEventsMap &
    StateChangeEventsMap &
    ControlsEventsMap &
    ComponentEventsMap;

export type EventCallback<T extends TypedEvent> = (data: EventsMap[T]) => void;
export type TypedEvent = keyof EventsMap;

/**
 * A strongly‑typed EventBus.
 *
 * @template Events  a map from event‑name → payload
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export class EventBus<ListenEvents extends Partial<EventsMap> = {}, DispatchEvents extends Partial<EventsMap> = {}> {
    private static listeners = new Map<string, Map<object, (data: any) => void>>();

    listen<E extends keyof ListenEvents>(
        eventName: E,
        cb: (data: ListenEvents[E]) => void,
    ): void {
        const key = String(eventName);
        let bucket = EventBus.listeners.get(key);
        if (!bucket) {
            bucket = new Map();
            EventBus.listeners.set(key, bucket);
        }
        if (bucket.has(this)) {
            throw new Error(`Listener for "${key}" already registered on ${this.constructor.name}`);
        }
        bucket.set(this, cb as (data: any) => void);
    }

    dispatch<E extends keyof DispatchEvents>(
        eventName: E,
        eventData: DispatchEvents[E]
    ): void {
        const key = String(eventName);
        const bucket = EventBus.listeners.get(key);
        if (!bucket) {
            console.warn(`${this.constructor.name}: no listeners for "${key}"`);
            return;
        }
        console.log('>>> - EventBus - eventName:', eventName)
        for (const [, cb] of bucket) {
            try {
                cb(structuredClone(eventData));
            } catch (err) {
                console.error(`Error in listener for "${key}":`, err);
            }
        }
    }

    remove(target: object): void {
        for (const bucket of EventBus.listeners.values()) {
            bucket.delete(target);
        }
    }
}
