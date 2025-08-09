import { MeleeCombat } from '../MeleeCombat';
import { MELEE_ATTACKS, MeleeCombatService } from '../services/MeleeCombatService';
import { State } from '../State';
import { EventBus, UpdateStateEvent, ControlsEvent, ActionEvent } from '../events';
import type { ICharacter, IWeapon, IState } from '../interfaces';

describe('MeleeCombat', () => {
    let state: State;
    let meleeCombat: MeleeCombat;
    let eventBus: EventBus<any, any>;
    let mockCharacters: ICharacter[];

    const createMockWeapon = (category: 'melee' | 'ranged', weaponClass: string, damage: number, range: number): IWeapon => ({
        id: `weapon-${weaponClass}`,
        name: `Test ${weaponClass}`,
        description: 'Test weapon',
        weight: 5,
        cost: 100,
        icon: '⚔️',
        type: 'weapon',
        weaponType: 'oneHanded',
        category,
        class: weaponClass as any,
        damage,
        range
    });

    const createMockCharacter = (name: string, player: string, position: { x: number; y: number }, weapon?: IWeapon): ICharacter => ({
        name,
        player,
        position,
        direction: 'down',
        race: 'human',
        health: 100,
        maxHealth: 100,
        description: `Test character ${name}`,
        action: 'idle',
        palette: { skin: '#000', helmet: '#000', suit: '#000' },
        location: 'test',
        blocker: true,
        path: [],
        actions: {
            pointsLeft: 100,
            general: { move: 10, talk: 5, use: 5, inventory: 0 },
            rangedCombat: { shoot: 25, aim: 10, overwatch: 50, cover: 10, throw: 15 },
            closeCombat: { powerStrike: 20, slash: 20, fastAttack: 15, feint: 15, breakGuard: 20 }
        },
        inventory: {
            items: [],
            maxWeight: 50,
            equippedWeapons: {
                primary: weapon || null,
                secondary: null
            }
        }
    });

    beforeEach(() => {
        // Reset the EventBus listeners and MeleeCombat singleton before each test
        EventBus.reset();
        MeleeCombat.resetInstance();
        
        mockCharacters = [
            createMockCharacter('Attacker', 'player1', { x: 5, y: 5 }, createMockWeapon('melee', 'sword', 20, 1)),
            createMockCharacter('Defender', 'player2', { x: 6, y: 5 }, createMockWeapon('melee', 'sword', 20, 1)),
            createMockCharacter('FarEnemy', 'player2', { x: 10, y: 10 }, createMockWeapon('melee', 'sword', 20, 1))
        ];

        const mockState: IState = {
            game: { turn: 'player1', players: ['player1', 'player2'] },
            map: [],
            characters: mockCharacters,
            messages: [],
            ui: {
                animations: { characters: {} },
                visualStates: { characters: {}, cells: {}, board: { mapWidth: 50, mapHeight: 50, hasPopupActive: false } },
                transientUI: { popups: {}, projectiles: [], highlights: { reachableCells: [], pathCells: [], targetableCells: [] } },
                interactionMode: { type: 'normal' },
                selectedCharacter: undefined
            },
            overwatchData: {}
        };

        state = new State(mockState);
        MeleeCombat.initialize(state);
        meleeCombat = MeleeCombat.getInstance();
        
        // Create a separate EventBus instance for listening to events
        // This works because EventBus uses a static listeners Map
        eventBus = new EventBus<any, any>();
    });

    describe('Range Detection', () => {
        it('should detect adjacent enemies within melee range', () => {
            const spy = jest.fn();
            eventBus.listen(UpdateStateEvent.uiHighlights, spy);

            meleeCombat.dispatch(ControlsEvent['power-strike'] as any, 'Attacker');

            expect(spy).toHaveBeenCalled();
            // Check if we got any calls
            if (spy.mock.calls.length > 0) {
                const highlights = spy.mock.calls[spy.mock.calls.length - 1][0]; // Get the last call
                expect(highlights.meleeTargets).toHaveLength(1);
                expect(highlights.meleeTargets[0].position).toEqual({ x: 6, y: 5 });
            } else {
                throw new Error('No highlights dispatched');
            }
        });

        it('should not detect enemies outside melee range', () => {
            const spy = jest.fn();
            eventBus.listen(UpdateStateEvent.uiHighlights, spy);

            meleeCombat.dispatch(ControlsEvent['power-strike'] as any, 'Attacker');

            const highlights = spy.mock.calls[0][0];
            // FarEnemy is at (10, 10), too far for melee
            expect(highlights.meleeTargets).toHaveLength(1);
            expect(highlights.meleeTargets[0].position).toEqual({ x: 6, y: 5 });
        });

        it('should detect diagonal adjacent enemies', () => {
            mockCharacters[1]!.position = { x: 6, y: 6 }; // Diagonal position
            
            // Need to recreate state with updated characters
            const mockState: IState = {
                game: { turn: 'player1', players: ['player1', 'player2'] },
                map: [],
                characters: mockCharacters,
                messages: [],
                ui: {
                    animations: { characters: {} },
                    visualStates: { characters: {}, cells: {}, board: { mapWidth: 50, mapHeight: 50, hasPopupActive: false } },
                    transientUI: { popups: {}, projectiles: [], highlights: { reachableCells: [], pathCells: [], targetableCells: [] } },
                    interactionMode: { type: 'normal' },
                    selectedCharacter: undefined
                },
                overwatchData: {}
            };
            
            EventBus.reset();
            MeleeCombat.resetInstance();
            state = new State(mockState);
            MeleeCombat.initialize(state);
            meleeCombat = MeleeCombat.getInstance();
            eventBus = new EventBus<any, any>();
            
            const spy = jest.fn();
            eventBus.listen(UpdateStateEvent.uiHighlights, spy);

            meleeCombat.dispatch(ControlsEvent['power-strike'] as any, 'Attacker');

            expect(spy).toHaveBeenCalled();
            const highlights = spy.mock.calls[0][0];
            expect(highlights.meleeTargets).toHaveLength(1);
            expect(highlights.meleeTargets[0].position).toEqual({ x: 6, y: 6 });
        });

        it('should respect weapon range for polearms', () => {
            // Give attacker a polearm with range 2
            mockCharacters[0]!.inventory.equippedWeapons.primary = createMockWeapon('melee', 'polearm', 25, 2);
            mockCharacters[2]!.position = { x: 7, y: 5 }; // 2 cells away
            
            // Need to recreate state with updated characters
            const mockState: IState = {
                game: { turn: 'player1', players: ['player1', 'player2'] },
                map: [],
                characters: mockCharacters,
                messages: [],
                ui: {
                    animations: { characters: {} },
                    visualStates: { characters: {}, cells: {}, board: { mapWidth: 50, mapHeight: 50, hasPopupActive: false } },
                    transientUI: { popups: {}, projectiles: [], highlights: { reachableCells: [], pathCells: [], targetableCells: [] } },
                    interactionMode: { type: 'normal' },
                    selectedCharacter: undefined
                },
                overwatchData: {}
            };
            
            EventBus.reset();
            MeleeCombat.resetInstance();
            state = new State(mockState);
            MeleeCombat.initialize(state);
            meleeCombat = MeleeCombat.getInstance();
            eventBus = new EventBus<any, any>();
            
            const spy = jest.fn();
            eventBus.listen(UpdateStateEvent.uiHighlights, spy);

            meleeCombat.dispatch(ControlsEvent['power-strike'] as any, 'Attacker');

            expect(spy).toHaveBeenCalled();
            const highlights = spy.mock.calls[0][0];
            expect(highlights.meleeTargets).toHaveLength(2); // Both enemies now in range
        });
    });

    describe('Damage Calculations', () => {
        it('should calculate damage with same attack and defense', () => {
            const result = MeleeCombatService.calculateMeleeDamage(
                mockCharacters[0]!,
                mockCharacters[1]!,
                'power-strike',
                'power-strike'
            );

            expect(result.blocked).toBe(true);
            expect(result.damage).toBe(0);
        });

        it('should calculate damage with opposite attack and defense', () => {
            const result = MeleeCombatService.calculateMeleeDamage(
                mockCharacters[0]!,
                mockCharacters[1]!,
                'power-strike', // 0 degrees
                'break-guard'   // 180 degrees
            );

            expect(result.blocked).toBe(false);
            expect(result.damage).toBe(20); // Full damage
        });

        it('should calculate reduced damage with adjacent angles', () => {
            const result = MeleeCombatService.calculateMeleeDamage(
                mockCharacters[0]!,
                mockCharacters[1]!,
                'power-strike', // 0 degrees
                'slash'         // 60 degrees
            );

            expect(result.blocked).toBe(false);
            expect(result.damage).toBe(7); // ~33% damage
        });

        it('should apply unarmed defense penalty', () => {
            mockCharacters[1]!.inventory.equippedWeapons.primary = null; // Remove weapon
            
            const result = MeleeCombatService.calculateMeleeDamage(
                mockCharacters[0]!,
                mockCharacters[1]!,
                'power-strike',
                'slash'
            );

            expect(result.blocked).toBe(false);
            expect(result.damage).toBe(40); // 2x damage for unarmed defense
        });

        it('should apply weapon class modifiers', () => {
            mockCharacters[0]!.inventory.equippedWeapons.primary = createMockWeapon('melee', 'polearm', 20, 2);
            mockCharacters[1]!.inventory.equippedWeapons.primary = createMockWeapon('melee', 'sword', 20, 1);
            
            const result = MeleeCombatService.calculateMeleeDamage(
                mockCharacters[0]!,
                mockCharacters[1]!,
                'power-strike',
                'break-guard'
            );

            // Polearm vs Sword = 1.2x modifier
            expect(result.damage).toBe(24); // 20 * 1.2
        });

        it('should handle knife vs polearm advantage', () => {
            mockCharacters[0]!.inventory.equippedWeapons.primary = createMockWeapon('melee', 'knife', 10, 1);
            mockCharacters[1]!.inventory.equippedWeapons.primary = createMockWeapon('melee', 'polearm', 25, 2);
            
            const result = MeleeCombatService.calculateMeleeDamage(
                mockCharacters[0]!,
                mockCharacters[1]!,
                'fast-attack',
                'power-strike'
            );

            // Knife vs Polearm = 0.6x modifier, but angles are different
            const angleDamage = Math.round(10 * 0.66); // ~120 degrees apart
            const finalDamage = Math.round(angleDamage * 0.6);
            expect(result.damage).toBe(finalDamage);
        });
    });

    describe('Action Points', () => {
        it('should check action point requirements', () => {
            mockCharacters[0]!.actions.pointsLeft = 10; // Not enough for fast-attack (15 AP)
            
            // Need to recreate state with updated characters
            const mockState: IState = {
                game: { turn: 'player1', players: ['player1', 'player2'] },
                map: [],
                characters: mockCharacters,
                messages: [],
                ui: {
                    animations: { characters: {} },
                    visualStates: { characters: {}, cells: {}, board: { mapWidth: 50, mapHeight: 50, hasPopupActive: false } },
                    transientUI: { popups: {}, projectiles: [], highlights: { reachableCells: [], pathCells: [], targetableCells: [] } },
                    interactionMode: { type: 'normal' },
                    selectedCharacter: undefined
                },
                overwatchData: {}
            };
            
            EventBus.reset();
            MeleeCombat.resetInstance();
            state = new State(mockState);
            MeleeCombat.initialize(state);
            meleeCombat = MeleeCombat.getInstance();
            eventBus = new EventBus<any, any>();
            
            const errorSpy = jest.fn();
            eventBus.listen(ActionEvent.error, errorSpy);

            meleeCombat.dispatch(ControlsEvent['fast-attack'] as any, 'Attacker');

            // Fast attack costs 15, but we only have 10 AP
            expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Not enough action points'));
        });

        it('should set pending action cost when attack is selected', () => {
            const spy = jest.fn();
            eventBus.listen(UpdateStateEvent.setPendingActionCost, spy);

            meleeCombat.dispatch(ControlsEvent['power-strike'] as any, 'Attacker'); // Costs 20 AP

            expect(spy).toHaveBeenCalledWith({
                characterName: 'Attacker',
                cost: 20
            });
        });

        it('should deduct action points when combat is resolved', () => {
            const deductSpy = jest.fn();
            const defenseSpy = jest.fn();
            
            eventBus.listen(UpdateStateEvent.deductActionPoints, deductSpy);
            eventBus.listen(UpdateStateEvent.uiMeleeDefense, defenseSpy);

            meleeCombat.dispatch(ControlsEvent['power-strike'] as any, 'Attacker');
            
            // Simulate clicking on target
            meleeCombat.dispatch(ControlsEvent.characterClick, {
                characterName: 'Defender',
                position: { x: 6, y: 5 }
            });

            // Defense wheel should have been shown
            expect(defenseSpy).toHaveBeenCalled();

            // Simulate defense selection
            // @ts-ignore - Testing private method
            meleeCombat.resolveMeleeCombat('slash');

            expect(deductSpy).toHaveBeenCalledWith({
                characterName: 'Attacker',
                actionId: 'power-strike',
                cost: 20
            });
        });
    });

    describe('Combat Flow', () => {
        it('should initiate melee combat when target is clicked', () => {
            const defenseSpy = jest.fn();
            eventBus.listen(UpdateStateEvent.uiMeleeDefense, defenseSpy);

            meleeCombat.dispatch(ControlsEvent['power-strike'] as any, 'Attacker');
            meleeCombat.dispatch(ControlsEvent.characterClick, {
                characterName: 'Defender',
                position: { x: 6, y: 5 }
            });

            expect(defenseSpy).toHaveBeenCalledWith(expect.objectContaining({
                attacker: 'Attacker',
                defender: 'Defender',
                attackType: 'power-strike'
            }));
        });

        it('should dispatch combat result after resolution', () => {
            const resultSpy = jest.fn();
            const damageSpy = jest.fn();
            eventBus.listen(UpdateStateEvent.uiMeleeCombatResult, resultSpy);
            eventBus.listen(UpdateStateEvent.damageCharacter, damageSpy);

            // Initiate combat
            meleeCombat.dispatch(ControlsEvent['power-strike'] as any, 'Attacker');
            
            // Click target
            meleeCombat.dispatch(ControlsEvent.characterClick, {
                characterName: 'Defender',
                position: { x: 6, y: 5 }
            });

            // Select defense
            // @ts-ignore - Testing private method
            meleeCombat.resolveMeleeCombat('break-guard'); // Opposite angle

            expect(resultSpy).toHaveBeenCalledWith(expect.objectContaining({
                attacker: 'Attacker',
                defender: 'Defender',
                attackType: 'power-strike',
                defenseType: 'break-guard',
                damage: 20,
                blocked: false
            }));

            expect(damageSpy).toHaveBeenCalledWith({
                targetName: 'Defender',
                damage: 20,
                attackerName: 'Attacker'
            });
        });
    });

    describe('Turn Validation', () => {
        it('should only allow current player to attack', () => {
            const highlightSpy = jest.fn();
            eventBus.listen(UpdateStateEvent.uiHighlights, highlightSpy);

            meleeCombat.dispatch(ControlsEvent['power-strike'] as any, 'Defender'); // Player2 character

            // Should not proceed since it's player1's turn
            expect(highlightSpy).not.toHaveBeenCalled();
        });

        it('should allow correct player to attack', () => {
            const highlightSpy = jest.fn();
            eventBus.listen(UpdateStateEvent.uiHighlights, highlightSpy);

            meleeCombat.dispatch(ControlsEvent['power-strike'] as any, 'Attacker'); // Player1's character

            expect(highlightSpy).toHaveBeenCalled();
        });
    });

    describe('Target Validation', () => {
        it('should not allow targeting allies', () => {
            mockCharacters[1]!.player = 'player1'; // Make defender an ally
            
            // Need to recreate state with updated characters
            const mockState: IState = {
                game: { turn: 'player1', players: ['player1', 'player2'] },
                map: [],
                characters: mockCharacters,
                messages: [],
                ui: {
                    animations: { characters: {} },
                    visualStates: { characters: {}, cells: {}, board: { mapWidth: 50, mapHeight: 50, hasPopupActive: false } },
                    transientUI: { popups: {}, projectiles: [], highlights: { reachableCells: [], pathCells: [], targetableCells: [] } },
                    interactionMode: { type: 'normal' },
                    selectedCharacter: undefined
                },
                overwatchData: {}
            };
            
            EventBus.reset();
            MeleeCombat.resetInstance();
            state = new State(mockState);
            MeleeCombat.initialize(state);
            meleeCombat = MeleeCombat.getInstance();
            eventBus = new EventBus<any, any>();
            
            const errorSpy = jest.fn();
            eventBus.listen(ActionEvent.error, errorSpy);

            meleeCombat.dispatch(ControlsEvent['power-strike'] as any, 'Attacker'); // Player1's character

            // Should error because no valid targets
            expect(errorSpy).toHaveBeenCalledWith('No valid targets in melee range');
        });
    });
});