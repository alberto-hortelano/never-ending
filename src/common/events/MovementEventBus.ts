import type { Direction, IMovable, IPath } from "../interfaces.js";
import { EventBus, EventCallback } from "./EventBus.js";

enum MovementEvent {
    position = 'position',
    direction = 'direction',
    move = 'move',
    path = 'path',
    requestRoute = 'requestRoute',
    location = 'location',
    stopMovement = 'stopMovement',
}

export class MovementEventBus extends EventBus {
    readonly events = MovementEvent;

    override listen(eventName: MovementEvent.position, listener: object, cb: EventCallback<IMovable>): void;
    override listen(eventName: MovementEvent.direction, listener: object, cb: EventCallback<Direction>): void;
    override listen(eventName: MovementEvent.move, listener: object, cb: EventCallback<IMovable>): void;
    override listen(eventName: MovementEvent.path, listener: object, cb: EventCallback<IPath>): void;
    override listen(eventName: MovementEvent.requestRoute, listener: object, cb: EventCallback<IPath>): void;
    override listen(eventName: MovementEvent.location, listener: object, cb: EventCallback<IMovable>): void;
    override listen(eventName: MovementEvent.stopMovement, listener: object, cb: EventCallback<null>): void;
    override listen<T>(
        eventName: MovementEvent,
        listener: object,
        cb: EventCallback<T>
    ): void {
        super.listen(eventName, listener, cb);
    }

    override dispatch(eventName: MovementEvent.position, eventData: IMovable): void;
    override dispatch(eventName: MovementEvent.direction, eventData: Direction): void;
    override dispatch(eventName: MovementEvent.move, eventData: IMovable): void;
    override dispatch(eventName: MovementEvent.path, eventData: IPath): void;
    override dispatch(eventName: MovementEvent.requestRoute, eventData: IPath): void;
    override dispatch(eventName: MovementEvent.location, eventData: IMovable): void;
    override dispatch(eventName: MovementEvent.stopMovement, eventData: null): void;
    override dispatch<T>(
        eventName: MovementEvent,
        eventData: T
    ): void {
        super.dispatch(eventName, eventData);
    }
}
