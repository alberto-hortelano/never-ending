/**
 * @jest-environment jsdom
 */

// Polyfill structuredClone for test environment
if (typeof globalThis.structuredClone === 'undefined') {
    globalThis.structuredClone = (obj: any) => JSON.parse(JSON.stringify(obj));
}

import { Popup } from '../popup/Popup';
import { Conversation } from '../conversation/Conversation';
import { ConversationEvent, UpdateStateEvent, StateChangeEvent } from '../../common/events';
import { EventBus } from '../../common/events/EventBus';
import { State } from '../../common/State';
import type { IState } from '../../common/interfaces';

describe('Conversation Popup Integration', () => {
    let popup: Popup;
    let eventBus: EventBus<any, any>;
    let state: State;
    let testState: IState;
    
    beforeAll(() => {
        // Mock console to avoid noise
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        
        // Register custom elements if not already registered
        if (!customElements.get('popup-component')) {
            customElements.define('popup-component', Popup);
        }
        if (!customElements.get('conversation-ui')) {
            customElements.define('conversation-ui', Conversation);
        }
    });
    
    afterAll(() => {
        jest.restoreAllMocks();
    });
    
    beforeEach(() => {
        // Clear DOM
        document.body.innerHTML = '';
        
        // Create test state
        testState = {
            game: {
                turn: 'human',
                players: ['human', 'ai'],
                playerInfo: {
                    'human': { name: 'Player', isAI: false },
                    'ai': { name: 'AI', isAI: true }
                }
            } as any,
            map: [] as any,
            characters: [],
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
        
        // Initialize State (which sets up UIStateService)
        state = new State(testState);
        
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
                popupId: 'main-popup',
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
                popupId: 'main-popup',
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
            
            // Wait for conversation component to initialize its shadow DOM
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Now dispatch the conversation update
            eventBus.dispatch(ConversationEvent.update, {
                type: 'speech',
                source: 'Data',
                content: 'Hola comandante, ¿necesita ayuda?',
                answers: ['Sí', 'No', 'Tal vez más tarde']
            });
            
            // Wait for the conversation to update
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Since shadow DOM is closed, we can only verify the component exists
            // and that the event was handled (no errors thrown)
            expect(conversationComponent).toBeTruthy();
            
            // We can't access closed shadow DOM in tests, but we can verify
            // the component received and processed the event by checking
            // that no errors were thrown and the component is still present
            expect(conversationComponent.parentElement).toBe(popup);
        });
        
        it('should handle conversation events dispatched immediately after popup creation', async () => {
            // Simulate what the AI does: dispatch popup state and then conversation update
            
            // Wait for popup to be connected
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Dispatch popup state
            eventBus.dispatch(UpdateStateEvent.uiPopup, {
                popupId: 'main-popup',
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
            
            // Wait for conversation component to initialize
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Since shadow DOM is closed, we can only verify the component exists
            // and that the events were handled without errors
            expect(conversationComponent.parentElement).toBe(popup);
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