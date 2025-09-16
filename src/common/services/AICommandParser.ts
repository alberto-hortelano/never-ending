export type CommandType = 'storyline' | 'map' | 'character' | 'movement' | 'attack' | 'speech' | 'tactical_directive' | 'item';

export interface AICommand {
    type: CommandType;
    [key: string]: unknown;
}

export interface MovementCommand extends AICommand {
    type: 'movement';
    characters: Array<{
        name: string;
        location: string;
    }>;
}

export interface AttackCommand extends AICommand {
    type: 'attack';
    characters: Array<{
        name: string;
        target: string;
        attack: 'melee' | 'hold' | 'kill' | 'retreat';
    }>;
}

export interface SpeechCommand extends AICommand {
    type: 'speech';
    source: string;
    content: string;
    answers?: string[];
    action?: string;
    target?: string;  // Target of the speech (for AI-to-AI conversations)
    listener?: string; // Alternative field name for target
}

export interface CharacterCommand extends AICommand {
    type: 'character';
    characters: Array<{
        name: string;
        race: 'human' | 'alien' | 'robot';
        description: string;
        speed: 'slow' | 'medium' | 'fast';
        orientation: 'top' | 'right' | 'bottom' | 'left';
        location: string;
        palette?: {
            skin: string;
            helmet: string;
            suit: string;
        };
    }>;
}

import type { StorylineActionData } from '../events/ConversationEvents';

export type StorylineActionType = 'map' | 'character' | 'movement' | 'attack' | 'item';

export interface StorylineCommand extends AICommand {
    type: 'storyline';
    content: string;
    description: string;
    action: StorylineActionType; // Required action
    actionData?: StorylineActionData; // Additional data for the action
}

export interface TacticalDirectiveCommand extends AICommand {
    type: 'tactical_directive';
    objective: 'attack' | 'defend' | 'patrol' | 'pursue' | 'retreat' | 'support';
    priority_targets?: string[];
    tactics: {
        stance: 'aggressive' | 'defensive' | 'flanking' | 'suppressive' | 'retreating';
        engagement_range: 'close' | 'medium' | 'long';
        retreat_threshold: number;
        coordination?: 'individual' | 'flanking' | 'concentrated' | 'dispersed';
    };
    position?: { x: number; y: number };
    duration?: number; // How many turns to maintain this directive
}

export interface MapCommand extends AICommand {
    type: 'map';
    seed?: number; // Optional seed for reproducible map generation
    palette: {
        terrain: string;
    };
    buildings: Array<{
        name: string;
        rooms: Array<{
            name: string;
            size: 'small' | 'medium' | 'big';
        }>;
        position: { x: number; y: number };
        palette: {
            floor: string;
            innerWalls: string;
            outerWalls: string;
        };
    }>;
    characters: Array<{
        name: string;
        race: 'human' | 'alien' | 'robot';
        description: string;
        speed: 'slow' | 'medium' | 'fast';
        orientation: 'top' | 'right' | 'bottom' | 'left';
        location: string;
        palette: {
            skin: string;
            helmet: string;
            suit: string;
        };
    }>;
    doors?: Array<{
        type: 'regular' | 'locked' | 'transition';
        position: { x: number; y: number };
        side: 'north' | 'south' | 'east' | 'west' | 'between';
        targetPosition?: { x: number; y: number };
        keyRequired?: string;
        transition?: {
            description: string;
            targetMap?: string;
        };
    }>;
}

export class AICommandParser {
    public validate(command: unknown): AICommand | null {
        if (!command || typeof command !== 'object') {
            console.error('Invalid command: not an object');
            return null;
        }

        const cmd = command as Record<string, unknown>;
        if (!cmd.type) {
            console.error('Invalid command: missing type');
            return null;
        }

        switch (cmd.type) {
            case 'movement':
                return this.validateMovement(command);
            case 'attack':
                return this.validateAttack(command);
            case 'speech':
                return this.validateSpeech(command);
            case 'character':
                return this.validateCharacter(command);
            case 'storyline':
                return this.validateStoryline(command);
            case 'map':
                return this.validateMap(command);
            case 'tactical_directive':
                return this.validateTacticalDirective(command);
            case 'item':
                return this.validateItem(command);
            default:
                console.error('Invalid command type:', cmd.type);
                return null;
        }
    }

    private validateMovement(command: unknown): MovementCommand | null {
        if (!command || typeof command !== 'object') {
            console.error('Movement command is not an object');
            return null;
        }
        
        const cmd = command as Record<string, unknown>;
        if (!Array.isArray(cmd.characters) || cmd.characters.length === 0) {
            console.error('Movement command missing characters array');
            return null;
        }

        for (const char of cmd.characters) {
            const charObj = char as Record<string, unknown>;
            if (!charObj.name || !charObj.location) {
                console.error('Movement character missing name or location');
                return null;
            }
        }

        // At this point, we've validated the structure matches MovementCommand
        return cmd as MovementCommand;
    }

