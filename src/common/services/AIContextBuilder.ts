import { State } from '../State';
import { ICharacter, IGame, ICoord } from '../interfaces';
import { DeepReadonly } from '../helpers/types';
import { FactionService } from './FactionService';

/**
 * Unified AI Game Context
 * Simplified interface containing only essential information for AI decision-making
 */
export interface AIGameContext {
    // Core character information
    currentCharacter: CharacterContext;
    visibleCharacters: CharacterContext[];
    charactersInConversationRange: CharacterContext[];  // Within 8 cells

    // Conversation tracking
    conversationHistory: ConversationExchange[];  // Recent exchanges

    // Story information
    currentMission?: {
        id: string;
        name: string;
        type: string;
        objectives: string[];
    };
    storyFlags?: Set<string>;  // Story progression flags

    // Game state
    turn: number;

    // Optional contextual information
    blockageInfo?: {
        blockingCharacter: {
            name: string;
            isAlly: boolean;
            distance: number;
        };
        originalTarget: string;
    };
    npcFaction?: string;  // Current NPC's faction

    // Allow additional properties for compatibility
    [key: string]: unknown;
}

// Keep GameContext as alias for backward compatibility
export type GameContext = AIGameContext;

// Removed TacticalAnalysis - no longer needed with story-driven decisions

export interface CharacterContext {
    name: string;
    race: string;
    position: { x: number; y: number };
    health: { current: number; max: number };
    energy: { current: number; max: number };
    orientation: string;
    speed: string;
    inventory?: Array<{ name: string; type: string; quantity?: number; [key: string]: unknown }>;
    faction?: string;
    personality?: string;
    isPlayer: boolean;
    isAlly: boolean;
    isEnemy?: boolean;
    lastAction?: string;
    distanceFromCurrent?: number;
    isAdjacent?: boolean;
    canReachThisTurn?: boolean;
    canConverse?: boolean;  // True if within conversation range (8 cells) and has line of sight
    threatLevel?: number;  // 0-100 assessment of threat
    hasRangedWeapon?: boolean;
    hasMeleeWeapon?: boolean;
    isInCover?: boolean;
    hasLineOfSight?: boolean;
}

export interface MapContext {
    terrain: string;
    currentLocation?: string;
    currentPosition?: ICoord;
    nearbyRooms?: Array<{
        position: ICoord;
        name: string;
        distance: number;
    }>;
    buildings: Array<{
        name: string;
        position: { x: number; y: number };
        distance: number;
    }>;
    obstacles: Array<{ x: number; y: number }>;
    coverPositions: Array<{ x: number; y: number }>;
}

export interface EventContext {
    type: string;
    actor?: string;
    target?: string;
    description: string;
    turn: number | string;
    // For conversation events, include the actual dialogue
    dialogue?: {
        speaker: string;
        content: string;
        answers?: string[];
    };
}

export interface ConversationExchange {
    speaker: string;
    content: string;
    turn: number | string;
    timestamp?: number;
}

// Removed StoryContextInfo and WorldContextInfo - consolidated into AIGameContext

interface ExtendedGame extends IGame {
    phase?: string;
    currentMission?: string;
    playerInfo?: Record<string, { name: string; isAI?: boolean }>;
}

interface ExtendedMap {
    palette?: { terrain?: string };
    buildings?: Array<{
        name: string;
        position: { x: number; y: number };
        rooms: Array<{ name: string }>;
    }>;
    currentLocation?: string;
}

export class AIContextBuilder {
    private recentEvents: EventContext[] = [];
    private maxRecentEvents = 10;
    private conversationHistory: ConversationExchange[] = [];
    private maxConversationHistory = 10;
    private activeConversations: Map<string, ConversationExchange[]> = new Map();

    constructor(private state: State) {
    }

    /**
     * Updates the state reference without losing conversation history
     * This is called when the game state changes but we want to preserve context
     */
    public updateState(newState: State): void {
        this.state = newState;
    }

