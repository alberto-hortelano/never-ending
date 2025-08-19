import type { BasicDirection, ICoord, IRoom } from "../interfaces";
import type { Corridor, CorridorGenerator } from "./CorridorGenerator";

interface RoomPlacement {
    room: IRoom;
    position: ICoord;
    connectionType: 'side' | 'through';
    corridorIndex: number;
    connectionPoint: ICoord;
}

export class RoomPlacer {
    private roomPlacements: RoomPlacement[] = [];
    private readonly directions: BasicDirection[] = ['up', 'right', 'down', 'left'];

    constructor(
        private width: number,
        private height: number,
        private corridorGenerator: CorridorGenerator,
    ) { }

    public placeAllRooms(rooms: IRoom[], corridors: Corridor[]): RoomPlacement[] {
        this.roomPlacements = [];
        let currentCorridors = [...corridors];

        // First attempt: place rooms with initial corridors
        let failedRooms = this.placeRoomsInitially(rooms, currentCorridors);

        // If rooms failed, try expanding the map
        if (failedRooms.length > 0) {
            currentCorridors = this.expandMapWithNewCorridors(failedRooms, currentCorridors);
            failedRooms = this.retryWithExpandedMap(failedRooms, currentCorridors);
        }

        // Final attempt: force placement of remaining rooms
        if (failedRooms.length > 0) {
            this.forcePlaceRemainingRooms(failedRooms, currentCorridors);
        }

        return [...this.roomPlacements];
    }

    public carveRooms(map: number[][]): void {
        this.roomPlacements.forEach(placement => {
            const { room, position } = placement;
            const radius = Math.floor(room.size / 2);

            for (let y = position.y - radius; y <= position.y + radius; y++) {
                for (let x = position.x - radius; x <= position.x + radius; x++) {
                    this.carveCell({ x, y }, map);
                }
            }
        });
    }

    public carveRoomConnections(map: number[][]): void {
        this.roomPlacements
            .filter(p => p.connectionType === 'side')
            .forEach(placement => {
                const connectionCells = this.getCorridorCells(placement.connectionPoint, placement.position);
                connectionCells.forEach(cell => this.carveCell(cell, map));
            });
    }

    private placeRoomsInitially(rooms: IRoom[], corridors: Corridor[]): { room: IRoom; index: number }[] {
        const failedRooms: { room: IRoom; index: number }[] = [];
        let corridorIndex = 0;
        let position = 0;

        for (let i = 0; i < rooms.length; i++) {
            const room = rooms[i];
            if (!room) continue;

            const placement = this.tryPlaceRoom(room, corridorIndex, position, corridors);

            if (placement) {
                this.roomPlacements.push(placement);
                room.center = placement.position;
                ({ corridorIndex, position } = this.getNextPosition(corridorIndex, position, room, corridors));
            } else {
                failedRooms.push({ room, index: i });
            }
        }

        return failedRooms;
    }

    private expandMapWithNewCorridors(failedRooms: { room: IRoom; index: number }[], corridors: Corridor[]): Corridor[] {
        const roomCount = failedRooms.length;

        // Add corridor extensions for better room placement
        for (let i = 0; i < Math.min(roomCount * 2, corridors.length); i++) {
            this.corridorGenerator.extendCorridor(i % corridors.length);
        }

        // Add new corridor branches
        for (let i = 0; i < Math.ceil(roomCount / 2); i++) {
            this.corridorGenerator.addNewCorridorBranch();
        }

        // Add long corridors if many rooms failed
        if (roomCount > 3) {
            this.corridorGenerator.addLongCorridors();
        }

        return this.corridorGenerator.getCorridors();
    }

    private retryWithExpandedMap(failedRooms: { room: IRoom; index: number }[], corridors: Corridor[]): { room: IRoom; index: number }[] {
        const stillFailed: { room: IRoom; index: number }[] = [];

        // Sort by size for better placement
        failedRooms.sort((a, b) => b.room.size - a.room.size);

        for (const { room, index } of failedRooms) {
            const placement = this.tryPlaceRoom(room, 0, 0, corridors, true);

            if (placement) {
                this.roomPlacements.push(placement);
                room.center = placement.position;
            } else {
                stillFailed.push({ room, index });
            }
        }

        return stillFailed;
    }

