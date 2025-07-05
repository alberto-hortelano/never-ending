import type { ICharacter, IMessage } from "./interfaces";
import type { DeepReadonly } from "./helpers/types";

import {
    EventBus, StateChangeEvent, StateChangeEventsMap, UpdateStateEvent, UpdateStateEventsMap,
    ConversationEvent, ConversationEventsMap, ConversationStartData, ConversationUpdateData
} from "./events";
import { conversationSystemPrompt, characterContext } from "../prompts/conversationPrompts";

export interface ConversationState {
    messages: IMessage[];
    isLoading: boolean;
    currentTalker?: string;
    currentTarget?: string;
    conversationId?: string;
}

export interface ConversationOptions {
    maxRetries?: number;
    retryDelay?: number;
    maxMessageLength?: number;
}

export class Conversation extends EventBus<
    StateChangeEventsMap & ConversationEventsMap,
    UpdateStateEventsMap & ConversationEventsMap
> {
    private messages: IMessage[] = [];
    private isLoading = false;
    private currentTalker?: string;
    private currentTarget?: string;
    private conversationId?: string;
    private options: ConversationOptions = {
        maxRetries: 3,
        retryDelay: 1000,
        maxMessageLength: 1000
    };

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
        this.currentTalker = talkingCharacter.name;
        this.currentTarget = targetCharacter.name;
        this.conversationId = `${Date.now()}-${talkingCharacter.name}-${targetCharacter.name}`;

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
            if (retry < (this.options.maxRetries || 3)) {
                await new Promise(resolve => setTimeout(resolve, this.options.retryDelay || 1000));
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

                // Validate required fields
                if (!parsed.type || !parsed.source || !parsed.content || !parsed.answers) {
                    throw new Error('Missing required fields in response');
                }

                // Ensure content doesn't exceed max length
                if (this.options.maxMessageLength && parsed.content.length > this.options.maxMessageLength) {
                    parsed.content = parsed.content.substring(0, this.options.maxMessageLength) + '...';
                }

                return parsed;
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

    public getConversationState(): ConversationState {
        return {
            messages: [...this.messages],
            isLoading: this.isLoading,
            currentTalker: this.currentTalker,
            currentTarget: this.currentTarget,
            conversationId: this.conversationId
        };
    }

    public clearConversation(): void {
        this.messages = [];
        this.currentTalker = undefined;
        this.currentTarget = undefined;
        this.conversationId = undefined;
        this.dispatch(UpdateStateEvent.updateMessages, []);
    }

    public setOptions(options: Partial<ConversationOptions>): void {
        this.options = { ...this.options, ...options };
    }

    public isConversationActive(): boolean {
        return this.messages.length > 0 && !this.isLoading;
    }

    public getMessageCount(): number {
        return this.messages.length;
    }

    public getLastMessage(): IMessage | undefined {
        return this.messages[this.messages.length - 1];
    }
}