export type EventCallback<T> = (data: T) => void;

/**
 * Serializes an object by recursively removing functions
 * @param input - The object to serialize
 * @returns The serialized object
 */
function serialize<T>(input: T): unknown {
    if (input === null || typeof input !== "object") {
        // Base case: Primitive types are directly returned.
        return input;
    }

    if (Array.isArray(input)) {
        // Handle arrays: Recursively process each element.
        return input.map(serialize);
    }

    // Handle objects: Filter out methods and recursively serialize properties.
    const serializedObject: Record<string, unknown> = {};
    Object.entries(input as Record<string, unknown>).forEach(([key, value]) => {
        if (typeof value !== "function") {
            serializedObject[key] = serialize(value);
        }
    });

    return serializedObject;
}

/**
 * Abstract EventBus class that provides typed event handling
 */
export abstract class EventBus {
    private listeners = new Map<string, Map<object, EventCallback<unknown>>>();

    /**
     * Register an event listener
     * @param eventName - The name of the event to listen for
     * @param listener - The object that is listening (for reference)
     * @param cb - The callback function to execute when the event is dispatched
     */
    listen<T>(
        eventName: string,
        listener: object,
        cb: EventCallback<T>
    ): void {
        let listeners = this.listeners.get(eventName);
        if (!listeners) {
            listeners = new Map();
            this.listeners.set(eventName, listeners);
        }
        if (listeners.has(listener)) {
            throw new Error(`Listener ${eventName} already set for ${listener.constructor?.name}`);
        }
        // Type assertion needed here because we're storing callbacks for different event types
        listeners.set(listener, cb as EventCallback<unknown>);
    }

    /**
     * Dispatch an event to all registered listeners
     * @param eventName - The name of the event to dispatch
     * @param eventData - The data to pass to event listeners
     */
    dispatch<T>(
        eventName: string,
        eventData: T
    ): void {
        const listenerCbs = this.listeners.get(eventName);
        if (!listenerCbs) {
            console.error('No listeners for', eventName);
            return;
        }
        listenerCbs.forEach((cb, listener) => {
            if (!cb) {
                throw new Error(`No callback for event ${eventName} at ${listener.constructor?.name}`);
            }
            
            // Use type assertion since we know this callback is for this event type
            const typedCallback = cb as EventCallback<T>;
            
            // Schedule callback to run asynchronously
            queueMicrotask(() => {
                // Clone and serialize data to prevent mutation issues
                const safeData = structuredClone(serialize(eventData));
                typedCallback(safeData as T);
            });
        });
    }

    /**
     * Remove all event listeners for the specified target
     * @param target - The object whose listeners should be removed
     */
    remove(target: object): void {
        this.listeners.forEach(listener => listener.delete(target));
    }
}
