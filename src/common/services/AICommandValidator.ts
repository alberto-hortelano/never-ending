import { State } from '../State';
import {
    AICommand
} from './AICommandParser';
import { DeepReadonly } from '../helpers/types';
import { ICharacter } from '../interfaces';

export interface ValidationError {
    field: string;
    value: any;
    error: string;
    suggestions?: string[];
}

export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
    command?: AICommand;
}

/**
 * Comprehensive AI command validator that collects all errors
 * instead of failing on the first one
 */
export class AICommandValidator {
    constructor(
        private state: State
    ) {}

    /**
     * Validates an AI command and returns all errors found
     */
    public validateCommand(command: unknown): ValidationResult {
        const errors: ValidationError[] = [];

        // Check if command is an object
        if (!command || typeof command !== 'object') {
            errors.push({
                field: 'command',
                value: command,
                error: 'Command must be a JSON object'
            });
            return { isValid: false, errors };
        }

        const cmd = command as Record<string, unknown>;

        // Check if type exists
        if (!cmd.type) {
            errors.push({
                field: 'type',
                value: undefined,
                error: 'Command type is required',
                suggestions: ['movement', 'attack', 'speech', 'character', 'map']
            });
            return { isValid: false, errors };
        }

        // Validate based on command type
        switch (cmd.type) {
            case 'movement':
                this.validateMovement(cmd, errors);
                break;
            case 'attack':
                this.validateAttack(cmd, errors);
                break;
            case 'speech':
                this.validateSpeech(cmd, errors);
                break;
            case 'character':
                this.validateCharacter(cmd, errors);
                break;
            case 'map':
                this.validateMap(cmd, errors);
                break;
            default:
                errors.push({
                    field: 'type',
                    value: cmd.type,
                    error: 'Invalid command type',
                    suggestions: ['movement', 'attack', 'speech', 'character', 'map']
                });
        }

        if (errors.length === 0) {
            return {
                isValid: true,
                errors: [],
                command: cmd as AICommand
            };
        }

        return {
            isValid: false,
            errors
        };
    }

    private validateMovement(cmd: Record<string, unknown>, errors: ValidationError[]): void {
        // Check characters array
        if (!Array.isArray(cmd.characters) || cmd.characters.length === 0) {
            errors.push({
                field: 'characters',
                value: cmd.characters,
                error: 'Movement command must have a characters array with at least one character'
            });
            return;
        }

        const existingCharacters = this.getExistingCharacterNames();
        const availableLocations = this.getAvailableLocations();

        cmd.characters.forEach((char: any, index: number) => {
            // Check character name
            if (!char.name) {
                errors.push({
                    field: `characters[${index}].name`,
                    value: undefined,
                    error: 'Character name is required'
                });
            } else if (!existingCharacters.includes(char.name)) {
                errors.push({
                    field: `characters[${index}].name`,
                    value: char.name,
                    error: 'Character does not exist',
                    suggestions: existingCharacters
                });
            }

            // Check location
            if (!char.location) {
                errors.push({
                    field: `characters[${index}].location`,
                    value: undefined,
                    error: 'Location is required'
                });
            } else {
                // Check for invalid location formats
                const location = char.location.toString().toLowerCase().trim();

                // Check if it's coordinates (not allowed)
                if (/^\d+\s*,\s*\d+$/.test(location)) {
                    errors.push({
                        field: `characters[${index}].location`,
                        value: char.location,
                        error: 'Coordinates are not allowed. Use room names or character names',
                        suggestions: [...availableLocations, ...existingCharacters]
                    });
                }
                // Check if it's a direction (not allowed)
                else if (this.isDirection(location)) {
                    errors.push({
                        field: `characters[${index}].location`,
                        value: char.location,
                        error: 'Directions are not allowed. Use room names or character names',
                        suggestions: [...availableLocations, ...existingCharacters]
                    });
                }
                // Check if location exists (room or character)
                else if (!availableLocations.includes(char.location) &&
                         !existingCharacters.includes(char.location) &&
                         location !== 'center') {
                    errors.push({
                        field: `characters[${index}].location`,
                        value: char.location,
                        error: 'Location does not exist',
                        suggestions: [...availableLocations, ...existingCharacters]
                    });
                }
            }
        });
    }