    public buildTurnContext(character: DeepReadonly<ICharacter>, state: State): AIGameContext {
        this.state = state;
        const currentChar = this.buildCharacterContext(character, true);
        const visibleChars = this.getVisibleCharacters(character);
        const charactersInConversationRange = this.getCharactersInConversationRange(character, visibleChars);

        // Get current mission if available
        const currentMissionId = state.story?.currentMissionId;
        const currentMission = currentMissionId
            ? this.getCurrentMission(currentMissionId, state)
            : undefined;

        // Get story flags - convert DeepReadonly to regular Set
        const storyFlags = state.story?.storyFlags ? new Set<string>(state.story.storyFlags as Set<string>) : undefined;

        return {
            currentCharacter: currentChar,
            visibleCharacters: visibleChars,
            charactersInConversationRange: charactersInConversationRange,
            conversationHistory: this.conversationHistory.slice(-5), // Last 5 exchanges
            currentMission: currentMission,
            storyFlags: storyFlags,
            turn: typeof state.game.turn === 'string' ? parseInt(state.game.turn) : state.game.turn,
            npcFaction: undefined // Will be set from character data if needed
        };
    }

    public buildDialogueContext(dialogue: unknown, state: State): Record<string, unknown> {
        this.state = state;
        const dlg = dialogue as Record<string, unknown>;
        const speaker = state.characters.find((c: DeepReadonly<ICharacter>) => c.name === dlg.speaker);
        const listener = state.characters.find((c: DeepReadonly<ICharacter>) => c.name === dlg.listener);

        return {
            dialogue: dialogue,
            speaker: speaker ? this.buildCharacterContext(speaker, false) : null,
            listener: listener ? this.buildCharacterContext(listener, false) : null,
            location: this.getCurrentLocation(),
            recentConversation: this.getRecentDialogue(),
            gamePhase: (state.game as ExtendedGame).phase || 'exploration',
            existingCharacters: state.characters.map((c: DeepReadonly<ICharacter>) => c.name),
            availableLocations: this.getAvailableRooms()
        };
    }

    private buildCharacterContext(character: DeepReadonly<ICharacter>, includeFull: boolean, fromPerspective?: DeepReadonly<ICharacter>): CharacterContext {
        const isPlayer = character.controller === 'human';
        
        // Use perspective character or current turn character
        const perspectiveChar = fromPerspective || this.state.characters.find(c => c.controller === this.state.game.turn);
        const isAlly = perspectiveChar ? FactionService.areAllied(perspectiveChar, character, this.state.game.factions) : false;
        const isEnemy = perspectiveChar ? FactionService.areHostile(perspectiveChar, character, this.state.game.factions) : false;

        const context: CharacterContext = {
            name: character.name,
            race: character.race || 'human',
            position: { x: character.position.x, y: character.position.y },
            health: {
                current: character.health || 100,
                max: character.maxHealth || 100
            },
            energy: {
                current: 100, // Energy not in ICharacter, using default
                max: 100
            },
            orientation: character.direction || 'bottom',
            speed: 'medium', // Speed not in ICharacter, using default
            isPlayer: isPlayer,
            isAlly: isAlly,
            isEnemy: isEnemy,
            hasRangedWeapon: this.checkCharacterHasRangedWeapon(character),
            hasMeleeWeapon: this.characterHasMeleeWeapon(character)
        };

        if (includeFull) {
            context.inventory = [...(character.inventory?.items || [])];
            context.faction = this.getCharacterFaction(character);
            context.personality = this.getCharacterPersonality(character);
            context.lastAction = this.getLastAction(character.name);
        }

        return context;
    }

    private getCharactersInConversationRange(_character: DeepReadonly<ICharacter>, visibleChars: CharacterContext[]): CharacterContext[] {
        // Filter visible characters to only those within conversation range (8 cells with line of sight)
        const conversationRange = 8;
        return visibleChars.filter(char => {
            const distance = char.distanceFromCurrent || 999;
            return distance <= conversationRange;
        });
    }

