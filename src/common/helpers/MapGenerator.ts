import type { ICoord } from "../interfaces";

interface Room {
    size: 0 | 3 | 5 | 7 | 9 | 11;
    center?: ICoord;
}

type Direction = 'up' | 'right' | 'down' | 'left';

export class MapGenerator {
    private map: number[][];
    private roomCenters: ICoord[] = [];

    constructor(
        private width: number = 50,
        private height: number = 50,
        private startingPoint = { x: Math.floor(width / 2), y: Math.floor(height / 2) }
    ) {
        this.width = width;
        this.height = height;
        this.map = Array(height).fill(null).map(() => Array(width).fill(0));

        // Ensure starting point is safe (at least 6 units from edges for largest room)
        const minBorder = 5;
        this.startingPoint = {
            x: Math.max(minBorder, Math.min(this.width - minBorder, this.startingPoint.x)),
            y: Math.max(minBorder, Math.min(this.height - minBorder, this.startingPoint.y))
        };
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

        let currentCenter: ICoord = this.startingPoint;
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
            console.log('>>> - MapGenerator - generateMap - room:', room.size, room.center)
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
        const minDistance = currentRoomRadius + nextRoomRadius + 3; // Just enough separation plus small buffer
        const maxDistance = Math.min(minDistance * 2, Math.min(this.width, this.height) / 3); // Cap at reasonable distance

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

        // Fallback: find a safe position within bounds
        return this.findSafePosition(currentCenter, currentRoom, minDistance);
    }

    private findSafePosition(currentCenter: ICoord, room: Room, minDistance: number): ICoord {
        const roomRadius = Math.ceil(room.size / 2);

        // Try all directions with progressively smaller distances
        const directions: Direction[] = ['right', 'down', 'left', 'up'];

        for (const direction of directions) {
            for (let distance = minDistance; distance >= 3; distance -= 1) {
                const newCenter = this.moveInDirection(currentCenter, direction, distance);

                // Check bounds with room radius
                if (newCenter.x - roomRadius >= 0 &&
                    newCenter.x + roomRadius < this.width &&
                    newCenter.y - roomRadius >= 0 &&
                    newCenter.y + roomRadius < this.height) {

                    // Check distance from existing rooms
                    let validDistance = true;
                    for (const existingCenter of this.roomCenters) {
                        const dist = Math.abs(newCenter.x - existingCenter.x) + Math.abs(newCenter.y - existingCenter.y);
                        if (dist < Math.max(3, minDistance / 2)) { // Relaxed distance requirement
                            validDistance = false;
                            break;
                        }
                    }

                    if (validDistance) {
                        return newCenter;
                    }
                }
            }
        }

        // Final fallback: try a grid search for any valid position
        for (let x = roomRadius; x < this.width - roomRadius; x += 2) {
            for (let y = roomRadius; y < this.height - roomRadius; y += 2) {
                const candidate = { x, y };
                let validDistance = true;

                for (const existingCenter of this.roomCenters) {
                    const dist = Math.abs(candidate.x - existingCenter.x) + Math.abs(candidate.y - existingCenter.y);
                    if (dist < 3) { // Minimum separation
                        validDistance = false;
                        break;
                    }
                }

                if (validDistance) {
                    return candidate;
                }
            }
        }

        // Ultimate fallback: offset from current center slightly
        const offsetX = currentCenter.x + (Math.random() > 0.5 ? 1 : -1) * 3;
        const offsetY = currentCenter.y + (Math.random() > 0.5 ? 1 : -1) * 3;
        const safeX = Math.max(roomRadius, Math.min(this.width - roomRadius - 1, offsetX));
        const safeY = Math.max(roomRadius, Math.min(this.height - roomRadius - 1, offsetY));
        return { x: safeX, y: safeY };
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

    private printMap = (map: number[][]) => {
        // console.log(map.map(row => row.map(cell => cell ? ' ' : '#').join('')).join('\n'));
    }
}
