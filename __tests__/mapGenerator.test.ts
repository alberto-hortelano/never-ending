import { MapGenerator } from '../src/common/helpers/MapGenerator';

describe('MapGenerator', () => {
    let generator: MapGenerator;

    const printMap = (map: number[][]) => console.log(map.map(row => row.map(cell => cell ? ' ' : '#').join('')).join('\n'));

    beforeEach(() => {
        generator = new MapGenerator(20, 20);
    });

    test('should generate empty map when no rooms provided', () => {
        const map = generator.generateMap([]);
        expect(map).toHaveLength(20);
        expect(map[0]).toHaveLength(20);
        expect(map.every(row => row.every(cell => cell === 0))).toBe(true);
        printMap(map);
    });

    test('should generate map with single room', () => {
        const rooms = [{ size: 5 as const }];
        const map = generator.generateMap(rooms);
        const centers = generator.getRoomCenters();

        expect(centers).toHaveLength(1);
        expect(centers[0]).toEqual({ x: 10, y: 10 });

        // Check that room area is walkable (1)
        const center = centers[0];
        if (center) {
            expect(map[center.y]?.[center.x]).toBe(1);
            expect(map[center.y - 1]?.[center.x]).toBe(1);
            expect(map[center.y + 1]?.[center.x]).toBe(1);
        }
        printMap(map);
    });

    test('should generate map with multiple rooms', () => {
        const rooms = [
            { size: 3 as const },
            { size: 5 as const },
            { size: 7 as const },
            { size: 3 as const },
            { size: 9 as const },
            { size: 7 as const },
            { size: 3 as const },
            { size: 5 as const },
            { size: 7 as const },
        ];
        const map = generator.generateMap(rooms);
        // const centers = generator.getRoomCenters();

        // expect(centers).toHaveLength(3);
        // expect(centers[0]).toEqual({ x: 0, y: 0 });

        // // Each room center should be walkable
        // centers.forEach(center => {
        //     expect(map[center.y]?.[center.x]).toBe(1);
        // });
        // printMap(map);
    });

    test('should maintain minimum distance between room centers', () => {
        const rooms = [
            { size: 5 as const },
            { size: 5 as const },
            { size: 3 as const }
        ];
        const map = generator.generateMap(rooms);
        const centers = generator.getRoomCenters();

        expect(centers).toHaveLength(3);

        // Check minimum distance between consecutive centers
        for (let i = 1; i < centers.length; i++) {
            const prev = centers[i - 1];
            const curr = centers[i];
            if (prev && curr) {
                const distance = Math.abs(curr.x - prev.x) + Math.abs(curr.y - prev.y);

                // Should be at least the room radius (ceil(5/2) = 3)
                expect(distance).toBeGreaterThanOrEqual(3);
            }
        }
        printMap(map);
    });

    test('should connect rooms with corridors', () => {
        const rooms = [
            { size: 3 as const },
            { size: 3 as const }
        ];
        const map = generator.generateMap(rooms);
        const centers = generator.getRoomCenters();

        expect(centers).toHaveLength(2);

        // There should be a path of walkable cells between the rooms
        const start = centers[0];
        const end = centers[1];
        if (start && end) {
            const current = { ...start };
            let pathExists = true;

            // Check horizontal path
            while (current.x !== end.x && pathExists) {
                if (map[current.y]?.[current.x] !== 1) {
                    pathExists = false;
                }
                current.x += current.x < end.x ? 1 : -1;
            }

            // Check vertical path
            while (current.y !== end.y && pathExists) {
                if (map[current.y]?.[current.x] !== 1) {
                    pathExists = false;
                }
                current.y += current.y < end.y ? 1 : -1;
            }

            expect(pathExists).toBe(true);
        }
        printMap(map);
    });

    test('should handle different room sizes', () => {
        const sizes = [3, 5, 7, 9, 11] as const;

        sizes.forEach(size => {
            const rooms = [{ size }];
            const map = generator.generateMap(rooms);
            const centers = generator.getRoomCenters();

            expect(centers).toHaveLength(1);

            const center = centers[0];
            if (center) {
                const radius = Math.floor(size / 2);

                // Check that room is properly carved
                for (let y = center.y - radius; y <= center.y + radius; y++) {
                    for (let x = center.x - radius; x <= center.x + radius; x++) {
                        if (x >= 0 && x < 20 && y >= 0 && y < 20) {
                            expect(map[y]?.[x]).toBe(1);
                        }
                    }
                }
            }
            printMap(map);
        });
    });
});