    private getVisibleCharacters(character: DeepReadonly<ICharacter>): CharacterContext[] {
        const state = this.state;
        const visibleChars: CharacterContext[] = [];
        const viewDistance = 15; // Tiles visible in each direction
        
        // Calculate movement range for the current character
        const moveCost = character.actions?.general?.move || 20;
        const pointsLeft = character.actions?.pointsLeft || 100;
        const maxMovementDistance = Math.floor(pointsLeft / moveCost);

        for (const otherChar of state.characters) {
            if (otherChar.name === character.name) continue;
            
            // Skip dead characters - they shouldn't be considered visible/interactable
            if (otherChar.health <= 0) continue;

            const distance = Math.sqrt(
                Math.pow(otherChar.position.x - character.position.x, 2) +
                Math.pow(otherChar.position.y - character.position.y, 2)
            );

            if (distance <= viewDistance) {
                // Check line of sight (simplified - doesn't account for walls yet)
                const hasLOS = this.hasLineOfSight(character, otherChar);
                if (hasLOS) {
                    const charContext = this.buildCharacterContext(otherChar, false, character);
                    // Add distance and tactical information
                    charContext.distanceFromCurrent = distance;
                    charContext.isAdjacent = distance <= 1.5;
                    charContext.canReachThisTurn = distance <= maxMovementDistance;
                    charContext.canConverse = distance <= 8 && hasLOS; // Can talk within 8 cells with line of sight
                    charContext.hasLineOfSight = hasLOS;
                    charContext.isInCover = this.isCharacterInCover(otherChar);
                    charContext.threatLevel = this.assessThreatLevel(character, otherChar, distance);
                    visibleChars.push(charContext);
                }
            }
        }

        return visibleChars;
    }

    private hasLineOfSight(from: DeepReadonly<ICharacter>, to: DeepReadonly<ICharacter>): boolean {
        // Check for obstacles between two characters using Bresenham's line algorithm
        const map = this.state.map;
        const dx = Math.abs(to.position.x - from.position.x);
        const dy = Math.abs(to.position.y - from.position.y);
        const sx = from.position.x < to.position.x ? 1 : -1;
        const sy = from.position.y < to.position.y ? 1 : -1;
        let err = dx - dy;
        let x = Math.round(from.position.x);
        let y = Math.round(from.position.y);
        const targetX = Math.round(to.position.x);
        const targetY = Math.round(to.position.y);

        while (x !== targetX || y !== targetY) {
            // Skip the starting position
            if (x !== Math.round(from.position.x) || y !== Math.round(from.position.y)) {
                const cell = map[y]?.[x];
                if (cell?.content?.blocker) {
                    return false; // Wall blocks line of sight
                }

                // Don't check for blocking characters - they shouldn't block conversation
                // Only walls should block line of sight for conversation purposes
            }

            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x += sx;
            }
            if (e2 < dx) {
                err += dx;
                y += sy;
            }
        }

