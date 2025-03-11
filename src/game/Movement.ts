import type { Cell, Coord, Direction, IMovable, IPath, Speed } from "../common/interfaces.js";
import type { EventBuses } from "../common/events/index.js";

export class Movement {
    /**
     * Speed values for different movement speeds
     */
    private readonly speeds: Record<Speed, number> = {
        verySlow: 1,
        slow: 2,
        medium: 3,
        fast: 4,
        veryFast: 5,
    };

    /**
     * Mapping of directions to angle values (in degrees)
     */
    private readonly directions: Record<Direction, number> = {
        'down': 0,
        'down-right': 45,
        'right': 90,
        'up-right': 135,
        'up': 180,
        'up-left': 225,
        'left': 270,
        'down-left': 315,
    };

    /**
     * Sine values for each direction angle
     */
    private readonly sineValues: Record<number, number> = {
        0: 0,
        45: 0.7,
        90: 1,
        135: 0.7,
        180: 0,
        225: -0.7,
        270: -1,
        315: -0.7,
    };

    /**
     * Cosine values for each direction angle
     */
    private readonly cosineValues: Record<number, number> = {
        0: 1,
        45: 0.7,
        90: 0,
        135: -0.7,
        180: -1,
        225: -0.7,
        270: 0,
        315: 0.7,
    };

    /**
     * Orthogonal movement vectors (N, E, S, W)
     */
    private readonly orthogonal: readonly Coord[] = [
        { x: 0, y: 1 },  // North
        { x: 1, y: 0 },  // East
        { x: 0, y: -1 }, // South
        { x: -1, y: 0 }  // West
    ];

    /**
     * Diagonal movement vectors (NE, SE, SW, NW)
     */
    private readonly diagonal: readonly Coord[] = [
        { x: 1, y: 1 },   // Northeast
        { x: 1, y: -1 },  // Southeast
        { x: -1, y: -1 }, // Southwest
        { x: -1, y: 1 }   // Northwest
    ];

    /** The game map grid */
    private map: Cell[][] = [];

    /** List of all movable entities */
    private movables: IMovable[] = [];

    /** Reference to the player character */
    private player: IMovable | null = null;

    /** List of cell symbols that are valid for movement */
    private validCells: string[] = [];

