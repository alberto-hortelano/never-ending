import { State } from '../common/State';
import { initialState } from '../data/state';

describe('Inventory Basic Test', () => {
    let state: State;
    
    beforeEach(() => {
        // Initialize state with test data
        state = new State(initialState(40, 50));
    });
    
    test('characters have inventory items in initial state', () => {
        const player = state.findCharacter('player');
        expect(player).toBeDefined();
        expect(player?.inventory).toBeDefined();
        expect(player?.inventory.items).toBeDefined();
        expect(player?.inventory.items.length).toBeGreaterThan(0);
        
        // Check that player has the expected items
        const itemNames = player?.inventory.items.map(item => item.name);
        expect(itemNames).toContain('Energy Pistol');
        expect(itemNames).toContain('Plasma Sword');
        expect(itemNames).toContain('Medkit');
        expect(itemNames).toContain('Food Ration');
        
        // Check equipped weapons
        expect(player?.inventory.equippedWeapons.primary?.name).toBe('Energy Pistol');
        expect(player?.inventory.equippedWeapons.secondary?.name).toBe('Plasma Sword');
    });
    
    test('data character has inventory items', () => {
        const data = state.findCharacter('data');
        expect(data).toBeDefined();
        expect(data?.inventory.items.length).toBeGreaterThan(0);
        
        // Check that data has the expected items
        const itemNames = data?.inventory.items.map(item => item.name);
        expect(itemNames).toContain('Pulse Rifle');
        expect(itemNames).toContain('Energy Cell');
        
        // Check equipped weapons
        expect(data?.inventory.equippedWeapons.primary?.name).toBe('Pulse Rifle');
        expect(data?.inventory.equippedWeapons.secondary).toBeNull();
    });
    
    test('enemy character has inventory items', () => {
        const enemy = state.findCharacter('enemy');
        expect(enemy).toBeDefined();
        expect(enemy?.inventory.items.length).toBeGreaterThan(0);
        
        // Check that enemy has the expected items
        const itemNames = enemy?.inventory.items.map(item => item.name);
        expect(itemNames).toContain('Combat Knife');
        expect(itemNames).toContain('Energy Spear');
        expect(itemNames).toContain('Security Keycard');
        
        // Check equipped weapons
        expect(enemy?.inventory.equippedWeapons.primary?.name).toBe('Energy Spear');
        expect(enemy?.inventory.equippedWeapons.secondary).toBeNull();
    });
});