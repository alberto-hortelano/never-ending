import type { IMessage, IStoryState, IOriginStory, IValidationResult } from '../interfaces';
import { AICommand, SpeechCommand } from './AICommandParser';
import { AIBrowserCacheService, type AIRequest, type AIResponse } from './AIBrowserCacheService';
import { ObjectValidator } from './ObjectValidator';
import { StoryPlanValidator } from './StoryPlanValidator';
import { AIMockService } from './AIMockService';
import type { GameContext } from './AIContextBuilder';
import { MAIN_CHARACTER_NAME, COMPANION_DROID_NAME, LANGUAGE_NAMES, LANGUAGE_INSTRUCTIONS, type LanguageCode } from '../constants';

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

// Character interfaces
interface CharacterInfo {
    name: string;
    race?: string;
    position?: { x: number; y: number };
    health?: {
        current: number;
        max: number;
    };
    faction?: string;
    personality?: string;
    isAlly?: boolean;
    isEnemy?: boolean;
    isAdjacent?: boolean;
    distanceFromCurrent?: number;
    canConverse?: boolean;
}

interface ConversationExchange {
    speaker: string;
    content: string;
}

interface RecentEvent {
    description: string;
}

interface ThreatInfo {
    source: string;
    level: number;
    type: string;
    distance: number;
}

interface TacticalAnalysis {
    threats?: ThreatInfo[];
    suggestedStance?: string;
}

