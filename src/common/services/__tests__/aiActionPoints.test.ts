import { TacticalExecutor } from '../TacticalExecutor';

describe('AI Action Points Management', () => {
    let executor: TacticalExecutor;

    beforeEach(() => {
        executor = TacticalExecutor.getInstance();
    });

    describe('Action Cost Estimation', () => {
        it('should correctly estimate action costs', () => {
            const mockCharacter: any = {
                name: 'TestChar',
                position: { x: 10, y: 10 },
                health: 100,
                maxHealth: 100,
                actions: {
                    pointsLeft: 100,
                    general: { move: 20 },
                    rangedCombat: { shoot: 30, overwatch: 40 }
                }
            };

            // Test private method indirectly through scoring
            const moveAction = {
                type: 'movement' as const,
                priority: 50,
                command: {
                    type: 'movement' as const,
                    characters: [{
                        name: 'TestChar',
                        location: '15,15'
                    }]
                },
                reasoning: 'Test move'
            };

            const attackAction = {
                type: 'attack' as const,
                priority: 50,
                command: {
                    type: 'attack' as const,
                    characters: [{
                        name: 'TestChar',
                        target: 'Enemy',
                    }]
                },
                reasoning: 'Test attack'
            };

            // Character with full action points should prefer actions
            const fullPointsChar = { ...mockCharacter };
            const moveScore1 = executor['scoreAction'](moveAction, fullPointsChar, [], {} as any);
            const attackScore1 = executor['scoreAction'](attackAction, fullPointsChar, [], {} as any);
            
            // Both should have reasonable scores
            expect(moveScore1.priority).toBeGreaterThan(0);
            expect(attackScore1.priority).toBeGreaterThan(0);

            // Character with low action points
            const lowPointsChar = {
                ...mockCharacter,
                actions: {
                    ...mockCharacter.actions,
                    pointsLeft: 15
                }
            };
            
            const moveScore2 = executor['scoreAction'](moveAction, lowPointsChar, [], {} as any);
            const attackScore2 = executor['scoreAction'](attackAction, lowPointsChar, [], {} as any);
            
            // Attack should be penalized (costs 30, only have 15)
            expect(attackScore2.priority).toBeLessThan(attackScore1.priority);
            // Move might be penalized or not depending on cost (20 > 15)
            expect(moveScore2.priority).toBeLessThan(moveScore1.priority);
        });

        it('should encourage using remaining action points efficiently', () => {
            const mockCharacter: any = {
                name: 'TestChar',
                position: { x: 10, y: 10 },
                health: 100,
                maxHealth: 100,
                actions: {
                    pointsLeft: 35,
                    general: { move: 20 },
                    rangedCombat: { shoot: 30, overwatch: 40 }
                }
            };

            const moveAction = {
                type: 'movement' as const,
                priority: 50,
                command: {
                    type: 'movement' as const,
                    characters: [{
                        name: 'TestChar',
                        location: '15,15'
                    }]
                },
                reasoning: 'Test move'
            };

            const attackAction = {
                type: 'attack' as const,
                priority: 50,
                command: {
                    type: 'attack' as const,
                    characters: [{
                        name: 'TestChar',
                        target: 'Enemy',
                    }]
                },
                reasoning: 'Test attack'
            };

            // With 35 points, attack (30) is affordable and should get bonus
            // Move (20) is also affordable
            const moveScore = executor['scoreAction'](moveAction, mockCharacter, [], {} as any);
            const attackScore = executor['scoreAction'](attackAction, mockCharacter, [], {} as any);
            
            // Both should be encouraged since we have just enough points
            expect(moveScore.priority).toBeGreaterThan(40);
            expect(attackScore.priority).toBeGreaterThan(40);
        });
    });

    describe('Action Generation with Limited Points', () => {
        it('should not generate impossible actions', () => {
            const mockState: any = {
                game: {
                    factions: {
                        player: { members: ['TestChar'], name: 'Player Faction' },
                        enemy: { members: ['Enemy'], name: 'Enemy Faction' }
                    }
                },
                characters: [],
                map: Array(30).fill(null).map((_, y) => 
                    Array(30).fill(null).map((_, x) => ({
                        position: { x, y },
                        type: 'floor',
                        content: null
                    }))
                )
            };

            const character: any = {
                name: 'TestChar',
                position: { x: 10, y: 10 },
                health: 100,
                maxHealth: 100,
                faction: 'enemy',
                controller: 'ai',
                actions: {
                    pointsLeft: 10, // Very low action points
                    general: { move: 20 },
                    rangedCombat: { shoot: 30, overwatch: 40 }
                }
            };

            const enemy: any = {
                name: 'Enemy',
                position: { x: 15, y: 15 },
                health: 100,
                maxHealth: 100,
                faction: 'enemy',
                player: 'enemy'
            };

            const action = executor.evaluateSituation(character, mockState, [enemy]);
            
            // Should still return an action, even if it's just patrol
            expect(action).toBeDefined();
            expect(action.type).toBeDefined();
            
            // With only 10 points, should heavily penalize expensive actions
            if (action.type === 'attack') {
                // Attack costs 30, so should be heavily penalized
                expect(action.priority).toBeLessThan(50);
            }
        });
    });
});