    private validateAttack(command: unknown): AttackCommand | null {
        if (!command || typeof command !== 'object') {
            console.error('Attack command is not an object');
            return null;
        }
        
        const cmd = command as Record<string, unknown>;
        if (!Array.isArray(cmd.characters) || cmd.characters.length === 0) {
            console.error('Attack command missing characters array');
            return null;
        }

        const validAttacks = ['melee', 'hold', 'kill', 'retreat'];
        for (const char of cmd.characters) {
            const charObj = char as Record<string, unknown>;
            if (!charObj.name || !charObj.target || !charObj.attack) {
                console.error('Attack character missing required fields');
                return null;
            }
            if (!validAttacks.includes(charObj.attack as string)) {
                console.error('Invalid attack type:', charObj.attack);
                return null;
            }
        }

        // At this point, we've validated the structure matches AttackCommand
        return cmd as AttackCommand;
    }

    private validateSpeech(command: unknown): SpeechCommand | null {
        if (!command || typeof command !== 'object') {
            console.error('Speech command is not an object');
            return null;
        }
        
        const cmd = command as Record<string, unknown>;
        if (!cmd.source || !cmd.content) {
            console.error('Speech command missing source or content');
            return null;
        }

        if (cmd.answers && !Array.isArray(cmd.answers)) {
            console.error('Speech answers must be an array');
            return null;
        }

        // At this point, we've validated the structure matches SpeechCommand
        return cmd as SpeechCommand;
    }

    private validateCharacter(command: unknown): CharacterCommand | null {
        if (!command || typeof command !== 'object') {
            console.error('Character command is not an object');
            return null;
        }
        
        const cmd = command as Record<string, unknown>;
        if (!Array.isArray(cmd.characters) || cmd.characters.length === 0) {
            console.error('Character command missing characters array');
            return null;
        }

        const validRaces = ['human', 'alien', 'robot'];
        const validSpeeds = ['slow', 'medium', 'fast'];
        const validOrientations = ['top', 'right', 'bottom', 'left'];

        for (const char of cmd.characters) {
            const charObj = char as Record<string, unknown>;
            if (!charObj.name || !charObj.race || !charObj.description || !charObj.speed || !charObj.orientation || !charObj.location) {
                console.error('Character missing required fields');
                return null;
            }

            if (!validRaces.includes(charObj.race as string)) {
                console.error('Invalid race:', charObj.race);
                return null;
            }

            if (!validSpeeds.includes(charObj.speed as string)) {
                console.error('Invalid speed:', charObj.speed);
                return null;
            }

            if (!validOrientations.includes(charObj.orientation as string)) {
                console.error('Invalid orientation:', charObj.orientation);
                return null;
            }

            if (charObj.palette) {
                if (!this.validatePalette(charObj.palette)) {
                    return null;
                }
            }
        }

        // At this point, we've validated the structure matches CharacterCommand
        return cmd as CharacterCommand;
    }

    private validateStoryline(command: unknown): StorylineCommand | null {
        if (!command || typeof command !== 'object') {
            console.error('Storyline command is not an object');
            return null;
        }
        
        const cmd = command as Record<string, unknown>;
        // Accept either content OR description (or both)
        if (!cmd.content && !cmd.description) {
            console.error('Storyline command missing both content and description');
            return null;
        }
        
        // Ensure we have at least one of the required fields
        const validatedCmd = {
            ...cmd,
            content: cmd.content || cmd.description || '',
            description: cmd.description || cmd.content || ''
        };

        // At this point, we've validated the structure matches StorylineCommand
        return validatedCmd as StorylineCommand;
    }

    private validateMap(command: unknown): MapCommand | null {
        if (!command || typeof command !== 'object') {
            console.error('Map command is not an object');
            return null;
        }
        
        const cmd = command as Record<string, unknown>;
        if (!cmd.palette || typeof cmd.palette !== 'object') {
            console.error('Map command missing palette');
            return null;
        }
        
        const palette = cmd.palette as Record<string, unknown>;
        if (!palette.terrain) {
            console.error('Map command missing palette.terrain');
            return null;
        }

        if (!Array.isArray(cmd.buildings)) {
            console.error('Map command missing buildings array');
            return null;
        }

        for (const building of cmd.buildings as Array<Record<string, unknown>>) {
            if (!building.name || !Array.isArray(building.rooms)) {
                console.error('Building missing name or rooms');
                return null;
            }

            const pos = building.position as Record<string, unknown> | undefined;
            if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') {
                console.error('Building missing valid position');
                return null;
            }

            if (pos.x < 0 || pos.x > 100 || pos.y < 0 || pos.y > 100) {
                console.error('Building position out of range (0-100)');
                return null;
            }

            if (!this.validateBuildingPalette(building.palette)) {
                return null;
            }

            const validSizes = ['small', 'medium', 'big'];
            for (const room of building.rooms) {
                if (!room.name || !room.size) {
                    console.error('Room missing name or size');
                    return null;
                }
                if (!validSizes.includes(room.size)) {
                    console.error('Invalid room size:', room.size);
                    return null;
                }
            }
        }

        if (cmd['characters'] && Array.isArray(cmd['characters'])) {
            // Reuse character validation logic
            const charCommand = { type: 'character', characters: cmd['characters'] };
            if (!this.validateCharacter(charCommand)) {
                return null;
            }
        }

