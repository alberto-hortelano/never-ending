import { positionCharacters } from '../common/helpers/map';
import { ICharacter, ICell } from '../common/interfaces';
import { baseCharacter } from '../data/state';

describe('Multiplayer Character Positioning', () => {
    // Create a simple test map with rooms
    const createTestMap = (): ICell[][] => {
        const map: ICell[][] = [];
        
        // Create a 10x10 map
        for (let y = 0; y < 10; y++) {
            const row: ICell[] = [];
            for (let x = 0; x < 10; x++) {
                // Create rooms in specific areas
                let locations: string[] = [];
                
                // Room 2: top-left (2x2)
                if (x >= 1 && x <= 2 && y >= 1 && y <= 2) {
                    locations = ['room2'];
                }
                // Room 3: top-right (2x2)
                else if (x >= 7 && x <= 8 && y >= 1 && y <= 2) {
                    locations = ['room3'];
                }
                // Room 4: bottom-left (2x2)
                else if (x >= 1 && x <= 2 && y >= 7 && y <= 8) {
                    locations = ['room4'];
                }
                // Room 5: bottom-right (2x2)
                else if (x >= 7 && x <= 8 && y >= 7 && y <= 8) {
                    locations = ['room5'];
                }
                
                const cell: ICell = {
                    position: { x, y },
                    locations,
                    elements: [],
                    content: null
                };
                row.push(cell);
            }
            map.push(row);
        }
        
        return map;
    };
    
    it('should position characters in their assigned rooms', () => {
        const map = createTestMap();
        
        // Create test characters for multiplayer
        const characters: ICharacter[] = [
            {
                ...baseCharacter,
                name: 'Player 1',
                player: 'player1',
                location: 'room2',
                position: { x: 0, y: 0 } // Invalid initial position
            },
            {
                ...baseCharacter,
                name: 'Player 2',
                player: 'player2',
                location: 'room3',
                position: { x: 0, y: 0 } // Invalid initial position
            }
        ];
        
        const positionedCharacters = positionCharacters(characters, map);
        
        // Check that characters were positioned in their respective rooms
        const player1 = positionedCharacters.find(c => c.player === 'player1');
        const player2 = positionedCharacters.find(c => c.player === 'player2');
        
        expect(player1).toBeDefined();
        expect(player2).toBeDefined();
        
        // Player 1 should be in room2 (top-left area)
        expect(player1!.position.x).toBeGreaterThanOrEqual(1);
        expect(player1!.position.x).toBeLessThanOrEqual(2);
        expect(player1!.position.y).toBeGreaterThanOrEqual(1);
        expect(player1!.position.y).toBeLessThanOrEqual(2);
        
        // Player 2 should be in room3 (top-right area)
        expect(player2!.position.x).toBeGreaterThanOrEqual(7);
        expect(player2!.position.x).toBeLessThanOrEqual(8);
        expect(player2!.position.y).toBeGreaterThanOrEqual(1);
        expect(player2!.position.y).toBeLessThanOrEqual(2);
        
        // Characters should not overlap
        expect(player1!.position).not.toEqual(player2!.position);
    });
    
    it('should handle multiple characters in the same room', () => {
        const map = createTestMap();
        
        // Create characters that want to spawn in the same room
        const characters: ICharacter[] = [
            {
                ...baseCharacter,
                name: 'Player 1',
                player: 'player1',
                location: 'room2',
                position: { x: 0, y: 0 }
            },
            {
                ...baseCharacter,
                name: 'Player 2',
                player: 'player2',
                location: 'room2', // Same room as player 1
                position: { x: 0, y: 0 }
            }
        ];
        
        const positionedCharacters = positionCharacters(characters, map);
        
        const player1 = positionedCharacters.find(c => c.player === 'player1');
        const player2 = positionedCharacters.find(c => c.player === 'player2');
        
        // Both should be in room2
        expect(player1!.position.x).toBeGreaterThanOrEqual(1);
        expect(player1!.position.x).toBeLessThanOrEqual(2);
        expect(player1!.position.y).toBeGreaterThanOrEqual(1);
        expect(player1!.position.y).toBeLessThanOrEqual(2);
        
        expect(player2!.position.x).toBeGreaterThanOrEqual(1);
        expect(player2!.position.x).toBeLessThanOrEqual(2);
        expect(player2!.position.y).toBeGreaterThanOrEqual(1);
        expect(player2!.position.y).toBeLessThanOrEqual(2);
        
        // But they should not overlap
        expect(player1!.position).not.toEqual(player2!.position);
    });
    
    it('should fallback to original position if no valid room cells found', () => {
        const map = createTestMap();
        
        // Create a character with an invalid room location
        const characters: ICharacter[] = [
            {
                ...baseCharacter,
                name: 'Player 1',
                player: 'player1',
                location: 'nonexistent-room',
                position: { x: 5, y: 5 } // Center position
            }
        ];
        
        const positionedCharacters = positionCharacters(characters, map);
        const player1 = positionedCharacters.find(c => c.player === 'player1');
        
        // Should keep original position since no valid room was found
        expect(player1!.position).toEqual({ x: 5, y: 5 });
    });
});