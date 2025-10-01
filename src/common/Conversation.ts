import type { ICharacter, IMessage, IStoryState } from "./interfaces";
import type { DeepReadonly } from "./helpers/types";
import type { State } from "./State";

import {
    EventBus, StateChangeEvent, StateChangeEventsMap, UpdateStateEvent, UpdateStateEventsMap,
    ConversationEvent, ConversationEventsMap, ConversationStartData, ConversationUpdateData,
    AIToAIConversationData
} from "./events";
import { conversationSystemPrompt, characterContext } from "../prompts/conversationPrompts";
import { i18n } from './i18n/i18n';
import { AIGameEngineService } from './services/AIGameEngineService';
import { MAIN_CHARACTER_NAME, COMPANION_DROID_NAME } from './constants';

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
    private aiService: AIGameEngineService;
    private storyState?: DeepReadonly<IStoryState>;
    private isAIToAIConversation = false;
    private aiToAIExchangeCount = 0;
    private currentAISpeaker?: DeepReadonly<ICharacter>;
    private currentAIListener?: DeepReadonly<ICharacter>;
    private fullAIConversation: ConversationUpdateData[] = [];
    private aiConversationSummary?: string;

    constructor(state?: State) {
        super();
        this.aiService = AIGameEngineService.getInstance();

        // Listen for state changes
        this.listen(StateChangeEvent.messages, (messages) => {
            this.messages = [...messages];
        });

        // Listen for story state changes if state is provided
        if (state) {
            this.listen(StateChangeEvent.storyState, (storyState) => {
                this.storyState = storyState;
            });
            // Initialize story state
            this.storyState = state.story;
        }

        // Listen for conversation start requests
        this.listen(ConversationEvent.start, (data: ConversationStartData) => {
            this.startConversation(data.talkingCharacter, data.targetCharacter);
        });

        // Listen for AI-to-AI conversation start
        this.listen(ConversationEvent.startAIToAI, (data: AIToAIConversationData) => {
            this.startAIToAIConversation(data.speaker, data.listener, data.isEavesdropping);
        });

        // Listen for continue conversation
        this.listen(ConversationEvent.continue, (answer: string) => {
            if (this.isAIToAIConversation) {
                this.continueAIToAIConversation();
            } else {
                this.continueConversation(answer);
            }
        });

        // Listen for player interrupt in AI-to-AI conversation
        this.listen(ConversationEvent.playerInterrupt, () => {
            this.handlePlayerInterrupt();
        });

        // Listen for skip conversation
        this.listen(ConversationEvent.skipConversation, () => {
            this.skipAIToAIConversation();
        });
    }

    private buildStoryContext(): string {
        if (!this.storyState?.selectedOrigin) {
            return '';
        }
        
        const origin = this.storyState.selectedOrigin;
        const factionRep = this.storyState.factionReputation || {};
        
        // Build a comprehensive story context
        let context = `\nCurrent Story Context:
- Origin: ${origin.name}${origin.nameES ? ` (${origin.nameES})` : ''}
- Starting Location: ${origin.startingLocation}
- Chapter: ${this.storyState.currentChapter || 1}`;
        
        // Add faction reputation if present
        const factionEntries = Object.entries(factionRep);
        if (factionEntries.length > 0) {
            context += `\n- Faction Relations: ${factionEntries
                .map(([faction, rep]) => `${faction}: ${rep}`)
                .join(', ')}`;
        }
        
        // Add special traits if present
        if (origin.specialTraits && origin.specialTraits.length > 0) {
            context += `\n- Character Traits: ${origin.specialTraits.join(', ')}`;
        }
        
        // Add narrative hooks if present
        if (origin.narrativeHooks && origin.narrativeHooks.length > 0) {
            context += `\n- Narrative Elements: ${origin.narrativeHooks.join(', ')}`;
        }
        
        // Add any completed missions
        if (this.storyState.completedMissions && this.storyState.completedMissions.length > 0) {
            context += `\n- Completed Missions: ${this.storyState.completedMissions.join(', ')}`;
        }
        
        return context;
    }

    private async startConversation(talkingCharacter: DeepReadonly<ICharacter>, targetCharacter: DeepReadonly<ICharacter>) {
        if (this.isLoading) return;

        this.isLoading = true;
        this.currentTarget = targetCharacter.name;
        this.conversationTurnCount = 1; // Reset turn count for new conversation

        try {
            // Build story context
            const storyContext = this.buildStoryContext();
            
            // Create context message with turn count for better conversation flow
            const contextMessage: IMessage = {
                role: 'user',
                content: characterContext(talkingCharacter.name, targetCharacter.name, this.conversationTurnCount)
            };

            // Include system prompt and story context in the context message if this is the first conversation
            let contextContent = contextMessage.content;
            if (this.messages.length === 0) {
                contextContent = conversationSystemPrompt;
                if (storyContext) {
                    contextContent += '\n' + storyContext;
                }
                contextContent += '\n\n' + contextMessage.content;
            } else if (storyContext) {
                // Even for ongoing conversations, include story context
                contextContent = storyContext + '\n\n' + contextMessage.content;
            }

            const fullContextMessage: IMessage = {
                role: 'user',
                content: contextContent
            };

            const messages = [...this.messages, fullContextMessage];

            // Call API
            const response = await this.callAIService(messages);

            // Parse and dispatch update
            const conversationData = this.parseResponse(response.content);
            
            // Only log if content is meaningful
            if (conversationData.content && conversationData.content !== '...' && conversationData.content !== 'Procesando información...') {
                // DEBUG: console.log('[Conversation] AI response:', conversationData.content);
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
            // Build story context for continued conversation
            const storyContext = this.buildStoryContext();
            
            // Add turn count context to help AI know when to end
            const turnContext = this.conversationTurnCount >= 3 
                ? '\n[SYSTEM: This is turn ' + this.conversationTurnCount + '. Consider ending the conversation naturally.]'
                : '';
            
            // Create player message with story context and turn context
            let messageContent = answer;
            if (storyContext) {
                messageContent = storyContext + '\n\nPlayer response: ' + answer;
            }
            messageContent += turnContext;
            
            const playerMessage: IMessage = {
                role: 'user',
                content: messageContent
            };

            // Call AI service (will use mock if enabled)
            const response = await this.callAIService([...this.messages, playerMessage]);

            // Parse and dispatch update
            const conversationData = this.parseResponse(response.content);
            
            // Only log if content is meaningful
            if (conversationData.content && conversationData.content !== '...' && conversationData.content !== 'Procesando información...') {
                // DEBUG: console.log('[Conversation] AI response:', conversationData.content);
            } else {
                console.warn('[Conversation] Received empty or placeholder response from AI');
            }
            
            // If AI returned a non-conversation action (like 'map'), we should execute it
            if (conversationData.action && conversationData.action !== 'speech') {
                // DEBUG: console.log('[Conversation] AI wants to execute action:', conversationData.action);
                // The conversation will show "Fin de la conversación" and close
                // The actual command execution should be handled by the AI controller
                // For now, just log it - the AI controller needs to listen for this
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

    private async callAIService(messages: IMessage[], retry = 0): Promise<{ messages: IMessage[], content: string }> {
        // Check if mock mode is enabled
        const isMockEnabled = localStorage.getItem('ai_mock_enabled') === 'true';
        
        if (isMockEnabled) {
            // Use mock dialogue response
            
            // Extract context from messages
            const lastUserMessage = messages[messages.length - 1];
            const playerChoice = lastUserMessage?.content || '';
            const speaker = MAIN_CHARACTER_NAME;
            const listener = COMPANION_DROID_NAME;  // Assuming Data is the one responding
            
            // Get mock response
            const mockResponse = await this.aiService.requestDialogueResponse(
                speaker,
                listener,
                playerChoice
            );
            
            if (mockResponse.command) {
                return {
                    messages: messages,
                    content: JSON.stringify(mockResponse.command)
                };
            }
            
            // Default mock response if no command
            return {
                messages: messages,
                content: JSON.stringify({
                    type: 'speech',
                    source: 'Data',
                    content: 'Entendido, comandante. Procederé según lo indicado.',
                    answers: []
                })
            };
        }
        
        // Original implementation for real API calls
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
                return this.callAIService(messages, retry + 1);
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
                if (parsed.type === 'speech') {
                    // Validate speech has required fields
                    if (!parsed.source || !parsed.content) {
                        throw new Error('Speech missing source or content');
                    }

                    // Ensure content is a string
                    let contentStr: string;
                    if (typeof parsed.content === 'string') {
                        contentStr = parsed.content;
                    } else if (typeof parsed.content === 'object' && parsed.content !== null) {
                        // Handle object content - try common patterns
                        if ('text' in parsed.content && typeof parsed.content.text === 'string') {
                            contentStr = parsed.content.text;
                        } else if ('message' in parsed.content && typeof parsed.content.message === 'string') {
                            contentStr = parsed.content.message;
                        } else {
                            // Fallback: stringify for debugging
                            console.warn('[Conversation] Content is an object, converting to string:', parsed.content);
                            contentStr = JSON.stringify(parsed.content);
                        }
                    } else {
                        contentStr = String(parsed.content || '');
                    }

                    // Ensure content doesn't exceed max length
                    if (contentStr.length > this.maxMessageLength) {
                        contentStr = contentStr.substring(0, this.maxMessageLength) + '...';
                    }
                    
                    // Check if conversation should end (empty answers array or specific text)
                    const shouldEnd = (parsed.answers && parsed.answers.length === 0) || 
                                    parsed.content.toLowerCase().includes('fin de la conversación');
                    
                    return {
                        type: 'speech',
                        source: parsed.source,
                        content: contentStr,
                        answers: shouldEnd ? [] : (parsed.answers || [i18n.t('common.continue')]),  // Default to 'Continue' if no answers provided
                        action: parsed.action
                    };
                } else if (parsed.type === 'map') {
                    // Map command from AI - this should be handled as a narrative with map action
                    // DEBUG: console.log('[Conversation] AI returned map command, converting to narrative format');
                    return {
                        type: 'speech',
                        source: 'Narrador',
                        content: parsed.description || '',  // No default text - let AI provide it
                        answers: [i18n.t('common.accept'), i18n.t('common.reject')],  // Action buttons
                        action: 'map'  // Pass the map action
                    };
                } else if (parsed.type === 'movement' || parsed.type === 'attack' ||
                          parsed.type === 'character' || parsed.type === 'item') {
                    // AI is taking a non-conversation action - end the conversation
                    // DEBUG: console.log('[Conversation] AI returned non-speech command:', parsed.type);
                    // DEBUG: console.log('[Conversation] Ending conversation as AI wants to perform action');
                    return {
                        type: 'speech',
                        source: this.currentTarget || 'AI',
                        content: 'Fin de la conversación.',
                        answers: [],  // Empty answers will trigger conversation end
                        action: parsed.type
                    };
                } else if (parsed.type === 'error') {
                    // Handle error responses from AI service
                    console.error('[Conversation] AI returned error:', parsed);
                    return {
                        type: 'speech',
                        source: this.currentTarget || 'System',
                        content: parsed.message || parsed.error || 'An error occurred. Please try again.',
                        answers: [i18n.t('common.retry'), i18n.t('common.cancel')],
                        action: undefined
                    };
                } else {
                    // Unknown type - still try to use what we have but log warning
                    console.warn('[Conversation] Unknown command type:', parsed.type);
                    // Ensure content is a string for unknown types
                    let contentStr = 'No response available';
                    if (parsed.content) {
                        if (typeof parsed.content === 'string') {
                            contentStr = parsed.content;
                        } else {
                            console.warn('[Conversation] Unknown type with object content:', parsed);
                            contentStr = JSON.stringify(parsed.content);
                        }
                    }

                    return {
                        type: 'speech',
                        source: parsed.source || this.currentTarget || 'Unknown',
                        content: contentStr,
                        answers: parsed.answers || ['Continue'],
                        action: parsed.action
                    };
                }
            }
            
            // No JSON found - treat the response as narrative text
            // This happens when the AI responds with story text instead of structured JSON
            if (response && response.trim().length > 0) {
                // DEBUG: console.log('[Conversation] No JSON found, treating as narrative text');
                
                // Check if it's a narrative response (contains story elements)
                const isNarrative = response.includes('alarmas') || response.includes('nave') || 
                                  response.includes('espacio') || response.includes('soldado');
                
                if (isNarrative) {
                    // It's a narrative response, present it as narrator
                    return {
                        type: 'speech',
                        source: i18n.t('conversation.narrator'),
                        content: response.substring(0, this.maxMessageLength),
                        answers: [i18n.t('common.continue')],  // Simplified default
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

    private async startAIToAIConversation(speaker: DeepReadonly<ICharacter>, listener: DeepReadonly<ICharacter>, isEavesdropping: boolean) {
        if (this.isLoading) return;

        this.isLoading = true;
        this.isAIToAIConversation = true;
        this.aiToAIExchangeCount = 0;
        this.currentAISpeaker = speaker;
        this.currentAIListener = listener;
        this.fullAIConversation = [];
        this.aiConversationSummary = undefined;

        try {
            // Build story context
            const storyContext = this.buildStoryContext();

            // Request the full conversation from AI
            const fullConversationPrompt = this.buildFullAIConversationPrompt(speaker, listener, storyContext);

            const messages: IMessage[] = [{
                role: 'user',
                content: fullConversationPrompt
            }];

            // Call API to get the full conversation
            const response = await this.callAIService(messages);

            // Parse the full conversation response
            const fullConversation = this.parseFullAIConversation(response.content, speaker.name, listener.name);

            if (!fullConversation || fullConversation.exchanges.length === 0) {
                throw new Error('Failed to generate AI conversation');
            }

            this.fullAIConversation = fullConversation.exchanges;
            this.aiConversationSummary = fullConversation.summary;

            // Update messages state
            this.dispatch(UpdateStateEvent.updateMessages, response.messages);

            // Show the first exchange
            this.showNextAIExchange(isEavesdropping);

        } catch (error) {
            console.error('Error starting AI-to-AI conversation:', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to start AI-to-AI conversation';
            this.dispatch(ConversationEvent.error, errorMessage);
            this.isAIToAIConversation = false;
        } finally {
            this.isLoading = false;
        }
    }

    private showNextAIExchange(isEavesdropping = false) {
        if (this.aiToAIExchangeCount >= this.fullAIConversation.length) {
            // Conversation is complete
            this.endAIToAIConversation();
            return;
        }

        const exchange = this.fullAIConversation[this.aiToAIExchangeCount];
        if (!exchange) {
            // Safety check
            this.endAIToAIConversation();
            return;
        }
        this.aiToAIExchangeCount++;

        // Dispatch AI exchange event
        this.dispatch(ConversationEvent.aiExchange, {
            speaker: exchange.source,
            listener: exchange.target || '',
            content: exchange.content,
            exchangeNumber: this.aiToAIExchangeCount,
            maxExchanges: this.fullAIConversation.length,
            isLastExchange: this.aiToAIExchangeCount === this.fullAIConversation.length
        });

        // Update conversation UI with next/skip buttons
        const isLastExchange = this.aiToAIExchangeCount === this.fullAIConversation.length;
        let answers: string[];

        if (isLastExchange) {
            answers = [];
        } else if (isEavesdropping) {
            answers = [i18n.t('conversation.next'), i18n.t('conversation.interrupt'), i18n.t('conversation.skip')];
        } else {
            answers = [i18n.t('conversation.next'), i18n.t('conversation.skip')];
        }

        // Create a properly typed update data
        const updateData: ConversationUpdateData = {
            type: exchange.type,
            source: exchange.source,
            content: exchange.content,
            answers: answers,
            action: exchange.action,
            actionData: exchange.actionData,
            target: exchange.target
        };

        this.dispatch(ConversationEvent.update, updateData);
    }

    private async continueAIToAIConversation() {
        // For pre-generated conversations, just show the next exchange
        this.showNextAIExchange(true);
    }

    private handlePlayerInterrupt() {
        // Player interrupts the AI-to-AI conversation
        this.isAIToAIConversation = false;
        this.aiToAIExchangeCount = 0;

        // Convert to normal conversation mode with the player
        // The player character now joins the conversation
        this.dispatch(ConversationEvent.update, {
            type: 'speech',
            source: MAIN_CHARACTER_NAME,
            content: 'Disculpen la interrupción...',
            answers: ['¿De qué están hablando?', 'Necesito hablar con ustedes', 'Continúen, solo escucho']
        });
    }

    private async skipAIToAIConversation() {
        // Skip to the end of the AI-to-AI conversation
        this.isAIToAIConversation = false;
        this.aiToAIExchangeCount = 0;

        // Show the summary if available
        const summaryContent = this.aiConversationSummary ||
            `${this.currentAISpeaker?.name} y ${this.currentAIListener?.name} terminaron su conversación.`;

        this.dispatch(ConversationEvent.update, {
            type: 'speech',
            source: i18n.t('conversation.narrator'),
            content: summaryContent,
            answers: []
        });
    }

    private endAIToAIConversation() {
        this.isAIToAIConversation = false;
        this.aiToAIExchangeCount = 0;
        this.fullAIConversation = [];

        // Show conversation end message
        this.dispatch(ConversationEvent.update, {
            type: 'speech',
            source: i18n.t('conversation.narrator'),
            content: 'La conversación ha terminado.',
            answers: []
        });
    }

    private buildFullAIConversationPrompt(speaker: DeepReadonly<ICharacter>, listener: DeepReadonly<ICharacter>, storyContext?: string): string {
        const prompt = `Generate a complete conversation between two AI characters.

## IMPORTANT: FULL CONVERSATION GENERATION

You must generate the ENTIRE conversation at once with all exchanges between the two characters.

### Characters:
- Speaker: ${speaker.name} (${speaker.controller === 'ai1' ? 'Allied' : 'Enemy'})
- Listener: ${listener.name} (${listener.controller === 'ai1' ? 'Allied' : 'Enemy'})

${storyContext ? `### Story Context:\n${storyContext}\n` : ''}

### Requirements:
1. Generate 3-5 complete exchanges between the characters
2. Each character should respond naturally to the previous statement
3. The conversation should reveal tactical information, character motivations, or advance the story
4. Keep each exchange concise but meaningful
5. All dialogue must be in Spanish
6. End with a natural conclusion
7. Include a brief summary of what was discussed

### Response Format:
Return a JSON object with this structure:
{
  "exchanges": [
    {
      "type": "speech",
      "source": "Character Name",
      "content": "Dialogue in Spanish",
      "answers": []
    },
    // ... more exchanges
  ],
  "summary": "Brief summary in Spanish of what was discussed (for skip functionality)"
}

### Example:
{
  "exchanges": [
    {
      "type": "speech",
      "source": "${speaker.name}",
      "content": "Hemos detectado movimiento en el sector oeste. ¿Cuál es tu posición?",
      "answers": []
    },
    {
      "type": "speech",
      "source": "${listener.name}",
      "content": "Estoy en el punto de observación norte. Confirmo actividad hostil, tres unidades acercándose.",
      "answers": []
    },
    {
      "type": "speech",
      "source": "${speaker.name}",
      "content": "Entendido. Prepara la emboscada en el corredor principal. Yo los guiaré hacia ti.",
      "answers": []
    },
    {
      "type": "speech",
      "source": "${listener.name}",
      "content": "En posición. Espero tu señal.",
      "answers": []
    }
  ],
  "summary": "Los soldados coordinaron una emboscada para los intrusos detectados en el sector oeste."
}

Now generate the full conversation between ${speaker.name} and ${listener.name}:`;

        return prompt;
    }

    private parseFullAIConversation(response: string, speakerName: string, listenerName: string): { exchanges: ConversationUpdateData[], summary: string } | null {
        try {
            // Try to extract JSON from the response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.error('[Conversation] No JSON found in AI response');
                return null;
            }

            const parsed = JSON.parse(jsonMatch[0]);

            if (!parsed.exchanges || !Array.isArray(parsed.exchanges)) {
                console.error('[Conversation] Invalid conversation format - missing exchanges array');
                return null;
            }

            // Validate and format each exchange
            const exchanges: ConversationUpdateData[] = parsed.exchanges.map((exchange: {
                source?: string;
                content?: unknown;
                target?: string;
            }) => ({
                type: 'speech' as const,
                source: exchange.source || speakerName,
                content: String(exchange.content || ''),
                answers: [],  // AI-to-AI conversations don't have player answers
                target: exchange.target
            }));

            const summary = parsed.summary || `Conversación entre ${speakerName} y ${listenerName}.`;

            return { exchanges, summary };

        } catch (error) {
            console.error('[Conversation] Error parsing full AI conversation:', error);

            // Fallback: create a simple exchange
            return {
                exchanges: [
                    {
                        type: 'speech',
                        source: speakerName,
                        content: '¿Qué está pasando aquí?',
                        answers: []
                    },
                    {
                        type: 'speech',
                        source: listenerName,
                        content: 'Estamos investigando la situación.',
                        answers: []
                    }
                ],
                summary: `${speakerName} y ${listenerName} discutieron la situación actual.`
            };
        }
    }

}