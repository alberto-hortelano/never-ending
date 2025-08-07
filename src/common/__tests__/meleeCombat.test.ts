import { MeleeCombat, MELEE_ATTACKS } from '../MeleeCombat';
import { State } from '../State';
import { EventBus, UpdateStateEvent, ControlsEvent } from '../events';
import type { ICharacter, IWeapon, IState } from '../interfaces';

describe('MeleeCombat', () => {
    let meleeCombat: MeleeCombat;
    let state: State;
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
        meleeCombat = new MeleeCombat(state);
        eventBus = new EventBus<any, any>();
    });

    describe('Range Detection', () => {
        it('should detect adjacent enemies within melee range', () => {
            const spy = jest.fn();
            eventBus.listen(UpdateStateEvent.uiHighlights, spy);

            meleeCombat.dispatch(ControlsEvent['power-strike'], 'Attacker');

            expect(spy).toHaveBeenCalled();
            const highlights = spy.mock.calls[0][0];
            expect(highlights.meleeTargets).toHaveLength(1);
            expect(highlights.meleeTargets[0].position).toEqual({ x: 6, y: 5 });
        });

        it('should not detect enemies outside melee range', () => {
            const spy = jest.fn();
            eventBus.listen(UpdateStateEvent.uiHighlights, spy);

            meleeCombat.dispatch(ControlsEvent['power-strike'], 'Attacker');

            expect(spy).toHaveBeenCalled();
            const highlights = spy.mock.calls[0][0];
            const farEnemyHighlight = highlights.meleeTargets?.find(
                (h: any) => h.position.x === 10 && h.position.y === 10
            );
            expect(farEnemyHighlight).toBeUndefined();
        });

        it('should detect diagonal adjacent enemies', () => {
            mockCharacters[1]!.position = { x: 6, y: 6 }; // Diagonal position
            const spy = jest.fn();
            eventBus.listen(UpdateStateEvent.uiHighlights, spy);

            meleeCombat.dispatch(ControlsEvent['power-strike'], 'Attacker');

            expect(spy).toHaveBeenCalled();
            const highlights = spy.mock.calls[0][0];
            expect(highlights.meleeTargets).toHaveLength(1);
            expect(highlights.meleeTargets[0].position).toEqual({ x: 6, y: 6 });
        });

        it('should respect weapon range for polearms', () => {
            // Give attacker a polearm with range 2
            mockCharacters[0]!.inventory.equippedWeapons.primary = createMockWeapon('melee', 'polearm', 25, 2);
            mockCharacters[2]!.position = { x: 7, y: 5 }; // 2 cells away
            
            const spy = jest.fn();
            eventBus.listen(UpdateStateEvent.uiHighlights, spy);

            meleeCombat.dispatch(ControlsEvent['power-strike'], 'Attacker');

            expect(spy).toHaveBeenCalled();
            const highlights = spy.mock.calls[0][0];
            expect(highlights.meleeTargets).toHaveLength(2); // Both enemies now in range
        });
    });

    describe('Damage Calculation', () => {
        it('should calculate 0 damage for perfect block (same attack)', () => {
            const attacker = mockCharacters[0]!;
            const defender = mockCharacters[1]!;
            
            const result = meleeCombat.calculateMeleeDamage(
                attacker,
                defender,
                'power-strike',
                'power-strike' // Same attack = perfect block
            );

            expect(result.blocked).toBe(true);
            expect(result.damage).toBe(0);
        });

        it('should calculate maximum damage for opposite attack', () => {
            const attacker = mockCharacters[0]!;
            const defender = mockCharacters[1]!;
            
            const result = meleeCombat.calculateMeleeDamage(
                attacker,
                defender,
                'power-strike', // 0°
                'break-guard'   // 180° - opposite
            );

            expect(result.blocked).toBe(false);
            expect(result.damage).toBe(20); // Base damage
        });

        it('should calculate 33% damage for adjacent attacks', () => {
            const attacker = mockCharacters[0]!;
            const defender = mockCharacters[1]!;
            
            const result = meleeCombat.calculateMeleeDamage(
                attacker,
                defender,
                'power-strike', // 0°
                'slash'         // 60° - adjacent
            );

            expect(result.blocked).toBe(false);
            expect(result.damage).toBe(Math.round(20 * 0.33)); // 33% of base damage
        });

        it('should calculate 66% damage for attacks two positions away', () => {
            const attacker = mockCharacters[0]!;
            const defender = mockCharacters[1]!;
            
            const result = meleeCombat.calculateMeleeDamage(
                attacker,
                defender,
                'power-strike', // 0°
                'fast-attack'   // 120° - two away
            );

            expect(result.blocked).toBe(false);
            expect(result.damage).toBe(Math.round(20 * 0.66)); // 66% of base damage
        });

        it('should apply penalty for unarmed defender', () => {
            const attacker = mockCharacters[0]!;
            const defender = mockCharacters[1]!;
            defender.inventory.equippedWeapons.primary = null; // Unarmed
            
            const result = meleeCombat.calculateMeleeDamage(
                attacker,
                defender,
                'power-strike',
                'slash' // Not a perfect block
            );

            expect(result.blocked).toBe(false);
            expect(result.damage).toBe(40); // 2x damage for unarmed
        });

        it('should allow unarmed defender to dodge with perfect match', () => {
            const attacker = mockCharacters[0]!;
            const defender = mockCharacters[1]!;
            defender.inventory.equippedWeapons.primary = null; // Unarmed
            
            const result = meleeCombat.calculateMeleeDamage(
                attacker,
                defender,
                'power-strike',
                'power-strike' // Perfect dodge
            );

            expect(result.blocked).toBe(true);
            expect(result.damage).toBe(0);
        });
    });

    describe('Weapon Class Modifiers', () => {
        it('should apply sword vs knife modifier', () => {
            const attacker = mockCharacters[0]!;
            attacker.inventory.equippedWeapons.primary = createMockWeapon('melee', 'sword', 20, 1);
            const defender = mockCharacters[1]!;
            defender.inventory.equippedWeapons.primary = createMockWeapon('melee', 'knife', 10, 1);
            
            const result = meleeCombat.calculateMeleeDamage(
                attacker,
                defender,
                'power-strike',
                'break-guard' // Opposite for max damage
            );

            expect(result.damage).toBe(Math.round(20 * 1.0 * 1.2)); // Sword vs knife = 1.2x
        });

        it('should apply polearm vs sword modifier', () => {
            const attacker = mockCharacters[0]!;
            attacker.inventory.equippedWeapons.primary = createMockWeapon('melee', 'polearm', 25, 2);
            const defender = mockCharacters[1]!;
            defender.inventory.equippedWeapons.primary = createMockWeapon('melee', 'sword', 20, 1);
            
            const result = meleeCombat.calculateMeleeDamage(
                attacker,
                defender,
                'power-strike',
                'break-guard' // Opposite for max damage
            );

            expect(result.damage).toBe(Math.round(25 * 1.0 * 1.2)); // Polearm vs sword = 1.2x
        });
    });

    describe('Attack Selection', () => {
        it('should handle all six attack types', () => {
            const attackTypes = ['power-strike', 'slash', 'fast-attack', 'feint', 'break-guard', 'special'];
            
            attackTypes.forEach(attackType => {
                const attack = MELEE_ATTACKS.find(a => a.type === attackType);
                expect(attack).toBeDefined();
                expect(attack?.angle).toBeDefined();
                expect(attack?.apCost).toBeGreaterThan(0);
            });
        });

        it('should deduct correct AP cost for each attack', () => {
            const spy = jest.fn();
            eventBus.listen(UpdateStateEvent.setPendingActionCost, spy);

            meleeCombat.dispatch(ControlsEvent['fast-attack'], 'Attacker');

            expect(spy).toHaveBeenCalledWith({
                characterName: 'Attacker',
                cost: 15 // Fast attack cost
            });
        });

        it('should prevent attacks without enough AP', () => {
            mockCharacters[0]!.actions.pointsLeft = 10; // Not enough for most attacks
            const errorSpy = jest.fn();
            eventBus.listen('ActionEvent.error', errorSpy);

            meleeCombat.dispatch(ControlsEvent['power-strike'], 'Attacker'); // Costs 20 AP

            expect(errorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Not enough action points')
            );
        });
    });

    describe('Combat Flow', () => {
        it('should initiate melee combat when clicking valid target', () => {
            const defenseSpy = jest.fn();
            eventBus.listen(UpdateStateEvent.uiMeleeDefense, defenseSpy);

            // Start melee attack
            meleeCombat.dispatch(ControlsEvent['power-strike'], 'Attacker');
            
            // Click on defender
            meleeCombat.dispatch(ControlsEvent.characterClick, {
                characterName: 'Defender',
                position: { x: 6, y: 5 }
            });

            expect(defenseSpy).toHaveBeenCalledWith({
                attacker: 'Attacker',
                defender: 'Defender',
                attackType: 'power-strike',
                weaponInfo: {
                    attackerWeapon: 'Test sword',
                    defenderWeapon: 'Test sword'
                }
            });
        });

        it('should resolve combat when defense is selected', () => {
            const resultSpy = jest.fn();
            const damageSpy = jest.fn();
            eventBus.listen(UpdateStateEvent.uiMeleeCombatResult, resultSpy);
            eventBus.listen(UpdateStateEvent.damageCharacter, damageSpy);

            // Setup combat
            meleeCombat.dispatch(ControlsEvent['power-strike'], 'Attacker');
            meleeCombat.dispatch(ControlsEvent.characterClick, {
                characterName: 'Defender',
                position: { x: 6, y: 5 }
            });

            // Select defense
            meleeCombat.dispatch(ControlsEvent.meleeDefenseSelected, {
                defenseType: 'slash'
            });

            expect(resultSpy).toHaveBeenCalled();
            expect(damageSpy).toHaveBeenCalledWith({
                targetName: 'Defender',
                damage: expect.any(Number),
                attackerName: 'Attacker'
            });
        });
    });

    describe('Edge Cases', () => {
        it('should handle attacking with no valid targets', () => {
            // Move all enemies out of range
            mockCharacters[1]!.position = { x: 20, y: 20 };
            mockCharacters[2]!.position = { x: 30, y: 30 };

            const errorSpy = jest.fn();
            eventBus.listen('ActionEvent.error', errorSpy);

            meleeCombat.dispatch(ControlsEvent['power-strike'], 'Attacker');

            expect(errorSpy).toHaveBeenCalledWith('No valid targets in melee range');
        });

        it('should not allow dead characters to be targeted', () => {
            mockCharacters[1]!.health = 0; // Dead defender
            
            const spy = jest.fn();
            eventBus.listen(UpdateStateEvent.uiHighlights, spy);

            meleeCombat.dispatch(ControlsEvent['power-strike'], 'Attacker');

            expect(spy).toHaveBeenCalled();
            const highlights = spy.mock.calls[0][0];
            expect(highlights.meleeTargets).toHaveLength(0); // No valid targets
        });

        it('should not allow targeting allies', () => {
            mockCharacters[1]!.player = 'player1'; // Same team as attacker
            
            const spy = jest.fn();
            eventBus.listen(UpdateStateEvent.uiHighlights, spy);

            meleeCombat.dispatch(ControlsEvent['power-strike'], 'Attacker');

            expect(spy).toHaveBeenCalled();
            const highlights = spy.mock.calls[0][0];
            expect(highlights.meleeTargets).toHaveLength(0); // No valid targets
        });

        it('should handle wrong turn attempts', () => {
            // Change turn to player2
            (state as any).game.turn = 'player2';
            
            const errorSpy = jest.fn();
            const highlightSpy = jest.fn();
            eventBus.listen(UpdateStateEvent.uiHighlights, highlightSpy);

            meleeCombat.dispatch(ControlsEvent['power-strike'], 'Attacker'); // Player1's character

            expect(highlightSpy).not.toHaveBeenCalled();
        });
    });
});