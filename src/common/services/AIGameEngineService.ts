import type { IMessage } from '../interfaces';
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

    private async loadNarrativeArchitectPrompt(): Promise<void> {
        try {
            // In production, this would be loaded from the server
            // For now, we'll use a simplified version
            this.narrativeArchitectPrompt = `You are the Narrative Architect for "Never Ending", a turn-based strategy game set in a post-apocalyptic galaxy.

## Core Setting
- Era: Post-empire galactic collapse
- Protagonist: "Player" - An ex-soldier fleeing
- Companion: "Data" - A loyal service droid
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
        systemPrompt?: string
    ): Promise<AIGameEngineResponse> {
        const messages: IMessage[] = [];

        // Add system context as first message
        if (systemPrompt || this.narrativeArchitectPrompt) {
            messages.push({
                role: 'user',
                content: systemPrompt || this.narrativeArchitectPrompt || ''
            });
        }

        // Add the current context
        const contextPrompt = this.buildContextPrompt(context);
        messages.push({
            role: 'user',
            content: contextPrompt
        });

        try {
            const response = await this.callGameEngine(messages);
            const command = this.parseAIResponse(response.content);

            return {
                messages: response.messages,
                command: command
            };
        } catch (error) {
            console.error('[AI GameEngine] Failed to get AI action:', error);
            return {
                messages: messages,
                command: null
            };
        }
    }

    private buildContextPrompt(context: any): string {
        // Find if there are adjacent characters
        const adjacentChars = context.visibleCharacters?.filter((c: any) => c.isAdjacent) || [];
        const hasAdjacentPlayer = adjacentChars.some((c: any) => c.isPlayer);
        
        // Get characters in conversation range
        const conversableChars = context.charactersInConversationRange || [];
        const conversableNames = conversableChars.map((c: any) => `${c.name} (${Math.round(c.distanceFromCurrent)}m)`).join(', ');
        
        return `Current game state:
${JSON.stringify(context, null, 2)}

It's ${context.currentCharacter.name}'s turn. Based on their personality and the current situation, what should they do?

IMPORTANT INTERACTION RULES:
- Characters within conversation range (3 cells): ${conversableNames || 'none'}
- You can DIRECTLY SPEAK to any character in conversation range without moving
- Characters marked as "canConverse: true" are close enough to talk to
- Characters marked as "isAdjacent: true" are already next to you - DO NOT move towards them
${hasAdjacentPlayer ? '- YOU ARE ALREADY NEXT TO THE PLAYER - Talk instead of moving!' : ''}
${conversableChars.length > 0 ? `- You can talk to: ${conversableNames} RIGHT NOW without moving!` : '- No characters in conversation range - move closer to talk'}

Respond with ONE JSON message following the format specifications. Choose the most appropriate action:
- speech: Say something to characters within conversation range (${conversableChars.length} available)
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
        context?: any
    ): Promise<AIGameEngineResponse> {
        const messages: IMessage[] = [];

        // Add context
        messages.push({
            role: 'user',
            content: `${speaker} is talking to ${listener}. The player (${speaker}) said: "${playerChoice}"

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