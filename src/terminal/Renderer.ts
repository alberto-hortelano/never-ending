import type { Cell, IMovable } from '../common/interfaces.js';
import type { EventBuses } from '../common/events/index.js';
import * as readline from 'readline';

// Refresh more frequently for smoother animation
const loopInterval = 100;

export class Renderer {
    private map: Cell[][] = [];
    private movables: IMovable[] = [];
    private currentQuestion: string = '';
    private currentAnswers: string[] = [];
    private selectedAnswerIndex: number = 0;
    private logs: string[] = [];
    private pressedKeys: string[] = [];

    private topLeftContent: string[] = [];
    private topRightContent: string[] = [];
    private bottomLeftContent: string[] = [];
    private bottomRightContent: string[] = [];

    private terminalWidth: number = process.stdout.columns || 80;
    private terminalHeight: number = process.stdout.rows || 24;
    private quadrantWidth: number;
    private quadrantHeight: number;
    // private isRendering: boolean = false;

    constructor(
        private bus: EventBuses,
    ) {
        this.quadrantWidth = Math.floor(this.terminalWidth / 2);
        this.quadrantHeight = Math.floor(this.terminalHeight / 2);

        // Clear screen on start
        console.clear();

        this.bus.server.listen(this.bus.server.events.map, this, map => this.onNewMap(map));
        this.bus.server.listen(this.bus.server.events.characters, this, characters => characters.forEach(character => this.onNewMovables(character)));
        this.bus.server.listen(this.bus.server.events.speech, this, speech => this.onSpeech(speech));
        this.bus.movement.listen(this.bus.movement.events.move, this, movable => this.move(movable));
        this.bus.ui.listen(this.bus.ui.events.log, this, msg => this.log(msg));

        // Listen for pressed keys updates
        this.bus.ui.listen(this.bus.ui.events.keysPressed, this, keys => {
            this.pressedKeys = keys;
            this.updateCharacterStatus();
        });

        // The Loop
        setInterval(() => {
            this.loop();
        }, loopInterval);
    }

    private move(movable: IMovable) {
        // Find the character in our local list
        const movingCharacter = this.movables.find(c => movable.name === c.name);
        if (!movingCharacter) {
            this.bus.ui.log(`Warning: No character ${movable.name} found in Renderer`);
            // Add it to our list if it doesn't exist
            this.movables.push(movable);
            return;
        }

        if (!movable.position) {
            this.bus.ui.log(`Warning: No position for ${movable.name}`);
            return;
        }

        // Update character's position
        movingCharacter.position = {
            x: movable.position.x,
            y: movable.position.y,
        };

        // Update action and direction
        movingCharacter.action = movable.action;
        movingCharacter.direction = movable.direction;

        // Redraw map with updated character position
        this.updateMapDisplay();
    }

    private writeToTopLeft(content: string): void {
        this.topLeftContent = content.split('\n');
    }

    private writeToTopRight(content: string): void {
        this.topRightContent = content.split('\n');
    }

    private writeToBottomLeft(content: string): void {
        this.bottomLeftContent = content.split('\n');
    }

    private writeToBottomRight(content: string): void {
        this.bottomRightContent = content.split('\n');
    }

    private padContent(content: string[], maxWidth: number, maxHeight: number): string[] {
        const paddedContent = [...content];
        while (paddedContent.length < maxHeight) {
            paddedContent.push(' '.repeat(maxWidth));
        }
        return paddedContent.map(line => {
            const paddedLine = line + ' '.repeat(maxWidth);
            return paddedLine.substring(0, maxWidth);
        }).slice(0, maxHeight);
    }

    private renderQuadrant(content: string[], startX: number, startY: number): void {
        const paddedContent = this.padContent(content, this.quadrantWidth - 1, this.quadrantHeight - 1);
        paddedContent.forEach((line, index) => {
            readline.cursorTo(process.stdout, startX, startY + index);
            process.stdout.write(line);
        });
    }