    /**
     * Initialize the Movement system
     * @param bus - Event buses for communication
     */
    constructor(
        private readonly bus: EventBuses,
    ) {
        // Server events
        this.bus.server.listen(this.bus.server.events.map, this, (map: Cell[][]) => {
            if (map && Array.isArray(map)) {
                this.map = map;
            } else {
                this.bus.ui.log('ERROR: Received invalid map data');
            }
        });
        
        this.bus.server.listen(this.bus.server.events.validCells, this, (validCells: string[]) => {
            if (validCells && Array.isArray(validCells)) {
                this.validCells = validCells;
            } else {
                this.bus.ui.log('ERROR: Received invalid validCells data');
            }
        });
        
        this.bus.server.listen(this.bus.server.events.player, this, (player: IMovable) => {
            if (player) {
                this.player = player;
            } else {
                this.bus.ui.log('ERROR: Received invalid player data');
            }
        });
        
        this.bus.server.listen(this.bus.server.events.characters, this, (characters: IMovable[]) => {
            if (characters && Array.isArray(characters)) {
                // Store the characters locally
                this.movables = characters;

                // Log what we received
                this.bus.ui.log("Movement received characters:");
                characters.forEach(char => {
                    this.bus.ui.log(`${char.name}: position = ${JSON.stringify(char.position)}`);

                    // Notify renderer about each character's position
                    if (char.position) {
                        this.bus.movement.dispatch(this.bus.movement.events.position, char);
                    } else {
                        this.bus.ui.log(`ERROR: Character ${char.name} has no position!`);
                    }
                });
            } else {
                this.bus.ui.log('ERROR: Received invalid characters data');
            }
        });
        
        // Movement events
        this.bus.movement.listen(this.bus.movement.events.requestRoute, this, (path: IPath) => {
            if (path) {
                this.generateRoute(path);
            }
        });
        
        this.bus.movement.listen(this.bus.movement.events.direction, this, (direction: Direction) => {
            this.bus.ui.log('>>> - Movement - direction:', direction);

            if (!this.player) {
                this.bus.ui.log('ERROR: No player available for direction change');
                return;
            }
            
            if (!this.player.position) {
                this.bus.ui.log('ERROR: Player has no position for direction change');
                return;
            }
            
            // Update player direction based on input
            this.player.direction = direction;

            // Set player to walking state
            this.player.action = 'walk';

            // Create a new path in the direction player is facing
            const angle = this.directions[this.player.direction];
            const dx = Math.round(this.sineValues[angle] || 0);
            const dy = Math.round(this.cosineValues[angle] || 0);

            // Get target coordinate several steps in that direction
            // Increase the distance for smoother continuous movement
            const targetX = this.player.position.x + dx * 5;
            const targetY = this.player.position.y + dy * 5;

            // Check if target is valid
            const targetRow = this.map[targetY];
            if (targetY >= 0 && targetY < this.map.length &&
                targetX >= 0 && targetRow && targetX < targetRow.length &&
                this.isValidCell({ x: targetX, y: targetY })) {
                // Set new route - always update the route for continuous movement
                // Even if a route exists, replace it with the new direction
                const newRoute = this.shortestPath(this.player.position, { x: targetX, y: targetY });
                this.player.route = newRoute;
            }
        });

        // Handle stop movement event
        this.bus.movement.listen(this.bus.movement.events.stopMovement, this, () => {
            if (!this.player) {
                this.bus.ui.log('WARNING: No player to stop movement for');
                return;
            }
            
            // Set player to idle
            this.player.action = 'iddle';

            // Clear the route
            this.player.route = [];

            // Notify about the state change
            this.bus.movement.dispatch(this.bus.movement.events.move, this.player);
            this.bus.ui.log('Player movement stopped');
        });

        // Handle position updates
        this.bus.movement.listen(this.bus.movement.events.position, this, (character: IMovable) => {
            if (!character || !character.name) {
                this.bus.ui.log('ERROR: Received invalid character for position update');
                return;
            }
            
            if (!character.position) {
                this.bus.ui.log(`ERROR: Character ${character.name} has no position to update to`);
                return;
            }
            
            const movable = this.movables.find(m => m.name === character.name);
            if (movable) {
                movable.position = character.position;
                this.bus.ui.log('Updated position for', movable.name, 'to', JSON.stringify(movable.position));
            } else {
                this.bus.ui.log(`WARNING: Cannot find character ${character.name} to update position`);
            }
        });
        
        // Handle location-based positioning
        this.bus.movement.listen(this.bus.movement.events.location, this, (movable: IMovable) => {
            if (!movable || !movable.name) {
                this.bus.ui.log('ERROR: Received invalid movable for location positioning');
                return;
            }
            
            if (!movable.target) {
                this.bus.ui.log(`ERROR: Movable ${movable.name} has no target location`);
                return;
            }
            
            const position = this.findPosition(movable.target);
            if (position) {
                movable.position = position;

                // Initialize movement properties if they don't exist
                if (!movable.action) movable.action = 'iddle';
                if (!movable.direction) movable.direction = 'down';
                if (!movable.speed) movable.speed = 'medium';

                this.bus.movement.dispatch(this.bus.movement.events.position, movable);
                this.bus.ui.log('Set position for', movable.name, 'to', JSON.stringify(position));
            } else {
                this.bus.ui.log(`ERROR: Could not find valid position for location ${movable.target}`);
            }
        });
        
        // Handle animation frame updates
        this.bus.ui.listen(this.bus.ui.events.frame, this, (time: number) => {
            // Update position for each movable entity on every frame
            this.movables.forEach(movable => {
                if (movable) {
                    this.move(movable, time);
                }
            });
        });
    }