    private forcePlaceRemainingRooms(failedRooms: { room: IRoom; index: number }[], corridors: Corridor[]): void {
        if (failedRooms.length === 0) return;

        // Try placing at corridor endpoints and intersections
        for (const { room } of failedRooms) {
            let placement = this.tryPlaceAtSpecialPoints(room, corridors) ||
                this.tryPlaceWithRelaxedConstraints(room, corridors) ||
                this.tryPlaceWithOverlap(room, corridors) ||
                this.forceCreateSpaceForRoom(room, corridors);

            if (placement) {
                this.roomPlacements.push(placement);
                room.center = placement.position;
            } else {
                // Last resort: place at any valid boundary position
                placement = this.placeAtAnyValidPosition(room, corridors);
                if (placement) {
                    this.roomPlacements.push(placement);
                    room.center = placement.position;
                    // Emergency placement for room
                } else {
                    // CRITICAL: Failed to place room even with force placement
                }
            }
        }
    }

    private tryPlaceRoom(room: IRoom, startCorridorIndex: number, startPosition: number, corridors: Corridor[], exhaustive = false): RoomPlacement | null {
        // First pass: try every few positions
        for (let ci = 0; ci < corridors.length; ci++) {
            const corridorIndex = (startCorridorIndex + ci) % corridors.length;
            const corridor = corridors[corridorIndex];
            if (!corridor) continue;

            const step = exhaustive ? 1 : Math.max(2, Math.floor(room.size / 3));
            for (let pos = startPosition; pos < corridor.cells.length; pos += step) {
                const placement = this.findRoomPlacement(room, corridorIndex, pos, corridors);
                if (placement) return placement;
            }
            startPosition = 0; // Reset position for next corridor
        }

        // Second pass (exhaustive only): try every single position
        if (exhaustive) {
            for (let corridorIndex = 0; corridorIndex < corridors.length; corridorIndex++) {
                const corridor = corridors[corridorIndex];
                if (!corridor) continue;

                for (let pos = 0; pos < corridor.cells.length; pos++) {
                    const placement = this.findRoomPlacement(room, corridorIndex, pos, corridors);
                    if (placement) return placement;
                }
            }
        }

        return null;
    }

    private tryPlaceAtSpecialPoints(room: IRoom, corridors: Corridor[]): RoomPlacement | null {
        // Try corridor endpoints
        for (let corridorIndex = 0; corridorIndex < corridors.length; corridorIndex++) {
            const corridor = corridors[corridorIndex];
            if (!corridor) continue;

            // Try start and end points
            for (const point of [corridor.start, corridor.end]) {
                const placement = this.tryPlaceAtPoint(room, point, corridorIndex);
                if (placement) return placement;
            }
        }

        // Try corridor intersections
        const intersections = this.findCorridorIntersections(corridors);
        for (const { point, corridorIndex } of intersections) {
            const corridor = corridors[corridorIndex];
            if (!corridor) continue;
            const placement = this.tryPlaceAtPoint(room, point, corridorIndex);
            if (placement) return placement;
        }

        return null;
    }

    private tryPlaceWithRelaxedConstraints(room: IRoom, corridors: Corridor[]): RoomPlacement | null {
        // Try with reduced buffer between rooms
        const originalIsValid = this.isValidRoomPosition.bind(this);
        this.isValidRoomPosition = (center: ICoord, room: IRoom) => {
            return this.isValidRoomPositionRelaxed(center, room, 0); // No buffer
        };

        const placement = this.tryPlaceRoom(room, 0, 0, corridors, true);

        // Restore original validation
        this.isValidRoomPosition = originalIsValid;

        return placement;
    }

    private tryPlaceAtPoint(room: IRoom, point: ICoord, corridorIndex: number): RoomPlacement | null {
        // Try placing room centered at point
        if (this.isValidRoomPosition(point, room)) {
            return { room, position: point, connectionType: 'through', corridorIndex, connectionPoint: point };
        }

        // Try all directions around the point
        const distance = Math.floor(room.size / 2) + 2;
        for (const direction of this.directions) {
            const position = this.moveInDirection(point, direction, distance);
            if (this.isValidRoomPosition(position, room)) {
                return { room, position, connectionType: 'side', corridorIndex, connectionPoint: point };
            }
        }

        return null;
    }