        return true; // No obstacles found
    }




    private getCharacterFaction(character: DeepReadonly<ICharacter>): string {
        // Use the faction field if available, otherwise fallback to neutral
        return character.faction || 'neutral';
    }

    private getCharacterPersonality(character: DeepReadonly<ICharacter>): string {
        // Define personality traits for AI behavior
        const faction = this.getCharacterFaction(character);
        
        switch (faction) {
            case 'syndicate':
                return 'ruthless, calculating, profit-driven';
            case 'rebels':
                return 'brave, idealistic, determined';
            case 'technomancers':
                return 'obsessive, intelligent, unpredictable';
            case 'military':
                return 'disciplined, tactical, aggressive';
            default:
                return 'cautious, self-preserving';
        }
    }

    private getLastAction(characterName: string): string | undefined {
        // Get the last action this character performed
        const lastEvent = this.recentEvents
            .filter(e => e.actor === characterName)
            .pop();
        
        return lastEvent?.description;
    }

    private getCurrentLocation(): string {
        // Get descriptive name of current location
        const state = this.state;
        const map = state.map as ExtendedMap;
        
        if (map?.currentLocation) {
            return map.currentLocation;
        }
        
        // Try to determine from buildings
        const player = state.characters.find((c: DeepReadonly<ICharacter>) => c.name === 'Player');
        if (player && map?.buildings) {
            for (const building of map.buildings) {
                // Check if player is inside this building (simplified)
                const distance = Math.sqrt(
                    Math.pow(building.position.x - player.position.x, 2) +
                    Math.pow(building.position.y - player.position.y, 2)
                );
                
                if (distance < 10) {
                    return building.name;
                }
            }
        }
        
        return 'Unknown Location';
    }

    private getRecentDialogue(): string[] {
        // Get recent dialogue exchanges
        return this.recentEvents
            .filter(e => e.type === 'dialogue')
            .map(e => e.description)
            .slice(-3); // Last 3 dialogue lines
    }

    private getAvailableRooms(): string[] {
        const rooms = new Set<string>();

        if (!this.state || !this.state.map) {
            return [];
        }

        // Iterate through all cells to find room names
        for (const row of this.state.map) {
            for (const cell of row) {
                if (cell?.locations) {
                    for (const location of cell.locations) {
                        // Exclude generic terrain like 'floor' and 'wall'
                        if (location && location !== 'floor' && location !== 'wall' && location !== 'terrain') {
                            rooms.add(location);
                        }
                    }
                }
            }
        }

        return Array.from(rooms).sort();
    }

    public recordEvent(event: EventContext): void {
        this.recentEvents.push(event);
        
        if (this.recentEvents.length > this.maxRecentEvents) {
            this.recentEvents.shift();
        }

        // If this is a conversation event, also record it in conversation history
        if (event.type === 'dialogue' && event.dialogue) {
            this.recordConversation({
                speaker: event.dialogue.speaker,
                content: event.dialogue.content,
                turn: event.turn
            });
        }
    }

    public recordConversation(exchange: ConversationExchange): void {
        // Add to general conversation history
        this.conversationHistory.push(exchange);
        
        if (this.conversationHistory.length > this.maxConversationHistory) {
            this.conversationHistory.shift();
        }

        // Track active conversations between specific character pairs
        // This helps maintain context for ongoing dialogues
        const participants = this.identifyConversationParticipants(exchange);
        if (participants) {
            const key = this.getConversationKey(participants);
            if (!this.activeConversations.has(key)) {
                this.activeConversations.set(key, []);
            }
            const conversation = this.activeConversations.get(key)!;
            conversation.push(exchange);
            
            // Keep only recent exchanges per conversation
            if (conversation.length > 5) {
                conversation.shift();
            }
        }
    }

    private identifyConversationParticipants(exchange: ConversationExchange): string[] | null {
        // Try to identify who's involved in the conversation
        // This is simplified - in practice would need better tracking
        if (exchange.speaker) {
            // Assume conversation is with player if not specified otherwise
            const otherParticipant = this.state?.characters.find(c => 
                c.controller === 'human' && c.name !== exchange.speaker
            )?.name || 'Player';
            return [exchange.speaker, otherParticipant].sort();
        }
        return null;
    }

    private getConversationKey(participants: string[]): string {
        return participants.join('-');
    }

    public clearEvents(): void {
        this.recentEvents = [];
    }

    public clearConversationHistory(): void {
        this.conversationHistory = [];
        this.activeConversations.clear();
    }

    private getCurrentMission(missionId: string, state: State): AIGameContext['currentMission'] | undefined {
        if (!state.story?.storyPlan) {
            return undefined;
        }

        for (const act of state.story.storyPlan.acts) {
            const mission = act.missions.find(m => m.id === missionId);
            if (mission) {
                return {
                    id: mission.id,
                    name: mission.name,
                    type: mission.type,
                    objectives: mission.objectives?.map(o => o.description) || []
                };
            }
        }
        return undefined;
    }










    private checkCharacterHasRangedWeapon(character: DeepReadonly<ICharacter>): boolean {
        const primary = character.inventory?.equippedWeapons?.primary;
        const secondary = character.inventory?.equippedWeapons?.secondary;
        return (primary?.category === 'ranged') || (secondary?.category === 'ranged');
    }
    
    private characterHasMeleeWeapon(character: DeepReadonly<ICharacter>): boolean {
        const primary = character.inventory?.equippedWeapons?.primary;
        const secondary = character.inventory?.equippedWeapons?.secondary;
        return (primary?.category === 'melee') || (secondary?.category === 'melee');
    }

    private isCharacterInCover(_character: DeepReadonly<ICharacter>): boolean {
        // Simplified cover check - would need actual map analysis
        return false;
    }

    private assessThreatLevel(
        _fromChar: DeepReadonly<ICharacter>,
        targetChar: DeepReadonly<ICharacter>,
        distance: number
    ): number {
        if (!FactionService.areHostile(_fromChar, targetChar, this.state.game.factions)) {
            return 0;
        }
        
        let threat = 50; // Base threat
        
        // Health factor
        const healthRatio = targetChar.health / targetChar.maxHealth;
        threat += healthRatio * 20;
        
        // Distance factor
        if (distance <= 2) threat += 30;
        else if (distance <= 5) threat += 20;
        else if (distance <= 10) threat += 10;
        
        // Weapon factor
        if (this.checkCharacterHasRangedWeapon(targetChar)) threat += 20;
        
        return Math.min(100, Math.max(0, threat));
    }


    

}