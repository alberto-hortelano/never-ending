import { MapGenerator } from '../MapGenerator';
import { SaveGameService } from '../../services/SaveGameService';
import { initialState } from '../../../data/state';

describe('Map Seed Integration', () => {
    it('should generate the same map when using the same seed after save/load', () => {
        // Create initial state with a specific seed
        const seed = 123456;
        const state1 = initialState(50, 50, undefined, undefined, seed);
        
        // Generate a map with the seed
        const mapGen1 = new MapGenerator(50, 50, 'random', seed);
        const rooms = [
            { name: 'room1', size: 5 },
            { name: 'room2', size: 7 }
        ];
        const startPos = { x: 25, y: 25 };
        
        mapGen1.generateMap(rooms, startPos);
        const map1 = mapGen1.getCells();
        
        // Save the state
        const saveService = new SaveGameService();
        saveService.save('test-slot', state1);
        
        // Load the state
        const loadedState = saveService.load('test-slot');
        expect(loadedState).toBeDefined();
        expect(loadedState?.mapSeed).toBe(seed);
        
        // Generate a new map with the loaded seed
        const mapGen2 = new MapGenerator(50, 50, 'random', loadedState!.mapSeed);
        mapGen2.generateMap(rooms, startPos);
        const map2 = mapGen2.getCells();
        
        // Maps should be identical
        expect(map1.length).toBe(map2.length);
        for (let y = 0; y < map1.length; y++) {
            expect(map1[y]?.length).toBe(map2[y]?.length);
            for (let x = 0; x < (map1[y]?.length || 0); x++) {
                const cell1 = map1[y]?.[x];
                const cell2 = map2[y]?.[x];
                
                expect(cell1?.position).toEqual(cell2?.position);
                expect(cell1?.locations).toEqual(cell2?.locations);
                expect(cell1?.content?.blocker).toBe(cell2?.content?.blocker);
            }
        }
    });
    
    it('should generate different maps with different seeds', () => {
        const seed1 = 111111;
        const seed2 = 999999;
        
        const state1 = initialState(50, 50, undefined, undefined, seed1);
        const state2 = initialState(50, 50, undefined, undefined, seed2);
        
        expect(state1.mapSeed).toBe(seed1);
        expect(state2.mapSeed).toBe(seed2);
        
        // Generate maps with different seeds
        const mapGen1 = new MapGenerator(50, 50, 'random', seed1);
        const mapGen2 = new MapGenerator(50, 50, 'random', seed2);
        
        const rooms = [{ name: 'room1', size: 5 }];
        const startPos = { x: 25, y: 25 };
        
        mapGen1.generateMap(rooms, startPos);
        mapGen2.generateMap(rooms, startPos);
        
        const map1 = mapGen1.getCells();
        const map2 = mapGen2.getCells();
        
        // Convert to string for easier comparison
        const mapStr1 = map1.map(row => 
            row.map(cell => cell.content?.blocker ? '0' : '1').join('')
        ).join('\n');
        
        const mapStr2 = map2.map(row => 
            row.map(cell => cell.content?.blocker ? '0' : '1').join('')
        ).join('\n');
        
        // Maps should be different
        expect(mapStr1).not.toBe(mapStr2);
    });
});