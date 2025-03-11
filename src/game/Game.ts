import type { IState } from "../common/interfaces.js";
import type { EventBuses } from "../common/events/index.js";

export class Game {
    constructor(
        private bus: EventBuses,
        private state: IState,
    ) {
        // First, define valid cells for movement
        const validCells = [
            ' ',     // Empty space
            '╌',     // Dotted line
            '=',     // Control panel - IMPORTANT: This needs to be included!
            'P', 'D', // Character letters
            // Additional valid symbols for movement
            '┃', '┣', '┫', '┏', '┓', '┗', '┛', '━', '┻', '┳'  // All wall and passage characters
        ];

        // Set initial positions directly without relying on event callbacks
        this.initializeCharacterPositions();

        // Now dispatch events in the correct order
        this.bus.server.dispatch(this.bus.server.events.map, this.state.map);
        this.bus.server.dispatch(this.bus.server.events.validCells, validCells);

        // Send characters after they have positions
        const player = this.state.characters.find(c => c.letter === 'P');
        if (!player) {
            throw new Error(`NO player in characters (${this.state.characters.length})[${this.state.characters.map(c => c.name).join(', ')}]`);
        }

        this.bus.ui.log("Character positions before dispatch:");
        this.state.characters.forEach(c => {
            this.bus.ui.log(`${c.name}: position = ${JSON.stringify(c.position)}`);
        });

        // Dispatch the characters with their positions
        this.bus.server.dispatch(this.bus.server.events.characters, this.state.characters);
        this.bus.server.dispatch(this.bus.server.events.player, player);

        // Start conversation
        this.bus.server.dispatch(this.bus.server.events.speech, {
            type: 'speech',
            source: 'Data',
            target: 'Jim',
            content: 'What do you want to do?',
            answers: ['Attack', 'Defend', 'Run'],
        });
    }

    /**
     * Initialize character positions directly without using the event system
     * This ensures positions are set before any events are dispatched
     */
    private initializeCharacterPositions(): void {
        this.state.characters.forEach(character => {
            if (character.target) {
                // Get all cells with this location that are empty spaces
                const matchingCells: Array<{ x: number, y: number }> = [];

                // Search the map for matching locations
                this.state.map.forEach((row, y) => {
                    row.forEach((cell, x) => {
                        // Only include cells that are empty spaces (' ') and have the required location
                        if (cell.location?.includes(character.target!) && cell.symbol === ' ') {
                            matchingCells.push({ x, y });
                            this.bus.ui.log(`Found valid spawn location at (${x},${y}) for ${character.name} in ${character.target}`);
                        }
                    });
                });

                if (matchingCells.length > 0) {
                    // Choose a random position from matching cells
                    const position = matchingCells[Math.floor(Math.random() * matchingCells.length)];
                    character.position = position;

                    // Ensure action and direction are set
                    if (!character.action) character.action = 'iddle';
                    if (!character.direction) character.direction = 'down';

                    this.bus.ui.log(`Set position for ${character.name} to ${JSON.stringify(position)}`);
                } else {
                    this.bus.ui.log(`WARN: No matching empty space found for ${character.target}, finding any empty cell`);

                    // Fallback to any open space
                    for (let y = 0; y < this.state.map.length; y++) {
                        const row = this.state.map[y];
                        if (!row) continue;
                        
                        for (let x = 0; x < row.length; x++) {
                            const cell = row[x];
                            if (cell && cell.symbol === ' ') {
                                character.position = { x, y };
                                this.bus.ui.log(`Fallback position for ${character.name}: ${JSON.stringify({ x, y })}`);
                                return;
                            }
                        }
                    }
                }
            }
        });
    }
}
