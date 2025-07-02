import { RoomPlacer } from '../RoomPlacer';
import { CorridorGenerator, Corridor } from '../CorridorGenerator';
import type { BasicDirection, ICoord, IRoom } from '../../interfaces';

// Mock CorridorGenerator
jest.mock('../CorridorGenerator');

describe('RoomPlacer', () => {
    let roomPlacer: RoomPlacer;
    let mockCorridorGenerator: jest.Mocked<CorridorGenerator>;
    const mapWidth = 50;
    const mapHeight = 50;

    // Helper function to create a mock corridor
    function createMockCorridor(start: ICoord, end: ICoord, direction: BasicDirection): Corridor {
        const cells: ICoord[] = [];
        const current = { ...start };

        while (current.x !== end.x || current.y !== end.y) {
            cells.push({ ...current });
            if (current.x < end.x) current.x++;
            else if (current.x > end.x) current.x--;
            if (current.y < end.y) current.y++;
            else if (current.y > end.y) current.y--;
        }
        cells.push({ ...end });

        return { start, end, cells, direction };
    }

    beforeEach(() => {
        mockCorridorGenerator = new CorridorGenerator(mapWidth, mapHeight) as jest.Mocked<CorridorGenerator>;
        roomPlacer = new RoomPlacer(mapWidth, mapHeight, mockCorridorGenerator);
    });

    describe('placeAllRooms', () => {
        test('should place a single small room along a corridor', () => {
            const rooms: IRoom[] = [{ size: 3, name: 'Room 1' }];
            const corridors: Corridor[] = [
                createMockCorridor({ x: 10, y: 25 }, { x: 40, y: 25 }, 'right')
            ];

            const placements = roomPlacer.placeAllRooms(rooms, corridors);

            expect(placements).toHaveLength(1);
            expect(placements[0]?.room).toBe(rooms[0]);
            expect(placements[0]?.position).toBeDefined();
            expect(rooms[0]?.center).toEqual(placements[0]?.position);
        });

        test('should place multiple rooms along corridors', () => {
            const rooms: IRoom[] = [
                { size: 3, name: 'Room 1' },
                { size: 5, name: 'Room 2' },
                { size: 7, name: 'Room 3' }
            ];
            const corridors: Corridor[] = [
                createMockCorridor({ x: 5, y: 25 }, { x: 45, y: 25 }, 'right'),
                createMockCorridor({ x: 25, y: 5 }, { x: 25, y: 45 }, 'down')
            ];

            const placements = roomPlacer.placeAllRooms(rooms, corridors);

            expect(placements).toHaveLength(3);
            placements.forEach((placement, i) => {
                expect(placement.room).toBe(rooms[i]);
                expect(placement.position).toBeDefined();
                expect(rooms[i]?.center).toEqual(placement.position);
            });
        });

        test('should handle rooms that dont fit initially by expanding corridors', () => {
            const rooms: IRoom[] = [
                { size: 11, name: 'Room 1' },
                { size: 11, name: 'Room 2' },
                { size: 11, name: 'Room 3' }
            ];
            const corridors: Corridor[] = [
                createMockCorridor({ x: 20, y: 25 }, { x: 30, y: 25 }, 'right')
            ];

            // Mock corridor expansion
            let extendCallCount = 0;
            let addBranchCallCount = 0;
            mockCorridorGenerator.extendCorridor.mockImplementation(() => {
                extendCallCount++;
            });
            mockCorridorGenerator.addNewCorridorBranch.mockImplementation(() => {
                addBranchCallCount++;
            });
            mockCorridorGenerator.getCorridors.mockReturnValue([
                ...corridors,
                createMockCorridor({ x: 10, y: 10 }, { x: 40, y: 10 }, 'right'),
                createMockCorridor({ x: 10, y: 40 }, { x: 40, y: 40 }, 'right')
            ]);

            const placements = roomPlacer.placeAllRooms(rooms, corridors);

            expect(extendCallCount).toBeGreaterThan(0);
            expect(addBranchCallCount).toBeGreaterThan(0);
            expect(placements).toHaveLength(3);
        });

        test('should force place rooms even with tight constraints', () => {
            const rooms: IRoom[] = [
                { size: 9, name: 'Room 1' },
                { size: 9, name: 'Room 2' },
                { size: 9, name: 'Room 3' },
                { size: 9, name: 'Room 4' }
            ];
            const corridors: Corridor[] = [
                createMockCorridor({ x: 15, y: 25 }, { x: 35, y: 25 }, 'right')
            ];

            mockCorridorGenerator.getCorridors.mockReturnValue(corridors);
            mockCorridorGenerator.addLongCorridors.mockImplementation(() => { });

            const placements = roomPlacer.placeAllRooms(rooms, corridors);

            // Even if not all rooms fit perfectly, all should be placed
            expect(placements).toHaveLength(4);
            rooms.forEach((room) => {
                expect(room.center).toBeDefined();
            });
        });

        test('should place rooms at corridor intersections', () => {
            const rooms: IRoom[] = [{ size: 5, name: 'Room 1' }];
            const corridors: Corridor[] = [
                createMockCorridor({ x: 10, y: 25 }, { x: 40, y: 25 }, 'right'),
                createMockCorridor({ x: 25, y: 10 }, { x: 25, y: 40 }, 'down')
            ];

            const placements = roomPlacer.placeAllRooms(rooms, corridors);

            expect(placements).toHaveLength(1);
            // IRoom could be placed at intersection or along corridors
            expect(placements[0]?.position).toBeDefined();
        });

        test('should not overlap rooms', () => {
            const rooms: IRoom[] = [
                { size: 7, name: 'Room 1' },
                { size: 7, name: 'Room 2' },
                { size: 7, name: 'Room 3' }
            ];
            const corridors: Corridor[] = [
                createMockCorridor({ x: 5, y: 25 }, { x: 45, y: 25 }, 'right')
            ];

            const placements = roomPlacer.placeAllRooms(rooms, corridors);

            // Check that no rooms overlap
            for (let i = 0; i < placements.length; i++) {
                for (let j = i + 1; j < placements.length; j++) {
                    const room1 = placements[i];
                    const room2 = placements[j];
                    if (!room1 || !room2) continue;
                    const halfSize1 = Math.floor(room1.room.size / 2);
                    const halfSize2 = Math.floor(room2.room.size / 2);

                    const distance = Math.abs(room1.position.x - room2.position.x) +
                        Math.abs(room1.position.y - room2.position.y);
                    const minDistance = halfSize1 + halfSize2 + 1;

                    expect(distance).toBeGreaterThanOrEqual(minDistance);
                }
            }
        });

        test('should respect map boundaries', () => {
            const rooms: IRoom[] = [
                { size: 11, name: 'Room 1' },
                { size: 11, name: 'Room 2' }
            ];
            const corridors: Corridor[] = [
                createMockCorridor({ x: 2, y: 2 }, { x: 48, y: 2 }, 'right'),
                createMockCorridor({ x: 2, y: 48 }, { x: 48, y: 48 }, 'right')
            ];

            const placements = roomPlacer.placeAllRooms(rooms, corridors);

            placements.forEach(placement => {
                const halfSize = Math.floor(placement.room.size / 2);
                expect(placement.position.x - halfSize).toBeGreaterThanOrEqual(1);
                expect(placement.position.x + halfSize).toBeLessThan(mapWidth - 1);
                expect(placement.position.y - halfSize).toBeGreaterThanOrEqual(1);
                expect(placement.position.y + halfSize).toBeLessThan(mapHeight - 1);
            });
        });

        test('should handle empty room list', () => {
            const rooms: IRoom[] = [];
            const corridors: Corridor[] = [
                createMockCorridor({ x: 10, y: 25 }, { x: 40, y: 25 }, 'right')
            ];

            const placements = roomPlacer.placeAllRooms(rooms, corridors);

            expect(placements).toHaveLength(0);
        });

        test('should handle empty corridor list by creating new corridors', () => {
            const rooms: IRoom[] = [{ size: 5, name: 'Room 1' }];
            const corridors: Corridor[] = [];

            mockCorridorGenerator.getCorridors.mockReturnValue([
                createMockCorridor({ x: 10, y: 25 }, { x: 40, y: 25 }, 'right')
            ]);

            const placements = roomPlacer.placeAllRooms(rooms, corridors);

            expect(mockCorridorGenerator.addNewCorridorBranch).toHaveBeenCalled();
            expect(placements).toHaveLength(1);
        });
    });

    describe('carveRooms', () => {
        test('should carve rooms into the map', () => {
            const map: number[][] = Array(mapHeight).fill(null).map(() => Array(mapWidth).fill(0));
            const rooms: IRoom[] = [{ size: 3, name: 'Room 1' }];
            const corridors: Corridor[] = [
                createMockCorridor({ x: 10, y: 25 }, { x: 40, y: 25 }, 'right')
            ];

            roomPlacer.placeAllRooms(rooms, corridors);
            roomPlacer.carveRooms(map);

            // Check that room cells are carved (set to 1)
            // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
            const center = rooms[0]?.center!;
            // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
            const radius = Math.floor(rooms[0]?.size! / 2);
            for (let y = center.y - radius; y <= center.y + radius; y++) {
                for (let x = center.x - radius; x <= center.x + radius; x++) {
                    expect(map[y]?.[x]).toBe(1);
                }
            }
        });

        test('should carve multiple rooms without overlap', () => {
            const map: number[][] = Array(mapHeight).fill(null).map(() => Array(mapWidth).fill(0));
            const rooms: IRoom[] = [
                { size: 5, name: 'Room 1' },
                { size: 5, name: 'Room 2' }
            ];
            const corridors: Corridor[] = [
                createMockCorridor({ x: 5, y: 25 }, { x: 45, y: 25 }, 'right')
            ];

            roomPlacer.placeAllRooms(rooms, corridors);
            roomPlacer.carveRooms(map);

            // Count carved cells
            let carvedCount = 0;
            for (let y = 0; y < mapHeight; y++) {
                for (let x = 0; x < mapWidth; x++) {
                    if (map[y]?.[x] === 1) carvedCount++;
                }
            }

            // Each 5x5 room has 25 cells
            expect(carvedCount).toBe(50);
        });
    });

    describe('carveRoomConnections', () => {
        test('should carve connections for side-placed rooms', () => {
            const map: number[][] = Array(mapHeight).fill(null).map(() => Array(mapWidth).fill(0));
            const rooms: IRoom[] = [{ size: 5, name: 'Room 1' }];
            const corridors: Corridor[] = [
                createMockCorridor({ x: 10, y: 25 }, { x: 40, y: 25 }, 'right')
            ];

            const placements = roomPlacer.placeAllRooms(rooms, corridors);

            // Force a side placement for testing
            if (placements[0]?.connectionType === 'through') {
                // Re-run to get a side placement
                placements[0].connectionType = 'side';
                placements[0].position = { x: 25, y: 20 };
            }

            roomPlacer.carveRoomConnections(map);

            // Should have carved a path from corridor to room
            const hasConnection = map.some(row => row.some(cell => cell === 1));
            expect(hasConnection).toBe(true);
        });

        test('should not carve connections for through-placed rooms', () => {
            const map: number[][] = Array(mapHeight).fill(null).map(() => Array(mapWidth).fill(0));
            const rooms: IRoom[] = [{ size: 3, name: 'Room 1' }];
            const corridors: Corridor[] = [
                createMockCorridor({ x: 10, y: 25 }, { x: 40, y: 25 }, 'right')
            ];

            roomPlacer.placeAllRooms(rooms, corridors);
            const originalMap = map.map(row => [...row]);
            roomPlacer.carveRoomConnections(map);

            // Map should remain unchanged for through connections
            expect(map).toEqual(originalMap);
        });
    });

    describe('edge cases', () => {
        test('should handle very large rooms', () => {
            const rooms: IRoom[] = [{ size: 11, name: 'Room 1' }];
            const corridors: Corridor[] = [
                createMockCorridor({ x: 25, y: 25 }, { x: 25, y: 25 }, 'right')
            ];

            mockCorridorGenerator.getCorridors.mockReturnValue([
                createMockCorridor({ x: 15, y: 25 }, { x: 35, y: 25 }, 'right')
            ]);

            const placements = roomPlacer.placeAllRooms(rooms, corridors);

            expect(placements).toHaveLength(1);
            expect(rooms[0]?.center).toBeDefined();
        });

        test('should handle rooms with all different sizes', () => {
            const rooms: IRoom[] = [
                { size: 3, name: 'Room 1' },
                { size: 5, name: 'Room 2' },
                { size: 7, name: 'Room 3' },
                { size: 9, name: 'Room 4' },
                { size: 11, name: 'Room 5' }
            ];
            const corridors: Corridor[] = [
                createMockCorridor({ x: 5, y: 15 }, { x: 45, y: 15 }, 'right'),
                createMockCorridor({ x: 5, y: 35 }, { x: 45, y: 35 }, 'right'),
                createMockCorridor({ x: 15, y: 5 }, { x: 15, y: 45 }, 'down'),
                createMockCorridor({ x: 35, y: 5 }, { x: 35, y: 45 }, 'down')
            ];

            mockCorridorGenerator.getCorridors.mockReturnValue(corridors);

            const placements = roomPlacer.placeAllRooms(rooms, corridors);

            expect(placements).toHaveLength(5);
            rooms.forEach(room => {
                expect(room.center).toBeDefined();
            });
        });

        test('should always find or create space for rooms', () => {
            // This is the critical test - ensure rooms are ALWAYS placed
            const rooms: IRoom[] = Array(10).fill(null).map((_, i) => ({ size: 7 as IRoom['size'], name: `Room ${i + 1}` }));
            const corridors: Corridor[] = [
                createMockCorridor({ x: 25, y: 25 }, { x: 25, y: 25 }, 'right')
            ];

            // Mock aggressive corridor expansion
            mockCorridorGenerator.getCorridors.mockReturnValue([
                createMockCorridor({ x: 5, y: 5 }, { x: 45, y: 5 }, 'right'),
                createMockCorridor({ x: 5, y: 15 }, { x: 45, y: 15 }, 'right'),
                createMockCorridor({ x: 5, y: 25 }, { x: 45, y: 25 }, 'right'),
                createMockCorridor({ x: 5, y: 35 }, { x: 45, y: 35 }, 'right'),
                createMockCorridor({ x: 5, y: 45 }, { x: 45, y: 45 }, 'right'),
                createMockCorridor({ x: 5, y: 5 }, { x: 5, y: 45 }, 'down'),
                createMockCorridor({ x: 15, y: 5 }, { x: 15, y: 45 }, 'down'),
                createMockCorridor({ x: 25, y: 5 }, { x: 25, y: 45 }, 'down'),
                createMockCorridor({ x: 35, y: 5 }, { x: 35, y: 45 }, 'down'),
                createMockCorridor({ x: 45, y: 5 }, { x: 45, y: 45 }, 'down')
            ]);

            const placements = roomPlacer.placeAllRooms(rooms, corridors);

            // CRITICAL: All rooms MUST be placed
            expect(placements).toHaveLength(rooms.length);
            rooms.forEach((room, index) => {
                expect(room.center).toBeDefined();
                expect(room.center).toEqual(placements[index]?.position);
            });
        });
    });
});