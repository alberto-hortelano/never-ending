import type { ICharacter, IMessage } from "./interfaces";
import type { DeepReadonly } from "./helpers/types";

import {
    EventBus, StateChangeEvent, StateChangeEventsMap, UpdateStateEvent, UpdateStateEventsMap,
    ConversationEvent, ConversationEventsMap, ConversationStartData, ConversationUpdateData
} from "./events";

export class ConversationService extends EventBus<
    StateChangeEventsMap & ConversationEventsMap,
    UpdateStateEventsMap & ConversationEventsMap
> {
    private messages: IMessage[] = [];
    private isLoading = false;

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

    async startConversation(talkingCharacter: DeepReadonly<ICharacter>, targetCharacter: DeepReadonly<ICharacter>) {
        if (this.isLoading) return;

        this.isLoading = true;

        try {
            // Create context message
            const contextMessage: IMessage = {
                role: 'user',
                content: `${talkingCharacter.name} wants to talk to ${targetCharacter.name}.`
            };

            // Call API
            const response = await this.callGameEngine([...this.messages, contextMessage]);

            // Parse and dispatch update
            const conversationData = this.parseResponse(response.content);
            this.dispatch(ConversationEvent.update, conversationData);

            // Update messages state
            this.dispatch(UpdateStateEvent.updateMessages, response.messages);

        } catch (error) {
            console.error('Error starting conversation:', error);
            this.dispatch(ConversationEvent.error, 'Failed to start conversation');
        }
    }

    async continueConversation(answer: string) {
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
            this.dispatch(ConversationEvent.error, 'Failed to continue conversation');
        }
    }

    private async callGameEngine(messages: IMessage[]): Promise<{ messages: IMessage[], content: string }> {
        const response = await fetch('/gameEngine', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(messages)
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.statusText}`);
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
    }

    private parseResponse(response: string): ConversationUpdateData {
        try {
            return JSON.parse(response);
        } catch (error) {
            console.error('Error parsing response:', error, 'Original response:', response);
            return {
                type: 'speech',
                source: 'Unknown',
                content: 'I... I\'m not sure what to say.',
                answers: ['Continue', 'Leave']
            };
        }
    }
}