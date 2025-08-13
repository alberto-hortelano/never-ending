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
- Multiple origin stories with unique companions and traits
- Theme: Survival and finding purpose

## Language Settings
ALL player-facing text MUST be in Spanish.

## Your Role
Control NPCs intelligently during their turns. Consider:
- Character personality and faction
- Tactical situation
- Recent events
- Relationships with other characters

## Response Format
Respond with ONE JSON message:

### Movement
{"type": "movement", "characters": [{"name": "CharName", "location": "target"}]}

### Attack
{"type": "attack", "characters": [{"name": "CharName", "target": "TargetName", "attack": "melee|hold|kill|retreat"}]}

### Speech
{"type": "speech", "source": "CharName", "content": "dialogue", "answers": ["option1", "option2"]}

### Character Spawn
{"type": "character", "characters": [{"name": "CharName", "race": "human|alien|robot", "description": "desc", "speed": "slow|medium|fast", "orientation": "top|right|bottom|left", "location": "spawn location"}]}

Consider the tactical situation and make intelligent decisions.`;
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
        // Find if there are adjacent characters
        const adjacentChars = context.visibleCharacters?.filter((c: any) => c.isAdjacent) || [];
        const hasAdjacentPlayer = adjacentChars.some((c: any) => c.isPlayer);
        
        // Get characters in conversation range
        const conversableChars = context.charactersInConversationRange || [];
        const conversableNames = conversableChars.map((c: any) => `${c.name} (${Math.round(c.distanceFromCurrent)}m)`).join(', ');
        
        // Check for blockage info
        let blockagePrompt = '';
        if (context.blockageInfo) {
            const info = context.blockageInfo;
            const charInfo = info.blockingCharacter;
            blockagePrompt = `

**MOVEMENT BLOCKED!**
You tried to reach ${info.originalTarget} but ${charInfo.name} is blocking your path!
- ${charInfo.name} is ${charInfo.isAlly ? 'an ALLY' : 'an ENEMY'}
- Health: ${charInfo.health}/${charInfo.maxHealth}
- Distance: ${Math.round(charInfo.distance)} cells away

You should:
${charInfo.isAlly ? '- Talk to your ally and ask them to move' : '- Attack the enemy blocking your path'}
${charInfo.distance <= 8 && charInfo.hasLineOfSight ? '- You can speak to them (within conversation range)' : '- Move closer or get line of sight to interact'}
- Or find an alternative action

DO NOT try to move to the original target again - the path is blocked!`;
        }
        
        // Build story context
        let storyContext = '';
        if (storyState?.selectedOrigin) {
            storyContext = `
ORIGIN CONTEXT:
- Player Origin: ${storyState.selectedOrigin.nameES} (${storyState.selectedOrigin.name})
- Companion: ${storyState.selectedOrigin.startingCompanion?.name || 'None'}
- Story Traits: ${storyState.selectedOrigin.specialTraits.join(', ')}
- Current Chapter: ${storyState.currentChapter || 1}
- Faction Relations: ${JSON.stringify(storyState.factionReputation || {})}
- Story Flags: ${Array.from(storyState.storyFlags || []).join(', ')}
`;
        }
        
        return `Current game state:
${JSON.stringify(context, null, 2)}
${storyContext}
It's ${context.currentCharacter.name}'s turn. Based on their personality and the current situation, what should they do?
${blockagePrompt}

IMPORTANT INTERACTION RULES:
- Characters within conversation range (8 cells with line of sight): ${conversableNames || 'none'}
- You can DIRECTLY SPEAK to any character in conversation range without moving
- Characters marked as "canConverse: true" are close enough to talk to
- Characters marked as "isAdjacent: true" are already next to you - DO NOT move towards them
${hasAdjacentPlayer ? '- YOU ARE ALREADY NEXT TO THE PLAYER - Talk instead of moving!' : ''}
${conversableChars.length > 0 ? `- You can talk to: ${conversableNames} RIGHT NOW without moving!` : '- No characters in conversation range - move closer to talk'}

Respond with ONE JSON message following the format specifications. Choose the most appropriate action:
- speech: Say something to characters within conversation range (8 cells with LoS, ${conversableChars.length} available)
- movement: Move to a strategic position (ONLY if target is not in conversation range)
- attack: Engage in combat (if enemy is in range)
- character: Spawn new characters (only if narratively appropriate)

Consider:
- The character's faction: ${context.currentCharacter.faction || 'unknown'}
- Their personality: ${context.currentCharacter.personality || 'unknown'}
- Current health: ${context.currentCharacter.health.current}/${context.currentCharacter.health.max}
- Characters in conversation range: ${conversableChars.length} (can talk without moving)
- Tactical positioning: Don't move if already in conversation range of target`;
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