// Main context interface
export interface AIActionContext {
    currentCharacter?: CharacterInfo;
    visibleCharacters?: CharacterInfo[];
    charactersInConversationRange?: CharacterInfo[];
    recentEvents?: RecentEvent[];
    conversationHistory?: ConversationExchange[];
    activeConversations?: Map<string, ConversationExchange[]>;
    tacticalAnalysis?: TacticalAnalysis;
    blockageInfo?: string;
    npcFaction?: string;
    recentConversation?: ConversationExchange[];
    [key: string]: unknown; // Allow additional properties
}

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

    private generateNarrativePrompt(language: LanguageCode): string {
        return `You are the Narrative Architect for "Never Ending", a turn-based tactical strategy game set in a post-apocalyptic galaxy.

## GAME MECHANICS - CRITICAL TO UNDERSTAND
- **Turn-based tactical combat**: Characters take turns on the CURRENT map
- **Persistent maps**: Maps stay loaded throughout gameplay sessions
- **Map transitions are RARE**: Only change maps for major story events (escape, new planet, etc.)
- **Normal gameplay**: Move, attack, and talk on the EXISTING map
- **DO NOT** request new maps after conversations or minor events

## Core Setting
- Era: Post-empire galactic collapse
- Theme: Survival, exploration, and finding purpose
- Language: ${LANGUAGE_INSTRUCTIONS[language]}

## CONVERSATION CONTINUITY - CRITICAL
When engaging in dialogue:
1. ALWAYS check "RECENT CONVERSATION HISTORY" section first
2. Reference what was previously said - don't repeat yourself
3. Build on the conversation naturally - acknowledge previous statements
4. If someone mentioned desertion, combat, or specific topics, continue that thread
5. Remember emotional tone from previous exchanges (hostile, friendly, suspicious)
6. After conversation ends, continue playing on the SAME MAP

## DECISION FRAMEWORK - Follow these steps IN ORDER:

### STEP 1: OBSERVE (What is real?)
- List ONLY characters marked as visible in the context
- Note their exact distances and positions
- Check who is in conversation range (within 8 cells)
- Review RECENT CONVERSATION HISTORY if available
- DO NOT imagine or invent characters not in the visible list

### STEP 2: ASSESS (What is the situation?)
- Am I in an ongoing conversation? (check conversation history)
- Am I in combat? (hostile characters visible)
- Am I in conversation? (friendly character in range)
- Am I exploring? (no immediate threats or allies)
- What was I doing last turn? (check recent events)

### STEP 3: PRIORITIZE (What should I do?)
Priority order:
1. If in ongoing conversation → Continue the conversation thread
2. If in conversation range (≤8 cells) with ally → SPEECH
3. If adjacent to enemy → ATTACK
4. If enemy visible but far → MOVEMENT toward enemy
5. If ally visible but far → MOVEMENT toward ally
6. If exploring → MOVEMENT to explore

### STEP 4: VALIDATE (Can I actually do this?)
Before responding, check:
- Is my target ACTUALLY visible? (must be in visibleCharacters list)
- Am I close enough for my chosen action?
- Is this action possible in the game mechanics?
- Does my response make sense given conversation history?

## CHARACTER PERSONALITIES

### Data (Android Companion)
- Speech: Analytical, precise, technical vocabulary
- Behavior: Protective of humans, logical, efficient
- Never: Shows emotion, uses colloquialisms, acts irrationally
- Language style: Formal, technical terms

### Enemy Soldiers
- Speech: Military, aggressive when hostile, cautious when outnumbered
- Behavior: Tactical, team-oriented, follows orders
- Language style: Commands, military terminology

## ACTION FORMATS WITH EXAMPLES

### SPEECH - When character is within 8 cells
Good Example (greeting):
{"type": "speech", "source": "Data", "content": "Comandante, he detectado actividad anómala en este sector. Sugiero proceder con cautela.", "answers": ["¿Qué tipo de actividad?", "Mantente alerta", "Continuemos"]}

Good Example (ending naturally):
{"type": "speech", "source": "Data", "content": "Entendido, comandante. Procederé según lo indicado.", "answers": []}

Bad Example (talking to non-existent character):
{"type": "speech", "source": "Data", "content": "Veo enemigos acercándose", "answers": [...]} // WRONG if no enemies visible!

### MOVEMENT - When target is NOT in conversation range
Good Example:
{"type": "movement", "characters": [{"name": "Data", "location": "player"}]}

Bad Example (moving when already close):
// If player is 3 cells away, DON'T move, SPEAK instead!

### ATTACK - Only when enemy is adjacent or in weapon range
{"type": "attack", "characters": [{"name": "enemy", "target": "player", "attack": "kill"}]}

## CONVERSATION MANAGEMENT

### CRITICAL: Check Conversation History First!
- ALWAYS read "RECENT CONVERSATION HISTORY" section
- If you previously mentioned desertion, threats, or specific topics, continue that thread
- Don't restart conversations - pick up where you left off
- Remember the emotional tone (hostile, friendly, suspicious, urgent)

### Starting Conversations
- Greet appropriately based on situation
- Provide useful information or warnings
- Ask relevant questions
- BUT if conversation already started, DON'T greet again!

### During Conversation (2-3 exchanges maximum)
- Stay on topic - don't suddenly change subjects
- Provide new information each turn - don't repeat
- React to player's choices - acknowledge what they said
- Build tension or resolve it based on context

### Ending Conversations
End when:
- No new information to share (use empty answers: [])
- Action is needed (enemy approaching)
- Player chooses to leave
- After 3-4 exchanges
- Natural conclusion reached (agreement, disagreement, threat executed)

Example ending:
{"type": "speech", "source": "Data", "content": "Mantendré vigilancia del perímetro, comandante.", "answers": []}

## CONVERSATION CONTINUITY EXAMPLES

### GOOD - References previous exchange:
History: Player: "¿Eres un desertor?"
Response: {"type": "speech", "source": "enemy", "content": "¿Desertor? Yo soy quien caza desertores como tú. El comando paga bien por traidores.", "answers": ["No soy un traidor", "¿Cuánto pagan?", "Prepárate para pelear"]}

### BAD - Ignores previous exchange:
History: Player: "¿Eres un desertor?"
Response: {"type": "speech", "source": "enemy", "content": "¡Alto! ¿Quién eres?", "answers": [...]} // WRONG - already talking!

### GOOD - Escalates based on context:
History: Enemy threatened combat
Response: {"type": "speech", "source": "enemy", "content": "¡Se acabó el tiempo! ¡Abran fuego!", "answers": []}

### BAD - Resets emotional tone:
History: Hostile confrontation about desertion
Response: {"type": "speech", "source": "enemy", "content": "Hola, ¿necesitas ayuda?", "answers": [...]} // WRONG - tone reset!

## MAP COMMAND - USE EXTREMELY RARELY

### When to use MAP command (ONLY these cases):
1. Player uses a transition door/portal to new location
2. Story explicitly requires leaving current area (escape pod, ship departure)
3. Mission completion that narratively moves to new location
4. Major story act transition

### NEVER use MAP command for:
- After any normal conversation
- To "refresh" or "update" the scene
- When characters just need to move around
- Minor story beats or encounters
- Because you think the scene needs variety

### MAP command format (when truly needed):
{"type": "map", "palette": {...}, "buildings": [...], "characters": [...]}

## CRITICAL RULES - NEVER VIOLATE THESE

1. NEVER describe characters not in visibleCharacters list
2. NEVER move toward a character already in conversation range
3. NEVER continue conversation beyond 3-4 exchanges
4. ONLY use ${LANGUAGE_NAMES[language]} in dialogue (never other languages)
5. NEVER suggest impossible tactics (flanking, cover system, etc.)
6. ALWAYS check canConverse flag before attempting speech
7. ALWAYS end conversation with empty answers: [] when done
8. ALWAYS check conversation history before speaking
9. NEVER repeat the same greeting or introduction twice
10. ONLY use map command for MAJOR location changes (see MAP COMMAND section)
11. Continue playing on CURRENT map after conversations end
12. The game is TURN-BASED TACTICAL - work with existing map

Remember: The map persists throughout gameplay. Characters move, fight, and talk on the CURRENT map. Only transition to new maps for major story events.`;
    }

    public async requestAIAction(
        context: AIActionContext,
        systemPrompt?: string,
        storyState?: IStoryState,
        language: LanguageCode = 'es'
    ): Promise<AIGameEngineResponse> {
        // Check if mock mode is enabled
        const isMockEnabled = localStorage.getItem('ai_mock_enabled') === 'true';
        if (isMockEnabled) {
            // Convert AIActionContext to GameContext for the mock service
            const gameContext = context as unknown as GameContext;
            return AIMockService.getInstance().requestAIAction(gameContext);
        }

        const messages: IMessage[] = [];
        const startTime = Date.now();

        // Add system context as first message
        const narrativePrompt = this.generateNarrativePrompt(language);
        if (systemPrompt || narrativePrompt) {
            messages.push({
                role: 'user',
                content: systemPrompt || narrativePrompt
            });
        }

        // Add the current context with story state
        const contextPrompt = this.buildContextPrompt(context, storyState);
        messages.push({
            role: 'user',
            content: contextPrompt
        });

        try {
            const response = await this.callGameEngine(messages);
            const command = this.parseAIResponse(response.content);

            const duration = Date.now() - startTime;
            if (command?.type === 'speech') {
                const speechCmd = command as SpeechCommand;
                console.log(`[AI] Response (${duration}ms): Speech - "${speechCmd.content?.substring(0, 60)}..."`);
            } else {
                console.log(`[AI] Response (${duration}ms): ${command?.type || 'none'}`);
            }

            return {
                messages: response.messages,
                command: command
            };
        } catch (error) {
            const duration = Date.now() - startTime;
            console.error(`[AI] Request failed (${duration}ms):`, error);
            return {
                messages: messages,
                command: null
            };
        }
    }

    private buildContextPrompt(context: AIActionContext, storyState?: IStoryState): string {
        const current = context.currentCharacter;
        const visibleChars = context.visibleCharacters || [];
        const conversableChars = context.charactersInConversationRange || [];

        // Build character descriptions with clear status
        const characterDescriptions = visibleChars.map((char) => {
            const status = [];
            if (char.isAlly) status.push('ALLY');
            if (char.isEnemy) status.push('ENEMY');
            if (char.canConverse) status.push('CAN TALK');
            if (char.isAdjacent) status.push('ADJACENT');

            return `  - ${char.name}: ${Math.round(char.distanceFromCurrent || 0)} cells away [${status.join(', ')}] Health: ${char.health?.current}/${char.health?.max}`;
        }).join('\n');

        // Create natural language situation summary
        let situationSummary = `## CURRENT SITUATION

You are: ${current?.name || 'unknown'} (${current?.race || 'unknown'})
Your position: (${Math.round(current?.position?.x || 0)}, ${Math.round(current?.position?.y || 0)})
Your health: ${current?.health?.current || 0}/${current?.health?.max || 100}
Your faction: ${current?.faction || 'neutral'}
Your personality: ${current?.personality || 'standard'}

## VISIBLE CHARACTERS (${visibleChars.length} total)
${characterDescriptions || '  None visible'}

## CONVERSATION OPTIONS (within 8 cells)
${conversableChars.length > 0
                ? conversableChars.map((c) => `  - ${c.name} (${Math.round(c.distanceFromCurrent || 0)}m) - Ready to talk`).join('\n')
                : '  No characters in conversation range - need to move closer'}
`;

        // Add recent events if available
        if (context.recentEvents && context.recentEvents.length > 0) {
            situationSummary += `
## RECENT EVENTS
${context.recentEvents.map((e) => `  - ${e.description}`).join('\n')}
`;
        }

        // Add conversation history if available
        if (context.conversationHistory && context.conversationHistory.length > 0) {
            situationSummary += `
## RECENT CONVERSATION HISTORY
${context.conversationHistory.map((exchange) =>
                `  - ${exchange.speaker}: "${exchange.content}"`
            ).join('\n')}
`;
        }

        // Add active conversations if any
        if (context.activeConversations && context.activeConversations.size > 0) {
            const activeConvos: string[] = [];
            context.activeConversations.forEach((exchanges, key) => {
                if (exchanges.length > 0) {
                    const lastExchange = exchanges[exchanges.length - 1];
                    if (lastExchange) {
                        activeConvos.push(`  - With ${key}: Last said "${lastExchange.content}" by ${lastExchange.speaker}`);
                    }
                }
            });
            if (activeConvos.length > 0) {
                situationSummary += `
## ACTIVE CONVERSATIONS
${activeConvos.join('\n')}
`;
            }
        }

        // Add tactical analysis if in combat
        if (context.tacticalAnalysis) {
            const threats = context.tacticalAnalysis.threats || [];
            if (threats.length > 0) {
                situationSummary += `
## TACTICAL ASSESSMENT
Threats detected:
${threats.map((t) => `  - ${t.source}: threat level ${t.level}, ${t.type} threat at ${t.distance}m`).join('\n')}
Recommended stance: ${context.tacticalAnalysis.suggestedStance}
`;
            }
        }

        // Add story context if available
        if (storyState?.selectedOrigin) {
            situationSummary += `
## STORY CONTEXT
Origin: ${storyState.selectedOrigin.nameES}
Chapter: ${storyState.currentChapter || 1}
Companion: ${storyState.selectedOrigin.startingCompanion?.name || 'None'}
`;
        }

        // Handle blockage situations
        if (context.blockageInfo) {
            if (typeof context.blockageInfo === 'string') {
                situationSummary += `
## ⚠️ PATH BLOCKED
${context.blockageInfo}
`;
            } else if (typeof context.blockageInfo === 'object') {
                const info = context.blockageInfo as {
                    blockingCharacter?: {
                        name: string;
                        isAlly: boolean;
                        distance: number;
                    };
                    originalTarget?: string;
                };
                const blocker = info.blockingCharacter;
                if (blocker) {
                    situationSummary += `
## ⚠️ PATH BLOCKED
Cannot reach ${info.originalTarget} - ${blocker.name} is blocking!
${blocker.name} is ${blocker.isAlly ? 'an ALLY' : 'an ENEMY'} at ${Math.round(blocker.distance)} cells
${blocker.distance <= 8 ? '✓ Can talk to resolve' : '✗ Too far to talk - move closer first'}
`;
                }
            }
        }

        // Clear action reminders based on situation
        let actionGuidance = `
## DECISION GUIDANCE

`;

        // Priority guidance based on situation
        if (conversableChars.some((c) => c.isAlly)) {
            actionGuidance += `📢 PRIORITY: You have allies in conversation range! Consider speaking first.\n`;
        }
        if (visibleChars.some((c) => c.isAdjacent && c.isEnemy)) {
            actionGuidance += `⚔️ COMBAT: Enemy adjacent! Attack or retreat immediately.\n`;
        }
        if (conversableChars.length === 0 && visibleChars.length > 0) {
            actionGuidance += `🚶 MOVEMENT: No one in conversation range. Move closer to interact.\n`;
        }
        if (visibleChars.length === 0) {
            actionGuidance += `🔍 EXPLORING: No one visible. Move to explore the area.\n`;
        }

        return situationSummary + actionGuidance + `
## YOUR RESPONSE
Based on the above situation, choose ONE action following the JSON format.
Remember: ${current?.name || 'character'} would act according to their ${current?.personality || 'standard'} personality.

CRITICAL REMINDERS:
- Can ONLY see/interact with the ${visibleChars.length} characters listed above
- Can ONLY speak to the ${conversableChars.length} characters in conversation range
- DO NOT invent or imagine other characters
- If someone is marked "CAN TALK" - use speech, not movement!
`;
    }

    private async callGameEngine(
        messages: IMessage[],
        retry = 0
    ): Promise<{ messages: IMessage[], content: string }> {

        // Check cache first
        const cacheKey: GameEngineRequest = { messages, endpoint: '/gameEngine' };
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
                body: JSON.stringify(messages)
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
                    messages: messages,
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
                    messages: messages,
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

                if (isOverloadError) {
                    console.log(`[AI] Service overloaded, retrying in ${backoffDelay}ms...`);
                }

                await new Promise(resolve => setTimeout(resolve, backoffDelay));
                return this.callGameEngine(messages, retry + 1);
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
        _storyState: IStoryState,
        language: LanguageCode = 'es'
    ): Promise<{ commands: AICommand[], narrative?: string }> {
        // Check if mock mode is enabled
        const isMockEnabled = localStorage.getItem('ai_mock_enabled') === 'true';
        if (isMockEnabled) {
            return AIMockService.getInstance().requestStoryInitialization();
        }

        const messages: IMessage[] = [];

        // Add the narrative architect prompt as a user message with context
        // Note: The IMessage interface only supports 'user' | 'assistant' roles
        const narrativePrompt = this.generateNarrativePrompt(language);
        if (narrativePrompt) {
            messages.push({
                role: 'user',
                content: `SYSTEM CONTEXT:
${narrativePrompt}

---
`
            });
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
Faction Relations: ${Object.entries(origin.factionRelations).map(([f, v]) => `${f}: ${v}`).join(', ')}

## REQUIRED INITIALIZATION

Generate the following in order:

1. **MAP GENERATION**
   - Create a tactical map appropriate for "${origin.startingLocation}"
   - Include buildings, rooms, corridors, and environmental features
   - Place strategic cover and obstacles
   - The map should support the narrative of ${origin.nameES}

2. **CHARACTER PLACEMENT**
   - You MUST include the main character "${MAIN_CHARACTER_NAME}" in your character list
   - You MUST include the companion "${COMPANION_DROID_NAME}" in your character list
   - Place ${MAIN_CHARACTER_NAME} and ${COMPANION_DROID_NAME} in logical starting positions
   ${origin.startingCompanion ? `- Also place companion "${origin.startingCompanion.name}" near ${MAIN_CHARACTER_NAME}` : ''}
   - Generate 2-4 additional NPCs or enemies appropriate to the origin story
   - Place all characters strategically on the map with valid positions

3. **INITIAL NARRATIVE**
   - Create an opening scenario that reflects the origin's theme
   - Set up an immediate objective or situation for the player
   - ${LANGUAGE_INSTRUCTIONS[language]}

## RESPONSE FORMAT

Return a JSON object with:
{
  "commands": [
    {"type": "map", "palette": {...}, "buildings": [...]},
    {"type": "character", "characters": [...]},
    {"type": "storyline", "storyline": {...}}
  ],
  "narrative": "Initial story text in ${LANGUAGE_NAMES[language]} to display to the player"
}

## MAP COMMAND FORMAT
{
  "type": "map",
  "palette": {
    "floor": "#hexcolor",
    "wall": "#hexcolor",
    "door": "#hexcolor"
  },
  "buildings": [
    {
      "name": "Building Name",
      "x": 10,
      "y": 10,
      "width": 20,
      "height": 15,
      "rooms": [
        {
          "name": "Room Name",
          "x": 0,
          "y": 0,
          "width": 10,
          "height": 10,
          "doors": [{"position": "north", "x": 5}]
        }
      ],
      "corridors": [...]
    }
  ]
}

## CHARACTER COMMAND FORMAT
{
  "type": "character",
  "characters": [
    {
      "name": "Jim",  // REQUIRED - main character (must be exactly "Jim")
      "race": "human",
      "description": "The main protagonist",
      "location": "room_name or x,y coordinates",
      "player": "human",
      "palette": {
        "skin": "#d7a55f",
        "helmet": "white",
        "suit": "white"
      }
    },
    {
      "name": "Data",  // REQUIRED - companion (must be exactly "Data")
      "race": "robot",
      "description": "Loyal companion droid",
      "location": "room_name or x,y coordinates",
      "player": "ai",
      "palette": {
        "skin": "yellow",
        "helmet": "gold",
        "suit": "gold"
      }
    },
    {
      "name": "NPC Name",
      "race": "human/robot/alien",
      "description": "Brief description",
      "location": "room_name or x,y",
      "player": "ai",
      "personality": "aggressive/defensive/neutral",
      "palette": {
        "skin": "#hexcolor",
        "helmet": "#hexcolor",
        "suit": "#hexcolor"
      }
    }
  ]
}

## STORYLINE COMMAND FORMAT
{
  "type": "storyline",
  "storyline": {
    "title": "Mission Title in ${LANGUAGE_NAMES[language]}",
    "description": "Mission description in ${LANGUAGE_NAMES[language]}",
    "objectives": [
      {"id": "obj1", "description": "Objective in ${LANGUAGE_NAMES[language]}", "completed": false}
    ]
  }
}

Remember: ALL narrative text, descriptions, objectives, and dialogue MUST be in ${LANGUAGE_NAMES[language]}.`;

        messages.push({
            role: 'user',
            content: initRequest
        });

        // console.log('[AIGameEngineService] Sending initialization request to /gameEngine endpoint');
        // console.log('[AIGameEngineService] Request length:', initRequest.length, 'characters');

        try {
            // console.log('[AIGameEngineService] Calling game engine API...');
            const response = await this.callGameEngine(messages);
            // console.log('[AIGameEngineService] API response received');
            // console.log('[AIGameEngineService] Response content length:', response.content?.length || 0);

            const parsedResponse = this.parseAIResponse(response.content);
            // console.log('[AIGameEngineService] Parsed response:', {
            //     hasParsedResponse: !!parsedResponse,
            //     responseType: parsedResponse?.type,
            //     hasCommands: !!parsedResponse?.commands,
            //     commandCount: parsedResponse?.commands?.length || 0
            // });

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

            // console.log('[AIGameEngineService] Returning commands:', commands.length, 'narrative:', !!narrative);
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
        language: LanguageCode = 'es'
    ): Promise<AIGameEngineResponse> {
        // Check if mock mode is enabled
        const isMockEnabled = localStorage.getItem('ai_mock_enabled') === 'true';
        if (isMockEnabled) {
            // Convert AIActionContext to GameContext for the mock service
            return AIMockService.getInstance().requestDialogueResponse(speaker, listener, playerChoice);
        }
        const messages: IMessage[] = [];

        // Add context
        // Build story context for dialogue
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
        }

        // Build conversation history context
        let conversationContext = '';
        if (context?.recentConversation && context.recentConversation.length > 0) {
            conversationContext = `
Previous conversation exchanges:
${context.recentConversation.join('\n')}
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
            console.log('[AIGameEngineService] Requesting AI to fix validation errors');

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