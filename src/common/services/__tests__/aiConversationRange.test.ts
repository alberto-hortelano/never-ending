import { AIContextBuilder } from '../AIContextBuilder';
import { State } from '../../State';
import { ICharacter, IState, Direction } from '../../interfaces';

describe('AI Conversation Range', () => {
    let contextBuilder: AIContextBuilder;
    let state: State;
    let testState: IState;
    
    beforeAll(() => {
        // Mock console to avoid noise
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });
    
    afterAll(() => {
        jest.restoreAllMocks();
    });
    
    beforeEach(() => {
        // Create a test state with multiple characters at various distances
        testState = {
            game: {
                turn: 'ai',
                players: ['human', 'ai'],
                playerInfo: {
                    'human': { name: 'Player', isAI: false },
                    'ai': { name: 'AI', isAI: true }
                }
            } as any,
            map: Array(30).fill(null).map((_, y) => 
                Array(30).fill(null).map((_, x) => ({
                    position: { x, y },
                    type: 'floor',
                    blocksMovement: false,
                    blocksSight: false
                }))
            ) as any,
            characters: [
                // AI character at center
                {
                    name: 'data',
                    race: 'robot',
                    description: 'AI companion robot',
                    controller: 'ai', faction: 'enemy',
                    position: { x: 15, y: 15 },
                    location: '',
                    blocker: true,
                    direction: 'bottom' as Direction,
                    action: 'idle',
                    path: [],
                    health: 100,
                    maxHealth: 100,
                    palette: {
                        skin: 'yellow',
                        helmet: 'gold',
                        suit: 'gold'
                    },
                    actions: {
                        pointsLeft: 100,
                        pendingCost: 0,
                        general: { move: 20, talk: 10, use: 10, inventory: 5 },
                        rangedCombat: { shoot: 20, aim: 10, overwatch: 30, cover: 10, throw: 15 },
                        closeCombat: { powerStrike: 25, slash: 20, fastAttack: 15, feint: 10, breakGuard: 20 }
                    },
                    inventory: {
                        maxWeight: 20,
                        items: [],
                        equippedWeapons: { primary: null, secondary: null }
                    }
                } as unknown as ICharacter,
                // Player - within conversation range (2 cells away)
                {
                    name: 'Jim',
                    race: 'human',
                    description: 'The player character',
                    controller: 'human', faction: 'player',
                    position: { x: 17, y: 15 }, // 2 cells away
                    location: '',
                    blocker: true,
                    direction: 'left' as Direction,
                    action: 'idle',
                    path: [],
                    health: 100,
                    maxHealth: 100,
                    palette: {
                        skin: '#d7a55f',
                        helmet: '#808080',
                        suit: '#404040'
                    },
                    actions: {
                        pointsLeft: 100,
                        pendingCost: 0,
                        general: { move: 20, talk: 10, use: 10, inventory: 5 },
                        rangedCombat: { shoot: 20, aim: 10, overwatch: 30, cover: 10, throw: 15 },
                        closeCombat: { powerStrike: 25, slash: 20, fastAttack: 15, feint: 10, breakGuard: 20 }
                    },
                    inventory: {
                        maxWeight: 20,
                        items: [],
                        equippedWeapons: { primary: null, secondary: null }
                    }
                } as unknown as ICharacter,
                // Ally - exactly at conversation range limit (3 cells)
                {
                    name: 'ally',
                    race: 'human',
                    description: 'Friendly character',
                    controller: 'human', faction: 'player',
                    position: { x: 15, y: 18 }, // 3 cells away vertically
                    location: '',
                    blocker: true,
                    direction: 'top' as Direction,
                    action: 'idle',
                    path: [],
                    health: 100,
                    maxHealth: 100,
                    palette: {
                        skin: '#d7a55f',
                        helmet: '#404040',
                        suit: '#606060'
                    },
                    actions: {
                        pointsLeft: 100,
                        pendingCost: 0,
                        general: { move: 20, talk: 10, use: 10, inventory: 5 },
                        rangedCombat: { shoot: 20, aim: 10, overwatch: 30, cover: 10, throw: 15 },
                        closeCombat: { powerStrike: 25, slash: 20, fastAttack: 15, feint: 10, breakGuard: 20 }
                    },
                    inventory: {
                        maxWeight: 20,
                        items: [],
                        equippedWeapons: { primary: null, secondary: null }
                    }
                } as unknown as ICharacter,
                // Enemy - just outside conversation range (4 cells)
                {
                    name: 'enemy',
                    race: 'alien',
                    description: 'Hostile character',
                    player: 'enemy',
                    position: { x: 19, y: 15 }, // 4 cells away horizontally
                    location: '',
                    blocker: true,
                    direction: 'left' as Direction,
                    action: 'idle',
                    path: [],
                    health: 100,
                    maxHealth: 100,
                    palette: {
                        skin: '#ff0000',
                        helmet: '#800000',
                        suit: '#400000'
                    },
                    actions: {
                        pointsLeft: 100,
                        pendingCost: 0,
                        general: { move: 20, talk: 10, use: 10, inventory: 5 },
                        rangedCombat: { shoot: 20, aim: 10, overwatch: 30, cover: 10, throw: 15 },
                        closeCombat: { powerStrike: 25, slash: 20, fastAttack: 15, feint: 10, breakGuard: 20 }
                    },
                    inventory: {
                        maxWeight: 20,
                        items: [],
                        equippedWeapons: { primary: null, secondary: null }
                    }
                } as unknown as ICharacter,
                // Distant NPC - far away (10 cells)
                {
                    name: 'distant',
                    race: 'human',
                    description: 'Far away character',
                    player: 'neutral',
                    position: { x: 25, y: 15 }, // 10 cells away
                    location: '',
                    blocker: true,
                    direction: 'left' as Direction,
                    action: 'idle',
                    path: [],
                    health: 100,
                    maxHealth: 100,
                    palette: {
                        skin: '#d7a55f',
                        helmet: '#808080',
                        suit: '#808080'
                    },
                    actions: {
                        pointsLeft: 100,
                        pendingCost: 0,
                        general: { move: 20, talk: 10, use: 10, inventory: 5 },
                        rangedCombat: { shoot: 20, aim: 10, overwatch: 30, cover: 10, throw: 15 },
                        closeCombat: { powerStrike: 25, slash: 20, fastAttack: 15, feint: 10, breakGuard: 20 }
                    },
                    inventory: {
                        maxWeight: 20,
                        items: [],
                        equippedWeapons: { primary: null, secondary: null }
                    }
                } as unknown as ICharacter
            ],
            messages: [],
            ui: {
                animations: { characters: {} },
                visualStates: { 
                    characters: {}, 
                    cells: {}, 
                    board: { 
                        mapWidth: 30,
                        mapHeight: 30,
                        hasPopupActive: false
                    } 
                },
                transientUI: { 
                    popups: {}, 
                    projectiles: [], 
                    highlights: {
                        reachableCells: [],
                        pathCells: [],
                        targetableCells: []
                    } 
                },
                interactionMode: { type: 'normal' },
                selectedCharacter: undefined
            },
            overwatchData: {}
        };
        
        state = new State(testState);
        contextBuilder = new AIContextBuilder(state);
    });
    
    describe('Context Building', () => {
        it('should identify characters in conversation range', () => {
            const dataCharacter = state.characters.find(c => c.name === 'data');
            expect(dataCharacter).toBeDefined();
            
            const context = contextBuilder.buildTurnContext(dataCharacter!, state);
            
            // Check that charactersInConversationRange is populated
            expect(context.charactersInConversationRange).toBeDefined();
            expect(Array.isArray(context.charactersInConversationRange)).toBe(true);
            
            // With conversation range of 8: Should include player (2), ally (3), and enemy (4), but not distant (10)
            const conversableNames = context.charactersInConversationRange.map(c => c.name);
            expect(conversableNames).toContain('Jim');
            expect(conversableNames).toContain('ally');
            expect(conversableNames).toContain('enemy');  // Now in range at 4 cells
            expect(conversableNames).not.toContain('distant');
        });
        
        it('should mark characters with canConverse flag correctly', () => {
            const dataCharacter = state.characters.find(c => c.name === 'data');
            const context = contextBuilder.buildTurnContext(dataCharacter!, state);
            
            // Check visible characters have correct canConverse flags
            const playerContext = context.visibleCharacters.find(c => c.name === 'Jim');
            const allyContext = context.visibleCharacters.find(c => c.name === 'ally');
            const enemyContext = context.visibleCharacters.find(c => c.name === 'enemy');
            const distantContext = context.visibleCharacters.find(c => c.name === 'distant');
            
            expect(playerContext?.canConverse).toBe(true);  // 2 cells - can converse
            expect(allyContext?.canConverse).toBe(true);    // 3 cells - can converse
            expect(enemyContext?.canConverse).toBe(true);   // 4 cells - now can converse (range is 8)
            expect(distantContext?.canConverse).toBe(false); // 10 cells - cannot converse
        });
        
        it('should calculate correct distances for all visible characters', () => {
            const dataCharacter = state.characters.find(c => c.name === 'data');
            const context = contextBuilder.buildTurnContext(dataCharacter!, state);
            
            const playerContext = context.visibleCharacters.find(c => c.name === 'Jim');
            const allyContext = context.visibleCharacters.find(c => c.name === 'ally');
            const enemyContext = context.visibleCharacters.find(c => c.name === 'enemy');
            
            // Check distances are calculated correctly
            expect(playerContext?.distanceFromCurrent).toBe(2); // Horizontal distance
            expect(allyContext?.distanceFromCurrent).toBe(3);   // Vertical distance
            expect(enemyContext?.distanceFromCurrent).toBe(4);  // Horizontal distance
        });
        
        it('should include only conversable characters in charactersInConversationRange', () => {
            const dataCharacter = state.characters.find(c => c.name === 'data');
            const context = contextBuilder.buildTurnContext(dataCharacter!, state);
            
            // All characters in conversation range should have distance <= 8
            context.charactersInConversationRange.forEach(char => {
                expect(char.distanceFromCurrent).toBeLessThanOrEqual(8);
                expect(char.canConverse).toBe(true);
            });
            
            // Should have exactly 3 characters in range (player, ally, and enemy)
            expect(context.charactersInConversationRange.length).toBe(3);
        });
        
        it('should handle empty conversation range', () => {
            // Move all characters far away
            const isolatedState = {
                ...testState,
                characters: testState.characters.map(c => 
                    c.name === 'data' 
                        ? c 
                        : { ...c, position: { x: 50, y: 50 } } // Move everyone far away
                )
            };
            
            const newState = new State(isolatedState);
            const newContextBuilder = new AIContextBuilder(newState);
            const dataCharacter = newState.characters.find(c => c.name === 'data');
            
            const context = newContextBuilder.buildTurnContext(dataCharacter!, newState);
            
            // Should have empty conversation range
            expect(context.charactersInConversationRange).toBeDefined();
            expect(context.charactersInConversationRange.length).toBe(0);
        });
        
        it('should correctly identify adjacent characters', () => {
            // Move player to be adjacent (1 cell away)
            const adjacentState = {
                ...testState,
                characters: testState.characters.map(c => 
                    c.name === 'Jim' 
                        ? { ...c, position: { x: 16, y: 15 } } // 1 cell away
                        : c
                )
            };
            
            const newState = new State(adjacentState);
            const newContextBuilder = new AIContextBuilder(newState);
            const dataCharacter = newState.characters.find(c => c.name === 'data');
            
            const context = newContextBuilder.buildTurnContext(dataCharacter!, newState);
            
            const playerContext = context.visibleCharacters.find(c => c.name === 'Jim');
            expect(playerContext?.isAdjacent).toBe(true);
            expect(playerContext?.canConverse).toBe(true);
            expect(playerContext?.distanceFromCurrent).toBe(1);
            
            // Adjacent character should also be in conversation range
            expect(context.charactersInConversationRange.some(c => c.name === 'Jim')).toBe(true);
        });
    });
});