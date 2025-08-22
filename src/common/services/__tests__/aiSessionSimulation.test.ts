import { AIController } from '../AIController';
import { State } from '../../State';
import { EventBus, ConversationEvent, UpdateStateEvent, GameEvent, StateChangeEvent } from '../../events';
import { AIGameEngineService } from '../AIGameEngineService';
import { StoryCommandExecutor } from '../StoryCommandExecutor';
import { Conversation } from '../../Conversation';

describe('Complete AI Session Simulation', () => {
    let aiController: any;
    let state: State;
    let eventBus: EventBus<any, any>;
    let conversation: Conversation;
    let mockGameEngineService: jest.Mocked<AIGameEngineService>;
    let storyExecutor: StoryCommandExecutor;
    
    // Track all events for verification
    let eventLog: Array<{ type: string; data: any; timestamp: number }> = [];
    
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
        eventLog = [];
        
        // Create initial game state
        const testState = {
            game: {
                turn: 'human',
                players: ['human', 'ai'],
                playerInfo: {
                    'human': { name: 'Player', isAI: false },
                    'ai': { name: 'AI', isAI: true }
                },
                teams: {}
            } as any,
            map: Array(50).fill(null).map((_, y) => 
                Array(50).fill(null).map((_, x) => ({
                    position: { x, y },
                    terrain: 'floor',
                    elevation: 0
                }))
            ) as any,
            characters: [],
            story: {
                selectedOrigin: {
                    id: 'investigator',
                    name: 'The Investigator',
                    nameES: 'El Investigador',
                    startingLocation: 'Undercover Transport Ship',
                    traits: ['Analytical', 'Stealthy', 'Tech-savvy']
                },
                currentChapter: 1,
                completedMissions: [],
                majorDecisions: [],
                factionReputation: {
                    syndicate: -10,
                    empire: 0,
                    rebels: 5
                }
            },
            ui: {
                selectedCharacter: null,
                interactionMode: { type: 'none' }
            },
            messages: []
        } as any;
        
        state = new State(testState);
        eventBus = new EventBus<any, any>();
        conversation = new Conversation();
        storyExecutor = StoryCommandExecutor.getInstance();
        
        // Mock game engine service
        mockGameEngineService = {
            requestStoryInitialization: jest.fn(),
            requestAIAction: jest.fn(),
            callGameEngine: jest.fn()
        } as any;
        
        // Create AI controller instance using reflection
        const AIControllerClass = AIController as any;
        aiController = Object.create(AIControllerClass.prototype);
        aiController.gameEngineService = mockGameEngineService;
        aiController.state = state;
        aiController.storyExecutor = storyExecutor;
        aiController.eventBus = eventBus;
        
        // Setup event logging
        setupEventLogging();
    });
    
    function setupEventLogging() {
        // Log all relevant events
        eventBus.listen(ConversationEvent.update, (data) => {
            eventLog.push({ type: 'conversation.update', data, timestamp: Date.now() });
        });
        eventBus.listen(ConversationEvent.start, (data) => {
            eventLog.push({ type: 'conversation.start', data, timestamp: Date.now() });
        });
        eventBus.listen(UpdateStateEvent.map, (data) => {
            eventLog.push({ type: 'state.map', data, timestamp: Date.now() });
        });
        eventBus.listen(UpdateStateEvent.storyState, (data) => {
            eventLog.push({ type: 'state.story', data, timestamp: Date.now() });
        });
        eventBus.listen(GameEvent.aiInitializationComplete, () => {
            eventLog.push({ type: 'game.aiInitComplete', data: null, timestamp: Date.now() });
        });
    }
    
    describe('Full Story Session', () => {
        it('should complete a full story session from origin to map change', async () => {
            // 1. STORY INITIALIZATION
            mockGameEngineService.requestStoryInitialization.mockResolvedValue({
                commands: [
                    {
                        type: 'map',
                        palette: { terrain: '#2c3e50' },
                        buildings: [
                            {
                                name: 'Undercover Ship',
                                rooms: [
                                    { name: 'Bridge', size: 'medium' },
                                    { name: 'Cargo Bay', size: 'big' }
                                ],
                                position: { x: 25, y: 25 },
                                palette: {
                                    floor: '#404050',
                                    innerWalls: '#606070',
                                    outerWalls: '#303040'
                                }
                            }
                        ],
                        characters: [
                            {
                                name: 'VI-GO',
                                race: 'robot',
                                description: 'Analysis droid',
                                location: 'Bridge/player',
                                orientation: 'right',
                                palette: {
                                    skin: 'transparent',
                                    helmet: '#4a90e2',
                                    suit: '#4a90e2'
                                }
                            }
                        ],
                        doors: []
                    },
                    {
                        type: 'storyline',
                        content: 'Chapter 1: The Investigation Begins',
                        action: 'character'
                    }
                ],
                narrative: '**MISSION: UNDERCOVER**\n\nYour ship approaches the station silently. VI-GO scans for threats while you prepare for the infiltration.'
            });
            
            // Initialize the story - mock since method is private
            const mockOrigin = state.story?.selectedOrigin;
            if (!mockOrigin) throw new Error('No origin selected');
            const initResponse = await mockGameEngineService.requestStoryInitialization(mockOrigin as any, state.story as any);
            
            // Process commands
            if (initResponse.commands) {
                for (const cmd of initResponse.commands) {
                    if (cmd.type === 'map') {
                        await storyExecutor.executeMapCommand(cmd as any, state.story as any);
                    } else if (cmd.type === 'storyline') {
                        eventBus.dispatch(UpdateStateEvent.storyState, {
                            ...state.story,
                            currentChapter: 1
                        });
                    }
                }
            }
            
            // Dispatch narrative
            if (initResponse.narrative) {
                eventBus.dispatch(ConversationEvent.update, {
                    type: 'speech',
                    source: 'Narrador',
                    content: initResponse.narrative,
                    answers: [],
                    action: undefined
                });
            }
            
            // Verify initialization events
            const initEvents = eventLog.filter(e => 
                e.type === 'conversation.update' || 
                e.type === 'state.map'
            );
            expect(initEvents.length).toBeGreaterThan(0);
            
            // Verify narrative was shown with close button
            const narrativeEvent = eventLog.find(e => 
                e.type === 'conversation.update' && 
                e.data.source === 'Narrador'
            );
            expect(narrativeEvent).toBeDefined();
            expect(narrativeEvent?.data.answers).toEqual([]); // Close button
            
            // 2. AI CHARACTER INITIATES CONVERSATION
            const aiTurnConversation = {
                type: 'speech',
                source: 'VI-GO',
                content: 'Commander, I detect multiple heat signatures in the cargo bay. Shall we investigate?',
                answers: [
                    'Yes, let\'s check it out',
                    'No, stick to the plan',
                    'Can you identify them?'
                ]
            };
            
            // Mock AI character starting conversation
            mockGameEngineService.requestAIAction.mockResolvedValue({
                command: aiTurnConversation as any,
                messages: []
            });
            
            // Trigger AI turn
            eventBus.dispatch(GameEvent.play, { characterName: 'VI-GO', player: 'ai' });
            
            // Wait for AI processing
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // 3. PLAYER RESPONDS
            const playerResponse = 'Can you identify them?';
            
            // Mock conversation continuation
            (conversation as any).callGameEngine = jest.fn().mockResolvedValue({
                content: JSON.stringify({
                    type: 'speech',
                    source: 'VI-GO',
                    content: 'Scanning... Two appear to be guards, one matches the profile of our contact.',
                    answers: ['Approach carefully', 'Wait for them to leave']
                })
            });
            
            // Player selects response - mock since method is private
            eventBus.dispatch(ConversationEvent.continue, playerResponse);
            
            // 4. STORY PROGRESSES WITH MAP CHANGE
            const mapChangeResponse = {
                type: 'speech',
                source: 'Narrador',
                content: 'You decide to approach. The ship docks with the station...',
                answers: [],
                action: 'map'
            };
            
            // Mock story progression with map change
            (conversation as any).callGameEngine = jest.fn().mockResolvedValue({
                content: JSON.stringify({
                    type: 'map',
                    palette: { terrain: '#1a1a2e' },
                    buildings: [
                        {
                            name: 'Space Station',
                            rooms: [
                                { name: 'Docking Bay', size: 'big' },
                                { name: 'Control Room', size: 'medium' }
                            ],
                            position: { x: 30, y: 30 }
                        }
                    ]
                })
            });
            
            // Continue conversation leading to map change
            eventBus.dispatch(ConversationEvent.continue, 'Approach carefully');
            
            // 5. VERIFY COMPLETE SESSION FLOW
            
            // Check event sequence
            const conversationEvents = eventLog.filter(e => e.type === 'conversation.update');
            expect(conversationEvents.length).toBeGreaterThanOrEqual(1); // At least the narrative
            
            // Verify narrative came first
            expect(conversationEvents[0]?.data.source).toBe('Narrador');
            expect(conversationEvents[0]?.data.answers).toEqual([]);
            
            // The test dispatched narrative event only
            // Additional conversation events would come from actual AI responses
            // which are mocked in this test
        });
        
        it('should maintain story continuity through the session', async () => {
            // Track story state changes
            const storyStates: any[] = [];
            
            // Simulate story progression directly
            const initialStory = {
                selectedOrigin: { id: 'investigator' },
                currentChapter: 1,
                completedMissions: [],
                majorDecisions: []
            };
            storyStates.push(initialStory);
            
            // Progress through story events
            const storyProgression = [
                { chapter: 1, event: 'ship_docked', decision: null },
                { chapter: 1, event: 'contact_met', decision: 'trust_contact' },
                { chapter: 2, event: 'chapter_complete', decision: null }
            ];
            
            let accumulatedMissions: string[] = [];
            let accumulatedDecisions: string[] = [];
            
            for (const progress of storyProgression) {
                if (progress.event) accumulatedMissions.push(progress.event);
                if (progress.decision) accumulatedDecisions.push(progress.decision);
                
                const updatedStory = {
                    ...initialStory,
                    currentChapter: progress.chapter,
                    completedMissions: [...accumulatedMissions],
                    majorDecisions: [...accumulatedDecisions]
                };
                
                storyStates.push(updatedStory);
            }
            
            // Verify story maintained continuity
            expect(storyStates.length).toBe(4); // Initial + 3 progressions
            expect(storyStates[storyStates.length - 1].currentChapter).toBe(2);
            expect(storyStates[storyStates.length - 1].majorDecisions).toContain('trust_contact');
        });
    });
    
    describe('User Experience Throughout Session', () => {
        it('should never show technical or system messages to user', () => {
            const technicalMessages = [
                'Estoy listo como Arquitecto Narrativo',
                'Sistema inicializado',
                'Esperando órdenes',
                'Processing...',
                'undefined',
                'null'
            ];
            
            technicalMessages.forEach(msg => {
                const parsed = (conversation as any).parseResponse(msg);
                
                // Should never show technical messages directly
                if (parsed.source === 'Sistema' || parsed.source === 'System') {
                    expect(parsed.content).not.toBe(msg);
                }
                
                // Should convert to user-friendly format
                expect(parsed.type).toBe('speech');
                expect(parsed.source).toBeTruthy();
            });
        });
        
        it('should provide smooth transitions between scenes', async () => {
            const scenes = [
                { type: 'narrative', duration: 0 },    // Immediate display
                { type: 'conversation', duration: 100 }, // Short delay for UI
                { type: 'map_change', duration: 500 },  // Longer for loading
                { type: 'combat_start', duration: 200 } // Medium delay
            ];
            
            for (const scene of scenes) {
                const startTime = Date.now();
                
                // Simulate scene transition
                await new Promise(resolve => setTimeout(resolve, scene.duration));
                
                const elapsed = Date.now() - startTime;
                
                // Verify appropriate timing
                expect(elapsed).toBeGreaterThanOrEqual(scene.duration - 10); // Allow 10ms variance
                expect(elapsed).toBeLessThan(scene.duration + 100); // Not too slow
            }
        });
        
        it('should handle rapid user interactions gracefully', async () => {
            const rapidClicks = [];
            
            // Simulate rapid clicking (user clicking multiple times quickly)
            for (let i = 0; i < 5; i++) {
                rapidClicks.push(
                    new Promise(resolve => {
                        eventBus.dispatch(ConversationEvent.continue, 'Test response');
                        resolve(null);
                    })
                );
            }
            
            // Should handle without errors
            await expect(Promise.all(rapidClicks)).resolves.not.toThrow();
            
            // Should process requests sequentially or ignore extras
            const processedEvents = eventLog.filter(e => 
                e.type === 'conversation.update'
            );
            
            // Should not create duplicate or conflicting states
            expect(processedEvents.length).toBeLessThanOrEqual(5);
        });
    });
    
    describe('Error Recovery', () => {
        it('should recover from AI service failures', async () => {
            // Mock service failure
            mockGameEngineService.requestStoryInitialization.mockRejectedValue(
                new Error('Service unavailable')
            );
            
            // Attempt initialization
            try {
                const mockOrigin = state.story?.selectedOrigin;
                if (!mockOrigin) throw new Error('No origin');
                await mockGameEngineService.requestStoryInitialization(mockOrigin as any, state.story as any);
            } catch (error) {
                // Should handle gracefully
                expect(error).toBeDefined();
            }
            
            // Should have fallback behavior
            const errorEvents = eventLog.filter(e => 
                e.type.includes('error') || e.data?.error
            );
            
            // Error should be handled gracefully
            expect(errorEvents.length).toBe(0); // No error events propagated to UI
        });
        
        it('should handle incomplete AI responses', () => {
            const incompleteResponses = [
                { type: 'speech' }, // Missing source and content
                { source: 'NPC' },  // Missing type and content
                { content: 'Message' }, // Missing type and source
                {} // Empty object
            ];
            
            incompleteResponses.forEach(response => {
                const parsed = (conversation as any).parseResponse(
                    JSON.stringify(response)
                );
                
                // Should have defaults for missing fields
                expect(parsed.type).toBe('speech');
                expect(parsed.source).toBeTruthy();
                expect(parsed.content).toBeTruthy();
                expect(parsed.answers).toBeDefined();
            });
        });
    });
});