    private renderDividers(): void {
        // Horizontal divider
        readline.cursorTo(process.stdout, 0, Math.floor(this.terminalHeight / 2));
        process.stdout.write('─'.repeat(this.terminalWidth));

        // Vertical divider
        for (let i = 0; i < this.terminalHeight; i++) {
            readline.cursorTo(process.stdout, Math.floor(this.terminalWidth / 2), i);
            process.stdout.write('│');
        }

        // Center intersection
        readline.cursorTo(process.stdout, Math.floor(this.terminalWidth / 2), Math.floor(this.terminalHeight / 2));
        process.stdout.write('┼');
    }

    private render(): void {
        // Clear screen and reset cursor
        console.clear();
        readline.cursorTo(process.stdout, 0, 0);

        // Hide cursor during rendering
        process.stdout.write('\x1B[?25l');

        // Render each quadrant
        this.renderQuadrant(this.topLeftContent, 0, 0);
        this.renderQuadrant(this.topRightContent, this.quadrantWidth + 1, 0);
        this.renderQuadrant(this.bottomLeftContent, 0, this.quadrantHeight + 1);
        this.renderQuadrant(this.bottomRightContent, this.quadrantWidth + 1, this.quadrantHeight + 1);

        // Render dividers
        this.renderDividers();

        // Show cursor and move it to bottom
        process.stdout.write('\x1B[?25h');
        readline.cursorTo(process.stdout, 0, this.terminalHeight - 1);
    }

    private onSpeech(conversation: { content: string; answers: string[] }) {
        this.currentQuestion = conversation.content;
        this.currentAnswers = conversation.answers;
        this.selectedAnswerIndex = 0;
        this.updateConversationBox();
    }

    private onNewMap(map: Cell[][]) {
        this.log(['Received new map', map.length, 'rows', map[0]?.length, 'cols']);
        this.map = map;
        this.updateMapDisplay();
    }

    private onNewMovables(movable: IMovable) {
        // Check if we already have this character
        const existingIndex = this.movables.findIndex(m => m.name === movable.name);

        if (existingIndex >= 0) {
            // Update existing character
            this.movables[existingIndex] = movable;
            this.log(`Updated existing character: ${movable.name} at position ${JSON.stringify(movable.position)}`);
        } else {
            // Add new character
            this.movables.push(movable);
            this.log(`Added new character: ${movable.name} at position ${JSON.stringify(movable.position)}`);
        }

        this.updateMapDisplay();
    }

    private updateMapDisplay(): void {
        const mapOutput = this.generateMapOutput();
        this.writeToTopLeft(mapOutput);
    }

    private generateMapOutput(): string {
        if (!this.map || this.map.length === 0) {
            return "Map not loaded yet...";
        }

        // Create a copy of the map with symbols
        const mapSymbols = this.map.map(row => row.map(col => col.symbol));

        // Log current character positions
        this.bus.ui.log("Current character positions:");
        this.movables.forEach(char => {
            this.bus.ui.log(`${char.name}: ${JSON.stringify(char.position)}`);
        });

        // Sort movables by importance (player first, then others)
        const sortedMovables = [...this.movables].sort((a, b) => {
            if (a.letter === 'P') return 1; // Player should be rendered last (on top)
            if (b.letter === 'P') return -1;
            return 0;
        });

        // Add character markers to the map
        sortedMovables.forEach(character => {
            if (character.position) {
                const x = Math.round(character.position.x);
                const y = Math.round(character.position.y);
                const row = mapSymbols[y];
                if (!row) {
                    return;
                }
                // Check array bounds before placing
                if (y >= 0 && y < mapSymbols.length &&
                    x >= 0 && x < row.length) {

                    // Choose display character based on action and direction
                    let displayChar = character.letter;

                    // Add directional indicators based on character direction
                    if (character.direction) {
                        // Use unicode arrows to indicate direction
                        const directionSymbols: Record<string, string> = {
                            'up': '↑',
                            'up-right': '↗',
                            'right': '→',
                            'down-right': '↘',
                            'down': '↓',
                            'down-left': '↙',
                            'left': '←',
                            'up-left': '↖'
                        };

                        // Use the direction symbol if available, otherwise use the character letter
                        if (character.action === 'walk') {
                            displayChar = directionSymbols[character.direction] || character.letter;
                        }
                    }

                    // Apply color based on character state
                    // ANSI color codes: \x1b[COLORm
                    let coloredChar = displayChar;
                    if (character.letter === 'P') {
                        // Player is bright green
                        coloredChar = `\x1b[92m${displayChar}\x1b[0m`;
                    } else if (character.action === 'walk') {
                        // Walking characters are yellow
                        coloredChar = `\x1b[33m${displayChar}\x1b[0m`;
                    } else {
                        // Idle characters are blue
                        coloredChar = `\x1b[34m${displayChar}\x1b[0m`;
                    }

                    row[x] = coloredChar;
                }
            }
        });

        // Display character status in top-right corner
        this.updateCharacterStatus();

        // Join the map symbols into a string
        return mapSymbols.map(r => r.join('')).join('\n');
    }

