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

        try {
            // Create context message with better prompt
            const contextMessage: IMessage = {
                role: 'user',
                content: characterContext(talkingCharacter.name, targetCharacter.name)
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

        try {
            // Create player message
            const playerMessage: IMessage = {
                role: 'user',
                content: answer
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
                    
                    return {
                        type: 'speech',
                        source: parsed.source,
                        content: parsed.content,
                        answers: parsed.answers || ['Continuar'],  // Default if no answers
                        action: parsed.action
                    };
                } else {
                    // Unknown type - try to use what we have
                    return {
                        type: 'speech',
                        source: parsed.source || this.currentTarget || 'Unknown',
                        content: parsed.content || 'No response available',
                        answers: parsed.answers || ['Continue'],
                        action: parsed.action
                    };
                }
            }
            throw new Error('No JSON found in response');
        } catch (error) {
            console.error('Error parsing response:', error, 'Original response:', response);
            return {
                type: 'speech',
                source: this.currentTarget || 'Unknown',
                content: 'I... I\'m not sure what to say.',
                answers: ['Continue', 'Leave']
            };
        }
    }

}