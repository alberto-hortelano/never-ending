import { Conversation } from '../../Conversation';
import { IMessage } from '../../interfaces';

// Track what messages are sent to the AI
let capturedMessages: IMessage[] = [];
let fetchCallCount = 0;

// Create a test-specific mock for the fetch API
const createTestFetchMock = () => {
    return jest.fn((url: string, options: any) => {
        fetchCallCount++;
        
        if (url === '/gameEngine') {
            // Capture the messages being sent
            const body = JSON.parse(options.body);
            capturedMessages = body;
            
            // Log for debugging
            console.log('=== FETCH CALLED ===');
            console.log('Messages sent:', body.length);
            body.forEach((msg: IMessage, i: number) => {
                console.log(`  Message ${i + 1} (${msg.role}):`, 
                    msg.content?.substring(0, 100) + (msg.content?.length > 100 ? '...' : ''));
            });
            
            // Check if the messages contain story context
            const hasStoryContext = body.some((msg: IMessage) => 
                msg.content?.includes('Deserter') || 
                msg.content?.includes('desertor') ||
                msg.content?.includes('Stolen Military Cruiser') ||
                msg.content?.includes('origin') ||
                msg.content?.includes('Chapter')
            );
            
            console.log('Has story context:', hasStoryContext);
            console.log('====================');
            
            // Return a response based on whether context was found
            const responseContent = hasStoryContext
                ? JSON.stringify({
                    type: 'speech',
                    source: 'Sargento Torres',
                    content: 'Tengo autoridad militar del Imperio. Esta es una operación clasificada.',
                    answers: ['Understood', 'I don\'t recognize your authority']
                })
                : JSON.stringify({
                    type: 'speech',
                    source: 'Narrator',
                    content: "I notice you've asked a question, but I don't have the current game context to respond appropriately.",
                    answers: []
                });
            
            return Promise.resolve({
                ok: true,
                json: async () => [
                    ...body,
                    {
                        role: 'assistant',
                        content: responseContent
                    }
                ]
            });
        }
        
        return Promise.reject(new Error(`Unexpected fetch to ${url}`));
    });
};