    private updateCharacterStatus(): void {
        // Create a status display for all characters
        const statusLines = ['CHARACTERS:', '------------'];

        this.movables.forEach(character => {
            const position = character.position ?
                `(${Math.round(character.position.x)},${Math.round(character.position.y)})` :
                `(${JSON.stringify(character.position)})`;

            const action = character.action || 'idle';
            const direction = character.direction || 'none';

            let statusLine = `${character.name} [${character.letter}]: ${position} ${action} ${direction}`;

            // Highlight player
            if (character.letter === 'P') {
                statusLine = `> ${statusLine}`;
            }

            statusLines.push(statusLine);
        });

        // Add pressed keys display
        if (this.pressedKeys.length > 0) {
            statusLines.push('');
            statusLines.push('PRESSED KEYS:');
            statusLines.push('------------');

            // Create a keyboard-like layout
            const keyboardLayout = [
                ['q', 'w', 'e'],
                ['a', 's', 'd'],
                ['z', ' ', 'c']
            ];

            const renderedKeyboard = keyboardLayout.map(row => {
                return row.map(key => {
                    if (key === ' ') return '   ';
                    const isPressed = this.pressedKeys.includes(key);
                    // Add color and brackets to pressed keys
                    return isPressed ? `\x1b[32m[${key}]\x1b[0m` : ` ${key} `;
                }).join(' ');
            });

            statusLines.push(...renderedKeyboard);

            // Map keys to their directions
            const keyDirections: Record<string, string> = {
                w: 'up',
                a: 'left',
                s: 'down',
                d: 'right',
                q: 'up-left',
                e: 'up-right',
                z: 'down-left',
                c: 'down-right'
            };

            // Show active directions
            const activeDirections = this.pressedKeys.map(key => keyDirections[key]).filter(Boolean);
            if (activeDirections.length > 0) {
                statusLines.push('');
                statusLines.push(`Direction: ${activeDirections.join(', ')}`);
            }
        }

        this.writeToBottomRight(statusLines.join('\n'));
    }

    private updateConversationBox() {
        const conversationContent = [
            '-'.repeat(this.quadrantWidth - 2),
            this.currentQuestion,
            '',
            ...this.currentAnswers.map((answer, index) =>
                index === this.selectedAnswerIndex ? `> ${answer}` : `  ${answer}`
            )
        ].join('\n');

        this.writeToTopRight(conversationContent);
    }

    private log(msgs: string | any[]) {
        if (!Array.isArray(msgs)) {
            msgs = [msgs];
        }
        const line = msgs.map((msg: any) => ['string', 'object'].includes(typeof msg) ? JSON.stringify(msg) : String(msg)).join(' - ')
        this.logs.push(line);
        const height = Math.floor(this.terminalHeight / 2) - 1;
        if (this.logs.length > height) {
            this.logs = this.logs.slice(-height);
        }
        this.writeToBottomLeft(this.logs.join('\n'));
    }

    private lastTime = Date.now();

    private loop() {
        const currentTime = Date.now();
        const elapsed = currentTime - this.lastTime;
        this.lastTime = currentTime;

        // Dispatch frame event with time since last frame
        this.bus.ui.dispatch(this.bus.ui.events.frame, elapsed);

        // Render the screen
        this.render();

        // Display animation frame rate in bottom corner
        const fps = Math.round(1000 / elapsed);
        readline.cursorTo(process.stdout, this.terminalWidth - 10, this.terminalHeight - 1);
        process.stdout.write(`FPS: ${fps}`);
    }
}
