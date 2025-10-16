import type { IMessage, IStoryState, IOriginStory, IValidationResult } from '../interfaces';
import { AICommand } from './AICommandParser';
import { AIBrowserCacheService, type AIRequest, type AIResponse } from './AIBrowserCacheService';
import { ObjectValidator } from './ObjectValidator';
import { StoryPlanValidator } from './StoryPlanValidator';
import { AIMockService } from './AIMockService';
import type { AIGameContext } from './AIContextBuilder';
import { MAIN_CHARACTER_NAME, LANGUAGE_NAMES, LANGUAGE_INSTRUCTIONS, type LanguageCode } from '../constants';
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

// Use types from AIGameContext

// Use unified AIGameContext from AIContextBuilder
export type AIActionContext = AIGameContext;

export class AIGameEngineService {
    private static instance: AIGameEngineService;
    private readonly maxRetries = 3;
    private readonly retryDelay = 1000;

    private constructor() {
        // Narrative prompt is now generated dynamically based on language
    }

    public static getInstance(): AIGameEngineService {
        if (!AIGameEngineService.instance) {
            AIGameEngineService.instance = new AIGameEngineService();
        }
        return AIGameEngineService.instance;
    }

    public async requestMapGeneration(
        missionType: string,
        narrativeContext: string,
        storyState?: IStoryState
    ): Promise<unknown> {
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
            const response = await this.callGameEngine(messages);
            return this.parseAIResponse(response.content);
        } catch (error) {
            console.error('Failed to generate map:', error);
            return null;
        }
    }


    public async requestAIAction(
        context: AIActionContext,
        systemPrompt?: string,
        storyState?: IStoryState,
        language: LanguageCode = 'en'
    ): Promise<AIGameEngineResponse> {
        // Check if mock mode is enabled
        const isMockEnabled = localStorage.getItem('ai_mock_enabled') === 'true';
        if (isMockEnabled) {
            // Convert AIActionContext to GameContext for the mock service
            const gameContext = context as unknown as AIGameContext;
            return AIMockService.getInstance().requestAIAction(gameContext);
        }

        const startTime = Date.now();

        try {
            // Send context to server, let it build the prompts
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

            // console.log('[AIGameEngineService] Response status:', response.status, response.statusText);

            if (!response.ok) {
                const errorData = await response.json();
                console.error('[AIGameEngineService] Server error:', errorData);
                throw new Error(errorData.error || `API request failed: ${response.statusText}`);
            }

            // The server might return either:
            // 1. A direct JSON command object
            // 2. An array of messages with the command in the last message
            const responseData = await response.json();
            // console.log('[AIGameEngineService] Response data type:', Array.isArray(responseData) ? 'array' : typeof responseData);
            // console.log('[AIGameEngineService] Response has type field:', !!responseData.type);
            // Check if it's a direct command response
            if (responseData.type) {
                const result: GameEngineResponse = {
                    messages: [],
                    content: JSON.stringify(responseData)
                };
                // Cache the successful response
                AIBrowserCacheService.cacheResponse<GameEngineRequest, GameEngineResponse>(cacheKey, result);
                return result;
            }

            // Otherwise treat as message array
            const updatedMessages: IMessage[] = responseData;
            const lastMessage = updatedMessages[updatedMessages.length - 1];
            if (!lastMessage || lastMessage.role !== 'assistant') {
                // If not messages format, assume it's a direct response
                const result: GameEngineResponse = {
                    messages: [],
                    content: JSON.stringify(responseData)
                };
                // Cache the successful response
                AIBrowserCacheService.cacheResponse<GameEngineRequest, GameEngineResponse>(cacheKey, result);
                return result;
            }

            const result: GameEngineResponse = {
                messages: updatedMessages,
                content: lastMessage.content
            };
            // Cache the successful response
            AIBrowserCacheService.cacheResponse<GameEngineRequest, GameEngineResponse>(cacheKey, result);
            return result;
        } catch (error) {
            console.error('[AI GameEngine] Error in callGameEngine:', error);

            // Check if it's an overload error (529)
            const errorMessage = (error as Error).message || '';
            const isOverloadError = errorMessage.includes('529') || errorMessage.includes('overloaded');

            if (retry < this.maxRetries) {
                // Calculate exponential backoff delay
                // For overload errors, use longer delays
                const baseDelay = isOverloadError ? 5000 : this.retryDelay;
                const backoffDelay = baseDelay * Math.pow(2, retry);
                await new Promise(resolve => setTimeout(resolve, backoffDelay));
                return this.callGameEngine(data, retry + 1);
            }
            throw error;
        }
    }

    private parseAIResponse(response: string): AICommand | null {
        try {
            // Try to extract JSON from the response
            // AI might include explanation text around the JSON
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

    public async requestStoryInitialization(
        origin: IOriginStory,
        storyState: IStoryState,
        language: LanguageCode = 'en'
    ): Promise<{ commands: AICommand[], narrative?: string }> {
        // Check if mock mode is enabled
        const isMockEnabled = localStorage.getItem('ai_mock_enabled') === 'true';
        if (isMockEnabled) {
            return AIMockService.getInstance().requestStoryInitialization();
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

Return a JSON object with:
{
  "narrative": "Initial story text in ${LANGUAGE_NAMES[language]} to display to the player",
  "commands": [
    {"type": "map", "palette": {...}, "buildings": [...]},
    {"type": "character", "characters": [...]},
    {"type": "speech", "source": "Narrador", "content": "..."}
  ]
}

## MAP COMMAND FORMAT
{
  "type": "map",
  "palette": {
    "terrain": "#1a1a2e"  // Background color
  },
  "buildings": [
    {
      "name": "Damaged Cruiser",
      "rooms": [
        {"name": "Bridge", "size": "medium"},  // size: small|medium|big
        {"name": "Cargo Bay", "size": "big"},
        {"name": "Engineering", "size": "medium"}
      ],
      "position": {"x": 25, "y": 25},  // Building position on map
      "palette": {
        "floor": "#2d2d2d",
        "innerWalls": "#4a4a4a",
        "outerWalls": "#6b6b6b"
      }
    }
  ],
  "characters": [
    // Characters to spawn with the map (same format as CHARACTER command)
  ]
}

## CHARACTER COMMAND FORMAT
{
  "type": "character",
  "characters": [
    {
      "name": "${MAIN_CHARACTER_NAME}",  // REQUIRED - main character
      "race": "human",  // REQUIRED: human|alien|robot
      "description": "The main protagonist",  // REQUIRED
      "faction": "player",  // REQUIRED: player|enemy|neutral
      "speed": "medium",  // REQUIRED: slow|medium|fast
      "orientation": "bottom",  // REQUIRED: top|right|bottom|left
      "location": "Bridge",  // REQUIRED: room name or character name
      "palette": {
        "skin": "#d7a55f",
        "helmet": "white",
        "suit": "white"
      }
    }${origin.startingCompanion ? `,
    {
      "name": "${origin.startingCompanion.name}",  // REQUIRED - companion
      "race": "${origin.startingCompanion.type}",
      "description": "${origin.startingCompanion.description}",
      "faction": "player",  // REQUIRED
      "speed": "medium",  // REQUIRED
      "orientation": "bottom",  // REQUIRED
      "location": "${MAIN_CHARACTER_NAME}",  // Place near player
      "palette": {
        "skin": "yellow",
        "helmet": "gold",
        "suit": "gold"
      }
    }` : ''},
    {
      "name": "Enemy Guard",
      "race": "human",  // REQUIRED
      "description": "Hostile guard",  // REQUIRED
      "faction": "enemy",  // REQUIRED
      "speed": "medium",  // REQUIRED
      "orientation": "left",  // REQUIRED
      "location": "Cargo Bay",  // REQUIRED
      "palette": {
        "skin": "#8b4513",
        "helmet": "darkred",
        "suit": "black"
      }
    }
  ]
}

## SPEECH/NARRATIVE COMMAND FORMAT
{
  "type": "speech",
  "source": "Narrator",  // or character name
  "content": "The narrative text or dialogue in ${LANGUAGE_NAMES[language]}",  // REQUIRED
  "answers": ["Option 1", "Option 2", "Option 3"]  // Optional, omit or use [] to end conversation
}

Remember: ALL narrative text, descriptions, objectives, and dialogue MUST be in ${LANGUAGE_NAMES[language]}.`;

        messages.push({
            role: 'user',
            content: initRequest
        });


        try {
            const response = await this.callGameEngine(messages);

            const parsedResponse = this.parseAIResponse(response.content);

            // Handle both single command and array of commands
            let commands: AICommand[] = [];
            let narrative: string | undefined;

            if (parsedResponse) {
                // Check if response has commands array
                if ('commands' in parsedResponse && Array.isArray(parsedResponse.commands)) {
                    commands = parsedResponse.commands;
                    narrative = parsedResponse.narrative as string | undefined;
                } else if (parsedResponse.type) {
                    // Single command response
                    commands = [parsedResponse];
                }
            }

            return { commands, narrative };
        } catch (error) {
            console.error('[AIGameEngineService] Failed to initialize story:', error);
            console.error('[AIGameEngineService] Error details:', {
                message: (error as Error).message,
                stack: (error as Error).stack
            });
            return { commands: [] };
        }
    }

    public async requestDialogueResponse(
        speaker: string,
        listener: string,
        playerChoice: string,
        context?: AIActionContext,
        storyState?: IStoryState,
        language: LanguageCode = 'en'
    ): Promise<AIGameEngineResponse> {
        // Check if mock mode is enabled
        const isMockEnabled = localStorage.getItem('ai_mock_enabled') === 'true';
        if (isMockEnabled) {
            // Convert AIActionContext to GameContext for the mock service
            return AIMockService.getInstance().requestDialogueResponse(speaker, listener, playerChoice);
        }
        const messages: IMessage[] = [];

        // Add context
        // Build comprehensive story context for dialogue
        let storyContext = '';
        if (storyState?.selectedOrigin) {
            const faction = context?.npcFaction || 'unknown';
            const reputation = storyState.factionReputation?.[faction] || 0;
            storyContext = `
Story Context:
- Player Origin: ${storyState.selectedOrigin.nameES}
- Faction Reputation with ${faction}: ${reputation}
- Story Flags: ${Array.from(storyState.storyFlags || []).join(', ')}
`;

            // Add mission context if available
            if (context?.currentMission) {
                storyContext += `
Current Mission: ${context.currentMission.name}
Mission Type: ${context.currentMission.type}
Objectives: ${context.currentMission.objectives.join(', ')}
`;
            }
        }

        // Build conversation history context
        let conversationContext = '';
        if (context?.conversationHistory && context.conversationHistory.length > 0) {
            conversationContext = `
Previous conversation exchanges:
${context.conversationHistory.map(ex => `${ex.speaker}: "${ex.content}"`).join('\n')}
`;
        }

        messages.push({
            role: 'user',
            content: `${speaker} is talking to ${listener}. The player (${speaker}) said: "${playerChoice}"
${storyContext}
${conversationContext}
Respond as ${listener} with a speech message in ${LANGUAGE_NAMES[language]}. Remember the conversation context and maintain continuity.

Context:
${context ? JSON.stringify(context, null, 2) : 'No additional context'}

Response format:
{"type": "speech", "source": "${listener}", "content": "response in ${LANGUAGE_NAMES[language]}", "answers": ["option 1", "option 2", "option 3"]}`
        });

        try {
            const response = await this.callGameEngine(messages);
            const command = this.parseAIResponse(response.content);

            return {
                messages: response.messages,
                command: command
            };
        } catch (error) {
            console.error('Failed to get dialogue response:', error);
            return {
                messages: messages,
                command: null
            };
        }
    }

    /**
     * Validate and retry AI-generated objects with specific validators
     */
    public async validateAndRetry<T>(
        response: unknown,
        validator: ObjectValidator<T>,
        retryCount: number = 2
    ): Promise<IValidationResult> {
        const retryCallback = async (fixPrompt: string): Promise<unknown> => {

            const messages: IMessage[] = [{
                role: 'user',
                content: fixPrompt
            }];

            try {
                const retryResponse = await this.callGameEngine(messages);
                return this.parseAIResponse(retryResponse.content);
            } catch (error) {
                console.error('[AIGameEngineService] Retry request failed:', error);
                throw error;
            }
        };

        return validator.validateWithRetry(response, retryCallback, retryCount);
    }

    /**
     * Request map generation with validation
     */
    public async requestValidatedStoryPlan(
        missionType: string,
        narrativeContext: string,
        storyState?: IStoryState
    ): Promise<unknown> {
        // First attempt
        const response = await this.requestMapGeneration(missionType, narrativeContext, storyState);

        // Check if it's a story plan response
        if (response && typeof response === 'object' && 'storyPlan' in response) {
            const validator = new StoryPlanValidator();
            const storyPlanResponse = response as { storyPlan: unknown };
            const validationResult = await this.validateAndRetry(
                storyPlanResponse.storyPlan,
                validator,
                2
            );

            if (validationResult.isValid) {
                return {
                    ...response,
                    storyPlan: validationResult.fixedObject
                };
            } else {
                console.error('[AIGameEngineService] Story plan validation failed after retries');
                console.error('Validation errors:', validationResult.errors);

                // Return a default story plan if validation fails
                const defaultPlan = validator.createDefaultStoryPlan();
                return {
                    ...response,
                    storyPlan: defaultPlan
                };
            }
        }

        return response;
    }
}