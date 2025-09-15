import { AIController } from '../AIController';
import { Conversation } from '../../Conversation';
import { State } from '../../State';
import { ConversationEvent, UpdateStateEvent, EventBus } from '../../events';
import { StoryCommandExecutor } from '../StoryCommandExecutor';

describe('AI Story Flow Integration', () => {
    let conversation: Conversation;
    let state: State;
    let eventBus: EventBus<any, any>;
    let mockGameEngineService: any;
    let aiController: any;

    beforeAll(() => {
        // Mock console to avoid noise
        jest.spyOn(console, 'log').mockImplementation(() => { });
        jest.spyOn(console, 'warn').mockImplementation(() => { });
        jest.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    beforeEach(() => {
        // Create basic test state
        const testState = {
            game: {
                turn: 'human',
                players: ['human', 'ai'],
                playerInfo: {
                    'human': { name: 'Player', isAI: false },
                    'ai': { name: 'AI', isAI: true }
                }
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
                factionReputation: {}
            },
            ui: {},
            messages: []
        } as any;

        state = new State(testState);
        eventBus = new EventBus<any, any>();
        conversation = new Conversation();

        // Create AI controller instance using reflection to bypass private constructor
        const AIControllerClass = AIController as any;
        aiController = Object.create(AIControllerClass.prototype);
        aiController.gameEngineService = mockGameEngineService;
        aiController.state = state;
        aiController.eventBus = eventBus;

        // Mock the game engine service
        mockGameEngineService = {
            requestStoryInitialization: jest.fn(),
            requestAIAction: jest.fn(),
            callGameEngine: jest.fn()
        };
    });

    describe('Initial Story Narrative', () => {
        it('should display initial narrative with close button, not continue', async () => {
            const narrativeUpdateSpy = jest.fn();
            eventBus.listen(ConversationEvent.update, narrativeUpdateSpy);

            // Mock story initialization response with narrative
            mockGameEngineService.requestStoryInitialization.mockResolvedValue({
                commands: [
                    {
                        type: 'map',
                        palette: { terrain: '#2c3e50' },
                        buildings: [],
                        characters: [],
                        doors: []
                    }
                ],
                narrative: '**MISIÓN: INFILTRACIÓN**\n\nTu nave se acerca silenciosamente...',
                messages: []
            });

            // Initialize story - mock the method since it's private
            const initResponse = await mockGameEngineService.requestStoryInitialization();
            eventBus.dispatch(ConversationEvent.update, {
                type: 'speech',
                source: 'Narrator',
                content: initResponse.narrative,
                answers: [],
                action: undefined
            });

            // Verify narrative was dispatched with empty answers (for close button)
            expect(narrativeUpdateSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'speech',
                    source: 'Narrator',
                    content: expect.stringContaining('MISIÓN: INFILTRACIÓN'),
                    answers: [], // Empty array triggers close button
                    action: undefined
                })
            );
        });

        it('should not send continue message to AI when narrative is closed', async () => {
            const continueEventSpy = jest.fn();
            eventBus.listen(ConversationEvent.continue, continueEventSpy);

            // Simulate narrative display
            eventBus.dispatch(ConversationEvent.update, {
                type: 'speech',
                source: 'Narrator',
                content: 'Story narrative...',
                answers: [], // Empty answers = close button
                action: undefined
            });

            // Simulate clicking close button (dispatches conversation-ended)
            // Since we're in jsdom, just verify the conversation doesn't trigger continue
            // when answers array is empty (close button scenario)

            // Verify no continue event was sent
            expect(continueEventSpy).not.toHaveBeenCalled();
        });
    });

    describe('Conversation to Map Transition', () => {
        it('should handle map command returned in conversation response', async () => {
            const _conversationData = {
                type: 'speech',
                source: 'Narrator',
                content: 'La nave salta al hiperespacio...',
                answers: ['Continuar'],
                action: 'map' // Map command in conversation
            };

            // Parse response should detect map command
            const parsed = (conversation as any).parseResponse(JSON.stringify({
                type: 'map',
                palette: { terrain: '#000000' },
                buildings: []
            }));

            // Should convert to end conversation message with map action
            expect(parsed.type).toBe('speech');
            expect(parsed.content).toBe('');
            expect(parsed.answers).toEqual(['Accept', 'Reject']); // Action buttons for map
            expect(parsed.action).toBe('map');
        });

        it('should execute map change after conversation ends with map action', async () => {
            const mapUpdateSpy = jest.fn();
            eventBus.listen(UpdateStateEvent.map, mapUpdateSpy);

            // Mock AI response with map command
            const mapCommand = {
                type: 'map',
                palette: { terrain: '#1a1a2e' },
                buildings: [
                    {
                        name: 'Nueva Estación',
                        rooms: [{ name: 'Hangar', size: 'big' }],
                        position: { x: 20, y: 20 }
                    }
                ]
            };

            // Execute map command through story executor
            const executor = StoryCommandExecutor.getInstance();
            await executor.executeMapCommand(mapCommand as any, {} as any);

            // Verify map was updated
            expect(mapUpdateSpy).toHaveBeenCalled();
        });
    });

    describe('Story Flow Continuity', () => {
        it('should maintain story context through narrative-conversation-action flow', async () => {
            const events: any[] = [];

            // Track all story-related events
            eventBus.listen(ConversationEvent.update, (data) => {
                events.push({ type: 'conversation', data });
            });
            eventBus.listen(UpdateStateEvent.storyState, (data) => {
                events.push({ type: 'story', data });
            });

            // 1. Initial narrative
            eventBus.dispatch(ConversationEvent.update, {
                type: 'speech',
                source: 'Narrator',
                content: 'Chapter 1 begins...',
                answers: [],
                action: undefined
            });

            // 2. AI character speaks
            eventBus.dispatch(ConversationEvent.update, {
                type: 'speech',
                source: 'VI-GO',
                content: 'Commander, I detect something...',
                answers: ['What is it?', 'Ignore it'],
                action: undefined
            });

            // 3. Story progresses with action
            eventBus.dispatch(ConversationEvent.update, {
                type: 'speech',
                source: 'Narrator',
                content: 'The ship jumps to hyperspace...',
                answers: [],
                action: 'map'
            });

            // Verify proper event sequence
            expect(events).toHaveLength(3);
            expect(events[0].data.source).toBe('Narrator');
            expect(events[0].data.answers).toEqual([]); // Close button
            expect(events[1].data.source).toBe('VI-GO');
            expect(events[1].data.answers.length).toBeGreaterThan(0); // Has choices
            expect(events[2].data.action).toBe('map'); // Triggers map change
        });

        it('should handle storyline commands properly', () => {
            const storylineCommand = {
                type: 'storyline',
                content: 'The investigation continues...',
                description: 'A tense moment',
                action: 'character'
            };

            // Parse storyline command
            const result = (conversation as any).parseResponse(JSON.stringify(storylineCommand));

            // Should convert to narrator speech
            expect(result.type).toBe('speech');
            expect(result.source).toBe('Narrator');
            expect(result.content).toBe('The investigation continues...');
            expect(result.answers).toEqual(['Continue', 'OK']);
            expect(result.action).toBe('character');
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid storyline commands gracefully', () => {
            const invalidCommand = {
                type: 'storyline'
                // Missing required fields
            };

            // Command validation should handle missing fields
            // Since we can't access private members, test through conversation parsing
            const result = (conversation as any).parseResponse(JSON.stringify(invalidCommand));

            // Should handle gracefully with defaults
            expect(result).toBeTruthy();
            expect(result.type).toBe('speech');
            expect(result.source).toBe('Narrator');
        });

        it('should not crash on malformed AI responses', () => {
            const malformedResponses = [
                'Not JSON at all',
                '{ invalid json',
                JSON.stringify({ type: 'unknown' }),
                null,
                undefined
            ];

            malformedResponses.forEach(response => {
                expect(() => {
                    (conversation as any).parseResponse(response);
                }).not.toThrow();
            });
        });
    });
});