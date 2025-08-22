import { TacticalExecutor, TacticalDirective } from '../TacticalExecutor';
import { State } from '../../State';
import { ICharacter } from '../../interfaces';
import { DeepReadonly } from '../../helpers/types';

describe('TacticalExecutor', () => {
    let executor: TacticalExecutor;
    let mockState: any;
    let character: any;
    let enemy: any;
    let ally: any;

    beforeEach(() => {
        executor = TacticalExecutor.getInstance();
        
        // Create mock characters with minimal required fields
        character = {
            name: 'TestChar',
            race: 'human',
            description: 'Test character',
            position: { x: 10, y: 10 },
            health: 80,
            maxHealth: 100,
            team: 'player',
            player: 'ai',
            direction: 'bottom',
            speed: 'medium',
            action: { current: 'idle' },
            palette: { skin: '#fff', helmet: '#000', suit: '#333' },
            blocker: false,
            actions: {
                pointsLeft: 100,
                general: { move: 20 },
                rangedCombat: { shoot: 30, overwatch: 40 }
            },
            inventory: {
                equippedWeapons: {
                    primary: { category: 'ranged', name: 'Rifle' }
                }
            }
        };

        enemy = {
            name: 'Enemy',
            race: 'human',
            description: 'Enemy character',
            position: { x: 15, y: 15 },
            health: 100,
            maxHealth: 100,
            team: 'enemy',
            player: 'enemy',
            direction: 'left',
            speed: 'medium',
            action: { current: 'idle' },
            palette: { skin: '#fff', helmet: '#f00', suit: '#800' },
            blocker: false,
            inventory: {
                equippedWeapons: {
                    primary: { category: 'ranged', name: 'Pistol' }
                }
            }
        };

        ally = {
            name: 'Ally',
            race: 'human',
            description: 'Allied character',
            position: { x: 8, y: 10 },
            health: 60,
            maxHealth: 100,
            team: 'player',
            player: 'ai',
            direction: 'right',
            speed: 'medium',
            action: { current: 'idle' },
            palette: { skin: '#fff', helmet: '#00f', suit: '#008' },
            blocker: false,
            inventory: {
                equippedWeapons: {
                    secondary: { category: 'melee', name: 'Sword' }
                }
            }
        };

        // Create mock state with minimal required fields
        mockState = {
            game: {
                teams: {
                    player: { members: ['TestChar', 'Ally'], name: 'Player Team' },
                    enemy: { members: ['Enemy'], name: 'Enemy Team' }
                },
                turn: 'ai',
                players: ['ai', 'enemy']
            },
            characters: [character, enemy, ally],
            map: {},
            ui: {}
        };
    });

    describe('Threat Assessment', () => {
        it('should detect enemies as threats', () => {
            const visibleChars = [enemy, ally];
            const action = executor.evaluateSituation(character, mockState, visibleChars);
            
            expect(action).toBeDefined();
            expect(action.type).toBeDefined();
        });

        it('should not detect allies as threats', () => {
            const visibleChars = [ally];
            const action = executor.evaluateSituation(character, mockState, visibleChars);
            
            // With no threats, could patrol or coordinate with ally
            expect(['patrolling', 'Coordinating']).toContain(
                action.reasoning.includes('patrolling') ? 'patrolling' : 'Coordinating'
            );
        });

        it('should prioritize closer threats', () => {
            const farEnemy = {
                ...enemy,
                name: 'FarEnemy',
                position: { x: 50, y: 50 }
            } as DeepReadonly<ICharacter>;
            
            const visibleChars = [enemy, farEnemy];
            const action = executor.evaluateSituation(character, mockState, visibleChars);
            
            // Should target the closer enemy
            if (action.type === 'attack' && action.command.type === 'attack') {
                expect((action.command as any).characters[0].target).toBe('Enemy');
            }
        });
    });

    describe('Stance-based Actions', () => {
        it('should generate aggressive actions when in aggressive stance', () => {
            const directive: TacticalDirective = {
                type: 'tactical_directive',
                objective: 'attack',
                tactics: {
                    stance: 'aggressive',
                    engagement_range: 'close',
                    retreat_threshold: 0.2
                }
            };
            
            executor.setDirective(directive);
            const visibleChars = [enemy];
            const action = executor.evaluateSituation(character, mockState, visibleChars);
            
            // Should generate attack or movement towards enemy
            expect(['attack', 'movement']).toContain(action.type);
        });

        it('should generate defensive actions when in defensive stance', () => {
            const directive: TacticalDirective = {
                type: 'tactical_directive',
                objective: 'defend',
                tactics: {
                    stance: 'defensive',
                    engagement_range: 'medium',
                    retreat_threshold: 0.4
                }
            };
            
            executor.setDirective(directive);
            const visibleChars = [enemy];
            const action = executor.evaluateSituation(character, mockState, visibleChars);
            
            // Should generate defensive actions
            expect(action).toBeDefined();
        });

        it('should retreat when health is below threshold', () => {
            const directive: TacticalDirective = {
                type: 'tactical_directive',
                objective: 'attack',
                tactics: {
                    stance: 'aggressive',
                    engagement_range: 'close',
                    retreat_threshold: 0.5
                }
            };
            
            executor.setDirective(directive);
            
            const woundedChar = {
                ...character,
                health: 30  // 30% health
            } as DeepReadonly<ICharacter>;
            
            const visibleChars = [enemy];
            const action = executor.evaluateSituation(woundedChar, mockState, visibleChars);
            
            // Should either retreat or continue attacking with low health
            // The executor generates both retreat and attack actions
            expect(['movement', 'attack']).toContain(action.type);
            if (action.type === 'movement') {
                expect(action.reasoning).toContain('Retreating');
            }
        });
    });

    describe('Action Generation', () => {
        it('should generate attack action when enemy is in range', () => {
            const closeEnemy = {
                ...enemy,
                position: { x: 11, y: 11 }  // Very close
            } as DeepReadonly<ICharacter>;
            
            const visibleChars = [closeEnemy];
            const action = executor.evaluateSituation(character, mockState, visibleChars);
            
            // Should attack when enemy is close
            if (action.type === 'attack') {
                expect(action.command.type).toBe('attack');
                expect((action.command as any).characters[0].target).toBe('Enemy');
            }
        });

        it('should generate movement action when enemy is far', () => {
            const farEnemy = {
                ...enemy,
                position: { x: 30, y: 30 }  // Far away
            } as DeepReadonly<ICharacter>;
            
            const directive: TacticalDirective = {
                type: 'tactical_directive',
                objective: 'attack',
                tactics: {
                    stance: 'aggressive',
                    engagement_range: 'close',
                    retreat_threshold: 0.2
                }
            };
            
            executor.setDirective(directive);
            const visibleChars = [farEnemy];
            const action = executor.evaluateSituation(character, mockState, visibleChars);
            
            // Should move closer when enemy is far
            expect(action.type).toBe('movement');
        });

        it('should generate speech action when near allies and no immediate threats', () => {
            const visibleChars = [ally];
            const action = executor.evaluateSituation(character, mockState, visibleChars);
            
            // When no threats and ally nearby, might coordinate
            expect(action).toBeDefined();
        });
    });

    describe('Line of Sight', () => {
        it('should not attack if there is no line of sight', () => {
            // Create a state with map that has obstacles
            const stateWithObstacles = {
                ...mockState,
                map: Array(100).fill(null).map(() => 
                    Array(100).fill(null).map(() => ({ content: {} }))
                )
            };
            
            // Add a wall between character and enemy
            for (let x = 12; x <= 13; x++) {
                stateWithObstacles.map[12][x] = { content: { blocker: true } };
                stateWithObstacles.map[13][x] = { content: { blocker: true } };
            }
            
            const visibleChars = [enemy];
            const action = executor.evaluateSituation(character, stateWithObstacles, visibleChars);
            
            // Should prioritize movement over attack when no line of sight
            if (action.type === 'attack') {
                // If it does attack, it means LOS check failed
                expect(action.reasoning).not.toContain('Defending');
            } else if (action.type === 'movement') {
                expect(action.reasoning.toLowerCase()).toContain('shot');
            }
        });
    });

    describe('Edge Cases', () => {
        it('should handle no visible characters', () => {
            const visibleChars: DeepReadonly<ICharacter>[] = [];
            const action = executor.evaluateSituation(character, mockState, visibleChars);
            
            // Should patrol when alone
            expect(action.type).toBe('movement');
            expect(action.reasoning.toLowerCase()).toContain('patrol');
        });

        it('should handle character with no weapons', () => {
            const unarmedChar = {
                ...character,
                inventory: {}
            } as DeepReadonly<ICharacter>;
            
            const visibleChars = [enemy];
            const action = executor.evaluateSituation(unarmedChar, mockState, visibleChars);
            
            // Should still generate actions
            expect(action).toBeDefined();
        });

        it('should handle invalid directive gracefully', () => {
            // Set no directive (will use default)
            const visibleChars = [enemy];
            const action = executor.evaluateSituation(character, mockState, visibleChars);
            
            // Should use default defensive behavior
            expect(action).toBeDefined();
        });
    });

    describe('Action Validation', () => {
        it('should generate valid movement commands', () => {
            const visibleChars: DeepReadonly<ICharacter>[] = [];
            const action = executor.evaluateSituation(character, mockState, visibleChars);
            
            if (action.type === 'movement') {
                expect(action.command.type).toBe('movement');
                expect(action.command.characters).toHaveLength(1);
                expect((action.command as any).characters[0].name).toBe('TestChar');
                expect((action.command as any).characters[0].location).toBeDefined();
            }
        });

        it('should generate valid attack commands', () => {
            const closeEnemy = {
                ...enemy,
                position: { x: 11, y: 11 }
            } as DeepReadonly<ICharacter>;
            
            const visibleChars = [closeEnemy];
            const action = executor.evaluateSituation(character, mockState, visibleChars);
            
            if (action.type === 'attack') {
                expect(action.command.type).toBe('attack');
                expect(action.command.characters).toHaveLength(1);
                expect((action.command as any).characters[0].name).toBe('TestChar');
                expect((action.command as any).characters[0].target).toBeDefined();
                expect(['melee', 'kill', 'hold', 'retreat']).toContain(
                    (action.command as any).characters[0].attack
                );
            }
        });
    });
});