    /**
     * Move a character based on its current route and direction
     * @param movable - The character to move
     * @param time - Time elapsed since last frame in milliseconds
     */
    private move(movable: IMovable, time: number): void {
        // Check if this is the player
        const isPlayer = movable === this.player;

        // Early return if any required properties are missing
        if (movable.action !== 'walk' || 
            !movable.direction || 
            !movable.route?.length || 
            !movable.position) {
            
            // If character is currently not idle and has a position, set to idle
            if (movable.action !== 'iddle' && movable.position) {
                movable.action = 'iddle';
                this.bus.movement.dispatch(this.bus.movement.events.move, movable);
            }
            return;
        }

        this.bus.ui.log('>>> - Movement - move:', time, movable.action, movable.direction, movable.route.length);

        // Calculate distance based on speed and elapsed time
        const speedMultiplier = 5; // Use a multiplier to make movement more visible
        const movableSpeed = this.speeds[movable.speed] || this.speeds.medium; // Default to medium speed if undefined
        const distance = speedMultiplier * movableSpeed * time / 1000;
        const angle = this.directions[movable.direction];
        
        // Calculate horizontal and vertical components of movement
        const distanceX = distance * (this.sineValues[angle] || 0);
        const distanceY = distance * (this.cosineValues[angle] || 0);

        // Calculate next position
        const nextX = movable.position.x + distanceX;
        const nextY = movable.position.y + distanceY;

        // Get current cell center - first cell in the route
        const currentCell = movable.route[0];
        if (!currentCell) {
            // This shouldn't happen due to earlier checks, but added for safety
            this.bus.ui.log(`ERROR: No current cell in route for ${movable.name}`);
            return;
        }
        
        const cellCenterX = currentCell.x + 0.5;
        const cellCenterY = currentCell.y + 0.5;

        // Check if we're crossing the cell center in this move
        const crossedX = (movable.position.x < cellCenterX && nextX >= cellCenterX) ||
                        (movable.position.x > cellCenterX && nextX <= cellCenterX);
        const crossedY = (movable.position.y < cellCenterY && nextY >= cellCenterY) ||
                        (movable.position.y > cellCenterY && nextY <= cellCenterY);

        // If we crossed the center in either direction (based on our movement angle)
        // Use primary movement direction to determine which crossing matters
        const sineValue = this.sineValues[angle] || 0;
        const crossedCenter = Math.abs(sineValue) > 0.5 ? crossedX : crossedY;

        if (crossedCenter && movable.route.length > 0) {
            // Snap to center of the cell
            movable.position.x = cellCenterX;
            movable.position.y = cellCenterY;

            // Remove the current cell from the path
            movable.route.shift();

            // If there's a next cell, calculate new direction
            if (movable.route.length > 0) {
                const nextCell = movable.route[0];
                if (!nextCell) {
                    this.bus.ui.log(`ERROR: Next cell is undefined for ${movable.name}`);
                    return;
                }

                // Calculate angle to next cell
                const dx = nextCell.x - cellCenterX;
                const dy = nextCell.y - cellCenterY;

                // Convert to degrees (0 is down, 90 is right, etc.)
                let newAngle = Math.atan2(dx, dy) * (180 / Math.PI);

                // Normalize to nearest 45-degree increment
                newAngle = Math.round(newAngle / 45) * 45;

                // Ensure angle is between 0 and 360
                newAngle = ((newAngle % 360) + 360) % 360;

                // Find direction that matches this angle
                let directionFound = false;
                for (const [dir, dirAngle] of Object.entries(this.directions)) {
                    if (dirAngle === newAngle) {
                        movable.direction = dir as Direction;
                        directionFound = true;
                        break;
                    }
                }
                
                if (!directionFound) {
                    this.bus.ui.log(`WARNING: Could not find direction for angle ${newAngle}`);
                }
            }
            // If player has reached the end of their route and is still in 'walk' action
            // We'll auto-generate a new route in the same direction to continue movement
            else if (isPlayer && movable.action === 'walk') {
                // Create a new route in the same direction the player is facing
                const playerAngle = this.directions[movable.direction];
                const dx = Math.round(this.sineValues[playerAngle] || 0);
                const dy = Math.round(this.cosineValues[playerAngle] || 0);

                // Get target coordinate several steps in that direction
                const targetX = movable.position.x + dx * 5;
                const targetY = movable.position.y + dy * 5;

                // Check if target is valid before creating a new route
                const targetRow = this.map[targetY];
                if (targetY >= 0 && targetY < this.map.length &&
                    targetX >= 0 && targetRow && targetX < targetRow.length &&
                    this.isValidCell({ x: targetX, y: targetY })) {
                    // Set new route for continued movement
                    movable.route = this.shortestPath(movable.position, { x: targetX, y: targetY });
                }
            }
        } else {
            // Normal movement if we haven't crossed center
            movable.position.x = nextX;
            movable.position.y = nextY;
        }

        this.bus.ui.log('move',
            movable.route.length,
            movable.name,
            movable.position.x,
            movable.position.y,
            movable.direction,
        );

        // Notify about the movement
        this.bus.movement.dispatch(this.bus.movement.events.move, movable);
    }

