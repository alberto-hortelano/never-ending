import { Conversation } from '../Conversation';
import { ConversationEvent } from '../events';

describe('NPC Conversation Flow', () => {
    let conversation: Conversation;

    beforeEach(() => {
        // Mock console to avoid noise
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});

        conversation = new Conversation();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('AI-to-AI Conversation', () => {
        it('should handle NPC conversations without loading states', async () => {
            // Setup mock AI response with multiple exchanges
            const mockAIResponse = {
                exchanges: [
                    {
                        type: 'speech',
                        source: 'Rival Captain',
                        content: '¿Cuánto tiempo llevan esos carroñeros en el sector?',
                        answers: []
                    },
                    {
                        type: 'speech',
                        source: 'Salvager Grunt',
                        content: 'Tres días, capitán.',
                        answers: []
                    },
                    {
                        type: 'speech',
                        source: 'Rival Captain',
                        content: 'Debemos actuar pronto.',
                        answers: []
                    }
                ],
                summary: 'Discussion about scavengers'
            };

            // Track dispatched events
            const dispatchedEvents: any[] = [];
            jest.spyOn(conversation, 'dispatch').mockImplementation((event, data) => {
                dispatchedEvents.push({ event, data });
                // Simulate event system behavior
                if (event === ConversationEvent.continue) {
                    // Simulate continuing to next exchange
                    (conversation as any).continueAIToAIConversation();
                }
            });

            // Mock the callAIService method
            jest.spyOn(conversation as any, 'callAIService')
                .mockResolvedValue({
                    content: JSON.stringify(mockAIResponse),
                    messages: []
                });

            // Start AI-to-AI conversation
            await (conversation as any).startAIToAIConversation(
                { name: 'Rival Captain', type: 'enemy' },
                { name: 'Salvager Grunt', type: 'enemy' },
                true // isEavesdropping
            );

            // Verify conversation is in AI-to-AI mode
            expect((conversation as any).isAIToAIConversation).toBe(true);
            expect((conversation as any).fullAIConversation).toHaveLength(3);

            // Check first exchange was dispatched
            const updateEvents = dispatchedEvents.filter(e => e.event === ConversationEvent.update);
            expect(updateEvents.length).toBeGreaterThan(0);

            const firstExchange = updateEvents[0];
            expect(firstExchange.data.source).toBe('Rival Captain');
            expect(firstExchange.data.answers).toContain('Next');

            // Simulate clicking "Next"
            (conversation as any).aiToAIExchangeCount = 1;
            (conversation as any).showNextAIExchange(true);

            // Verify no loading state is set
            expect((conversation as any).isLoading).toBe(false);
        });

        it('should not show loading when continuing AI-to-AI conversation', () => {
            // Set up AI-to-AI mode with pre-loaded exchanges
            (conversation as any).isAIToAIConversation = true;
            (conversation as any).fullAIConversation = [
                { type: 'speech', source: 'NPC1', content: 'First', answers: [] },
                { type: 'speech', source: 'NPC2', content: 'Second', answers: [] },
                { type: 'speech', source: 'NPC1', content: 'Third', answers: [] }
            ];
            (conversation as any).aiToAIExchangeCount = 0;

            // Track if loading is ever set
            let loadingWasSet = false;
            Object.defineProperty(conversation, 'isLoading', {
                get() { return this._isLoading; },
                set(value) {
                    if (value === true) loadingWasSet = true;
                    this._isLoading = value;
                }
            });

            // Continue to next exchange
            (conversation as any).continueAIToAIConversation();

            // Verify loading was never set
            expect(loadingWasSet).toBe(false);
            expect((conversation as any).aiToAIExchangeCount).toBe(1);
        });

        it('should handle Skip button in AI-to-AI conversation', () => {
            // Set up AI-to-AI mode
            (conversation as any).isAIToAIConversation = true;
            (conversation as any).fullAIConversation = [
                { type: 'speech', source: 'NPC1', content: 'Test', answers: [] }
            ];

            const dispatchedEvents: any[] = [];
            jest.spyOn(conversation, 'dispatch').mockImplementation((event, data) => {
                dispatchedEvents.push({ event, data });
            });

            // Call the skip method directly
            (conversation as any).skipAIToAIConversation();

            // Verify conversation ends properly
            expect((conversation as any).isAIToAIConversation).toBe(false);
        });
    });

    describe('Loading State Management', () => {
        it('should never set loading for pre-loaded AI exchanges', () => {
            (conversation as any).isAIToAIConversation = true;
            (conversation as any).fullAIConversation = [
                { type: 'speech', source: 'NPC', content: 'Test', answers: ['Next', 'Skip'] }
            ];

            // Spy on any method that might set loading
            const originalShowNextAIExchange = (conversation as any).showNextAIExchange;
            (conversation as any).showNextAIExchange = jest.fn(function(this: any, ...args: any[]) {
                // Should not set loading
                expect(this.isLoading).toBe(false);
                return originalShowNextAIExchange.call(this, ...args);
            });

            // Continue conversation
            (conversation as any).continueAIToAIConversation();

            expect((conversation as any).showNextAIExchange).toHaveBeenCalled();
            expect((conversation as any).isLoading).toBe(false);
        });
    });
});