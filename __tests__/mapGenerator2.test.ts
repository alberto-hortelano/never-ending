import { MapGenerator2 } from '../src/common/helpers/MapGenerator2';

describe('MapGenerator2', () => {
    let generator: MapGenerator2;

    const printMap = (map: number[][]) => console.log(map.map(row => row.map(cell => cell ? ' ' : '#').join('')).join('\n'));

    beforeEach(() => {
        generator = new MapGenerator2(50, 50);
    });

    test('should place all rooms without missing any', () => {
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
        const centers = generator.getRoomCenters();

        // All rooms should be placed
        expect(centers).toHaveLength(rooms.length);
        
        // Each room center should be walkable
        centers.forEach((center, index) => {
            expect(map[center.y]?.[center.x]).toBe(1);
            console.log(`Room ${index} placed at (${center.x}, ${center.y})`);
        });
        
        printMap(map);
    });

    test('should handle large number of rooms', () => {
        const rooms = Array(20).fill(null).map(() => ({ 
            size: [3, 5, 7][Math.floor(Math.random() * 3)] as 3 | 5 | 7 
        }));
        
        const map = generator.generateMap(rooms);
        const centers = generator.getRoomCenters();

        // All rooms should be placed
        expect(centers).toHaveLength(rooms.length);
        console.log(`Successfully placed ${centers.length} rooms`);
    });

    test('should handle maximum sized rooms', () => {
        const rooms = [
            { size: 11 as const },
            { size: 11 as const },
            { size: 9 as const },
            { size: 9 as const },
            { size: 7 as const },
        ];
        
        const map = generator.generateMap(rooms);
        const centers = generator.getRoomCenters();

        // All rooms should be placed
        expect(centers).toHaveLength(rooms.length);
        
        printMap(map);
    });

    test('should work with different corridor patterns', () => {
        const patterns = ['random', 'star', 'grid', 'linear'] as const;
        const rooms = [
            { size: 5 as const },
            { size: 5 as const },
            { size: 5 as const },
            { size: 5 as const },
        ];

        patterns.forEach(pattern => {
            generator.setCorridorPattern(pattern);
            const map = generator.generateMap(rooms);
            const centers = generator.getRoomCenters();
            
            expect(centers).toHaveLength(rooms.length);
            console.log(`Pattern: ${pattern}, placed ${centers.length} rooms`);
        });
    });
});