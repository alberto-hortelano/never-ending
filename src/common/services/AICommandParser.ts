export interface AICommand {
    type: 'storyline' | 'map' | 'character' | 'movement' | 'attack' | 'speech';
    [key: string]: any;
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

export interface StorylineCommand extends AICommand {
    type: 'storyline';
    content: string;
    description: string;
}

export interface MapCommand extends AICommand {
    type: 'map';
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
}

export class AICommandParser {
    public validate(command: any): AICommand | null {
        if (!command || typeof command !== 'object') {
            console.error('Invalid command: not an object');
            return null;
        }

        if (!command.type) {
            console.error('Invalid command: missing type');
            return null;
        }

        switch (command.type) {
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
            default:
                console.error('Invalid command type:', command.type);
                return null;
        }
    }

    private validateMovement(command: any): MovementCommand | null {
        if (!Array.isArray(command.characters) || command.characters.length === 0) {
            console.error('Movement command missing characters array');
            return null;
        }

        for (const char of command.characters) {
            if (!char.name || !char.location) {
                console.error('Movement character missing name or location');
                return null;
            }
        }

        return command as MovementCommand;
    }

    private validateAttack(command: any): AttackCommand | null {
        if (!Array.isArray(command.characters) || command.characters.length === 0) {
            console.error('Attack command missing characters array');
            return null;
        }

        const validAttacks = ['melee', 'hold', 'kill', 'retreat'];
        for (const char of command.characters) {
            if (!char.name || !char.target || !char.attack) {
                console.error('Attack character missing required fields');
                return null;
            }
            if (!validAttacks.includes(char.attack)) {
                console.error('Invalid attack type:', char.attack);
                return null;
            }
        }

        return command as AttackCommand;
    }

    private validateSpeech(command: any): SpeechCommand | null {
        if (!command.source || !command.content) {
            console.error('Speech command missing source or content');
            return null;
        }

        if (command.answers && !Array.isArray(command.answers)) {
            console.error('Speech answers must be an array');
            return null;
        }

        return command as SpeechCommand;
    }

    private validateCharacter(command: any): CharacterCommand | null {
        if (!Array.isArray(command.characters) || command.characters.length === 0) {
            console.error('Character command missing characters array');
            return null;
        }

        const validRaces = ['human', 'alien', 'robot'];
        const validSpeeds = ['slow', 'medium', 'fast'];
        const validOrientations = ['top', 'right', 'bottom', 'left'];

        for (const char of command.characters) {
            if (!char.name || !char.race || !char.description || !char.speed || !char.orientation || !char.location) {
                console.error('Character missing required fields');
                return null;
            }

            if (!validRaces.includes(char.race)) {
                console.error('Invalid race:', char.race);
                return null;
            }

            if (!validSpeeds.includes(char.speed)) {
                console.error('Invalid speed:', char.speed);
                return null;
            }

            if (!validOrientations.includes(char.orientation)) {
                console.error('Invalid orientation:', char.orientation);
                return null;
            }

            if (char.palette) {
                if (!this.validatePalette(char.palette)) {
                    return null;
                }
            }
        }

        return command as CharacterCommand;
    }

    private validateStoryline(command: any): StorylineCommand | null {
        if (!command.content || !command.description) {
            console.error('Storyline command missing content or description');
            return null;
        }

        return command as StorylineCommand;
    }

    private validateMap(command: any): MapCommand | null {
        if (!command.palette || !command.palette.terrain) {
            console.error('Map command missing palette.terrain');
            return null;
        }

        if (!Array.isArray(command.buildings)) {
            console.error('Map command missing buildings array');
            return null;
        }

        for (const building of command.buildings) {
            if (!building.name || !Array.isArray(building.rooms)) {
                console.error('Building missing name or rooms');
                return null;
            }

            if (!building.position || typeof building.position.x !== 'number' || typeof building.position.y !== 'number') {
                console.error('Building missing valid position');
                return null;
            }

            if (building.position.x < 0 || building.position.x > 100 || building.position.y < 0 || building.position.y > 100) {
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

        if (command.characters && Array.isArray(command.characters)) {
            // Reuse character validation logic
            const charCommand = { type: 'character', characters: command.characters };
            if (!this.validateCharacter(charCommand)) {
                return null;
            }
        }

        return command as MapCommand;
    }

    private validatePalette(palette: any): boolean {
        if (!palette.skin || !palette.helmet || !palette.suit) {
            console.error('Palette missing required colors');
            return false;
        }

        // Validate CSS color format (basic check)
        const colorRegex = /^#[0-9A-Fa-f]{6}$|^#[0-9A-Fa-f]{3}$|^transparent$|^[a-z]+$/i;
        
        if (!colorRegex.test(palette.skin) || !colorRegex.test(palette.helmet) || !colorRegex.test(palette.suit)) {
            console.error('Invalid color format in palette');
            return false;
        }

        return true;
    }

    private validateBuildingPalette(palette: any): boolean {
        if (!palette || !palette.floor || !palette.innerWalls || !palette.outerWalls) {
            console.error('Building palette missing required colors');
            return false;
        }

        const colorRegex = /^#[0-9A-Fa-f]{6}$|^#[0-9A-Fa-f]{3}$|^[a-z]+$/i;
        
        if (!colorRegex.test(palette.floor) || !colorRegex.test(palette.innerWalls) || !colorRegex.test(palette.outerWalls)) {
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
}