import { AIController } from '../AIController';
import { State } from '../../State';
import { EventBus, ConversationEvent, UpdateStateEvent } from '../../events';
import { ICharacter, IState, Direction } from '../../interfaces';

describe('AI Conversation Integration', () => {
    let aiController: AIController;
    let state: State;
    let popupStateSpy: jest.Mock;
    let conversationUpdateSpy: jest.Mock;
    let testState: IState;
    
    // Mock console to avoid noise
    beforeAll(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });
    
    afterAll(() => {
        jest.restoreAllMocks();
    });
    
    beforeEach(() => {
        // Create a test state with AI and player characters adjacent
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
                    position: { x: 10, y: 10 },
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
                    position: { x: 11, y: 10 }, // Adjacent to player
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
        
        // Set up spies for events
        popupStateSpy = jest.fn();
        conversationUpdateSpy = jest.fn();
        
        aiController.listen(UpdateStateEvent.uiPopup, popupStateSpy);
        aiController.listen(ConversationEvent.update, conversationUpdateSpy);
    });
    
    afterEach(() => {
        jest.clearAllMocks();
        // Clean up the AIController
        (aiController as any).cleanup();
    });
    
    describe('Conversation Event Flow', () => {
        it('should dispatch popup state before conversation update', async () => {
            const speechCommand = {
                type: 'speech' as const,
                source: 'data',
                content: 'Test message',
                answers: ['Answer 1', 'Answer 2'],
                characters: []
            };
            
            const dataCharacter = state.characters.find(c => c.name === 'data');
            
            // Execute speech command
            await (aiController as any).executeSpeech(speechCommand, dataCharacter);
            
            // Wait for async operations (popup state is immediate, conversation update has 200ms delay)
            await new Promise(resolve => setTimeout(resolve, 250));
            
            // Verify popup state was dispatched first
            expect(popupStateSpy).toHaveBeenCalledWith(expect.objectContaining({
                popupId: 'main-popup',
                popupState: expect.objectContaining({
                    type: 'conversation',
                    visible: true,
                    data: expect.objectContaining({
                        title: 'data - Conversación'
                    })
                })
            }));
            
            // Verify conversation update was dispatched after
            expect(conversationUpdateSpy).toHaveBeenCalledWith(expect.objectContaining({
                type: 'speech',
                source: 'data',
                content: 'Test message',
                answers: ['Answer 1', 'Answer 2']
            }));
            
            // Verify order of calls
            const popupCallOrder = popupStateSpy.mock.invocationCallOrder[0];
            const conversationCallOrder = conversationUpdateSpy.mock.invocationCallOrder[0];
            if (popupCallOrder !== undefined && conversationCallOrder !== undefined) {
                expect(popupCallOrder).toBeLessThan(conversationCallOrder);
            } else {
                // At least verify both were called
                expect(popupStateSpy).toHaveBeenCalled();
                expect(conversationUpdateSpy).toHaveBeenCalled();
            }
        });
        
        it('should verify events are received by all listeners', () => {
            // Create separate event bus instances to simulate different components
            const componentA = new EventBus<any, any>();
            const componentB = new EventBus<any, any>();
            const componentC = new EventBus<any, any>();
            
            const receivedA: any[] = [];
            const receivedB: any[] = [];
            const receivedC: any[] = [];
            
            // Each component listens for conversation updates
            componentA.listen(ConversationEvent.update, (data) => {
                receivedA.push(data);
            });
            
            componentB.listen(ConversationEvent.update, (data) => {
                receivedB.push(data);
            });
            
            componentC.listen(ConversationEvent.update, (data) => {
                receivedC.push(data);
            });
            
            // One component dispatches an update
            const testData = {
                type: 'speech',
                source: 'Test',
                content: 'Shared message',
                answers: ['OK']
            };
            
            componentA.dispatch(ConversationEvent.update, testData);
            
            // All components should receive it (because EventBus uses static listeners)
            expect(receivedA).toContainEqual(testData);
            expect(receivedB).toContainEqual(testData);
            expect(receivedC).toContainEqual(testData);
        });
        
        it('should handle the complete conversation flow', async () => {
            // Track all events in order
            const eventLog: { type: string; data: any }[] = [];
            
            // Create a separate EventBus instance for listening (shares same static listeners)
            const testListener = new EventBus<any, any>();
            
            // Listen to multiple events
            testListener.listen(UpdateStateEvent.uiPopup, (data) => {
                eventLog.push({ type: 'popup', data });
            });
            
            testListener.listen(ConversationEvent.update, (data) => {
                eventLog.push({ type: 'conversation', data });
            });
            
            // Create speech command
            const speechCommand = {
                type: 'speech' as const,
                source: 'data',
                content: 'Comandante, necesito instrucciones.',
                answers: [
                    'Mantén posición',
                    'Avanza con cuidado',
                    'Retrocede'
                ],
                characters: []
            };
            
            const dataCharacter = state.characters.find(c => c.name === 'data');
            
            // Execute speech
            await (aiController as any).executeSpeech(speechCommand, dataCharacter);
            
            // Wait for all async operations
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Verify event sequence
            expect(eventLog.length).toBe(2);
            expect(eventLog[0]?.type).toBe('popup');
            expect(eventLog[1]?.type).toBe('conversation');
            
            // Verify popup has correct structure
            expect(eventLog[0]?.data.popupState).toMatchObject({
                type: 'conversation',
                visible: true
            });
            
            // Verify conversation has correct content
            expect(eventLog[1]?.data).toMatchObject({
                type: 'speech',
                source: 'data',
                content: 'Comandante, necesito instrucciones.',
                answers: expect.arrayContaining([
                    'Mantén posición',
                    'Avanza con cuidado',
                    'Retrocede'
                ])
            });
        });
        
        it('should not dispatch conversation if characters are too far', async () => {
            // Move data far from player
            const farTestState = {
                ...testState,
                characters: testState.characters.map(c => 
                    c.name === 'data' 
                        ? { ...c, position: { x: 20, y: 20 } } // Far away
                        : c
                )
            };
            
            const farState = new State(farTestState);
            aiController.setGameState(farState);
            
            const dataCharacter = farState.characters.find(c => c.name === 'data');
            
            const speechCommand = {
                type: 'speech' as const,
                source: 'data',
                content: 'Too far to talk',
                answers: [],
                characters: []
            };
            
            // Clear previous spies
            popupStateSpy.mockClear();
            conversationUpdateSpy.mockClear();
            
            // Execute speech when too far
            await (aiController as any).executeSpeech(speechCommand, dataCharacter);
            
            // Wait for potential async operations
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Should trigger movement instead of conversation
            expect(popupStateSpy).not.toHaveBeenCalled();
            expect(conversationUpdateSpy).not.toHaveBeenCalled();
            
            // Verify pending speech command was stored
            expect((aiController as any).pendingSpeechCommands.get('data')).toEqual(speechCommand);
        });
    });
});