    private findCorridorIntersections(corridors: Corridor[]): { point: ICoord; corridorIndex: number }[] {
        const intersections: { point: ICoord; corridorIndex: number }[] = [];
        const seen = new Set<string>();

        for (let i = 0; i < corridors.length; i++) {
            const corridor1 = corridors[i];
            if (!corridor1) continue;

            for (const cell1 of corridor1.cells) {
                for (let j = i + 1; j < corridors.length; j++) {
                    const corridor2 = corridors[j];
                    if (!corridor2) continue;

                    for (const cell2 of corridor2.cells) {
                        if (cell1.x === cell2.x && cell1.y === cell2.y) {
                            const key = `${cell1.x},${cell1.y}`;
                            if (!seen.has(key)) {
                                seen.add(key);
                                intersections.push({ point: cell1, corridorIndex: i });
                            }
                        }
                    }
                }
            }
        }

        return intersections;
    }

    private isValidRoomPositionRelaxed(center: ICoord, room: IRoom, buffer: number): boolean {
        const halfSize = Math.floor(room.size / 2);

        // Check boundaries
        if (center.x - halfSize < 1 || center.x + halfSize >= this.width - 1 ||
            center.y - halfSize < 1 || center.y + halfSize >= this.height - 1) {
            return false;
        }

        // Check overlap with existing rooms using bounding box collision
        return this.roomPlacements.every(placement => {
            const existingHalfSize = Math.floor(placement.room.size / 2);

            // Calculate bounding boxes
            const room1Left = center.x - halfSize;
            const room1Right = center.x + halfSize;
            const room1Top = center.y - halfSize;
            const room1Bottom = center.y + halfSize;

            const room2Left = placement.position.x - existingHalfSize;
            const room2Right = placement.position.x + existingHalfSize;
            const room2Top = placement.position.y - existingHalfSize;
            const room2Bottom = placement.position.y + existingHalfSize;

            // Check if boxes don't overlap (with buffer)
            return room1Right + buffer < room2Left ||
                room1Left > room2Right + buffer ||
                room1Bottom + buffer < room2Top ||
                room1Top > room2Bottom + buffer;
        });
    }

    private findRoomPlacement(room: IRoom, corridorIndex: number, positionIndex: number, corridors: Corridor[]): RoomPlacement | null {
        const corridor = corridors[corridorIndex];
        const connectionPoint = corridor?.cells[positionIndex];
        if (!corridor || !connectionPoint) return null;

        // Try 'through' placement first (room centered on corridor)
        if (this.isValidRoomPosition(connectionPoint, room)) {
            return { room, position: connectionPoint, connectionType: 'through', corridorIndex, connectionPoint };
        }

        // Try both side positions
        const sidePositions = this.getBothSidePositions(connectionPoint, corridor.direction, room);
        for (const sidePos of sidePositions) {
            if (this.isValidRoomPosition(sidePos, room)) {
                return { room, position: sidePos, connectionType: 'side', corridorIndex, connectionPoint };
            }
        }

        return null;
    }

    private getBothSidePositions(connectionPoint: ICoord, corridorDirection: BasicDirection, room: IRoom): ICoord[] {
        const distance = Math.floor(room.size / 2) + 2;
        const perpendiculars = this.getBothPerpendicularDirections(corridorDirection);
        return perpendiculars.map(dir => this.moveInDirection(connectionPoint, dir, distance));
    }

    private getNextPosition(corridorIndex: number, position: number, room: IRoom, corridors: Corridor[]): { corridorIndex: number; position: number } {
        position += Math.max(3, Math.ceil(room.size / 2) + 1);
        const corridor = corridors[corridorIndex];

        if (!corridor || position >= corridor.cells.length) {
            return { corridorIndex: (corridorIndex + 1) % corridors.length, position: 0 };
        }

        return { corridorIndex, position };
    }

    private isValidRoomPosition(center: ICoord, room: IRoom): boolean {
        const halfSize = Math.floor(room.size / 2);

        // Check boundaries
        if (center.x - halfSize < 1 || center.x + halfSize >= this.width - 1 ||
            center.y - halfSize < 1 || center.y + halfSize >= this.height - 1) {
            return false;
        }

        // Check overlap with existing rooms using bounding box collision
        return this.roomPlacements.every(placement => {
            const existingHalfSize = Math.floor(placement.room.size / 2);

            // Calculate bounding boxes
            const room1Left = center.x - halfSize;
            const room1Right = center.x + halfSize;
            const room1Top = center.y - halfSize;
            const room1Bottom = center.y + halfSize;

            const room2Left = placement.position.x - existingHalfSize;
            const room2Right = placement.position.x + existingHalfSize;
            const room2Top = placement.position.y - existingHalfSize;
            const room2Bottom = placement.position.y + existingHalfSize;

            // Check if boxes don't overlap (with 1 tile buffer)
            return room1Right + 1 < room2Left ||
                room1Left > room2Right + 1 ||
                room1Bottom + 1 < room2Top ||
                room1Top > room2Bottom + 1;
        });
    }

