import type { GameEventsMap } from "./GameEvents";
import type { StateChangeEventsMap, UpdateStateEventsMap } from "./StateEvents";
import type { ControlsEventsMap } from "./ControlsEvents";
import type { GUIEventsMap } from "./GUIEvents";
import type { ActionEventsMap } from "./ActionEvents";
import type { ConversationEventsMap } from "./ConversationEvents";
import type { InventoryEventsMap } from "./InventoryEvents";
import type { ClientNetworkEventMap } from "./NetworkEvents";
import type { CustomUIEventMap, MultiplayerEventMap } from "./CustomEvents";

// Browser-safe environment check
const isTestEnvironment = typeof process !== 'undefined' && process?.env?.NODE_ENV === 'test';

export type EventsMap =
    GameEventsMap &
    UpdateStateEventsMap &
    StateChangeEventsMap &
    ControlsEventsMap &
    GUIEventsMap &
    ActionEventsMap &
    ConversationEventsMap &
    InventoryEventsMap &
    ClientNetworkEventMap &
    MultiplayerEventMap &
    CustomUIEventMap;

export type EventCallback<T extends TypedEvent> = (data: EventsMap[T]) => void;
export type TypedEvent = keyof EventsMap;

/**
 * A strongly‑typed EventBus.
 *
 * @template Events  a map from event‑name → payload
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export class EventBus<ListenEvents extends Partial<EventsMap> = {}, DispatchEvents extends Partial<EventsMap> = {}> {
    private static listeners = new Map<string, Map<object, (data: unknown) => void>>();

    listen<E extends keyof ListenEvents>(
        eventName: E,
        cb: (data: ListenEvents[E]) => void,
        filter: string = '',
    ): void {
        const key = String(eventName) + filter;
        let bucket = EventBus.listeners.get(key);
        if (!bucket) {
            bucket = new Map();
            EventBus.listeners.set(key, bucket);
        }
        if (bucket.has(this)) {
            throw new Error(`Listener for "${key}" already registered on ${this.constructor.name}`);
        }
        bucket.set(this, cb as (data: unknown) => void);
    }

    dispatch<E extends keyof DispatchEvents>(
        eventName: E,
        eventData: DispatchEvents[E],
        filter: string = '',
    ): void {
        const key = String(eventName);
        const filterKey = String(eventName) + filter;
        const bucket = EventBus.listeners.get(key);
        const filterBucket = EventBus.listeners.get(filterKey);
        if (!bucket && !filterBucket) {
            if (!isTestEnvironment) {
                console.log(`${this.constructor.name}: no listeners for "${key}"`);
            }
            return;
        }
        // console.log(eventName);
        if (bucket && filterKey !== key) {
            for (const [, cb] of bucket) {
                try {
                    cb(structuredClone(eventData));
                } catch (err) {
                    if (!isTestEnvironment) {
                        console.error(`Error in listener for "${key}":`, err);
                    }
                }
            }
        }
        if (filterBucket) {
            for (const [, cb] of filterBucket) {
                try {
                    cb(structuredClone(eventData));
                } catch (err) {
                    if (!isTestEnvironment) {
                        console.error(`Error in listener for "${filterKey}":`, err);
                    }
                }
            }
        }
    }

    remove(target: object): void {
        for (const bucket of EventBus.listeners.values()) {
            bucket.delete(target);
        }
    }

    static reset() {
        EventBus.listeners = new Map<string, Map<object, (data: unknown) => void>>();
    }
}

// For testing and development only
export const superEventBus = new EventBus<EventsMap, EventsMap>();