    /**
     * Generate a route between two locations
     * @param path - Path object containing source and target locations
     */
    private generateRoute(path: IPath): void {
        if (!path.source || !path.target) {
            this.bus.ui.log('ERROR: Missing source or target for route generation');
            return;
        }
        
        const start = this.findPosition(path.source);
        const end = this.findPosition(path.target);

        if (!start || !end) {
            this.bus.ui.log('Cannot generate route: invalid start or end position');
            return;
        }

        // Get the shortest path between locations
        path.route = this.shortestPath(start, end);

        if (path.route.length === 0) {
            this.bus.ui.log('No valid route found from', path.source, 'to', path.target);
            return;
        }

        this.bus.ui.log('Generated route with', path.route.length, 'steps');

        // Send the calculated path back through the event system
        this.bus.movement.dispatch(this.bus.movement.events.path, path);

        // Find the character that requested this route
        const character = this.movables.find(m => m.name === path.source);
        if (!character) {
            this.bus.ui.log(`WARNING: Character ${path.source} not found for route application`);
            return;
        }
        
        // Set the character to start walking
        character.action = 'walk';
        character.route = path.route;

        // Calculate initial direction if route has at least 2 points
        if (path.route.length > 1 && path.route[0] && start) {
            const firstRoutePoint = path.route[0];
            const dx = firstRoutePoint.x - start.x;
            const dy = firstRoutePoint.y - start.y;

            // Get angle and convert to direction
            let angle = Math.atan2(dx, dy) * (180 / Math.PI);
            angle = Math.round(angle / 45) * 45;
            angle = ((angle % 360) + 360) % 360;

            // Find matching direction
            let directionFound = false;
            for (const [dir, dirAngle] of Object.entries(this.directions)) {
                if (dirAngle === angle) {
                    character.direction = dir as Direction;
                    directionFound = true;
                    break;
                }
            }
            
            if (!directionFound) {
                this.bus.ui.log(`WARNING: Could not find direction for angle ${angle}, defaulting to 'down'`);
                character.direction = 'down';
            }
        }
    }

    /**
     * Find the shortest path between two coordinates using BFS
     * @param start - Starting coordinate
     * @param end - Target coordinate
     * @returns Array of coordinates representing the path, or empty array if no path found
     */
    private shortestPath(start: Coord, end: Coord): Coord[] {
        // Validate start and end positions
        if (!this.isValidCell(start) || !this.isValidCell(end)) {
            this.bus.ui.log('No valid start or end position', start, end);
            return [];
        }

        const queue: Coord[] = [start];
        const visited = new Set<string>();
        const parent = new Map<string, Coord>();

        visited.add(this.coordToString(start));

        let current = queue.shift();
        while (current) {
            if (this.isEnd(current, end)) {
                return this.reconstructPath(current, parent);
            }

            for (const neighbor of this.getNeighbors(current)) {
                const neighborStr = this.coordToString(neighbor);
                if (!visited.has(neighborStr)) {
                    visited.add(neighborStr);
                    parent.set(neighborStr, current);
                    queue.push(neighbor);
                }
            }
            current = queue.shift();
        }

        this.bus.ui.log('No path found');
        return []; // No path found
    }

    /**
     * Find a valid position for a named location
     * @param location - Name of the location or character
     * @returns A valid coordinate or undefined if no position found
     */
    private findPosition(location: string): Coord | undefined {
        if (!location) {
            this.bus.ui.log('Empty location name provided');
            return undefined;
        }

        // First check if we're looking for a character by name
        const character = this.movables.find(c => c.name === location);
        let coords: Coord[] = [];

        if (character?.position) {
            // Get valid cells near the character
            coords = this.getNeighbors(character.position);
        } else {
            // Get cells matching the location name
            coords = this.getLocationCoords(location);
        }

        // If no valid positions found, log error and try to find any walkable position
        if (coords.length === 0) {
            this.bus.ui.log(`Target ${location} not found! Trying to find any valid position.`);

            // As a fallback, use the first valid position on the map
            for (let y = 0; y < this.map.length; y++) {
                for (let x = 0; x < (this.map[y]?.length || 0); x++) {
                    const testCoord = { x, y };
                    if (this.isValidCell(testCoord)) {
                        return testCoord;
                    }
                }
            }

            this.bus.ui.log(`CRITICAL: No valid positions found on the entire map!`);
            return undefined;
        }

        // Return a random valid position
        return coords[Math.floor(Math.random() * coords.length)];
    }

