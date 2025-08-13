import type { IMessage } from '../interfaces';
import type { IStoryState } from '../interfaces/IStory';
import { AICommand } from './AICommandParser';

export interface AIGameEngineResponse {
    messages: IMessage[];
    command: AICommand | null;
}

export class AIGameEngineService {
    private static instance: AIGameEngineService;
    private readonly maxRetries = 3;
    private readonly retryDelay = 1000;
    private narrativeArchitectPrompt: string | null = null;

    private constructor() {
        this.loadNarrativeArchitectPrompt();
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
    ): Promise<any> {
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
    
    private async loadNarrativeArchitectPrompt(): Promise<void> {
        try {
            // In production, this would be loaded from the server
            // For now, we'll use a simplified version
            this.narrativeArchitectPrompt = `You are the Narrative Architect for "Never Ending", a turn-based strategy game set in a post-apocalyptic galaxy.

## Core Setting
- Era: Post-empire galactic collapse
- Theme: Survival, exploration, and finding purpose
- Language: ALL dialogue and narration MUST be in Spanish

## DECISION FRAMEWORK - Follow these steps IN ORDER:

### STEP 1: OBSERVE (What is real?)
- List ONLY characters marked as visible in the context
- Note their exact distances and positions
- Check who is in conversation range (within 8 cells)
- DO NOT imagine or invent characters not in the visible list

### STEP 2: ASSESS (What is the situation?)
- Am I in combat? (hostile characters visible)
- Am I in conversation? (friendly character in range)
- Am I exploring? (no immediate threats or allies)
- What was I doing last turn? (check recent events)

### STEP 3: PRIORITIZE (What should I do?)
Priority order:
1. If in conversation range (≤8 cells) with ally → SPEECH
2. If adjacent to enemy → ATTACK
3. If enemy visible but far → MOVEMENT toward enemy
4. If ally visible but far → MOVEMENT toward ally
5. If exploring → MOVEMENT to explore

### STEP 4: VALIDATE (Can I actually do this?)
Before responding, check:
- Is my target ACTUALLY visible? (must be in visibleCharacters list)
- Am I close enough for my chosen action?
- Is this action possible in the game mechanics?

## CHARACTER PERSONALITIES

### Data (Android Companion)
- Speech: Analytical, precise, technical vocabulary
- Behavior: Protective of humans, logical, efficient
- Never: Shows emotion, uses colloquialisms, acts irrationally
- Spanish style: Formal, uses "usted", technical terms

### Enemy Soldiers
- Speech: Military, aggressive when hostile, cautious when outnumbered
- Behavior: Tactical, team-oriented, follows orders
- Spanish style: Commands, military terminology

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

### Starting Conversations
- Greet appropriately based on situation
- Provide useful information or warnings
- Ask relevant questions

### During Conversation (2-3 exchanges maximum)
- Stay on topic
- Provide new information each turn
- React to player's choices

### Ending Conversations
End when:
- No new information to share (use empty answers: [])
- Action is needed (enemy approaching)
- Player chooses to leave
- After 3 exchanges

Example ending:
{"type": "speech", "source": "Data", "content": "Mantendré vigilancia del perímetro, comandante.", "answers": []}

## CRITICAL RULES - NEVER VIOLATE THESE

1. NEVER describe characters not in visibleCharacters list
2. NEVER move toward a character already in conversation range
3. NEVER continue conversation beyond 3-4 exchanges
4. NEVER use English in dialogue (always Spanish)
5. NEVER suggest impossible tactics (flanking, cover system, etc.)
6. ALWAYS check canConverse flag before attempting speech
7. ALWAYS end conversation with empty answers: [] when done
8. ONLY spawn characters/maps for major story transitions

Remember: You can ONLY interact with what's ACTUALLY in the game state, not what you imagine might be there.`;
        } catch (error) {
            console.error('Failed to load narrative architect prompt:', error);
        }
    }

    public async requestAIAction(
        context: any,
        systemPrompt?: string,
        storyState?: IStoryState
    ): Promise<AIGameEngineResponse> {
        const messages: IMessage[] = [];
        const startTime = Date.now();
        
        // Log the request
        console.log('[AI GameEngine] === REQUEST START ===');
        console.log('[AI GameEngine] Character:', context.currentCharacter?.name);
        console.log('[AI GameEngine] Visible characters:', context.visibleCharacters?.map((c: any) => `${c.name} (health: ${c.health?.current})`).join(', '));
        console.log('[AI GameEngine] Characters in conversation range:', context.charactersInConversationRange?.map((c: any) => c.name).join(', '));

        // Add system context as first message
        if (systemPrompt || this.narrativeArchitectPrompt) {
            messages.push({
                role: 'user',
                content: systemPrompt || this.narrativeArchitectPrompt || ''
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
            console.log('[AI GameEngine] === REQUEST SUCCESS ===');
            console.log('[AI GameEngine] Duration:', duration, 'ms');
            console.log('[AI GameEngine] Command type:', command?.type || 'none');
            if (command?.type === 'speech') {
                console.log('[AI GameEngine] Speech preview:', command.content?.substring(0, 50) + '...');
            } else if (command?.type === 'attack') {
                console.log('[AI GameEngine] Attack target:', command.characters?.[0]?.target);
            } else if (command?.type === 'movement') {
                console.log('[AI GameEngine] Movement location:', command.characters?.[0]?.location);
            }

            return {
                messages: response.messages,
                command: command
            };
        } catch (error) {
            const duration = Date.now() - startTime;
            console.error('[AI GameEngine] === REQUEST FAILED ===');
            console.error('[AI GameEngine] Duration:', duration, 'ms');
            console.error('[AI GameEngine] Error:', error);
            return {
                messages: messages,
                command: null
            };
        }
    }

    private buildContextPrompt(context: any, storyState?: IStoryState): string {
        const current = context.currentCharacter;
        const visibleChars = context.visibleCharacters || [];
        const conversableChars = context.charactersInConversationRange || [];
        
        // Build character descriptions with clear status
        const characterDescriptions = visibleChars.map((char: any) => {
            const status = [];
            if (char.isAlly) status.push('ALLY');
            if (char.isEnemy) status.push('ENEMY');
            if (char.canConverse) status.push('CAN TALK');
            if (char.isAdjacent) status.push('ADJACENT');
            
            return `  - ${char.name}: ${Math.round(char.distanceFromCurrent || 0)} cells away [${status.join(', ')}] Health: ${char.health?.current}/${char.health?.max}`;
        }).join('\n');
        
        // Create natural language situation summary
        let situationSummary = `## CURRENT SITUATION

You are: ${current.name} (${current.race || 'unknown'})
Your position: (${Math.round(current.position?.x || 0)}, ${Math.round(current.position?.y || 0)})
Your health: ${current.health?.current}/${current.health?.max}
Your faction: ${current.faction || 'neutral'}
Your personality: ${current.personality || 'standard'}

## VISIBLE CHARACTERS (${visibleChars.length} total)
${characterDescriptions || '  None visible'}

## CONVERSATION OPTIONS (within 8 cells)
${conversableChars.length > 0 
    ? conversableChars.map((c: any) => `  - ${c.name} (${Math.round(c.distanceFromCurrent)}m) - Ready to talk`).join('\n')
    : '  No characters in conversation range - need to move closer'}
`;
        
        // Add recent events if available
        if (context.recentEvents && context.recentEvents.length > 0) {
            situationSummary += `
## RECENT EVENTS
${context.recentEvents.map((e: any) => `  - ${e.description}`).join('\n')}
`;
        }
        
        // Add tactical analysis if in combat
        if (context.tacticalAnalysis) {
            const threats = context.tacticalAnalysis.threats || [];
            if (threats.length > 0) {
                situationSummary += `
## TACTICAL ASSESSMENT
Threats detected:
${threats.map((t: any) => `  - ${t.source}: threat level ${t.level}, ${t.type} threat at ${t.distance}m`).join('\n')}
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
            const info = context.blockageInfo;
            const blocker = info.blockingCharacter;
            situationSummary += `
## ⚠️ PATH BLOCKED
Cannot reach ${info.originalTarget} - ${blocker.name} is blocking!
${blocker.name} is ${blocker.isAlly ? 'an ALLY' : 'an ENEMY'} at ${Math.round(blocker.distance)} cells
${blocker.distance <= 8 ? '✓ Can talk to resolve' : '✗ Too far to talk - move closer first'}
`;
        }
        
        // Clear action reminders based on situation
        let actionGuidance = `
## DECISION GUIDANCE

`;
        
        // Priority guidance based on situation
        if (conversableChars.some((c: any) => c.isAlly)) {
            actionGuidance += `📢 PRIORITY: You have allies in conversation range! Consider speaking first.\n`;
        }
        if (visibleChars.some((c: any) => c.isAdjacent && c.isEnemy)) {
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
Remember: ${current.name} would act according to their ${current.personality || 'standard'} personality.

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
                console.error('[AI GameEngine] Server error:', errorData);
                throw new Error(errorData.error || `API request failed: ${response.statusText}`);
            }

            // The server might return either:
            // 1. A direct JSON command object
            // 2. An array of messages with the command in the last message
            const responseData = await response.json();
            // Check if it's a direct command response
            if (responseData.type) {
                return {
                    messages: messages,
                    content: JSON.stringify(responseData)
                };
            }
            
            // Otherwise treat as message array
            const updatedMessages: IMessage[] = responseData;
            const lastMessage = updatedMessages[updatedMessages.length - 1];
            if (!lastMessage || lastMessage.role !== 'assistant') {
                // If not messages format, assume it's a direct response
                return {
                    messages: messages,
                    content: JSON.stringify(responseData)
                };
            }

            return {
                messages: updatedMessages,
                content: lastMessage.content
            };
        } catch (error) {
            console.error('[AI GameEngine] Error in callGameEngine:', error);
            if (retry < this.maxRetries) {
                console.log(`[AI GameEngine] Retrying... (attempt ${retry + 1}/${this.maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
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

    public async requestDialogueResponse(
        speaker: string,
        listener: string,
        playerChoice: string,
        context?: any,
        storyState?: IStoryState
    ): Promise<AIGameEngineResponse> {
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
        
        messages.push({
            role: 'user',
            content: `${speaker} is talking to ${listener}. The player (${speaker}) said: "${playerChoice}"
${storyContext}
Respond as ${listener} with a speech message in Spanish.

Context:
${context ? JSON.stringify(context, null, 2) : 'No additional context'}

Response format:
{"type": "speech", "source": "${listener}", "content": "response in Spanish", "answers": ["option 1", "option 2", "option 3"]}`
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
}