    private validateAttack(cmd: Record<string, unknown>, errors: ValidationError[]): void {
        // Check characters array
        if (!Array.isArray(cmd.characters) || cmd.characters.length === 0) {
            errors.push({
                field: 'characters',
                value: cmd.characters,
                error: 'Attack command must have a characters array with at least one attacker'
            });
            return;
        }

        const existingCharacters = this.getExistingCharacterNames();

        cmd.characters.forEach((char: any, index: number) => {
            // Check attacker name
            if (!char.name) {
                errors.push({
                    field: `characters[${index}].name`,
                    value: undefined,
                    error: 'Attacker name is required'
                });
            } else if (!existingCharacters.includes(char.name)) {
                errors.push({
                    field: `characters[${index}].name`,
                    value: char.name,
                    error: 'Attacker does not exist',
                    suggestions: existingCharacters
                });
            }

            // Check target
            if (!char.target) {
                errors.push({
                    field: `characters[${index}].target`,
                    value: undefined,
                    error: 'Target is required'
                });
            } else if (!existingCharacters.includes(char.target)) {
                errors.push({
                    field: `characters[${index}].target`,
                    value: char.target,
                    error: 'Target does not exist',
                    suggestions: existingCharacters
                });
            }
        });
    }

    private validateSpeech(cmd: Record<string, unknown>, errors: ValidationError[]): void {
        // Check source
        if (!cmd.source) {
            errors.push({
                field: 'source',
                value: undefined,
                error: 'Required field missing'
            });
        }

        // Check content
        if (!cmd.content) {
            errors.push({
                field: 'content',
                value: undefined,
                error: 'Required field missing'
            });
        }

        // Validate answers if present
        if (cmd.answers !== undefined && !Array.isArray(cmd.answers)) {
            errors.push({
                field: 'answers',
                value: cmd.answers,
                error: 'Answers must be an array of strings'
            });
        }
    }

    private validateCharacter(cmd: Record<string, unknown>, errors: ValidationError[]): void {
        // Check characters array
        if (!Array.isArray(cmd.characters) || cmd.characters.length === 0) {
            errors.push({
                field: 'characters',
                value: cmd.characters,
                error: 'Character command must have a characters array with at least one character'
            });
            return;
        }

        const existingCharacters = this.getExistingCharacterNames();
        const availableLocations = this.getAvailableLocations();
        const validRaces = ['human', 'alien', 'robot'];
        const validFactions = ['player', 'enemy', 'neutral'];
        const validSpeeds = ['slow', 'medium', 'fast'];
        const validOrientations = ['top', 'right', 'bottom', 'left'];

        cmd.characters.forEach((char: any, index: number) => {
            // Check name
            if (!char.name) {
                errors.push({
                    field: `characters[${index}].name`,
                    value: undefined,
                    error: 'Required field missing'
                });
            } else if (existingCharacters.includes(char.name)) {
                errors.push({
                    field: `characters[${index}].name`,
                    value: char.name,
                    error: 'Character with this name already exists'
                });
            }

            // Check race
            if (!char.race) {
                errors.push({
                    field: `characters[${index}].race`,
                    value: undefined,
                    error: 'Required field missing',
                    suggestions: validRaces
                });
            } else if (!validRaces.includes(char.race)) {
                errors.push({
                    field: `characters[${index}].race`,
                    value: char.race,
                    error: 'Invalid race value',
                    suggestions: validRaces
                });
            }

            // Check description
            if (!char.description) {
                errors.push({
                    field: `characters[${index}].description`,
                    value: undefined,
                    error: 'Required field missing'
                });
            }

            // Check faction
            if (!char.faction) {
                errors.push({
                    field: `characters[${index}].faction`,
                    value: undefined,
                    error: 'Required field missing',
                    suggestions: validFactions
                });
            } else if (!validFactions.includes(char.faction)) {
                errors.push({
                    field: `characters[${index}].faction`,
                    value: char.faction,
                    error: 'Invalid faction value',
                    suggestions: validFactions
                });
            }

            // Check speed
            if (!char.speed) {
                errors.push({
                    field: `characters[${index}].speed`,
                    value: undefined,
                    error: 'Required field missing',
                    suggestions: validSpeeds
                });
            } else if (!validSpeeds.includes(char.speed)) {
                errors.push({
                    field: `characters[${index}].speed`,
                    value: char.speed,
                    error: 'Invalid speed value',
                    suggestions: validSpeeds
                });
            }

            // Check orientation
            if (!char.orientation) {
                errors.push({
                    field: `characters[${index}].orientation`,
                    value: undefined,
                    error: 'Required field missing',
                    suggestions: validOrientations
                });
            } else if (!validOrientations.includes(char.orientation)) {
                errors.push({
                    field: `characters[${index}].orientation`,
                    value: char.orientation,
                    error: 'Invalid orientation value',
                    suggestions: validOrientations
                });
            }

            // Check location
            if (!char.location) {
                errors.push({
                    field: `characters[${index}].location`,
                    value: undefined,
                    error: 'Required field missing',
                    suggestions: [...availableLocations, ...existingCharacters]
                });
            } else if (!availableLocations.includes(char.location) &&
                      !existingCharacters.includes(char.location)) {
                errors.push({
                    field: `characters[${index}].location`,
                    value: char.location,
                    error: 'Location does not exist',
                    suggestions: [...availableLocations, ...existingCharacters]
                });
            }

            // Validate palette if present
            if (char.palette) {
                this.validatePalette(char.palette, `characters[${index}].palette`, errors);
            }
        });
    }