    /**
     * Find all coordinates matching a location name
     * @param location - Name of the location to find
     * @returns Array of coordinates where the location is found
     */
    private getLocationCoords(location: string): Coord[] {
        if (!location) {
            this.bus.ui.log('No location name provided to getLocationCoord');
            return [];
        }
        
        const matches: Coord[] = [];
        
        this.map.forEach((row, y) => {
            row.forEach((cell, x) => {
                if (cell.location?.includes(location)) {
                    matches.push({ x, y });
                }
            });
        });
        
        return matches;
    }

    /**
     * Get all valid neighboring cells for a given coordinate
     * @param coord - The coordinate to find neighbors for
     * @returns Array of valid neighboring coordinates
     */
    private getNeighbors(coord: Coord): Coord[] {
        const { x, y } = coord;
        const neighbors: Coord[] = [];

        // Add orthogonal neighbors (N, E, S, W)
        for (const move of this.orthogonal) {
            const newCoord = { x: x + move.x, y: y + move.y };
            if (this.isValidCell(newCoord)) {
                neighbors.push(newCoord);
            }
        }

        // Add diagonal neighbors (NE, SE, SW, NW) only if path isn't blocked
        for (const move of this.diagonal) {
            const newCoord = { x: x + move.x, y: y + move.y };
            // For diagonals, we need to check that the path isn't blocked
            // by ensuring both adjacent cells are also valid
            if (
                this.isValidCell(newCoord) &&
                this.isValidCell({ x: x, y: y + move.y }) &&
                this.isValidCell({ x: x + move.x, y: y })
            ) {
                neighbors.push(newCoord);
            }
        }

        return neighbors;
    }

    /**
     * Check if a cell at the given coordinates is valid for movement
     * @param coord - The coordinate to check
     * @returns True if the cell is valid for movement, false otherwise
     */
    private isValidCell(coord: Coord): boolean {
        const { x, y } = coord;
        
        // First check if coordinates are in bounds
        if (y < 0 || y >= this.map.length || x < 0) {
            return false;
        }
        
        const row = this.map[y];
        if (!row || x >= row.length) {
            return false;
        }

        const cell = row[x];
        if (!cell) {
            return false;
        }

        // Allow any cell if no valid cells are defined
        if (!this.validCells || this.validCells.length === 0) {
            this.bus.ui.log('WARNING: No valid cells defined!');
            return true;
        }

        // Special rules for the player
        if (this.player && this.player.position) {
            // Always allow the player to move anywhere (completely unrestricted movement)
            return true;
        }

        // Default rule: cell must be in the valid cells list and not a blocker
        return !cell.blocker && this.validCells.includes(cell.symbol);
    }

    /**
     * Check if the current coordinate equals the end coordinate
     * @param current - Current coordinate
     * @param end - Target coordinate
     * @returns True if coordinates are the same, false otherwise
     */
    private isEnd(current: Coord, end: Coord): boolean {
        return current.x === end.x && current.y === end.y;
    }

    /**
     * Reconstruct a path from the parent map created during pathfinding
     * @param current - The ending coordinate
     * @param parent - Map tracking the parent of each coordinate
     * @returns Array of coordinates forming the path
     */
    private reconstructPath(current: Coord, parent: Map<string, Coord>): Coord[] {
        const path: Coord[] = [];
        let curr: Coord | undefined = current;
        
        while (curr) {
            path.unshift(curr);
            const parentKey = this.coordToString(curr);
            curr = parent.get(parentKey);
        }
        
        return path;
    }

    /**
     * Convert a coordinate to a string key for use in maps and sets
     * @param coord - The coordinate to convert
     * @returns String representation of the coordinate
     */
    private coordToString(coord: Coord): string {
        return `${coord.x},${coord.y}`;
    }
}