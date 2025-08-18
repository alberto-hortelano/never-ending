import { State } from '../State';
import { ICharacter, IGame, ICoord } from '../interfaces';
import { DeepReadonly } from '../helpers/types';
import { TeamService } from './TeamService';

export interface GameContext {
    currentCharacter: CharacterContext;
    visibleCharacters: CharacterContext[];
    charactersInConversationRange: CharacterContext[];  // Characters within 3 cells that can be talked to
    mapInfo: MapContext;
    recentEvents: EventContext[];
    conversationHistory: ConversationExchange[];  // Recent conversation exchanges
    activeConversations: Map<string, ConversationExchange[]>;  // Track conversations by character pairs
    gameState: {
        turn: number | string;
        phase: string;
        objectives?: string[];
    };
    tacticalAnalysis?: TacticalAnalysis;  // New tactical assessment
}

export interface TacticalAnalysis {
    threats: ThreatAssessment[];
    opportunities: TacticalOpportunity[];
    suggestedStance: 'aggressive' | 'defensive' | 'flanking' | 'suppressive' | 'retreating';
    coverPositions: ICoord[];
    flankingRoutes: ICoord[][];
    retreatPaths: ICoord[][];
}

export interface ThreatAssessment {
    source: string;  // Character name
    level: number;  // 0-100
    type: 'immediate' | 'potential' | 'distant';
    distance: number;
    weaponRange: number;
}

export interface TacticalOpportunity {
    type: 'flank' | 'ambush' | 'highGround' | 'coverAdvance' | 'crossfire';
    position: ICoord;
    value: number;  // 0-100
    description: string;
}

