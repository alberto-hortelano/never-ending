import { AIController } from '../AIController';
import { State } from '../../State';
import { ConversationEvent, UpdateStateEvent } from '../../events';
import { ICharacter, IState, Direction } from '../../interfaces';

describe('AI Speech System', () => {
    let aiController: AIController;
    let state: State;
    let conversationUpdateSpy: jest.Mock;
    let popupShowSpy: jest.Mock;
    let testState: IState;
    
    // Use fake timers for better control
    beforeAll(() => {
        jest.useFakeTimers();
        // Mock console.log to avoid EPIPE errors
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });
    
    afterAll(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });
    
    beforeEach(() => {
        // Create a test state with AI and player characters close together
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
                {
                    name: 'Jim',
                    race: 'human',
                    description: 'The player character',
                    controller: 'human', faction: 'player',
                    position: { x: 10, y: 10 }, // Position player at 10,10
                    location: '',
                    blocker: true,
                    direction: 'bottom' as Direction,
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
                {
                    name: 'data',
                    race: 'robot',
                    description: 'AI companion robot',
                    controller: 'ai', faction: 'enemy',
                    position: { x: 11, y: 10 }, // Position data adjacent to player
                    location: '',
                    blocker: true,
                    direction: 'left' as Direction,
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
        aiController = AIController.getInstance();
        aiController.setGameState(state);
        
        // Spy on conversation update event from AIController
        conversationUpdateSpy = jest.fn();
        aiController.listen(ConversationEvent.update, (data) => conversationUpdateSpy(data));
        
        // Spy on UI popup show event from AIController
        popupShowSpy = jest.fn();
        aiController.listen(UpdateStateEvent.uiPopup, (data) => popupShowSpy(data));
    });
    
    afterEach(() => {
        jest.clearAllMocks();
        jest.clearAllTimers();
        // Clean up the AIController instance to stop any pending operations
        (aiController as any).cleanup();
    });
    
    describe('AI Speech Message Display', () => {
        it('should display conversation content directly when AI sends speech', async () => {
            // Create a hardcoded speech command from AI
            const speechCommand = {
                type: 'speech' as const,
                source: 'data',
                content: 'Hello friend! How are you today?',
                answers: ['Fine, thanks', 'Not very well', 'I prefer not to say'],
                characters: [] // Speech commands don't need characters array
            };
            
            // Get the data character
            const dataCharacter = state.characters.find(c => c.name === 'data');
            expect(dataCharacter).toBeDefined();
            
            // Execute the speech command directly
            await (aiController as any).commandExecutor?.executeSpeech(speechCommand, dataCharacter);
            
            // Fast-forward timers to execute the delayed dispatch
            jest.advanceTimersByTime(200);
            
            // Check that popup was shown with conversation type
            expect(popupShowSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    popupId: 'main-popup',
                    popupState: expect.objectContaining({
                        type: 'conversation'
                    })
                })
            );
            
            // Check that conversation update was dispatched with the correct content
            expect(conversationUpdateSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'speech',
                    source: 'data',
                    content: 'Hello friend! How are you today?',
                    answers: ['Fine, thanks', 'Not very well', 'I prefer not to say']
                })
            );
        });
        
        it('should show conversation when characters are adjacent', async () => {
            // Verify characters are adjacent (distance = 1)
            const player = state.characters.find(c => c.name === 'Jim');
            const data = state.characters.find(c => c.name === 'data');
            expect(player).toBeDefined();
            expect(data).toBeDefined();
            
            const distance = Math.sqrt(
                Math.pow(data!.position.x - player!.position.x, 2) +
                Math.pow(data!.position.y - player!.position.y, 2)
            );
            expect(distance).toBe(1); // Adjacent horizontally
            
            // Create speech command
            const speechCommand = {
                type: 'speech' as const,
                source: 'data',
                content: 'Do you need help with anything?',
                answers: ['Yes, please', 'No, thanks'],
                characters: []
            };
            
            // Execute speech
            await (aiController as any).commandExecutor?.executeSpeech(speechCommand, data);
            
            // Fast-forward timers to execute the delayed dispatch
            jest.advanceTimersByTime(200);
            
            // Verify popup was shown and conversation updated
            expect(popupShowSpy).toHaveBeenCalled();
            expect(conversationUpdateSpy).toHaveBeenCalled();
        });
        
        it('should automatically move closer when too far to talk', async () => {
            // Create a new test state with data far from player
            const farTestState: IState = {
                ...testState,
                game: {
                    ...testState.game,
                    turn: 'ai' // Set to AI turn so data can move
                },
                characters: testState.characters.map(c => 
                    c.name === 'data' 
                        ? { ...c, position: { x: 20, y: 20 } } // Far away
                        : c
                )
            };
            const farState = new State(farTestState);
            aiController.setGameState(farState);
            
            const dataCharacter = farState.characters.find(c => c.name === 'data');
            
            // Spy on the movement dispatch (AI characters use characterPath)
            const movementSpy = jest.fn();
            aiController.listen(UpdateStateEvent.characterPath, movementSpy);
            
            const speechCommand = {
                type: 'speech' as const,
                source: 'data',
                content: 'I need to get closer to talk',
                answers: ['OK'],
                characters: []
            };
            
            // Execute speech - should trigger movement instead
            await (aiController as any).commandExecutor?.executeSpeech(speechCommand, dataCharacter);
            
            // Fast-forward timers to execute any immediate operations
            jest.advanceTimersByTime(100);
            
            // Should have initiated movement instead of conversation
            expect(movementSpy).toHaveBeenCalled();
            const callArg = movementSpy.mock.calls[0][0];
            expect(callArg.name).toBe('data');
            expect(Array.isArray(callArg.path)).toBe(true);
            expect(callArg.path.length).toBeGreaterThan(0);
            expect(popupShowSpy).not.toHaveBeenCalled();
            expect(conversationUpdateSpy).not.toHaveBeenCalled();
            
            // Verify that the speech command was stored as pending
            expect((aiController as any).pendingSpeechCommands.get('data')).toEqual(speechCommand);
        });
        
        it('should handle speech with multiple answer options', async () => {
            const speechCommand = {
                type: 'speech' as const,
                source: 'data',
                content: 'What is your mission here?',
                answers: [
                    'I\'m looking for survivors',
                    'I\'m exploring the area',
                    'I\'m trying to reach the base',
                    'It\'s none of your business'
                ],
                characters: []
            };
            
            const dataCharacter = state.characters.find(c => c.name === 'data');
            await (aiController as any).commandExecutor?.executeSpeech(speechCommand, dataCharacter);
            
            // Fast-forward timers to execute the delayed dispatch
            jest.advanceTimersByTime(200);
            
            // Check all answers are included
            expect(conversationUpdateSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    answers: [
                        'I\'m looking for survivors',
                        'I\'m exploring the area',
                        'I\'m trying to reach the base',
                        'It\'s none of your business'
                    ]
                })
            );
        });
    });
});