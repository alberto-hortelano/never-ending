/* eslint-disable @typescript-eslint/no-explicit-any */
import { BaseEventsMap } from "./BaseEvents";
import { StateEventsMap } from "./StateEvents";
import { ControlsEventsMap } from "./ControlsEvents";

export type EventCallback<T extends TypedEvent> = (data: EventsMap[T]) => void;
export type EventsMap = StateEventsMap & BaseEventsMap & ControlsEventsMap;
export type TypedEvent = keyof EventsMap;

/**
 * A strongly‑typed EventBus.
 *
 * @template Events  a map from event‑name → payload
 */
export class EventBus {
    private static listeners = new Map<string, Map<object, (data: any) => void>>();

    listen<E extends keyof EventsMap>(
        eventName: E,
        cb: (data: EventsMap[E]) => void,
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

    dispatch<E extends keyof EventsMap>(
        eventName: E,
        eventData: EventsMap[E]
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
                cb(eventData);
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