    private validateMap(cmd: Record<string, unknown>, errors: ValidationError[]): void {
        // Map validation is complex and would require checking building structures,
        // room sizes, positions, etc. For now, we'll do basic validation
        if (!cmd.palette || typeof cmd.palette !== 'object') {
            errors.push({
                field: 'palette',
                value: cmd.palette,
                error: 'Map command must have a palette object'
            });
        } else {
            const palette = cmd.palette as Record<string, unknown>;
            if (!palette.terrain) {
                errors.push({
                    field: 'palette.terrain',
                    value: undefined,
                    error: 'Terrain color is required'
                });
            }
        }

        if (!Array.isArray(cmd.buildings)) {
            errors.push({
                field: 'buildings',
                value: cmd.buildings,
                error: 'Map command must have a buildings array'
            });
        }
    }

    private validatePalette(palette: any, basePath: string, errors: ValidationError[]): void {
        const colorFields = ['skin', 'helmet', 'suit'];
        const validColorNames = ['white', 'black', 'red', 'blue', 'green', 'yellow', 'gold',
                                 'silver', 'gray', 'brown', 'orange', 'purple', 'pink',
                                 'darkred', 'darkblue', 'darkgreen', 'darkgray'];

        colorFields.forEach(field => {
            if (palette[field]) {
                const color = palette[field].toString();

                // Check if it's a hex color
                if (color.startsWith('#')) {
                    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
                        errors.push({
                            field: `${basePath}.${field}`,
                            value: color,
                            error: 'Invalid hex color format',
                            suggestions: ['#rrggbb format or color names']
                        });
                    }
                }
                // Check if it's a valid color name
                else if (!validColorNames.includes(color.toLowerCase()) &&
                        !color.match(/^(rgb|hsl)/)) {
                    errors.push({
                        field: `${basePath}.${field}`,
                        value: color,
                        error: 'Invalid color format. Use hex code (#rrggbb) or color name',
                        suggestions: ['#d7a55f', ...validColorNames.slice(0, 8)]
                    });
                }
            }
        });
    }

    private isDirection(location: string): boolean {
        const directions = [
            'north', 'south', 'east', 'west', 'up', 'down', 'left', 'right',
            'northeast', 'northwest', 'southeast', 'southwest',
            'north-east', 'north-west', 'south-east', 'south-west'
        ];
        return directions.includes(location);
    }

    private getExistingCharacterNames(): string[] {
        return this.state.characters.map((c: DeepReadonly<ICharacter>) => c.name);
    }

    private getAvailableLocations(): string[] {
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
}