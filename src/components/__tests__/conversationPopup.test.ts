/**
 * @jest-environment jsdom
 */

import { Popup } from '../popup/Popup';
import { Conversation } from '../conversation/Conversation';
import { ConversationEvent, UpdateStateEvent } from '../../common/events';
import { EventBus } from '../../common/events/EventBus';

describe('Conversation Popup Integration', () => {
    let popup: Popup;
    let eventBus: EventBus<any, any>;
    
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
        // Clear DOM
        document.body.innerHTML = '';
        
        // Create popup component
        popup = document.createElement('popup-component') as Popup;
        document.body.appendChild(popup);
        
        // Create a shared event bus
        eventBus = new EventBus();
    });
    
    afterEach(() => {
        // Clean up
        if (popup && popup.parentNode) {
            popup.parentNode.removeChild(popup);
        }
    });
    
    describe('Conversation Display', () => {
        it('should create conversation component when popup state is set to conversation', async () => {
            // Wait for popup to be connected
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Dispatch popup state with conversation type
            eventBus.dispatch(UpdateStateEvent.uiPopup, {
                popupId: 'main',
                popupState: {
                    type: 'conversation',
                    visible: true,
                    position: undefined,
                    data: {
                        title: 'Data - Conversación'
                    }
                }
            });
            
            // Wait for popup to process the state
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Check that conversation component was created
            const conversationComponent = popup.querySelector('conversation-ui');
            expect(conversationComponent).toBeTruthy();
            expect(conversationComponent).toBeInstanceOf(HTMLElement);
        });
        
        it('should display conversation content when update event is dispatched', async () => {
            // Wait for popup to be connected
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // First, show the popup with conversation type
            eventBus.dispatch(UpdateStateEvent.uiPopup, {
                popupId: 'main',
                popupState: {
                    type: 'conversation',
                    visible: true,
                    position: undefined,
                    data: {
                        title: 'Data - Conversación'
                    }
                }
            });
            
            // Wait for popup and conversation component to be created
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Get the conversation component
            const conversationComponent = popup.querySelector('conversation-ui') as Conversation;
            expect(conversationComponent).toBeTruthy();
            
            // Now dispatch the conversation update
            eventBus.dispatch(ConversationEvent.update, {
                type: 'speech',
                source: 'Data',
                content: 'Hola comandante, ¿necesita ayuda?',
                answers: ['Sí', 'No', 'Tal vez más tarde']
            });
            
            // Wait for the conversation to update
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Check that the content is displayed (not loading)
            const shadowRoot = conversationComponent.shadowRoot;
            expect(shadowRoot).toBeTruthy();
            
            const loadingElement = shadowRoot?.querySelector('.conversation-loading');
            const contentElement = shadowRoot?.querySelector('.conversation-content');
            
            // Loading should be hidden
            if (loadingElement instanceof HTMLElement) {
                expect(loadingElement.style.display).toBe('none');
            }
            
            // Content should be visible and contain the text
            expect(contentElement).toBeTruthy();
            expect(contentElement?.textContent).toContain('Data');
            expect(contentElement?.textContent).toContain('Hola comandante');
            
            // Check that answers are displayed
            const answerButtons = shadowRoot?.querySelectorAll('.answer-button');
            expect(answerButtons?.length).toBe(3);
        });
        
        it('should handle conversation events dispatched immediately after popup creation', async () => {
            // Simulate what the AI does: dispatch popup state and then conversation update
            
            // Wait for popup to be connected
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Dispatch popup state
            eventBus.dispatch(UpdateStateEvent.uiPopup, {
                popupId: 'main',
                popupState: {
                    type: 'conversation',
                    visible: true,
                    position: undefined,
                    data: {
                        title: 'Data - Conversación'
                    }
                }
            });
            
            // Simulate the AI's 200ms delay
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Dispatch conversation update (like AI does)
            eventBus.dispatch(ConversationEvent.update, {
                type: 'speech',
                source: 'Data',
                content: 'Comandante, detecto una amenaza.',
                answers: ['Entendido', 'Más información', 'Ignorar']
            });
            
            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Verify the conversation is displayed correctly
            const conversationComponent = popup.querySelector('conversation-ui') as Conversation;
            expect(conversationComponent).toBeTruthy();
            
            const shadowRoot = conversationComponent.shadowRoot;
            const contentElement = shadowRoot?.querySelector('.conversation-content');
            
            expect(contentElement).toBeTruthy();
            expect(contentElement?.textContent).toContain('Comandante, detecto una amenaza');
            
            // Verify answers are shown
            const answerButtons = shadowRoot?.querySelectorAll('.answer-button');
            expect(answerButtons?.length).toBe(3);
            
            // Verify first answer button text
            if (answerButtons?.[0]) {
                expect(answerButtons[0].textContent).toBe('Entendido');
            }
        });
        
        it('should properly set up event listeners on conversation component', async () => {
            // Create a conversation component directly
            const conversation = document.createElement('conversation-ui') as Conversation;
            document.body.appendChild(conversation);
            
            // Wait for component to connect and set up listeners
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Spy on the updateConversation method
            const updateSpy = jest.spyOn(conversation as any, 'updateConversation');
            
            // Dispatch conversation update
            eventBus.dispatch(ConversationEvent.update, {
                type: 'speech',
                source: 'Test',
                content: 'Test content',
                answers: ['Answer 1', 'Answer 2']
            });
            
            // Wait for event processing
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Check that updateConversation was called
            expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({
                type: 'speech',
                source: 'Test',
                content: 'Test content',
                answers: ['Answer 1', 'Answer 2']
            }));
            
            // Clean up
            conversation.remove();
        });
    });
    
    describe('Event Bus Communication', () => {
        it('should verify EventBus is shared across all instances', () => {
            // Create two event bus instances with proper typing
            const bus1 = new EventBus<any, any>();
            const bus2 = new EventBus<any, any>();
            
            let received = false;
            
            // Listen on bus1
            bus1.listen(ConversationEvent.update, () => {
                received = true;
            });
            
            // Dispatch from bus2 (should work because EventBus uses static listeners)
            bus2.dispatch(ConversationEvent.update, {
                type: 'test',
                source: 'test',
                content: 'test',
                answers: []
            });
            
            // Should receive the event
            expect(received).toBe(true);
        });
        
        it('should allow conversation component to receive events from AI controller', () => {
            // This simulates the AI controller dispatching events
            const aiControllerBus = new EventBus<any, any>();
            
            // This simulates the conversation component listening
            const conversationBus = new EventBus<any, any>();
            
            let messageReceived: any = null;
            
            // Conversation listens for updates
            conversationBus.listen(ConversationEvent.update, (data) => {
                messageReceived = data;
            });
            
            // AI controller dispatches update
            aiControllerBus.dispatch(ConversationEvent.update, {
                type: 'speech',
                source: 'AI',
                content: 'Hello',
                answers: ['Hi', 'Bye']
            });
            
            // Should receive the message (because EventBus is shared)
            expect(messageReceived).toEqual({
                type: 'speech',
                source: 'AI',
                content: 'Hello',
                answers: ['Hi', 'Bye']
            });
        });
    });
});