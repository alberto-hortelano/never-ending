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
        messages.push({
            role: 'user',
            content: this.buildContextPrompt(context)
        });

        try {
            const response = await this.callGameEngine(messages);
            const command = this.parseAIResponse(response.content);

            return {
                messages: response.messages,
                command: command
            };
        } catch (error) {
            console.error('Failed to get AI action:', error);
            return {
                messages: messages,
                command: null
            };
        }
    }

    private buildContextPrompt(context: any): string {
        return `Current game state:
${JSON.stringify(context, null, 2)}

It's ${context.currentCharacter.name}'s turn. Based on their personality and the current situation, what should they do?

Respond with ONE JSON message following the format specifications. Choose the most appropriate action:
- movement: Move to a strategic position
- attack: Engage in combat
- speech: Say something (if appropriate)
- character: Spawn new characters (only if narratively appropriate)

Consider:
- The character's faction: ${context.currentCharacter.faction || 'unknown'}
- Their personality: ${context.currentCharacter.personality || 'unknown'}
- Current health: ${context.currentCharacter.health.current}/${context.currentCharacter.health.max}
- Visible enemies and allies
- Tactical positioning`;
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
            console.error('Failed to parse AI response:', error);
            console.error('Response was:', response);
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