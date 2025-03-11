# Analysis of the Event System

## Current Structure

The application uses a publish-subscribe (pub/sub) event system with three main event buses:

1. ServerEventBus: Handles game state events (map, characters, player, etc.)
2. MovementEventBus: Manages character movement (position, direction, pathing)
3. UiEventBus: Handles UI-related events (rendering, input, logging)

## Strengths

1. Clear separation of concerns: Each bus has a specific purpose
2. Type safety: TypeScript interfaces ensure proper event payloads
3. Modular architecture: Components communicate without tight coupling
4. Deep cloning: Events use structuredClone to avoid mutation issues
5. Asynchronous handling: Uses queueMicrotask for non-blocking operations

## Issues and Improvement Opportunities

1. Initialization Sequence Issues
- Events are sometimes dispatched before components are ready
- Characters need positions before they can be properly rendered
- Solution: Implement a staged initialization system with ready events
2. Cyclic Dependencies
- Movement depends on server events and UI events
- Renderer receives events from both server and movement
- Solution: Introduce a mediator pattern or command queue
3. Error Handling
- No centralized error tracking or recovery mechanism
- Errors in one component can cause cascading failures
- Solution: Add error events and recovery strategies
4. Performance Considerations
- Deep cloning of large objects (like the map) can be expensive
- Solution: Selective deep cloning or immutable data structures
5. Debugging Challenges
- Event flow is difficult to trace through the system
- Solution: Add event tracing/logging system

## Proposed Improvements

1. Staged Initialization
// Add ready events to each bus
enum ServerEvent {
    // ...existing events
    ready = 'ready',
    initialized = 'initialized'
}

// In Game.ts
constructor() {
    // Initialize components
    this.initializeMap();
    this.initializeCharacters();

    // Signal completion
    this.bus.server.dispatch(this.bus.server.events.initialized, true);
}

2. Event Mediator
// Create a central event mediator
class EventMediator {
    private buses: EventBuses;
    private commandQueue: Array<() => void> = [];

    constructor(buses: EventBuses) {
    this.buses = buses;
    }

    queue(command: () => void) {
    this.commandQueue.push(command);
    }

    process() {
    while (this.commandQueue.length > 0) {
        const command = this.commandQueue.shift();
        command?.();
    }
    }
}

3. Event Tracing
// Add tracing to EventBus base class
dispatch<T>(eventName: string, eventData: T): void {
    console.debug(`[EVENT] ${this.constructor.name}: ${eventName}`);
    // ...existing code
}

4. Simplified Position Management
// Create position manager
class PositionManager {
    private map: Cell[][];
    private entities: Map<string, IMovable> = new Map();

    setPosition(entity: IMovable, position: Coord) {
    entity.position = position;
    this.entities.set(entity.name, entity);
    return entity;
    }

    getByName(name: string): IMovable | undefined {
    return this.entities.get(name);
    }
}

5. Optimized Events
// Only deep clone when necessary
dispatch<T>(eventName: string, eventData: T): void {
    // Skip expensive cloning for simple types
    const shouldClone = typeof eventData === 'object' && eventData !== null;
    const data = shouldClone ? structuredClone(serialize(eventData)) : eventData;

    listenerCbs.forEach(cb => {
    queueMicrotask(() => cb(data));
    });
}

These improvements would make the event system more robust, easier to debug, and improve
performance while maintaining the existing architecture's flexibility.
