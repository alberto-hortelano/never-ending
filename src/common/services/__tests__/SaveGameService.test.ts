import { SaveGameService } from '../SaveGameService';
import { IState } from '../../interfaces';
import { getBaseState } from '../../../data/state';

describe('SaveGameService', () => {
    let service: SaveGameService;
    let mockState: IState;

    beforeEach(() => {
        service = new SaveGameService();
        mockState = getBaseState();
    });

    describe('save', () => {
        it('should save a game state with a given slot name', () => {
            const slotName = 'test-save';
            const result = service.save(slotName, mockState);
            
            expect(result).toBe(true);
        });

        it('should overwrite existing save in the same slot', () => {
            const slotName = 'test-save';
            
            // First save
            service.save(slotName, mockState);
            
            // Modify state
            const modifiedState = { ...mockState };
            modifiedState.game.turn = 'different-turn';
            
            // Second save to same slot
            const result = service.save(slotName, modifiedState);
            
            expect(result).toBe(true);
            
            // Verify it was overwritten
            const loaded = service.load(slotName);
            expect(loaded?.game.turn).toBe('different-turn');
        });

        it('should handle multiple save slots', () => {
            const state1 = { ...mockState, game: { ...mockState.game, turn: 'player1' } };
            const state2 = { ...mockState, game: { ...mockState.game, turn: 'player2' } };
            
            service.save('slot1', state1);
            service.save('slot2', state2);
            
            const loaded1 = service.load('slot1');
            const loaded2 = service.load('slot2');
            
            expect(loaded1?.game.turn).toBe('player1');
            expect(loaded2?.game.turn).toBe('player2');
        });
    });

    describe('load', () => {
        it('should load a previously saved game state', () => {
            const slotName = 'test-save';
            service.save(slotName, mockState);
            
            const loaded = service.load(slotName);
            
            expect(loaded).toBeDefined();
            expect(loaded?.game).toEqual(mockState.game);
            expect(loaded?.map).toEqual(mockState.map);
            expect(loaded?.characters).toEqual(mockState.characters);
        });

        it('should return null for non-existent slot', () => {
            const loaded = service.load('non-existent');
            
            expect(loaded).toBeNull();
        });

        it('should return a deep copy of the saved state', () => {
            const slotName = 'test-save';
            service.save(slotName, mockState);
            
            const loaded1 = service.load(slotName);
            const loaded2 = service.load(slotName);
            
            // Modify loaded1
            if (loaded1) {
                loaded1.game.turn = 'modified';
            }
            
            // loaded2 should not be affected
            expect(loaded2?.game.turn).toBe(mockState.game.turn);
            expect(loaded2?.game.turn).not.toBe('modified');
        });
    });

    describe('delete', () => {
        it('should delete a saved game', () => {
            const slotName = 'test-save';
            service.save(slotName, mockState);
            
            const deleted = service.delete(slotName);
            
            expect(deleted).toBe(true);
            expect(service.load(slotName)).toBeNull();
        });

        it('should return false when deleting non-existent save', () => {
            const deleted = service.delete('non-existent');
            
            expect(deleted).toBe(false);
        });
    });

    describe('listSaves', () => {
        it('should return empty array when no saves exist', () => {
            const saves = service.listSaves();
            
            expect(saves).toEqual([]);
        });

        it('should list all saved games with metadata', () => {
            const state1 = { ...mockState, game: { ...mockState.game, turn: 'player1' } };
            const state2 = { ...mockState, game: { ...mockState.game, turn: 'player2' } };
            
            service.save('slot1', state1);
            service.save('slot2', state2);
            
            const saves = service.listSaves();
            
            expect(saves).toHaveLength(2);
            expect(saves[0]?.slotName).toBe('slot1');
            expect(saves[0]?.turn).toBe('player1');
            expect(saves[0]?.timestamp).toBeDefined();
            expect(saves[1]?.slotName).toBe('slot2');
            expect(saves[1]?.turn).toBe('player2');
        });

        it('should update metadata when overwriting a save', () => {
            service.save('slot1', mockState);
            const saves1 = service.listSaves();
            const timestamp1 = saves1[0]?.timestamp || 0;
            
            // Wait a bit to ensure different timestamp
            const modifiedState = { ...mockState, game: { ...mockState.game, turn: 'new-turn' } };
            
            // Use a mock timer or just save immediately
            service.save('slot1', modifiedState);
            const saves2 = service.listSaves();
            
            expect(saves2[0]?.turn).toBe('new-turn');
            expect(saves2[0]?.timestamp).toBeGreaterThanOrEqual(timestamp1);
        });
    });

    describe('exists', () => {
        it('should return true for existing save', () => {
            service.save('test-save', mockState);
            
            expect(service.exists('test-save')).toBe(true);
        });

        it('should return false for non-existent save', () => {
            expect(service.exists('non-existent')).toBe(false);
        });
    });

    describe('clear', () => {
        it('should remove all saves', () => {
            service.save('slot1', mockState);
            service.save('slot2', mockState);
            service.save('slot3', mockState);
            
            service.clear();
            
            expect(service.listSaves()).toEqual([]);
            expect(service.load('slot1')).toBeNull();
            expect(service.load('slot2')).toBeNull();
            expect(service.load('slot3')).toBeNull();
        });
    });

    describe('getMetadata', () => {
        it('should return metadata for a specific save', () => {
            const state = { ...mockState, game: { ...mockState.game, turn: 'player1' } };
            service.save('test-save', state);
            
            const metadata = service.getMetadata('test-save');
            
            expect(metadata).toBeDefined();
            expect(metadata?.slotName).toBe('test-save');
            expect(metadata?.turn).toBe('player1');
            expect(metadata?.characterCount).toBe(state.characters.length);
            expect(metadata?.timestamp).toBeDefined();
        });

        it('should return null for non-existent save', () => {
            const metadata = service.getMetadata('non-existent');
            
            expect(metadata).toBeNull();
        });
    });
});