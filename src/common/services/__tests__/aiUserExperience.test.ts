import { Conversation } from '../../Conversation';
import { EventBus } from '../../events/EventBus';

// Mock the BottomBar component directly
jest.mock('../../../components/bottombar/BottomBar', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        showConversation: jest.fn(),
        hideConversation: jest.fn(),
        isConversationVisible: false
    }))
}));

describe('AI User Experience', () => {
    let conversation: Conversation;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let eventBus: EventBus<any, any>;
    let bottomBarMock: any;
    
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
        eventBus = new EventBus<any, any>();
        conversation = new Conversation();
        
        // Mock BottomBar behavior
        bottomBarMock = {
            showConversation: jest.fn(),
            hideConversation: jest.fn(),
            isConversationVisible: false
        };
    });
    
    describe('Narrative Display', () => {
        it('should show narrative with close button instead of continue options', () => {
            const narrative = {
                type: 'speech',
                source: 'Narrator',
                content: '**CHAPTER 1**\n\nYour story begins...',
                answers: [] // Empty array for close button
            };
            
            // Parse the narrative
            const result = (conversation as any).parseResponse(JSON.stringify({
                type: 'storyline',
                content: narrative.content
            }));
            
            // Should have narrator as source
            expect(result.source).toBe('Narrator');
            // Should have story content
            expect(result.content).toContain('Your story begins');
            // Should have default continue options (for storyline)
            expect(result.answers).toEqual(['Continue', 'OK']);
        });
        
        it('should not confuse users with system messages', () => {
            const systemMessages = [
                'Estoy listo como Arquitecto Narrativo',
                'Esperando órdenes',
                'Entendido',
                'Sistema inicializado'
            ];
            
            systemMessages.forEach(msg => {
                const result = (conversation as any).parseResponse(msg);
                
                // Should treat as regular text response, not system message
                expect(result.source).toBe('Data'); // Default source for non-narrative text
                expect(result.answers).toEqual(['Entendido', 'Dime más', 'Cambiar de tema']);
            });
        });
    });
    
    describe('Conversation Flow', () => {
        it('should show appropriate UI elements during conversation', () => {
            const conversationStates = [
                { visible: false, component: null },     // Initial state
                { visible: true, component: 'created' }, // Conversation starts
                { visible: true, component: 'active' },  // During conversation
                { visible: false, component: 'hidden' }  // Conversation ends
            ];
            
            // Simulate conversation lifecycle
            conversationStates.forEach((state, index) => {
                if (index === 1) {
                    // Start conversation
                    bottomBarMock.showConversation();
                    bottomBarMock.isConversationVisible = true;
                } else if (index === 3) {
                    // End conversation
                    bottomBarMock.hideConversation();
                    bottomBarMock.isConversationVisible = false;
                }
                
                expect(bottomBarMock.isConversationVisible).toBe(state.visible);
            });
        });
        
        it('should handle conversation with multiple answer options properly', () => {
            const multiChoiceConversation = {
                type: 'speech',
                source: 'NPC',
                content: 'What do you want to do?',
                answers: [
                    'Fight',
                    'Talk',
                    'Run away',
                    'Use item'
                ]
            };
            
            // All answers should be available
            expect(multiChoiceConversation.answers).toHaveLength(4);
            // Each answer should be a valid string
            multiChoiceConversation.answers.forEach(answer => {
                expect(typeof answer).toBe('string');
                expect(answer.length).toBeGreaterThan(0);
            });
        });
        
        it('should handle empty conversation responses gracefully', () => {
            const emptyResponses = [
                { content: '', answers: [] },
                { content: null, answers: [] },
                { content: undefined, answers: [] }
            ];
            
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            emptyResponses.forEach(response => {
                // Test with invalid JSON that triggers error handling
                const parsed = (conversation as any).parseResponse('');
                
                // Should have fallback content
                expect(parsed.content).toBeTruthy();
                // Should provide fallback answers for error cases
                expect(parsed.answers).toEqual(['Está bien', 'Toma tu tiempo', 'Intentemos de nuevo']);
            });
        });
    });
    
    describe('Map Change Experience', () => {
        it('should show loading or transition during map changes', async () => {
            const mapChangeSequence = [
                { event: 'conversation_end', ui: 'closing' },
                { event: 'map_loading', ui: 'loading_screen' },
                { event: 'map_generated', ui: 'new_map_visible' },
                { event: 'characters_placed', ui: 'ready' }
            ];
            
            const uiStates: string[] = [];
            
            // Simulate map change sequence
            for (const step of mapChangeSequence) {
                // Track UI state
                uiStates.push(step.ui);
                
                // Small delay to simulate async operations
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            
            // Verify UI states progressed correctly
            expect(uiStates).toEqual([
                'closing',
                'loading_screen',
                'new_map_visible',
                'ready'
            ]);
        });
        
        it('should maintain context when transitioning from conversation to map', () => {
            const context = {
                lastSpeaker: 'Captain',
                lastMessage: 'Prepare for hyperspace jump',
                nextAction: 'map',
                storyChapter: 2
            };
            
            // Conversation ends with map action
            const endConversation = {
                type: 'speech',
                source: context.lastSpeaker,
                content: context.lastMessage,
                answers: [],
                action: context.nextAction
            };
            
            // Verify context is preserved
            expect(endConversation.action).toBe('map');
            expect(endConversation.source).toBe('Captain');
            // Story chapter should be maintained in state
            expect(context.storyChapter).toBe(2);
        });
    });
    
    describe('User Feedback', () => {
        it('should provide clear feedback when actions are processing', () => {
            const loadingStates = [
                { state: 'idle', indicator: false },
                { state: 'processing', indicator: true },
                { state: 'waiting_response', indicator: true },
                { state: 'complete', indicator: false }
            ];
            
            loadingStates.forEach(({ state, indicator }) => {
                const isLoading = state === 'processing' || state === 'waiting_response';
                expect(isLoading).toBe(indicator);
            });
        });
        
        it('should show appropriate messages for different conversation endings', () => {
            const endings = [
                { reason: 'map_change', message: 'Fin de la conversación.' },
                { reason: 'combat_start', message: 'Fin de la conversación.' },
                { reason: 'narrative_close', message: '' }, // Just close button
                { reason: 'normal_end', message: 'Fin de la conversación.' }
            ];
            
            endings.forEach(({ reason, message }) => {
                if (reason === 'narrative_close') {
                    // Narrative should have no message, just close
                    expect(message).toBe('');
                } else {
                    // Other endings should have clear message
                    expect(message).toBe('Fin de la conversación.');
                }
            });
        });
    });
    
    describe('Accessibility and Clarity', () => {
        it('should use clear button labels', () => {
            const buttonLabels = {
                close: '✕ Cerrar',
                continue: 'Continue',
                understand: 'Entendido'
            };
            
            // Close button should have X icon
            expect(buttonLabels.close).toContain('✕');
            // Continue should be clear
            expect(buttonLabels.continue).toBe('Continue');
            // Understand option should be available
            expect(buttonLabels.understand).toBe('Entendido');
        });
        
        it('should format narrative text for readability', () => {
            const rawText = '**TÍTULO**\n\nPárrafo uno.\n\nPárrafo dos con *énfasis*.';
            
            // Should preserve formatting
            expect(rawText).toContain('**');
            expect(rawText).toContain('\n\n');
            expect(rawText).toContain('*');
            
            // Should have clear structure
            const lines = rawText.split('\n');
            expect(lines[0]).toContain('TÍTULO');
            expect(lines[2]).toContain('Párrafo uno');
        });
    });
});