export interface CharacterContext {
    name: string;
    race: string;
    position: { x: number; y: number };
    health: { current: number; max: number };
    energy: { current: number; max: number };
    orientation: string;
    speed: string;
    inventory?: any[];
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
    buildings: Array<{
        name: string;
        position: { x: number; y: number };
        rooms: string[];
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

    public buildTurnContext(character: DeepReadonly<ICharacter>, state: State): GameContext {
        this.state = state;
        const currentChar = this.buildCharacterContext(character, true);
        const visibleChars = this.getVisibleCharacters(character);
        const charactersInConversationRange = this.getCharactersInConversationRange(character, visibleChars);
        const mapInfo = this.buildMapContext(character);
        const gameState = this.buildGameState();
        
        // Only include tactical analysis if there are actual enemies visible
        const hasEnemies = visibleChars.some(c => c.isEnemy);
        const tacticalAnalysis = hasEnemies ? this.performTacticalAnalysis(character, visibleChars) : undefined;

        return {
            currentCharacter: currentChar,
            visibleCharacters: visibleChars,
            charactersInConversationRange: charactersInConversationRange,
            mapInfo: mapInfo,
            recentEvents: this.recentEvents.slice(-5), // Last 5 events
            conversationHistory: this.conversationHistory.slice(-5), // Last 5 conversation exchanges
            activeConversations: this.activeConversations,
            gameState: gameState,
            tacticalAnalysis: tacticalAnalysis
        };
    }

    public buildDialogueContext(dialogue: any, state: State): any {
        this.state = state;
        const speaker = state.characters.find((c: DeepReadonly<ICharacter>) => c.name === dialogue.speaker);
        const listener = state.characters.find((c: DeepReadonly<ICharacter>) => c.name === dialogue.listener);

        return {
            dialogue: dialogue,
            speaker: speaker ? this.buildCharacterContext(speaker, false) : null,
            listener: listener ? this.buildCharacterContext(listener, false) : null,
            location: this.getCurrentLocation(),
            recentConversation: this.getRecentDialogue(),
            gamePhase: (state.game as ExtendedGame).phase || 'exploration'
        };
    }

    private buildCharacterContext(character: DeepReadonly<ICharacter>, includeFull: boolean, fromPerspective?: DeepReadonly<ICharacter>): CharacterContext {
        const isPlayer = character.player === 'human';
        
        // Use perspective character or current turn character
        const perspectiveChar = fromPerspective || this.state.characters.find(c => c.player === this.state.game.turn);
        const isAlly = perspectiveChar ? TeamService.areAllied(perspectiveChar, character, this.state.game.teams) : false;
        const isEnemy = perspectiveChar ? TeamService.areHostile(perspectiveChar, character, this.state.game.teams) : false;

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

    private buildMapContext(character: DeepReadonly<ICharacter>): MapContext {
        const state = this.state;
        const map = state.map as ExtendedMap;
        
        // Get current room/location
        const currentCell = (map as any)[Math.floor(character.position.y)]?.[Math.floor(character.position.x)];
        const currentLocation = currentCell?.locations?.[0] || 'unknown';
        
        // Get nearby rooms and their positions
        const nearbyRooms = this.getNearbyRooms(character);
        
        // Get nearby buildings
        const nearbyBuildings = this.getNearbyBuildings(character);
        
        // Get tactical positions
        const obstacles = this.getNearbyObstacles(character);
        const coverPositions = this.findCoverPositions(character);

        return {
            terrain: map?.palette?.terrain || 'urban',
            currentLocation: currentLocation,
            currentPosition: character.position,
            nearbyRooms: nearbyRooms,
            buildings: nearbyBuildings,
            obstacles: obstacles,
            coverPositions: coverPositions
        } as any;
    }

    private getNearbyRooms(character: DeepReadonly<ICharacter>): any[] {
        const state = this.state;
        const map = state.map;
        const rooms: any[] = [];
        const searchRadius = 15;
        const roomPositions = new Map<string, { positions: ICoord[], center: ICoord }>();
        
        // Scan nearby cells to find rooms
        for (let dy = -searchRadius; dy <= searchRadius; dy++) {
            for (let dx = -searchRadius; dx <= searchRadius; dx++) {
                const x = Math.floor(character.position.x) + dx;
                const y = Math.floor(character.position.y) + dy;
                
                if (y >= 0 && y < map.length && x >= 0 && x < (map[0]?.length || 0)) {
                    const cell = map[y]?.[x];
                    if (cell?.locations && cell.locations.length > 0) {
                        const roomName = cell.locations[0];
                        if (roomName && roomName !== 'wall' && roomName !== 'floor') {
                            if (!roomPositions.has(roomName)) {
                                roomPositions.set(roomName, { positions: [], center: { x: 0, y: 0 } });
                            }
                            roomPositions.get(roomName)!.positions.push({ x, y });
                        }
                    }
                }
            }
        }
        
        // Calculate center position for each room
        for (const [roomName, data] of roomPositions) {
            if (data.positions.length > 0) {
                const centerX = Math.floor(data.positions.reduce((sum, pos) => sum + pos.x, 0) / data.positions.length);
                const centerY = Math.floor(data.positions.reduce((sum, pos) => sum + pos.y, 0) / data.positions.length);
                const distance = Math.sqrt(
                    Math.pow(centerX - character.position.x, 2) +
                    Math.pow(centerY - character.position.y, 2)
                );
                
                rooms.push({
                    name: roomName,
                    centerPosition: { x: centerX, y: centerY },
                    distance: Math.round(distance),
                    direction: this.getDirection(character.position, { x: centerX, y: centerY })
                });
            }
        }
        
        // Sort by distance
        rooms.sort((a, b) => a.distance - b.distance);
        
        return rooms.slice(0, 5); // Return closest 5 rooms
    }
    
    private getDirection(from: ICoord, to: ICoord): string {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        
        if (Math.abs(dx) > Math.abs(dy)) {
            return dx > 0 ? 'east' : 'west';
        } else {
            return dy > 0 ? 'south' : 'north';
        }
    }

    private getNearbyBuildings(character: DeepReadonly<ICharacter>): any[] {
        const state = this.state;
        const buildings: any[] = [];
        const nearDistance = 20;
        const map = state.map as ExtendedMap;

        if (map?.buildings) {
            for (const building of map.buildings) {
                const distance = Math.sqrt(
                    Math.pow(building.position.x - character.position.x, 2) +
                    Math.pow(building.position.y - character.position.y, 2)
                );

                if (distance <= nearDistance) {
                    buildings.push({
                        name: building.name,
                        position: building.position,
                        rooms: building.rooms.map((r: { name: string }) => r.name)
                    });
                }
            }
        }

        return buildings;
    }

    private getNearbyObstacles(_character: DeepReadonly<ICharacter>): Array<{ x: number; y: number }> {
        // Get walls and other obstacles near the character
        const obstacles: Array<{ x: number; y: number }> = [];
        // const checkRadius = 10;

        // TODO: Actually check the map grid for walls
        // For now, return empty array
        return obstacles;
    }


    private buildGameState(): any {
        const state = this.state;
        const game = state.game as ExtendedGame;
        
        return {
            turn: game.turn || 0,
            phase: game.phase || 'exploration',
            objectives: this.getCurrentObjectives()
        };
    }

    private getCurrentObjectives(): string[] {
        // Get current mission objectives
        const state = this.state;
        const objectives: string[] = [];
        const game = state.game as ExtendedGame;

        if (game.currentMission) {
            objectives.push(game.currentMission);
        }

        // Add contextual objectives based on situation
        if (this.isInCombat()) {
            objectives.push('Eliminate hostile forces');
        }

        return objectives;
    }

    private isInCombat(): boolean {
        // Check if any hostile characters are nearby
        const state = this.state;
        const player = state.characters.find((c: DeepReadonly<ICharacter>) => c.name === 'Player');
        
        if (!player) return false;

        for (const char of state.characters) {
            if (this.isHostileTo('Player', char.name)) {
                const distance = Math.sqrt(
                    Math.pow(char.position.x - player.position.x, 2) +
                    Math.pow(char.position.y - player.position.y, 2)
                );
                
                if (distance < 20) {
                    return true;
                }
            }
        }

        return false;
    }

    private isHostileTo(character1: string, character2: string): boolean {
        // Determine if two characters are hostile using TeamService
        const char1 = this.state.characters.find(c => c.name === character1);
        const char2 = this.state.characters.find(c => c.name === character2);
        
        if (!char1 || !char2) return false;
        
        return TeamService.areHostile(char1, char2, this.state.game.teams);
    }

    private getCharacterFaction(character: DeepReadonly<ICharacter>): string {
        // Use the team field if available, otherwise fallback to neutral
        return character.team || 'neutral';
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
                c.player === 'human' && c.name !== exchange.speaker
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

    /**
     * Perform tactical analysis of the battlefield
     * Simplified to only include actually achievable tactics
     */
    private performTacticalAnalysis(
        character: DeepReadonly<ICharacter>,
        visibleChars: CharacterContext[]
    ): TacticalAnalysis {
        const threats = this.assessThreats(character, visibleChars);
        const opportunities = this.findSimpleTacticalOpportunities(character, visibleChars);
        const suggestedStance = this.suggestStance(character, threats, opportunities);
        
        // Simplified - no complex flanking or cover mechanics
        const coverPositions: ICoord[] = [];
        const flankingRoutes: ICoord[][] = [];
        const retreatPaths = threats.length > 0 ? this.calculateSimpleRetreatPaths(character, threats) : [];

        return {
            threats,
            opportunities,
            suggestedStance,
            coverPositions,
            flankingRoutes,
            retreatPaths
        };
    }

    private assessThreats(
        _character: DeepReadonly<ICharacter>,
        visibleChars: CharacterContext[]
    ): ThreatAssessment[] {
        const threats: ThreatAssessment[] = [];
        
        for (const other of visibleChars) {
            if (!other.isEnemy || !other.distanceFromCurrent) continue;
            
            const distance = other.distanceFromCurrent;
            const weaponRange = other.hasRangedWeapon ? 15 : 1.5;
            
            let type: 'immediate' | 'potential' | 'distant' = 'distant';
            if (distance <= weaponRange) type = 'immediate';
            else if (distance <= weaponRange * 2) type = 'potential';
            
            threats.push({
                source: other.name,
                level: other.threatLevel || 50,
                type,
                distance,
                weaponRange
            });
        }
        
        return threats.sort((a, b) => b.level - a.level);
    }

    private findSimpleTacticalOpportunities(
        character: DeepReadonly<ICharacter>,
        visibleChars: CharacterContext[]
    ): TacticalOpportunity[] {
        const opportunities: TacticalOpportunity[] = [];
        
        // Only include simple, achievable opportunities
        const enemies = visibleChars.filter(c => c.isEnemy);
        
        // Direct engagement opportunities
        for (const enemy of enemies) {
            if (!enemy.position || !enemy.distanceFromCurrent) continue;
            
            // Can we reach them this turn for melee?
            if (enemy.canReachThisTurn && this.characterHasMeleeWeapon(character)) {
                opportunities.push({
                    type: 'ambush',
                    position: enemy.position,
                    value: 60,
                    description: `Engage ${enemy.name} in melee combat`
                });
            }
            
            // Do we have range advantage?
            if (this.checkCharacterHasRangedWeapon(character) && !enemy.hasRangedWeapon) {
                opportunities.push({
                    type: 'highGround', // Using as "range advantage"
                    position: character.position,
                    value: 70,
                    description: `Maintain distance and use ranged attacks on ${enemy.name}`
                });
            }
        }
        
        return opportunities;
    }

    private suggestStance(
        _character: DeepReadonly<ICharacter>,
        threats: ThreatAssessment[],
        _opportunities: TacticalOpportunity[]
    ): 'aggressive' | 'defensive' | 'flanking' | 'suppressive' | 'retreating' {
        const healthPercent = _character.health / _character.maxHealth;
        const immediateThreats = threats.filter(t => t.type === 'immediate').length;
        
        // Critical health - retreat
        if (healthPercent < 0.3) return 'retreating';
        
        // Multiple immediate threats - defensive
        if (immediateThreats > 1) return 'defensive';
        
        // Single threat and good health - aggressive
        if (immediateThreats === 1 && healthPercent > 0.6) return 'aggressive';
        
        // Has ranged weapon and enemies are distant - suppressive
        if (this.checkCharacterHasRangedWeapon(_character) && threats.every(t => t.type === 'distant')) {
            return 'suppressive';
        }
        
        // Default to defensive
        return 'defensive';
    }

    private findCoverPositions(character: DeepReadonly<ICharacter>): ICoord[] {
        const positions: ICoord[] = [];
        const searchRadius = 10;
        
        // Simple grid search for cover positions
        for (let dx = -searchRadius; dx <= searchRadius; dx++) {
            for (let dy = -searchRadius; dy <= searchRadius; dy++) {
                if (dx === 0 && dy === 0) continue;
                
                const pos: ICoord = {
                    x: character.position.x + dx,
                    y: character.position.y + dy
                };
                
                // Check if position would provide cover (simplified)
                if (this.positionProvidesCover(pos)) {
                    positions.push(pos);
                }
            }
        }
        
        return positions;
    }


    private calculateSimpleRetreatPaths(
        character: DeepReadonly<ICharacter>,
        threats: ThreatAssessment[]
    ): ICoord[][] {
        const paths: ICoord[][] = [];
        
        if (threats.length === 0) return paths;
        
        // Just suggest moving away from the nearest threat
        const nearestThreat = threats[0]; // Already sorted by threat level
        if (!nearestThreat) return paths;
        
        const threatChar = this.state.characters.find(c => c.name === nearestThreat.source);
        
        if (threatChar) {
            // Simple retreat: move directly away
            const retreatDirection = Math.atan2(
                character.position.y - threatChar.position.y,
                character.position.x - threatChar.position.x
            );
            
            const path: ICoord[] = [];
            // Just 3 steps back
            for (let i = 1; i <= 3; i++) {
                path.push({
                    x: Math.round(character.position.x + Math.cos(retreatDirection) * i * 2),
                    y: Math.round(character.position.y + Math.sin(retreatDirection) * i * 2)
                });
            }
            
            paths.push(path);
        }
        
        return paths;
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
        if (!TeamService.areHostile(_fromChar, targetChar, this.state.game.teams)) {
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


    private positionProvidesCover(_pos: ICoord): boolean {
        // Simplified - would need actual map analysis
        // Check if position has adjacent walls or obstacles
        return false;
    }

}