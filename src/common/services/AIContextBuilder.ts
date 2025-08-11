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
    canConverse?: boolean;  // True if within conversation range (3 cells)
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

    constructor(private state: State) {
    }

    public buildTurnContext(character: DeepReadonly<ICharacter>, state: State): GameContext {
        this.state = state;
        const currentChar = this.buildCharacterContext(character, true);
        const visibleChars = this.getVisibleCharacters(character);
        const charactersInConversationRange = this.getCharactersInConversationRange(character, visibleChars);
        const mapInfo = this.buildMapContext(character);
        const gameState = this.buildGameState();
        const tacticalAnalysis = this.performTacticalAnalysis(character, visibleChars);

        return {
            currentCharacter: currentChar,
            visibleCharacters: visibleChars,
            charactersInConversationRange: charactersInConversationRange,
            mapInfo: mapInfo,
            recentEvents: this.recentEvents.slice(-5), // Last 5 events
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
        // Filter visible characters to only those within conversation range (3 cells)
        const conversationRange = 3;
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
                    charContext.canConverse = distance <= 3; // Can talk within 3 cells
                    charContext.hasLineOfSight = hasLOS;
                    charContext.isInCover = this.isCharacterInCover(otherChar);
                    charContext.threatLevel = this.assessThreatLevel(character, otherChar, distance);
                    visibleChars.push(charContext);
                }
            }
        }

        return visibleChars;
    }

    private hasLineOfSight(_from: DeepReadonly<ICharacter>, _to: DeepReadonly<ICharacter>): boolean {
        // Simplified line of sight check
        // TODO: Implement proper raycasting through walls
        return true;
    }

    private buildMapContext(character: DeepReadonly<ICharacter>): MapContext {
        const state = this.state;
        const map = state.map as ExtendedMap;
        
        // Get nearby buildings
        const nearbyBuildings = this.getNearbyBuildings(character);
        
        // Get tactical positions
        const obstacles = this.getNearbyObstacles(character);
        const coverPositions = this.findCoverPositions(character);

        return {
            terrain: map?.palette?.terrain || 'urban',
            buildings: nearbyBuildings,
            obstacles: obstacles,
            coverPositions: coverPositions
        };
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
    }

    public clearEvents(): void {
        this.recentEvents = [];
    }

    /**
     * Perform tactical analysis of the battlefield
     */
    private performTacticalAnalysis(
        character: DeepReadonly<ICharacter>,
        visibleChars: CharacterContext[]
    ): TacticalAnalysis {
        const threats = this.assessThreats(character, visibleChars);
        const opportunities = this.findTacticalOpportunities(character, visibleChars);
        const suggestedStance = this.suggestStance(character, threats, opportunities);
        const coverPositions = this.findCoverPositions(character);
        const flankingRoutes = this.calculateFlankingRoutes(character, visibleChars);
        const retreatPaths = this.calculateRetreatPaths(character, threats);

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

    private findTacticalOpportunities(
        character: DeepReadonly<ICharacter>,
        visibleChars: CharacterContext[]
    ): TacticalOpportunity[] {
        const opportunities: TacticalOpportunity[] = [];
        
        // Check for flanking opportunities
        const enemies = visibleChars.filter(c => c.isEnemy);
        for (const enemy of enemies) {
            if (!enemy.position) continue;
            
            // Simple flanking position calculation
            const flankPos = this.calculateFlankPosition(character.position, enemy.position);
            if (flankPos) {
                opportunities.push({
                    type: 'flank',
                    position: flankPos,
                    value: 70,
                    description: `Flank ${enemy.name}`
                });
            }
        }
        
        // Check for crossfire opportunities with allies
        const allies = visibleChars.filter(c => c.isAlly);
        if (allies.length > 0 && enemies.length > 0) {
            for (const enemy of enemies) {
                if (!enemy.position) continue;
                
                for (const ally of allies) {
                    if (!ally.position) continue;
                    
                    // Check if enemy is between character and ally
                    if (this.isInCrossfire(character.position, ally.position, enemy.position)) {
                        opportunities.push({
                            type: 'crossfire',
                            position: enemy.position,
                            value: 80,
                            description: `Crossfire on ${enemy.name} with ${ally.name}`
                        });
                    }
                }
            }
        }
        
        return opportunities;
    }

    private suggestStance(
        _character: DeepReadonly<ICharacter>,
        threats: ThreatAssessment[],
        opportunities: TacticalOpportunity[]
    ): 'aggressive' | 'defensive' | 'flanking' | 'suppressive' | 'retreating' {
        const healthPercent = _character.health / _character.maxHealth;
        const immediateThreats = threats.filter(t => t.type === 'immediate').length;
        
        // Critical health - retreat
        if (healthPercent < 0.3) return 'retreating';
        
        // Multiple immediate threats - defensive
        if (immediateThreats > 1) return 'defensive';
        
        // Good flanking opportunity - flanking
        if (opportunities.some(o => o.type === 'flank' && o.value > 60)) return 'flanking';
        
        // Single threat and good health - aggressive
        if (immediateThreats === 1 && healthPercent > 0.6) return 'aggressive';
        
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

    private calculateFlankingRoutes(
        character: DeepReadonly<ICharacter>,
        visibleChars: CharacterContext[]
    ): ICoord[][] {
        const routes: ICoord[][] = [];
        const enemies = visibleChars.filter(c => c.isEnemy);
        
        for (const enemy of enemies) {
            if (!enemy.position) continue;
            
            // Calculate simple flanking route
            const route = this.calculateFlankRoute(character.position, enemy.position);
            if (route) {
                routes.push(route);
            }
        }
        
        return routes;
    }

    private calculateRetreatPaths(
        character: DeepReadonly<ICharacter>,
        threats: ThreatAssessment[]
    ): ICoord[][] {
        const paths: ICoord[][] = [];
        
        if (threats.length === 0) return paths;
        
        // Calculate average threat direction
        let avgX = 0, avgY = 0;
        for (const threat of threats) {
            // Find threat character position
            const threatChar = this.state.characters.find(c => c.name === threat.source);
            if (threatChar) {
                avgX += threatChar.position.x;
                avgY += threatChar.position.y;
            }
        }
        avgX /= threats.length;
        avgY /= threats.length;
        
        // Create retreat path away from average threat
        const retreatDirection = Math.atan2(
            character.position.y - avgY,
            character.position.x - avgX
        );
        
        const path: ICoord[] = [];
        for (let i = 1; i <= 5; i++) {
            path.push({
                x: character.position.x + Math.cos(retreatDirection) * i * 2,
                y: character.position.y + Math.sin(retreatDirection) * i * 2
            });
        }
        
        paths.push(path);
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

    private calculateFlankPosition(myPos: ICoord, enemyPos: ICoord): ICoord | null {
        const angle = Math.atan2(enemyPos.y - myPos.y, enemyPos.x - myPos.x);
        const flankAngle = angle + Math.PI / 2; // 90 degrees to the side
        const flankDistance = 5;
        
        return {
            x: enemyPos.x + Math.cos(flankAngle) * flankDistance,
            y: enemyPos.y + Math.sin(flankAngle) * flankDistance
        };
    }

    private isInCrossfire(pos1: ICoord, pos2: ICoord, target: ICoord): boolean {
        // Check if target is roughly between two positions
        const angle1 = Math.atan2(target.y - pos1.y, target.x - pos1.x);
        const angle2 = Math.atan2(target.y - pos2.y, target.x - pos2.x);
        const angleDiff = Math.abs(angle1 - angle2);
        
        // If angles are roughly opposite (around 180 degrees), it's crossfire
        return angleDiff > Math.PI * 0.75;
    }

    private positionProvidesCover(_pos: ICoord): boolean {
        // Simplified - would need actual map analysis
        // Check if position has adjacent walls or obstacles
        return false;
    }

    private calculateFlankRoute(from: ICoord, to: ICoord): ICoord[] | null {
        // Simple arc route for flanking
        const route: ICoord[] = [];
        const directAngle = Math.atan2(to.y - from.y, to.x - from.x);
        const flankAngle = directAngle + Math.PI / 3; // 60 degrees offset
        
        // Create arc path
        for (let i = 1; i <= 3; i++) {
            const progress = i / 3;
            const currentAngle = flankAngle + (directAngle - flankAngle) * progress;
            const distance = Math.sqrt(
                Math.pow(to.x - from.x, 2) + Math.pow(to.y - from.y, 2)
            ) * progress;
            
            route.push({
                x: from.x + Math.cos(currentAngle) * distance,
                y: from.y + Math.sin(currentAngle) * distance
            });
        }
        
        return route;
    }
}