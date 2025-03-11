import { EventBus, EventCallback } from "./EventBus.js";

enum UiEvent {
    // The user press a key
    keyPress = 'keyPress',
    // New frame by the ui with the time since last one
    frame = 'frame',
    // Log something to the ui
    log = 'log',
    // Currently pressed movement keys
    keysPressed = 'keysPressed',
}

export class UiEventBus extends EventBus {
    readonly events = UiEvent;

    /**
     * Log messages to the UI
     * @param args - Values to log
     */
    log(...args: unknown[]): void {
        this.dispatch(this.events.log, args);
    }

    override listen(eventName: UiEvent.log, listener: object, cb: EventCallback<unknown[]>): void;
    override listen(eventName: UiEvent.frame, listener: object, cb: EventCallback<number>): void;
    override listen(eventName: UiEvent.keyPress, listener: object, cb: EventCallback<string>): void;
    override listen(eventName: UiEvent.keysPressed, listener: object, cb: EventCallback<string[]>): void;
    override listen<T>(
        eventName: UiEvent,
        listener: object,
        cb: EventCallback<T>
    ): void {
        super.listen(eventName, listener, cb);
    }

    override dispatch(eventName: UiEvent.log, eventData: unknown[]): void;
    override dispatch(eventName: UiEvent.frame, eventData: number): void;
    override dispatch(eventName: UiEvent.keyPress, eventData: string): void;
    override dispatch(eventName: UiEvent.keysPressed, eventData: string[]): void;
    override dispatch<T>(
        eventName: UiEvent,
        eventData: T
    ): void {
        super.dispatch(eventName, eventData);
    }
}
