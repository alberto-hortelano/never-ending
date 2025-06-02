import type { ICoord } from "../interfaces";

interface Room {
    size: 3 | 5 | 7 | 9 | 11;
    center?: ICoord;
}

type Direction = 'up' | 'right' | 'down' | 'left';

export class MapGenerator {
    private map: number[][];
    private roomCenters: ICoord[] = [];

    constructor(private width: number = 50, private height: number = 50) {
        this.width = width;
        this.height = height;
        this.map = Array(height).fill(null).map(() => Array(width).fill(0));
    }

    public getCells() {
        return this.map.map((row, y) => row.map((cell, x) => ({
            position: { x, y },
            locations: [],
            elements: [],
            content: {
                position: { x, y },
                location: '',
                blocker: !cell,
            },
        })))
    }

    generateMap(rooms: Room[]): number[][] {
        this.roomCenters = [];
        this.map = Array(this.height).fill(null).map(() => Array(this.width).fill(0));

        if (rooms.length === 0) {
            return this.map;
        }

        let currentCenter: ICoord = { x: Math.floor(this.width / 2), y: Math.floor(this.height / 2) };
        let previousDirection: Direction | null = null;

        for (let i = 0; i < rooms.length; i++) {
            const room = rooms[i];
            if (!room) continue;

            const nextRoom = rooms[i + 1];

            if (i === 0) {
                room.center = currentCenter;
                this.roomCenters.push(currentCenter);
                this.carveRoom(room);
                this.printMap(this.map);
            } else {
                // Find next position
                const newCenter = this.findNextRoomPosition(
                    currentCenter,
                    room,
                    nextRoom,
                    previousDirection
                );

                room.center = newCenter;
                this.roomCenters.push(newCenter);
                this.carveRoom(room);
                this.printMap(this.map);

                // Connect rooms with corridor
                this.carveCorridorBetween(currentCenter, newCenter);

                // Update previous direction
                previousDirection = this.getDirection(currentCenter, newCenter);
            }

            if (room.center) {
                currentCenter = room.center;
            }
        }

        return this.map;
    }

    private findNextRoomPosition(
        currentCenter: ICoord,
        currentRoom: Room,
        nextRoom: Room | undefined,
        previousDirection: Direction | null
    ): ICoord {
        const currentRoomRadius = Math.ceil(currentRoom.size / 2);
        const nextRoomRadius = nextRoom ? Math.ceil(nextRoom.size / 2) : currentRoomRadius;
        const minDistance = currentRoomRadius + nextRoomRadius; // Sum of radii for proper separation
        const maxDistance = minDistance * 3; // n times the min distance (using 3 as default)

        const availableDirections: Direction[] = ['up', 'right', 'down', 'left'];

        // Remove previous direction if it exists
        if (previousDirection) {
            const oppositeDirection = this.getOppositeDirection(previousDirection);
            const filteredDirections = availableDirections.filter(dir => dir !== oppositeDirection);
            availableDirections.length = 0;
            availableDirections.push(...filteredDirections);
        }

        let attempts = 0;
        const maxAttempts = 100;

        while (attempts < maxAttempts) {
            // Choose random direction
            const direction = availableDirections[Math.floor(Math.random() * availableDirections.length)];
            if (!direction) continue;

            // Choose random distance
            const distance = Math.floor(Math.random() * (maxDistance - minDistance + 1)) + minDistance;

            // Calculate new position
            const newCenter = this.moveInDirection(currentCenter, direction, distance);

            // Check if position is valid
            if (this.isValidRoomPosition(newCenter, currentRoom, minDistance)) {
                return newCenter;
            }

            attempts++;
        }

        // Fallback: just move right by min distance
        return this.moveInDirection(currentCenter, 'right', minDistance);
    }

    private moveInDirection(center: ICoord, direction: Direction, distance: number): ICoord {
        switch (direction) {
            case 'up':
                return { x: center.x, y: center.y - distance };
            case 'right':
                return { x: center.x + distance, y: center.y };
            case 'down':
                return { x: center.x, y: center.y + distance };
            case 'left':
                return { x: center.x - distance, y: center.y };
        }
    }

    private getDirection(from: ICoord, to: ICoord): Direction {
        const dx = to.x - from.x;
        const dy = to.y - from.y;

        if (Math.abs(dx) > Math.abs(dy)) {
            return dx > 0 ? 'right' : 'left';
        } else {
            return dy > 0 ? 'down' : 'up';
        }
    }

    private getOppositeDirection(direction: Direction): Direction {
        switch (direction) {
            case 'up': return 'down';
            case 'down': return 'up';
            case 'left': return 'right';
            case 'right': return 'left';
        }
    }

    private isValidRoomPosition(center: ICoord, room: Room, minDistance: number): boolean {
        const roomRadius = Math.ceil(room.size / 2);

        // Check if room fits within map bounds
        if (center.x - roomRadius < 0 || center.x + roomRadius >= this.width ||
            center.y - roomRadius < 0 || center.y + roomRadius >= this.height) {
            return false;
        }

        // Check distance from other room centers
        for (const existingCenter of this.roomCenters) {
            const distance = Math.abs(center.x - existingCenter.x) + Math.abs(center.y - existingCenter.y);
            if (distance < minDistance) {
                return false;
            }
        }

        return true;
    }

    private carveRoom(room: Room): void {
        if (!room.center) return;

        const radius = Math.floor(room.size / 2);
        const { x: centerX, y: centerY } = room.center;

        for (let y = centerY - radius; y <= centerY + radius; y++) {
            for (let x = centerX - radius; x <= centerX + radius; x++) {
                if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
                    const row = this.map[y];
                    if (row) {
                        row[x] = 1; // walkable floor
                    }
                }
            }
        }
    }

    private carveCorridorBetween(from: ICoord, to: ICoord): void {
        // Simple L-shaped corridor
        const current = { ...from };

        // Move horizontally first
        while (current.x !== to.x) {
            if (current.x >= 0 && current.x < this.width &&
                current.y >= 0 && current.y < this.height) {
                const row = this.map[current.y];
                if (row) {
                    row[current.x] = 1;
                }
            }
            current.x += current.x < to.x ? 1 : -1;
        }

        // Then move vertically
        while (current.y !== to.y) {
            if (current.x >= 0 && current.x < this.width &&
                current.y >= 0 && current.y < this.height) {
                const row = this.map[current.y];
                if (row) {
                    row[current.x] = 1;
                }
            }
            current.y += current.y < to.y ? 1 : -1;
        }

        // Ensure destination is walkable
        if (to.x >= 0 && to.x < this.width && to.y >= 0 && to.y < this.height) {
            const row = this.map[to.y];
            if (row) {
                row[to.x] = 1;
            }
        }
    }

    getMap(): number[][] {
        return this.map;
    }

    getRoomCenters(): ICoord[] {
        return [...this.roomCenters];
    }

    private printMap = (map: number[][]) => console.log(map.map(row => row.map(cell => cell ? ' ' : '#').join('')).join('\n'));
}