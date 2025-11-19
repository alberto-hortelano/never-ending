/**
 * Refactored AIGameEngineService that uses the plugin system
 * This can replace the original AIGameEngineService.ts once testing is complete
 */

import type { IMessage, IStoryState, IOriginStory, Language } from '../interfaces';
import { AICommand } from './AICommandParser';
import { AIBrowserCacheService, type AIRequest, type AIResponse } from './AIBrowserCacheService';
import { AIMockService } from './AIMockService';
import type { AIGameContext } from './AIContextBuilder';
import { MAIN_CHARACTER_NAME, LANGUAGE_NAMES, LANGUAGE_INSTRUCTIONS } from '../constants';

// Import plugin system
import { AIProviderManager } from '../ai-plugins/AIProviderManager';
import { IAIRequestOptions } from '../ai-plugins/types';

export interface AIGameEngineResponse {
    messages: IMessage[];
    command: AICommand | null;
}

// Define a specific response type for game engine
interface GameEngineResponse extends AIResponse {
    messages: IMessage[];
    content: string;
}

// Define a specific request type for game engine
interface GameEngineRequest extends AIRequest {
    messages: IMessage[];
    endpoint: string;
}

// Use unified AIGameContext from AIContextBuilder
export type AIActionContext = AIGameContext;

/**
 * Refactored AI Game Engine Service using the plugin system
 */
export class AIGameEngineService {
    private static instance: AIGameEngineService;
    private readonly maxRetries = 3;
    private readonly retryDelay = 1000;
    private providerManager: AIProviderManager;
    private usePluginSystem: boolean = true; // Feature flag to switch between old and new system

    private constructor() {
        this.providerManager = AIProviderManager.getInstance();
        this.initializeProviders();
    }

    /**
     * Initialize default providers
     */
    private async initializeProviders(): Promise<void> {
        try {
            // The providers auto-register themselves when imported
            // We just need to ensure they're loaded
            await import('../ai-plugins/providers/MockProvider');
            await import('../ai-plugins/providers/ClaudeProvider');
            await import('../ai-plugins/providers/OpenAIProvider');

            console.log('[AIGameEngineService] Providers initialized');
        } catch (error) {
            console.error('[AIGameEngineService] Failed to initialize providers:', error);
        }
    }

    public static getInstance(): AIGameEngineService {
        if (!AIGameEngineService.instance) {
            AIGameEngineService.instance = new AIGameEngineService();
        }
        return AIGameEngineService.instance;
    }

    /**
     * Switch to a specific provider
     */
    public async switchProvider(providerId: string): Promise<void> {
        await this.providerManager.switchProvider(providerId);
        console.log(`[AIGameEngineService] Switched to provider: ${providerId}`);
    }

    /**
     * Get current provider status
     */
    public getProviderStatuses(): Record<string, unknown> {
        return this.providerManager.getAllStatuses();
    }

    /**
     * Enable/disable plugin system (for backward compatibility)
     */
    public setUsePluginSystem(use: boolean): void {
        this.usePluginSystem = use;
        console.log(`[AIGameEngineService] Plugin system ${use ? 'enabled' : 'disabled'}`);
    }

    /**
     * Request map generation
     */
    public async requestMapGeneration(
        missionType: string,
        narrativeContext: string,
        storyState?: IStoryState
    ): Promise<unknown> {
        // Check if using plugin system
        if (!this.usePluginSystem) {
            return this.legacyRequestMapGeneration(missionType, narrativeContext, storyState);
        }

        const messages: IMessage[] = [];

        // Build map generation prompt
        const originContext = storyState?.selectedOrigin ?
            `Origin: ${storyState.selectedOrigin.name}\nLocation Type: ${storyState.selectedOrigin.startingLocation}` : '';

        messages.push({
            role: 'user',
            content: `Generate a map for:
Mission Type: ${missionType}
Narrative Context: ${narrativeContext}
${originContext}

Generate a tactical map with buildings, rooms, and initial character positions.

Response format:
{"type": "map", "palette": {...}, "buildings": [...], "characters": [...]}`
        });

        try {
            // Use plugin system
            const provider = await this.providerManager.getActiveProvider();
            const response = await provider.sendMessage(messages);
            return this.parseAIResponse(response.content);
        } catch (error) {
            console.error('Failed to generate map:', error);
            return null;
        }
    }

