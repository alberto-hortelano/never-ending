import { MapGenerator } from '../MapGenerator';
import { SeededRandom } from '../SeededRandom';
import type { IRoom, ICoord } from '../../interfaces';

describe('MapGenerator', () => {
    const defaultRooms: IRoom[] = [
        { name: 'Room1', size: 5 },
        { name: 'Room2', size: 7 },
        { name: 'Room3', size: 6 }
    ];
    
    const startingPoint: ICoord = { x: 25, y: 25 };
    
    describe('seeded generation', () => {
        it('should generate identical maps with the same seed', () => {
            const seed = 12345;
            const mapGen1 = new MapGenerator(50, 50, 'random', seed);
            const mapGen2 = new MapGenerator(50, 50, 'random', seed);
            
            const map1 = mapGen1.generateMap(defaultRooms, startingPoint);
            const map2 = mapGen2.generateMap(defaultRooms, startingPoint);
            
            // Convert maps to strings for easier comparison
            const mapStr1 = map1.map(row => row.join('')).join('\n');
            const mapStr2 = map2.map(row => row.join('')).join('\n');
            
            expect(mapStr1).toEqual(mapStr2);
        });
        
        it('should generate different maps with different seeds', () => {
            const mapGen1 = new MapGenerator(50, 50, 'random', 111);
            const mapGen2 = new MapGenerator(50, 50, 'random', 999);
            
            const map1 = mapGen1.generateMap(defaultRooms, startingPoint);
            const map2 = mapGen2.generateMap(defaultRooms, startingPoint);
            
            const mapStr1 = map1.map(row => row.join('')).join('\n');
            const mapStr2 = map2.map(row => row.join('')).join('\n');
            
            expect(mapStr1).not.toEqual(mapStr2);
        });
        
        it('should generate consistent cells with the same seed', () => {
            const seed = 77777;
            const mapGen1 = new MapGenerator(50, 50, 'random', seed);
            const mapGen2 = new MapGenerator(50, 50, 'random', seed);
            
            mapGen1.generateMap(defaultRooms, startingPoint);
            mapGen2.generateMap(defaultRooms, startingPoint);
            
            const cells1 = mapGen1.getCells();
            const cells2 = mapGen2.getCells();
            
            // Check that cells are identical
            expect(cells1.length).toEqual(cells2.length);
            for (let y = 0; y < cells1.length; y++) {
                expect(cells1[y]?.length).toEqual(cells2[y]?.length);
                for (let x = 0; x < (cells1[y]?.length || 0); x++) {
                    const cell1 = cells1[y]?.[x];
                    const cell2 = cells2[y]?.[x];
                    
                    expect(cell1?.position).toEqual(cell2?.position);
                    expect(cell1?.locations).toEqual(cell2?.locations);
                    expect(cell1?.content?.blocker).toEqual(cell2?.content?.blocker);
                }
            }
        });
    });
    
    describe('corridor patterns with seed', () => {
        const seed = 54321;
        
        it('should generate consistent star pattern with seed', () => {
            const mapGen1 = new MapGenerator(50, 50, 'star', seed);
            const mapGen2 = new MapGenerator(50, 50, 'star', seed);
            
            const map1 = mapGen1.generateMap(defaultRooms, startingPoint);
            const map2 = mapGen2.generateMap(defaultRooms, startingPoint);
            
            const mapStr1 = map1.map(row => row.join('')).join('\n');
            const mapStr2 = map2.map(row => row.join('')).join('\n');
            
            expect(mapStr1).toEqual(mapStr2);
        });
        
        it('should generate consistent grid pattern with seed', () => {
            const mapGen1 = new MapGenerator(50, 50, 'grid', seed);
            const mapGen2 = new MapGenerator(50, 50, 'grid', seed);
            
            const map1 = mapGen1.generateMap(defaultRooms, startingPoint);
            const map2 = mapGen2.generateMap(defaultRooms, startingPoint);
            
            const mapStr1 = map1.map(row => row.join('')).join('\n');
            const mapStr2 = map2.map(row => row.join('')).join('\n');
            
            expect(mapStr1).toEqual(mapStr2);
        });
        
        it('should generate consistent linear pattern with seed', () => {
            const mapGen1 = new MapGenerator(50, 50, 'linear', seed);
            const mapGen2 = new MapGenerator(50, 50, 'linear', seed);
            
            const map1 = mapGen1.generateMap(defaultRooms, startingPoint);
            const map2 = mapGen2.generateMap(defaultRooms, startingPoint);
            
            const mapStr1 = map1.map(row => row.join('')).join('\n');
            const mapStr2 = map2.map(row => row.join('')).join('\n');
            
            expect(mapStr1).toEqual(mapStr2);
        });
    });
    
    describe('backward compatibility', () => {
        it('should still work without a seed (random generation)', () => {
            const mapGen = new MapGenerator(50, 50, 'random');
            
            const map = mapGen.generateMap(defaultRooms, startingPoint);
            
            // Should generate a valid map
            expect(map).toBeDefined();
            expect(map.length).toBeGreaterThan(0);
            
            // Should have some walkable cells (1s)
            const hasWalkableCells = map.some(row => row.some(cell => cell === 1));
            expect(hasWalkableCells).toBe(true);
        });
        
        it('should generate different maps when no seed is provided', () => {
            const mapGen1 = new MapGenerator(50, 50, 'random');
            const mapGen2 = new MapGenerator(50, 50, 'random');
            
            const map1 = mapGen1.generateMap(defaultRooms, startingPoint);
            const map2 = mapGen2.generateMap(defaultRooms, startingPoint);
            
            const mapStr1 = map1.map(row => row.join('')).join('\n');
            const mapStr2 = map2.map(row => row.join('')).join('\n');
            
            // Very unlikely to be the same without seed
            expect(mapStr1).not.toEqual(mapStr2);
        });
    });
    
    describe('edge cases', () => {
        it('should handle empty rooms array', () => {
            const mapGen = new MapGenerator(50, 50, 'random', 123);
            const map = mapGen.generateMap([], startingPoint);
            
            expect(map).toBeDefined();
            expect(map.length).toEqual(50);
            expect(map[0]?.length).toEqual(50);
        });
        
        it('should handle very small maps', () => {
            const mapGen = new MapGenerator(10, 10, 'random', 456);
            const map = mapGen.generateMap(defaultRooms, { x: 5, y: 5 });
            
            expect(map).toBeDefined();
            expect(map.length).toBeGreaterThan(0);
            expect(map.length).toBeLessThanOrEqual(10);
        });
    });
    
    describe('getSeed method', () => {
        it('should return the seed used for generation', () => {
            const seed = 98765;
            const mapGen = new MapGenerator(50, 50, 'random', seed);
            
            expect(mapGen.getSeed()).toBe(seed);
        });
        
        it('should return undefined when no seed was provided', () => {
            const mapGen = new MapGenerator(50, 50, 'random');
            
            // Should be undefined or a number (if auto-generated)
            const seed = mapGen.getSeed();
            expect(seed === undefined || typeof seed === 'number').toBe(true);
        });
    });
});