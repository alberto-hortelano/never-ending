import { Overwatch } from '../../Overwatch';
import { State } from '../../State';
import { initialState } from '../../../data/state';
import { EventBus } from '../../events';
import { UpdateStateEvent, GUIEvent } from '../../events';

describe('Overwatch Team-based Targeting', () => {
    let overwatch: Overwatch;
    let state: any; // Use any for test manipulation
    let eventBus: EventBus<any, any>;
    let dispatchSpy: jest.SpyInstance;

    beforeEach(() => {
        // Create initial state with team configuration
        const stateData = initialState(40, 50);
        state = new State(stateData) as any; // Cast to any for test manipulation
        
        // Create overwatch instance
        overwatch = new Overwatch(state);
        eventBus = new EventBus();
        
        // Spy on dispatch to track events
        dispatchSpy = jest.spyOn(overwatch as any, 'dispatch');
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('Player overwatch should NOT shoot at Data (same team)', () => {
        // Setup: Player in overwatch mode
        const player = state.characters.find((c: any) => c.name === 'Jim')!;
        const data = state.characters.find((c: any) => c.name === 'Data')!;
        
        // Activate overwatch for player
        state.overwatchData['Jim'] = {
            active: true,
            direction: player.direction,
            position: player.position,
            range: 10,
            shotsRemaining: 3,
            watchedCells: [data.position], // Data is in watched area
            shotCells: []
        };

        // Trigger: Move Data through overwatch area
        (overwatch as any).checkOverwatchTriggers(data);

        // Assert: No shoot projectile event should be dispatched
        const shootEvents = dispatchSpy.mock.calls.filter(
            call => call[0] === GUIEvent.shootProjectile
        );
        expect(shootEvents).toHaveLength(0);
    });

    test('Player overwatch SHOULD shoot at enemy (different team)', () => {
        // Setup: Player in overwatch mode
        const player = state.characters.find((c: any) => c.name === 'Jim')!;
        const enemy = state.characters.find((c: any) => c.name === 'enemy')!;
        
        // Position enemy near player for line of sight
        enemy.position = { x: player.position.x + 2, y: player.position.y };
        
        // Activate overwatch for player
        state.overwatchData['Jim'] = {
            active: true,
            direction: 'right',
            position: player.position,
            range: 10,
            shotsRemaining: 3,
            watchedCells: [enemy.position], // Enemy is in watched area
            shotCells: []
        };

        // Mock line of sight check to return true
        jest.spyOn(overwatch as any, 'hasLineOfSight').mockReturnValue(true);

        // Trigger: Move enemy through overwatch area
        (overwatch as any).checkOverwatchTriggers(enemy);

        // Assert: Shoot projectile event should be dispatched
        const shootEvents = dispatchSpy.mock.calls.filter(
            call => call[0] === GUIEvent.shootProjectile
        );
        expect(shootEvents).toHaveLength(1);
        
        // Assert: Damage should be applied to enemy
        const damageEvents = dispatchSpy.mock.calls.filter(
            call => call[0] === UpdateStateEvent.damageCharacter
        );
        expect(damageEvents).toHaveLength(1);
        expect(damageEvents[0][1].targetName).toBe('enemy');
    });

    test('Data overwatch should NOT shoot at player (same team)', () => {
        // Setup: Data in overwatch mode
        const data = state.characters.find((c: any) => c.name === 'Data')!;
        const player = state.characters.find((c: any) => c.name === 'Jim')!;
        
        // Activate overwatch for Data
        state.overwatchData['Data'] = {
            active: true,
            direction: data.direction,
            position: data.position,
            range: 10,
            shotsRemaining: 3,
            watchedCells: [player.position], // Player is in watched area
            shotCells: []
        };

        // Trigger: Move player through overwatch area
        (overwatch as any).checkOverwatchTriggers(player);

        // Assert: No shoot projectile event should be dispatched
        const shootEvents = dispatchSpy.mock.calls.filter(
            call => call[0] === GUIEvent.shootProjectile
        );
        expect(shootEvents).toHaveLength(0);
    });

    test('Data overwatch SHOULD shoot at enemy (different team)', () => {
        // Setup: Data in overwatch mode
        const data = state.characters.find((c: any) => c.name === 'Data')!;
        const enemy = state.characters.find((c: any) => c.name === 'enemy')!;
        
        // Position enemy near Data for line of sight
        enemy.position = { x: data.position.x + 2, y: data.position.y };
        
        // Activate overwatch for Data
        state.overwatchData['Data'] = {
            active: true,
            direction: 'right',
            position: data.position,
            range: 20,
            shotsRemaining: 3,
            watchedCells: [enemy.position], // Enemy is in watched area
            shotCells: []
        };

        // Mock line of sight check to return true
        jest.spyOn(overwatch as any, 'hasLineOfSight').mockReturnValue(true);

        // Trigger: Move enemy through overwatch area
        (overwatch as any).checkOverwatchTriggers(enemy);

        // Assert: Shoot projectile event should be dispatched
        const shootEvents = dispatchSpy.mock.calls.filter(
            call => call[0] === GUIEvent.shootProjectile
        );
        expect(shootEvents).toHaveLength(1);
        
        // Assert: Damage should be applied to enemy
        const damageEvents = dispatchSpy.mock.calls.filter(
            call => call[0] === UpdateStateEvent.damageCharacter
        );
        expect(damageEvents).toHaveLength(1);
        expect(damageEvents[0][1].targetName).toBe('enemy');
    });

    test('Enemy overwatch SHOULD shoot at both player and Data (both on player team)', () => {
        // Setup: Enemy in overwatch mode
        const enemy = state.characters.find((c: any) => c.name === 'enemy')!;
        const player = state.characters.find((c: any) => c.name === 'Jim')!;
        const data = state.characters.find((c: any) => c.name === 'Data')!;
        
        // Position player and Data near enemy
        player.position = { x: enemy.position.x - 2, y: enemy.position.y };
        data.position = { x: enemy.position.x, y: enemy.position.y - 2 };
        
        // Activate overwatch for enemy
        state.overwatchData['enemy'] = {
            active: true,
            direction: 'left',
            position: enemy.position,
            range: 20,
            shotsRemaining: 5,
            watchedCells: [player.position, data.position],
            shotCells: []
        };

        // Mock line of sight check to return true
        jest.spyOn(overwatch as any, 'hasLineOfSight').mockReturnValue(true);

        // Trigger: Move player through overwatch area
        (overwatch as any).checkOverwatchTriggers(player);

        // Assert: Should shoot at player
        let shootEvents = dispatchSpy.mock.calls.filter(
            call => call[0] === GUIEvent.shootProjectile
        );
        expect(shootEvents).toHaveLength(1);

        // Clear mock calls
        dispatchSpy.mockClear();

        // Trigger: Move Data through overwatch area
        (overwatch as any).checkOverwatchTriggers(data);

        // Assert: Should also shoot at Data
        shootEvents = dispatchSpy.mock.calls.filter(
            call => call[0] === GUIEvent.shootProjectile
        );
        expect(shootEvents).toHaveLength(1);
    });
});