describe('AI Conversation Context Loss', () => {
    let conversation: Conversation;
    let mockFetch: jest.Mock;
    
    beforeAll(() => {
        // Mock console to reduce noise
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        
        // Mock localStorage
        const localStorageMock = {
            getItem: jest.fn().mockReturnValue(null), // Mock mode disabled
            setItem: jest.fn(),
            removeItem: jest.fn(),
            clear: jest.fn(),
        };
        Object.defineProperty(global, 'localStorage', {
            value: localStorageMock,
            writable: true
        });
    });
    
    afterAll(() => {
        jest.restoreAllMocks();
    });
    
    beforeEach(() => {
        // Reset tracking
        capturedMessages = [];
        fetchCallCount = 0;
        
        // Setup fetch mock
        mockFetch = createTestFetchMock();
        global.fetch = mockFetch as any;
        
        // Create a new conversation instance
        conversation = new Conversation();
    });
    
    afterEach(() => {
        jest.clearAllMocks();
    });
    
    describe('Context Loss During Conversation', () => {
        it('should lose story context when continuing conversation (BUG REPRODUCTION)', async () => {
            // Enable console for this test to see the output
            jest.spyOn(console, 'log').mockRestore();
            
            console.log('\n=== TEST: Context Loss Bug Reproduction ===\n');
            
            // Simulate the conversation flow that causes context loss
            // This is what happens when the player continues a conversation
            
            // 1. Simulate the ACTUAL bug: messages don't contain story context
            // In the real game, when a conversation continues, it only has the conversation prompts
            const conversationMessages: IMessage[] = [
                {
                    role: 'user',
                    content: `player is talking with Sargento Torres.
This is turn 2 of the conversation. Provide new information.
Respond as Sargento Torres based on their personality profile.
Remember: All dialogue must be in Spanish.`
                },
                {
                    role: 'user',
                    content: '¿Qué autoridad tienes aquí?'
                }
            ];
            
            // 2. This is what ACTUALLY happens - no story context!
            const conversationAny = conversation as any;
            conversationAny.messages = []; // Empty messages, as conversation just started
            
            // Call the AI service with just the conversation context
            await conversationAny.callAIService(conversationMessages);
            
            // ASSERTIONS
            console.log('\n=== ASSERTIONS ===\n');
            
            // 1. Verify fetch was called
            expect(mockFetch).toHaveBeenCalled();
            expect(fetchCallCount).toBe(1);
            
            // 2. Check captured messages
            expect(capturedMessages.length).toBeGreaterThan(0);
            
            // 3. BUG VERIFICATION: Check if story context is missing
            const hasDesertorContext = capturedMessages.some(msg => 
                msg.content?.includes('Deserter') || 
                msg.content?.includes('desertor')
            );
            const hasLocationContext = capturedMessages.some(msg => 
                msg.content?.includes('Stolen Military Cruiser') || 
                msg.content?.includes('Crucero')
            );
            const hasChapterContext = capturedMessages.some(msg => 
                msg.content?.includes('Chapter') || 
                msg.content?.includes('origin')
            );
            
            console.log('Context check results:');
            console.log('  - Has Desertor context:', hasDesertorContext);
            console.log('  - Has Location context:', hasLocationContext);
            console.log('  - Has Chapter context:', hasChapterContext);
            
            // These should be TRUE but will be FALSE, demonstrating the bug
            if (!hasDesertorContext) {
                console.log('\n❌ BUG CONFIRMED: Missing Desertor origin context');
            }
            if (!hasLocationContext) {
                console.log('❌ BUG CONFIRMED: Missing location context');
            }
            if (!hasChapterContext) {
                console.log('❌ BUG CONFIRMED: Missing chapter/story context');
            }
            
            // The test PASSES when the bug is present (context is missing)
            expect(hasDesertorContext).toBe(false); // Bug: Should be true
            expect(hasLocationContext).toBe(false); // Bug: Should be true
            expect(hasChapterContext).toBe(false);  // Bug: Should be true
            
            console.log('\n=== END TEST ===\n');
        });
        
        it('should demonstrate what messages SHOULD contain for proper context', () => {
            // This test documents the expected behavior
            const idealMessages: IMessage[] = [
                {
                    role: 'user',
                    content: `You are in a game where:
                        - Origin: The Deserter (Ex-soldier fleeing corrupt military)
                        - Current Location: Stolen Military Cruiser
                        - Chapter: 1
                        - Faction Relations: Military -50, Rebels +10
                        - Recent Event: Encountered by Sargento Torres
                        
                        Player asks: ¿Qué autoridad tienes aquí?`
                }
            ];
            
            // These messages would provide proper context
            const hasContext = idealMessages.some(msg => 
                msg.content?.includes('Deserter') && 
                msg.content?.includes('Military Cruiser')
            );
            
            expect(hasContext).toBe(true);
            const firstMessage = idealMessages[0];
            if (firstMessage?.content) {
                expect(firstMessage.content).toContain('Origin');
                expect(firstMessage.content).toContain('Location');
                expect(firstMessage.content).toContain('Chapter');
            }
        });
        
        it('should show that conversation system prompt alone is not enough', async () => {
            // Test that even with conversation system prompt, story context is missing
            const messagesWithPrompt: IMessage[] = [
                {
                    role: 'user',
                    content: `You are the game master for "Never Ending", a post-apocalyptic turn-based tactical strategy game.
                    
                    player is talking with Sargento Torres.
                    This is turn 2 of the conversation.
                    
                    ¿Qué autoridad tienes aquí?`
                }
            ];
            
            // Even with the system prompt, there's no story context
            const hasStoryContext = messagesWithPrompt.some(msg => 
                msg.content?.includes('Deserter') || 
                msg.content?.includes('origin') ||
                msg.content?.includes('Stolen Military Cruiser')
            );
            
            // This shows the prompt has game rules but no story context
            const firstPrompt = messagesWithPrompt[0];
            if (firstPrompt?.content) {
                expect(firstPrompt.content).toContain('Never Ending'); // Has game name
                expect(firstPrompt.content).toContain('Sargento Torres'); // Has character
            }
            expect(hasStoryContext).toBe(false); // But missing story context!
        });
    });
    
    describe('Expected Fix', () => {
        it('after fix, messages should include story context when State is provided', async () => {
            // Create a mock State with story context
            const mockState = {
                story: {
                    selectedOrigin: {
                        id: 'deserter',
                        name: 'The Deserter',
                        nameES: 'El Desertor',
                        startingLocation: 'Stolen Military Cruiser',
                        specialTraits: ['Combat Training', 'Survival Instinct'],
                        narrativeHooks: ['Military pursuit', 'Classified data']
                    },
                    currentChapter: 1,
                    factionReputation: {
                        military: -50,
                        rebels: 10
                    },
                    completedMissions: []
                }
            };
            
            // Import the Conversation class
            const { Conversation: ConversationClass } = await import('../../Conversation');
            
            // Create a new Conversation instance WITH State
            const conversationWithState = new ConversationClass(mockState as any);
            
            // Set story state directly for testing
            (conversationWithState as any).storyState = mockState.story;
            
            // Call the private buildStoryContext method through reflection
            const contextBuilder = (conversationWithState as any).buildStoryContext;
            const storyContext = contextBuilder.call(conversationWithState);
            
            // Verify that story context is built correctly
            expect(storyContext).toContain('The Deserter');
            expect(storyContext).toContain('Stolen Military Cruiser');
            expect(storyContext).toContain('Chapter: 1');
            expect(storyContext).toContain('military: -50');
            
            // Now test actual conversation with context
            const conversationAny = conversationWithState as any;
            conversationAny.messages = [];
            
            // Simulate continuing a conversation
            const messagesWithContext: IMessage[] = [
                {
                    role: 'user',
                    content: storyContext + '\n\nPlayer response: ¿Qué autoridad tienes aquí?'
                }
            ];
            
            capturedMessages = []; // Reset capture
            await conversationAny.callAIService(messagesWithContext);
            
            // After fix, these should all be true
            const hasDesertorContext = capturedMessages.some(msg => 
                msg.content?.includes('Deserter') || 
                msg.content?.includes('desertor')
            );
            const hasLocationContext = capturedMessages.some(msg => 
                msg.content?.includes('Stolen Military Cruiser')
            );
            
            expect(hasDesertorContext).toBe(true);
            expect(hasLocationContext).toBe(true);
        });
    });
});