    private moveInDirection(point: ICoord, direction: BasicDirection, distance: number): ICoord {
        const moves = {
            up: { x: 0, y: -distance },
            right: { x: distance, y: 0 },
            down: { x: 0, y: distance },
            left: { x: -distance, y: 0 }
        };
        const move = moves[direction];
        return { x: point.x + move.x, y: point.y + move.y };
    }

    private getBothPerpendicularDirections(direction: BasicDirection): BasicDirection[] {
        if (direction === 'up' || direction === 'down') {
            return ['left', 'right'];
        } else {
            return ['up', 'down'];
        }
    }

    private getCorridorCells(start: ICoord, end: ICoord): ICoord[] {
        const cells: ICoord[] = [];
        const current = { ...start };

        while (current.x !== end.x) {
            cells.push({ ...current });
            current.x += current.x < end.x ? 1 : -1;
        }
        while (current.y !== end.y) {
            cells.push({ ...current });
            current.y += current.y < end.y ? 1 : -1;
        }
        cells.push({ ...end });

        return cells;
    }

    private carveCell(cell: ICoord, map: number[][]): void {
        if (cell.x >= 0 && cell.x < this.width && cell.y >= 0 && cell.y < this.height) {
            const row = map[cell.y];
            if (row) row[cell.x] = 1;
        }
    }

    private tryPlaceWithOverlap(room: IRoom, corridors: Corridor[]): RoomPlacement | null {
        // Allow slight overlap with other rooms
        const originalIsValid = this.isValidRoomPosition.bind(this);
        this.isValidRoomPosition = (center: ICoord, room: IRoom) => {
            return this.isValidRoomPositionRelaxed(center, room, -1); // Allow 1 tile overlap
        };

        const placement = this.tryPlaceRoom(room, 0, 0, corridors, true);

        this.isValidRoomPosition = originalIsValid;
        return placement;
    }

    private forceCreateSpaceForRoom(room: IRoom, corridors: Corridor[]): RoomPlacement | null {
        // Find the best position even if it requires moving other rooms
        const halfSize = Math.floor(room.size / 2);

        // Try placing at regular intervals across the map
        for (let y = halfSize + 2; y < this.height - halfSize - 2; y += room.size + 2) {
            for (let x = halfSize + 2; x < this.width - halfSize - 2; x += room.size + 2) {
                const position = { x, y };

                // Check if this position is near any corridor
                const nearCorridor = corridors.some(corridor =>
                    corridor.cells.some(cell =>
                        Math.abs(cell.x - x) + Math.abs(cell.y - y) <= room.size
                    )
                );

                if (nearCorridor && this.isValidRoomPositionRelaxed(position, room, -2)) {
                    // Find nearest corridor point
                    let minDist = Infinity;
                    let bestCorridorIndex = 0;
                    let connectionPoint = position;

                    corridors.forEach((corridor, idx) => {
                        corridor.cells.forEach(cell => {
                            const dist = Math.abs(cell.x - x) + Math.abs(cell.y - y);
                            if (dist < minDist) {
                                minDist = dist;
                                bestCorridorIndex = idx;
                                connectionPoint = cell;
                            }
                        });
                    });

                    return { room, position, connectionType: 'side', corridorIndex: bestCorridorIndex, connectionPoint };
                }
            }
        }

        return null;
    }

    private placeAtAnyValidPosition(room: IRoom, corridors: Corridor[]): RoomPlacement | null {
        const halfSize = Math.floor(room.size / 2);

        // Scan entire map for any valid position
        for (let y = halfSize + 1; y < this.height - halfSize - 1; y++) {
            for (let x = halfSize + 1; x < this.width - halfSize - 1; x++) {
                const position = { x, y };

                if (this.isValidRoomPosition(position, room)) {
                    // Find nearest corridor
                    let minDist = Infinity;
                    let bestCorridorIndex = 0;
                    let connectionPoint = position;

                    corridors.forEach((corridor, idx) => {
                        corridor.cells.forEach(cell => {
                            const dist = Math.abs(cell.x - x) + Math.abs(cell.y - y);
                            if (dist < minDist) {
                                minDist = dist;
                                bestCorridorIndex = idx;
                                connectionPoint = cell;
                            }
                        });
                    });

                    return { room, position, connectionType: 'side', corridorIndex: bestCorridorIndex, connectionPoint };
                }
            }
        }

        return null;
    }
}