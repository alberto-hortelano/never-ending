import type { ICharacter, IMessage } from "./interfaces";
import type { DeepReadonly } from "./helpers/types";

import {
    EventBus, StateChangeEvent, StateChangeEventsMap, UpdateStateEvent, UpdateStateEventsMap,
    ConversationEvent, ConversationEventsMap, ConversationStartData, ConversationUpdateData
} from "./events";
import { conversationSystemPrompt, characterContext } from "../prompts/conversationPrompts";

export class Conversation extends EventBus<
    StateChangeEventsMap & ConversationEventsMap,
    UpdateStateEventsMap & ConversationEventsMap
> {
    private messages: IMessage[] = [];
    private isLoading = false;
    private currentTarget?: string;
    private conversationTurnCount = 0;
    private readonly maxRetries = 3;
    private readonly retryDelay = 1000;
    private readonly maxMessageLength = 1000;

    constructor() {
        super();

        // Listen for state changes
        this.listen(StateChangeEvent.messages, (messages) => {
            this.messages = [...messages];
        });

        // Listen for conversation start requests
        this.listen(ConversationEvent.start, (data: ConversationStartData) => {
            this.startConversation(data.talkingCharacter, data.targetCharacter);
        });

        // Listen for continue conversation
        this.listen(ConversationEvent.continue, (answer: string) => {
            this.continueConversation(answer);
        });
    }

    private async startConversation(talkingCharacter: DeepReadonly<ICharacter>, targetCharacter: DeepReadonly<ICharacter>) {
        if (this.isLoading) return;

        this.isLoading = true;
        this.currentTarget = targetCharacter.name;
        this.conversationTurnCount = 1; // Reset turn count for new conversation

        try {
            // Create context message with turn count for better conversation flow
            const contextMessage: IMessage = {
                role: 'user',
                content: characterContext(talkingCharacter.name, targetCharacter.name, this.conversationTurnCount)
            };

            // Include system prompt in the context message if this is the first conversation
            const fullContextMessage: IMessage = {
                role: 'user',
                content: this.messages.length === 0
                    ? `${conversationSystemPrompt}\n\n${contextMessage.content}`
                    : contextMessage.content
            };

            const messages = [...this.messages, fullContextMessage];

            // Call API
            const response = await this.callGameEngine(messages);

            // Parse and dispatch update
            const conversationData = this.parseResponse(response.content);
            
            // Only log if content is meaningful
            if (conversationData.content && conversationData.content !== '...' && conversationData.content !== 'Procesando información...') {
                console.log('[Conversation] AI response:', conversationData.content);
            } else {
                console.warn('[Conversation] Received empty or placeholder response from AI');
            }
            
            this.dispatch(ConversationEvent.update, conversationData);

            // Update messages state
            this.dispatch(UpdateStateEvent.updateMessages, response.messages);

        } catch (error) {
            console.error('Error starting conversation:', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to start conversation';
            this.dispatch(ConversationEvent.error, errorMessage);
        } finally {
            this.isLoading = false;
        }
    }

    private async continueConversation(answer: string) {
        if (this.isLoading) return;

        this.isLoading = true;
        this.conversationTurnCount++; // Increment turn count

        try {
            // Add turn count context to help AI know when to end
            const turnContext = this.conversationTurnCount >= 3 
                ? '\n[SYSTEM: This is turn ' + this.conversationTurnCount + '. Consider ending the conversation naturally.]'
                : '';
            
            // Create player message with turn context
            const playerMessage: IMessage = {
                role: 'user',
                content: answer + turnContext
            };

            // Call API
            const response = await this.callGameEngine([...this.messages, playerMessage]);

            // Parse and dispatch update
            const conversationData = this.parseResponse(response.content);
            
            // Only log if content is meaningful
            if (conversationData.content && conversationData.content !== '...' && conversationData.content !== 'Procesando información...') {
                console.log('[Conversation] AI response:', conversationData.content);
            } else {
                console.warn('[Conversation] Received empty or placeholder response from AI');
            }
            
            this.dispatch(ConversationEvent.update, conversationData);

            // Update messages state
            this.dispatch(UpdateStateEvent.updateMessages, response.messages);

        } catch (error) {
            console.error('Error continuing conversation:', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to continue conversation';
            this.dispatch(ConversationEvent.error, errorMessage);
        } finally {
            this.isLoading = false;
        }
    }

    private async callGameEngine(messages: IMessage[], retry = 0): Promise<{ messages: IMessage[], content: string }> {
        try {
            const response = await fetch('/gameEngine', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(messages)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `API request failed: ${response.statusText}`);
            }

            const updatedMessages: IMessage[] = await response.json();

            const lastMessage = updatedMessages[updatedMessages.length - 1];
            if (!lastMessage || lastMessage.role !== 'assistant') {
                throw new Error('Invalid response from server');
            }

            return {
                messages: updatedMessages,
                content: lastMessage.content
            };
        } catch (error) {
            if (retry < this.maxRetries) {
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                return this.callGameEngine(messages, retry + 1);
            }
            throw error;
        }
    }

    private parseResponse(response: string): ConversationUpdateData {
        try {
            // Try to extract JSON from the response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);

                // Handle different response types
                if (parsed.type === 'storyline') {
                    // Convert storyline to speech format for conversation display
                    return {
                        type: 'speech',
                        source: 'Narrador',  // Narrator in Spanish
                        content: parsed.content || 'La historia continúa...',
                        answers: ['Continuar', 'Entendido'],  // Default options for storyline
                        action: parsed.action
                    };
                } else if (parsed.type === 'speech') {
                    // Validate speech has required fields
                    if (!parsed.source || !parsed.content) {
                        throw new Error('Speech missing source or content');
                    }
                    
                    // Ensure content doesn't exceed max length
                    if (parsed.content.length > this.maxMessageLength) {
                        parsed.content = parsed.content.substring(0, this.maxMessageLength) + '...';
                    }
                    
                    // Check if conversation should end (no answers or empty answers array)
                    const shouldEnd = !parsed.answers || parsed.answers.length === 0 || 
                                    parsed.content.toLowerCase().includes('fin de la conversación');
                    
                    return {
                        type: 'speech',
                        source: parsed.source,
                        content: parsed.content,
                        answers: shouldEnd ? [] : (parsed.answers || ['Continuar']),  // Empty array ends conversation
                        action: parsed.action
                    };
                } else if (parsed.type === 'movement' || parsed.type === 'attack' || 
                          parsed.type === 'character' || parsed.type === 'map' || 
                          parsed.type === 'item' || parsed.type === 'tactical_directive') {
                    // AI is taking a non-conversation action - end the conversation
                    console.log('[Conversation] AI returned non-speech command:', parsed.type);
                    console.log('[Conversation] Ending conversation as AI wants to perform action');
                    return {
                        type: 'speech',
                        source: this.currentTarget || 'AI',
                        content: 'Fin de la conversación.',
                        answers: [],  // Empty answers will trigger conversation end
                        action: parsed.type
                    };
                } else {
                    // Unknown type - still try to use what we have but log warning
                    console.warn('[Conversation] Unknown command type:', parsed.type);
                    return {
                        type: 'speech',
                        source: parsed.source || this.currentTarget || 'Unknown',
                        content: parsed.content || 'No response available',
                        answers: parsed.answers || ['Continue'],
                        action: parsed.action
                    };
                }
            }
            
            // No JSON found - treat the response as narrative text
            // This happens when the AI responds with story text instead of structured JSON
            if (response && response.trim().length > 0) {
                console.log('[Conversation] No JSON found, treating as narrative text');
                
                // Check if it's a narrative response (contains story elements)
                const isNarrative = response.includes('alarmas') || response.includes('nave') || 
                                  response.includes('espacio') || response.includes('soldado');
                
                if (isNarrative) {
                    // It's a narrative response, present it as narrator
                    return {
                        type: 'speech',
                        source: 'Narrador',
                        content: response.substring(0, this.maxMessageLength),
                        answers: ['Continuar', 'Explorar', 'Preguntar'],
                        action: undefined
                    };
                } else {
                    // It's a direct response, attribute it to the current target
                    return {
                        type: 'speech',
                        source: this.currentTarget || 'Data',
                        content: response.substring(0, this.maxMessageLength),
                        answers: ['Entendido', 'Dime más', 'Cambiar de tema'],
                        action: undefined
                    };
                }
            }
            
            throw new Error('Empty response received');
        } catch (error) {
            console.error('Error parsing response:', error, 'Original response:', response);
            
            // Better fallback based on who we're talking to
            const fallbackSource = this.currentTarget || 'Data';
            const fallbackContent = this.currentTarget === 'Data' 
                ? 'Procesando... mis circuitos necesitan un momento para calibrarse.'
                : 'Disculpa, necesito un momento para pensar...';
            
            return {
                type: 'speech',
                source: fallbackSource,
                content: fallbackContent,
                answers: ['Está bien', 'Toma tu tiempo', 'Intentemos de nuevo']
            };
        }
    }

}