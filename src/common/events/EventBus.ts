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
        
        // Log targeted cell updates to show the improvement
        if (key === 'StateChangeEvent.uiCellUpdate' && filter) {
            const targetedListeners = filterBucket?.size ?? 0;
            if (targetedListeners > 0) {
                // Only 1 listener (the targeted cell) instead of 5000+!
                if (Math.random() < 0.01) { // Sample 1% to avoid spam
                    console.log(`[EventBus] Targeted update to cell ${filter}: ${targetedListeners} listener (not 5000+!)`);
                }
            }
        }
        
        // Track performance for expensive events (uiVisualStates no longer used for cells)
        const isExpensiveEvent = key === 'StateChangeEvent.uiTransient';
        const startTime = isExpensiveEvent ? performance.now() : 0;
        const totalListeners = (bucket?.size ?? 0) + (filterBucket?.size ?? 0);
        
        // console.log(eventName);
        if (bucket && filterKey !== key) {
            for (const [, cb] of bucket) {
                try {
                    cb(structuredClone(eventData));
                } catch (err) {
                    if (!isTestEnvironment) {
                        console.log(`Error in listener for "${key}":`, err);
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
                        console.log(`Error in listener for "${filterKey}":`, err);
                    }
                }
            }
        }
        
        if (isExpensiveEvent) {
            const duration = performance.now() - startTime;
            // Only log if VERY slow - this is the main bottleneck
            if (duration > 100) {
                console.log(`[EventBus] ${key} dispatch slow: ${duration.toFixed(1)}ms for ${totalListeners} listeners`);
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
