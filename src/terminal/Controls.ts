import type { Direction } from "../common/interfaces.js";
import type { EventBuses } from "../common/events/index.js";
import * as readline from 'readline';

interface Key {
    sequence?: string;
    name?: string;
    ctrl?: boolean;
    meta?: boolean;
    shift?: boolean;
    code?: string;
}

export class Controls {
    private keyDirections: Record<string, Direction> = {
        w: 'up',
        a: 'left',
        s: 'down',
        d: 'right',
        q: 'up-left',
        e: 'up-right',
        z: 'down-left',
        c: 'down-right'
    }

    // Track currently pressed keys
    private pressedKeys: Set<string> = new Set();
    private movementInterval: NodeJS.Timeout | null = null;
    private readonly MOVEMENT_INTERVAL_MS = 150; // Send movement updates every 150ms while key is pressed

    constructor(
        private bus: EventBuses,
    ) {
        // Configure terminal
        readline.emitKeypressEvents(process.stdin);
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
        }
        process.stdin.on('keypress', (_str, key) => this.handleKeypress(key));

        // Start the continuous movement loop
        this.startMovementLoop();
    }

    private startMovementLoop(): void {
        // Clear any existing interval
        if (this.movementInterval) {
            clearInterval(this.movementInterval);
        }

        // Create a new interval that will dispatch movement events for pressed keys
        this.movementInterval = setInterval(() => {
            // If we have pressed keys, send the latest movement direction
            if (this.pressedKeys.size > 0) {
                // Get the latest pressed key (for now we'll prioritize the last key pressed)
                // Get all pressed keys and sort them to prioritize certain keys
                const pressedKeyArray = Array.from(this.pressedKeys);

                if (pressedKeyArray.length > 0) {
                    // For debugging
                    this.bus.ui.log(`Pressed keys: ${pressedKeyArray.join(', ')}`);

                    // Get the last pressed key for now - you might want more complex logic here
                    const latestKey = pressedKeyArray[pressedKeyArray.length - 1];
                    // Only look up direction if the key exists in our mapping
                    const direction = latestKey && this.keyDirections[latestKey];

                    if (direction) {
                        // Send continuous movement events while key is pressed
                        this.bus.movement.dispatch(this.bus.movement.events.direction, direction);
                    }
                }
            }
        }, this.MOVEMENT_INTERVAL_MS);
    }

    private handleKeypress(key: Key): void {
        // Handle CTRL+C to exit
        if (key.ctrl && key.name === 'c') {
            // console.clear();
            process.stdout.write('\x1B[?25h'); // Show cursor
            this.bus.ui.log('\nExiting...');
            // Clean up interval before exiting
            if (this.movementInterval) {
                clearInterval(this.movementInterval);
            }
            process.exit();
        }

        const keyName = key.name || '';
        const direction = this.keyDirections[keyName];

        if (direction) {
            this.bus.ui.log(`Key pressed: ${keyName}, direction: ${direction}`);

            // Track key press (add to set)
            this.pressedKeys.add(keyName);

            // Dispatch immediate movement event for responsiveness
            this.bus.movement.dispatch(this.bus.movement.events.direction, direction);
            this.bus.ui.log(`Movement direction event dispatched: ${direction}`);

            // Notify UI about currently pressed keys
            this.bus.ui.dispatch(this.bus.ui.events.keysPressed, Array.from(this.pressedKeys));

            // Handle key release
            // We're using setTimeout instead of keyup since Node.js doesn't distinguish
            // between keydown and keyup in raw mode
            setTimeout(() => {
                this.pressedKeys.delete(keyName);
                this.bus.ui.dispatch(this.bus.ui.events.keysPressed, Array.from(this.pressedKeys));

                // If no keys are pressed anymore, stop player movement
                if (this.pressedKeys.size === 0) {
                    this.bus.movement.dispatch(this.bus.movement.events.stopMovement, null);
                }
            }, 300);
        }
    }

    // Public method to get currently pressed movement keys
    public getPressedKeys(): string[] {
        return Array.from(this.pressedKeys);
    }
}
