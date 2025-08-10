import { State } from '../State';
import { ICharacter, IGame } from '../interfaces';
import { DeepReadonly } from '../helpers/types';

export interface GameContext {
    currentCharacter: CharacterContext;
    visibleCharacters: CharacterContext[];
    mapInfo: MapContext;
    recentEvents: EventContext[];
    gameState: {
        turn: number | string;
        phase: string;
        objectives?: string[];
    };
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
    lastAction?: string;
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
        const mapInfo = this.buildMapContext(character);
        const gameState = this.buildGameState();

        return {
            currentCharacter: currentChar,
            visibleCharacters: visibleChars,
            mapInfo: mapInfo,
            recentEvents: this.recentEvents.slice(-5), // Last 5 events
            gameState: gameState
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

    private buildCharacterContext(character: DeepReadonly<ICharacter>, includeFull: boolean): CharacterContext {
        const isPlayer = character.name === 'Player';
        const isAlly = character.name === 'Data' || this.isAllyOf('Player', character.name);

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
            isAlly: isAlly
        };

        if (includeFull) {
            context.inventory = [...(character.inventory?.items || [])];
            context.faction = this.getCharacterFaction(character);
            context.personality = this.getCharacterPersonality(character);
            context.lastAction = this.getLastAction(character.name);
        }

        return context;
    }

    private getVisibleCharacters(character: DeepReadonly<ICharacter>): CharacterContext[] {
        const state = this.state;
        const visibleChars: CharacterContext[] = [];
        const viewDistance = 15; // Tiles visible in each direction

        for (const otherChar of state.characters) {
            if (otherChar.name === character.name) continue;

            const distance = Math.sqrt(
                Math.pow(otherChar.position.x - character.position.x, 2) +
                Math.pow(otherChar.position.y - character.position.y, 2)
            );

            if (distance <= viewDistance) {
                // Check line of sight (simplified - doesn't account for walls yet)
                if (this.hasLineOfSight(character, otherChar)) {
                    visibleChars.push(this.buildCharacterContext(otherChar, false));
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

    private findCoverPositions(_character: DeepReadonly<ICharacter>): Array<{ x: number; y: number }> {
        // Find positions that provide cover from enemies
        const coverPositions: Array<{ x: number; y: number }> = [];
        
        // TODO: Implement actual cover detection based on walls and obstacles
        // For now, return some dummy positions
        return coverPositions;
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

    private isAllyOf(character1: string, character2: string): boolean {
        // Determine if two characters are allies
        if (character1 === 'Player' && character2 === 'Data') return true;
        if (character1 === 'Data' && character2 === 'Player') return true;
        
        // Check faction alignment
        const faction1 = this.getCharacterFactionByName(character1);
        const faction2 = this.getCharacterFactionByName(character2);
        
        return faction1 === faction2 && faction1 !== 'neutral';
    }

    private isHostileTo(character1: string, character2: string): boolean {
        // Determine if two characters are hostile
        if (this.isAllyOf(character1, character2)) return false;
        
        // For now, NPCs are hostile to player unless explicitly allied
        if ((character1 === 'Player' || character1 === 'Data') && 
            (character2 !== 'Player' && character2 !== 'Data')) {
            return true;
        }
        
        return false;
    }

    private getCharacterFaction(character: DeepReadonly<ICharacter>): string {
        // Determine character's faction based on name or properties
        // faction not in ICharacter interface, check by name
        
        if (character.name === 'Player' || character.name === 'Data') {
            return 'player';
        }
        
        // Parse faction from name or description
        const name = character.name.toLowerCase();
        if (name.includes('syndicate')) return 'syndicate';
        if (name.includes('rebel')) return 'rebels';
        if (name.includes('technomancer')) return 'technomancers';
        if (name.includes('military')) return 'military';
        
        return 'neutral';
    }

    private getCharacterFactionByName(name: string): string {
        const state = this.state;
        const character = state.characters.find((c: DeepReadonly<ICharacter>) => c.name === name);
        return character ? this.getCharacterFaction(character) : 'neutral';
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
}