    /**
     * Request AI action
     */
    public async requestAIAction(
        context: AIActionContext,
        systemPrompt?: string,
        storyState?: IStoryState,
        language: Language = 'en'
    ): Promise<AIGameEngineResponse> {
        // Check if mock mode is enabled
        const isMockEnabled = localStorage.getItem('ai_mock_enabled') === 'true';

        // If mock enabled, prioritize mock provider
        if (isMockEnabled && this.usePluginSystem) {
            try {
                await this.providerManager.switchProvider('mock');
            } catch (error) {
                console.warn('[AIGameEngineService] Failed to switch to mock provider:', error);
                // Fall back to legacy mock service
                const gameContext = context as unknown as AIGameContext;
                return AIMockService.getInstance().requestAIAction(gameContext);
            }
        } else if (isMockEnabled && !this.usePluginSystem) {
            // Use legacy mock service
            const gameContext = context as unknown as AIGameContext;
            return AIMockService.getInstance().requestAIAction(gameContext);
        }

        const startTime = Date.now();

        try {
            if (!this.usePluginSystem) {
                // Use legacy system
                return this.legacyRequestAIAction(context, systemPrompt, storyState, language);
            }

            // Build messages from context
            const messages = this.buildMessagesFromContext(context, language, storyState);

            // Use plugin system
            const provider = await this.providerManager.getActiveProvider();
            const options: IAIRequestOptions = {
                systemPrompt,
                cache: true
            };

            const response = await provider.sendMessage(messages, options);
            const command = this.parseAIResponse(response.content);

            return {
                messages: messages,
                command: command
            };
        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`[AI] Request failed (${duration}ms):`, error);
            return {
                messages: [],
                command: null
            };
        }
    }

    /**
     * Build messages from context
     */
    private buildMessagesFromContext(
        context: AIActionContext,
        language: Language,
        storyState?: IStoryState
    ): IMessage[] {
        const messages: IMessage[] = [];

        // Build context message
        let contextMessage = `Current game context:
Turn: ${context.turn || 0}
Language: ${LANGUAGE_NAMES[language]}
`;

        if (context.currentCharacter) {
            contextMessage += `\nCharacter: ${context.currentCharacter.name}`;
            if (context.currentCharacter.position) {
                contextMessage += `\nPosition: (${context.currentCharacter.position.x}, ${context.currentCharacter.position.y})`;
            }
        }

        if (context.visibleCharacters && context.visibleCharacters.length > 0) {
            contextMessage += `\nVisible characters: ${context.visibleCharacters.length}`;
        }

        if (context.charactersInConversationRange && context.charactersInConversationRange.length > 0) {
            contextMessage += `\nCharacters in conversation range: ${context.charactersInConversationRange.length}`;
        }

        if (storyState) {
            contextMessage += `\n\nStory context:`;
            if (storyState.selectedOrigin) {
                contextMessage += `\nOrigin: ${storyState.selectedOrigin.name}`;
            }
            if (storyState.currentChapter) {
                contextMessage += `\nChapter: ${storyState.currentChapter}`;
            }
        }

        // Add conversation history if present
        if (context.conversationHistory && context.conversationHistory.length > 0) {
            contextMessage += `\n\nRecent conversation:`;
            // Add recent conversation exchanges
        }

        messages.push({
            role: 'user',
            content: contextMessage + '\n\nWhat is the next AI action?'
        });

        return messages;
    }

    /**
     * Request story initialization
     */
    public async requestStoryInitialization(
        origin: IOriginStory,
        storyState: IStoryState,
        language: Language = 'en'
    ): Promise<{ commands: AICommand[], narrative?: string }> {
        // Check if mock mode is enabled
        const isMockEnabled = localStorage.getItem('ai_mock_enabled') === 'true';

        if (isMockEnabled && !this.usePluginSystem) {
            return AIMockService.getInstance().requestStoryInitialization();
        }

        if (isMockEnabled && this.usePluginSystem) {
            try {
                await this.providerManager.switchProvider('mock');
            } catch (error) {
                console.warn('[AIGameEngineService] Failed to switch to mock provider:', error);
                return AIMockService.getInstance().requestStoryInitialization();
            }
        }

        const messages: IMessage[] = [];

        // Build mission context if available
        let missionContext = '';
        if (storyState.storyPlan) {
            const firstAct = storyState.storyPlan.acts[0];
            const firstMission = firstAct?.missions[0];
            if (firstMission) {
                missionContext = `

## STORY MISSION CONTEXT
First Mission: ${firstMission.name}
Mission Type: ${firstMission.type}
Primary Objective: ${firstMission.objectives[0]?.description || 'Explore the area'}
Environment: ${firstMission.mapContext?.environment || 'unknown'}`;
            }
        }

        // Build the initialization request
        const initRequest = `
# STORY INITIALIZATION REQUEST

You are initializing a new game session for "Never Ending". Generate the initial map, characters, and narrative setup based on the selected origin story.

## SELECTED ORIGIN
Name: ${origin.nameES} (${origin.name})
Description: ${origin.descriptionES}
Starting Location Type: ${origin.startingLocation}
Companion: ${origin.startingCompanion?.name || 'None'}
Special Traits: ${origin.specialTraits.join(', ')}
Faction Relations: ${Object.entries(origin.factionRelations).map(([f, v]) => `${f}: ${v}`).join(', ')}${missionContext}

## REQUIRED INITIALIZATION

Generate the following in order:

1. **INITIAL NARRATIVE**
   - Create an opening scenario that reflects the origin's theme
   - Set up an immediate objective or situation for the player
   - ${LANGUAGE_INSTRUCTIONS[language]}

2. **MAP GENERATION**
   - Create a tactical map appropriate for "${origin.startingLocation}"
   - Include buildings and rooms
   - The map should support the narrative of ${origin.nameES}

3. **CHARACTER PLACEMENT**
   - You MUST include the main character "${MAIN_CHARACTER_NAME}" in your character list
   ${origin.startingCompanion ? `- You MUST include the companion "${origin.startingCompanion.name}" in your character list
   - Place ${MAIN_CHARACTER_NAME} and ${origin.startingCompanion.name} in logical starting positions` : ''}
   - Generate 2-4 additional NPCs or enemies appropriate to the origin story
   - Place all characters strategically on the map with valid positions. All the building names must exist in the map.

## RESPONSE FORMAT

Provide your response as a JSON object with this structure:
{
  "narrative": "Opening story text in ${LANGUAGE_NAMES[language]}",
  "commands": [
    {"command": "map", ...},
    {"command": "character", ...}
  ]
}`;

        messages.push({
            role: 'user',
            content: initRequest
        });

        try {
            if (!this.usePluginSystem) {
                // Use legacy system
                const response = await this.callGameEngine(messages);
                const parsed = this.parseAIResponse(response.content);
                if (parsed && typeof parsed === 'object' && 'commands' in parsed) {
                    return parsed as unknown as { commands: AICommand[], narrative?: string };
                }
                return { commands: parsed ? [parsed] : [] };
            }

            // Use plugin system
            const provider = await this.providerManager.getActiveProvider();
            const response = await provider.sendMessage(messages);
            const parsed = this.parseAIResponse(response.content);

            if (parsed && typeof parsed === 'object' && 'commands' in parsed) {
                return parsed as unknown as { commands: AICommand[], narrative?: string };
            }

            return { commands: parsed ? [parsed] : [] };
        } catch (error) {
            console.error('[AIGameEngineService] Story initialization failed:', error);
            return { commands: [] };
        }
    }

    /**
     * Parse AI response
     */
    private parseAIResponse(response: string): AICommand | null {
        try {
            // Try to extract JSON from the response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return parsed as AICommand;
            }

            // If no JSON found, try to parse the entire response
            const parsed = JSON.parse(response);
            return parsed as AICommand;
        } catch (error) {
            console.error('[AI GameEngine] Failed to parse AI response:', error);
            console.error('[AI GameEngine] Response was:', response);
            return null;
        }
    }

    // ========== LEGACY METHODS (for backward compatibility) ==========

    private async legacyRequestMapGeneration(
        missionType: string,
        narrativeContext: string,
        storyState?: IStoryState
    ): Promise<unknown> {
        const messages: IMessage[] = [];

        const originContext = storyState?.selectedOrigin ?
            `Origin: ${storyState.selectedOrigin.name}\nLocation Type: ${storyState.selectedOrigin.startingLocation}` : '';

        messages.push({
            role: 'user',
            content: `Generate a map for:
Mission Type: ${missionType}
Narrative Context: ${narrativeContext}
${originContext}

Generate a tactical map with buildings, rooms, and initial character positions.

Response format:
{"type": "map", "palette": {...}, "buildings": [...], "characters": [...]}`
        });

        try {
            const response = await this.callGameEngine(messages);
            return this.parseAIResponse(response.content);
        } catch (error) {
            console.error('Failed to generate map:', error);
            return null;
        }
    }

    private async legacyRequestAIAction(
        context: AIActionContext,
        systemPrompt?: string,
        storyState?: IStoryState,
        language: Language = 'en'
    ): Promise<AIGameEngineResponse> {
        const startTime = Date.now();

        try {
            const response = await this.callGameEngine({
                context,
                language,
                storyState,
                systemPrompt
            });

            const command = this.parseAIResponse(response.content);

            return {
                messages: response.messages,
                command: command
            };
        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`[AI] Request failed (${duration}ms):`, error);
            return {
                messages: [],
                command: null
            };
        }
    }

    private async callGameEngine(
        data: { context?: AIActionContext; language?: string; storyState?: IStoryState; systemPrompt?: string } | IMessage[],
        retry = 0
    ): Promise<{ messages: IMessage[], content: string }> {

        // Check if this is the new format (context object) or legacy format (messages array)
        const isLegacyFormat = Array.isArray(data);

        // Check cache first
        const cacheKey: GameEngineRequest = isLegacyFormat
            ? { messages: data as IMessage[], endpoint: '/gameEngine' }
            : { messages: [], endpoint: '/gameEngine' };
        const cachedResponse = AIBrowserCacheService.getCachedResponse<GameEngineRequest, GameEngineResponse>(cacheKey);
        if (cachedResponse) {
            console.log('[AIGameEngineService] Using cached response');
            return cachedResponse;
        }

        try {
            const response = await fetch('/gameEngine', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('[AIGameEngineService] Server error:', errorData);
                throw new Error(errorData.error || `API request failed: ${response.statusText}`);
            }

            const responseData = await response.json();

            // Check if it's a direct command response
            if (responseData.type) {
                const result: GameEngineResponse = {
                    messages: [],
                    content: JSON.stringify(responseData)
                };
                AIBrowserCacheService.cacheResponse<GameEngineRequest, GameEngineResponse>(cacheKey, result);
                return result;
            }

            // Otherwise treat as message array
            const updatedMessages: IMessage[] = responseData;
            const lastMessage = updatedMessages[updatedMessages.length - 1];
            if (!lastMessage || lastMessage.role !== 'assistant') {
                const result: GameEngineResponse = {
                    messages: [],
                    content: JSON.stringify(responseData)
                };
                AIBrowserCacheService.cacheResponse<GameEngineRequest, GameEngineResponse>(cacheKey, result);
                return result;
            }

            const result: GameEngineResponse = {
                messages: updatedMessages,
                content: lastMessage.content
            };
            AIBrowserCacheService.cacheResponse<GameEngineRequest, GameEngineResponse>(cacheKey, result);
            return result;
        } catch (error) {
            console.error('[AI GameEngine] Error in callGameEngine:', error);

            const errorMessage = (error as Error).message || '';
            const isOverloadError = errorMessage.includes('529') || errorMessage.includes('overloaded');

            if (retry < this.maxRetries) {
                const baseDelay = isOverloadError ? 5000 : this.retryDelay;
                const backoffDelay = baseDelay * Math.pow(2, retry);
                await new Promise(resolve => setTimeout(resolve, backoffDelay));
                return this.callGameEngine(data, retry + 1);
            }
            throw error;
        }
    }
}