        // At this point, we've validated the structure matches MapCommand
        return cmd as MapCommand;
    }

    private validatePalette(palette: unknown): boolean {
        if (!palette || typeof palette !== 'object') {
            console.error('Palette is not an object');
            return false;
        }
        
        const pal = palette as Record<string, unknown>;
        if (!pal.skin || !pal.helmet || !pal.suit) {
            console.error('Palette missing required colors');
            return false;
        }

        // Validate CSS color format (basic check)
        const colorRegex = /^#[0-9A-Fa-f]{6}$|^#[0-9A-Fa-f]{3}$|^transparent$|^[a-z]+$/i;
        
        if (!colorRegex.test(pal['skin'] as string) || !colorRegex.test(pal['helmet'] as string) || !colorRegex.test(pal['suit'] as string)) {
            console.error('Invalid color format in palette');
            return false;
        }

        return true;
    }

    private validateBuildingPalette(palette: unknown): boolean {
        if (!palette || typeof palette !== 'object') {
            console.error('Building palette is not an object');
            return false;
        }
        
        const pal = palette as Record<string, unknown>;
        if (!pal['floor'] || !pal['innerWalls'] || !pal['outerWalls']) {
            console.error('Building palette missing required colors');
            return false;
        }

        const colorRegex = /^#[0-9A-Fa-f]{6}$|^#[0-9A-Fa-f]{3}$|^[a-z]+$/i;
        
        if (!colorRegex.test(pal['floor'] as string) || !colorRegex.test(pal['innerWalls'] as string) || !colorRegex.test(pal['outerWalls'] as string)) {
            console.error('Invalid color format in building palette');
            return false;
        }

        return true;
    }

    public parseMultipleCommands(response: string): AICommand[] {
        const commands: AICommand[] = [];
        
        // Try to extract multiple JSON objects from the response
        const jsonMatches = response.matchAll(/\{[\s\S]*?\}(?=\s*\{|\s*$)/g);
        
        for (const match of jsonMatches) {
            try {
                const parsed = JSON.parse(match[0]);
                const validated = this.validate(parsed);
                if (validated) {
                    commands.push(validated);
                }
            } catch (error) {
                console.error('Error parsing JSON command:', error);
            }
        }

        return commands;
    }

    private validateTacticalDirective(command: unknown): TacticalDirectiveCommand | null {
        if (!command || typeof command !== 'object') {
            console.error('Tactical directive is not an object');
            return null;
        }
        
        const cmd = command as Record<string, unknown>;
        if (!cmd.objective || !cmd.tactics) {
            console.error('Tactical directive missing objective or tactics');
            return null;
        }

        const validObjectives = ['attack', 'defend', 'patrol', 'pursue', 'retreat', 'support'];
        if (!validObjectives.includes(cmd.objective as string)) {
            console.error('Invalid tactical objective:', cmd.objective);
            return null;
        }

        const tactics = cmd.tactics as Record<string, unknown>;
        const validStances = ['aggressive', 'defensive', 'flanking', 'suppressive', 'retreating'];
        if (!tactics.stance || !validStances.includes(tactics.stance as string)) {
            console.error('Invalid tactical stance:', tactics.stance);
            return null;
        }

        const validRanges = ['close', 'medium', 'long'];
        if (!tactics.engagement_range || !validRanges.includes(tactics.engagement_range as string)) {
            console.error('Invalid engagement range:', tactics.engagement_range);
            return null;
        }

        if (typeof tactics.retreat_threshold !== 'number' || 
            tactics.retreat_threshold < 0 || 
            tactics.retreat_threshold > 1) {
            console.error('Invalid retreat threshold:', tactics.retreat_threshold);
            return null;
        }

        if (tactics.coordination) {
            const validCoordination = ['individual', 'flanking', 'concentrated', 'dispersed'];
            if (!validCoordination.includes(tactics.coordination as string)) {
                console.error('Invalid coordination type:', tactics.coordination);
                return null;
            }
        }

        const position = cmd.position as Record<string, unknown> | undefined;
        if (position) {
            if (typeof position.x !== 'number' || typeof position.y !== 'number') {
                console.error('Invalid position in tactical directive');
                return null;
            }
        }

        // At this point, we've validated the structure matches TacticalDirectiveCommand
        return cmd as TacticalDirectiveCommand;
    }
    
    private validateItem(command: unknown): AICommand | null {
        if (!command || typeof command !== 'object') {
            console.error('Item command is not an object');
            return null;
        }
        
        const cmd = command as Record<string, unknown>;
        if (!Array.isArray(cmd.items) || cmd.items.length === 0) {
            console.error('Item command missing items array');
            return null;
        }
        
        const validTypes = ['weapon', 'consumable', 'key', 'artifact'];
        for (const item of cmd.items as Array<Record<string, unknown>>) {
            if (!item.name || !item.type || !item.location) {
                console.error('Item missing required fields');
                return null;
            }
            
            if (!validTypes.includes(item.type as string)) {
                console.error('Invalid item type:', item.type);
                return null;
            }
        }
        
        return cmd as AICommand;
    }
}