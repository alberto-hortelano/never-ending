import { AICommand, CharacterCommand } from './AICommandParser';
import { AICommandValidator, ValidationError, ValidationResult } from './AICommandValidator';

/**
 * Specialized validator for story initialization commands
 * Allows multiple commands but ensures no duplicate types
 */
export class StoryInitializationValidator {
    constructor(
        private commandValidator: AICommandValidator
    ) {}

    /**
     * Validates an array of story initialization commands
     * Ensures no duplicate command types and all commands are valid
     */
    public validateInitializationCommands(commands: unknown): ValidationResult {
        const errors: ValidationError[] = [];

        // Check if commands is an array
        if (!Array.isArray(commands)) {
            errors.push({
                field: 'commands',
                value: commands,
                error: 'Story initialization must return a commands array',
                suggestions: ['Return format: {"commands": [...], "narrative": "..."}']
            });
            return { isValid: false, errors };
        }

        // Check for empty array
        if (commands.length === 0) {
            errors.push({
                field: 'commands',
                value: commands,
                error: 'Commands array cannot be empty',
                suggestions: ['Include at least a map command and character command']
            });
            return { isValid: false, errors };
        }

        // Track command types we've seen
        const commandTypes = new Map<string, number>();
        const validatedCommands: AICommand[] = [];

        // Extract room names from the map command (if present) for character location validation
        const roomNames: string[] = [];
        const createdCharacterNames: string[] = [];

        // First pass: Extract context from commands for validation
        commands.forEach(command => {
            if (command && typeof command === 'object') {
                const cmd = command as Record<string, unknown>;

                // Extract rooms from map command
                if (cmd.type === 'map' && Array.isArray(cmd.buildings)) {
                    cmd.buildings.forEach((building: any) => {
                        if (Array.isArray(building.rooms)) {
                            building.rooms.forEach((room: any) => {
                                if (room.name && typeof room.name === 'string') {
                                    roomNames.push(room.name);
                                }
                            });
                        }
                    });
                }

                // Extract character names being created
                if (cmd.type === 'character' && Array.isArray(cmd.characters)) {
                    cmd.characters.forEach((char: any) => {
                        if (char.name && typeof char.name === 'string') {
                            createdCharacterNames.push(char.name);
                        }
                    });
                }
            }
        });

        // Validate each command with context
        commands.forEach((command, index) => {
            // For character commands during initialization, we need special validation
            if (command && typeof command === 'object' && (command as any).type === 'character') {
                const result = this.validateCharacterCommandForInitialization(
                    command as CharacterCommand,
                    roomNames,
                    createdCharacterNames
                );

                if (!result.isValid) {
                    result.errors.forEach(error => {
                        errors.push({
                            ...error,
                            field: `commands[${index}].${error.field}`
                        });
                    });
                } else if (result.command) {
                    validatedCommands.push(result.command);
                    const type = result.command.type;
                    const count = (commandTypes.get(type) || 0) + 1;
                    commandTypes.set(type, count);

                    if (count > 1) {
                        errors.push({
                            field: `commands[${index}]`,
                            value: command,
                            error: `Duplicate command type "${type}". Story initialization can only have ONE command of each type.`,
                            suggestions: ['Remove duplicate commands', `Keep only one ${type} command`]
                        });
                    }
                }
            } else {
                // For non-character commands, use regular validation
                const result = this.commandValidator.validateCommand(command);

                if (!result.isValid) {
                    result.errors.forEach(error => {
                        errors.push({
                            ...error,
                            field: `commands[${index}].${error.field}`
                        });
                    });
                } else if (result.command) {
                    validatedCommands.push(result.command);
                    const type = result.command.type;
                    const count = (commandTypes.get(type) || 0) + 1;
                    commandTypes.set(type, count);

                    if (count > 1) {
                        errors.push({
                            field: `commands[${index}]`,
                            value: command,
                            error: `Duplicate command type "${type}". Story initialization can only have ONE command of each type.`,
                            suggestions: ['Remove duplicate commands', `Keep only one ${type} command`]
                        });
                    }
                }
            }
        });

        // Check for required command types for story initialization
        const requiredTypes = ['map', 'character'];
        for (const requiredType of requiredTypes) {
            if (!commandTypes.has(requiredType)) {
                errors.push({
                    field: 'commands',
                    value: commands,
                    error: `Missing required "${requiredType}" command for story initialization`,
                    suggestions: [`Add a ${requiredType} command to initialize the game`]
                });
            }
        }

        if (errors.length === 0) {
            return {
                isValid: true,
                errors: [],
                command: { commands: validatedCommands } as any
            };
        }

        return {
            isValid: false,
            errors
        };
    }

    /**
     * Validates a character command specifically for story initialization
     * Uses room names from map command instead of current state
     */
    private validateCharacterCommandForInitialization(
        command: CharacterCommand,
        availableRooms: string[],
        characterNamesBeingCreated: string[]
    ): ValidationResult {
        const errors: ValidationError[] = [];
        const cmd = command as Record<string, unknown>;

        // Check characters array
        if (!Array.isArray(cmd.characters) || cmd.characters.length === 0) {
            errors.push({
                field: 'characters',
                value: cmd.characters,
                error: 'Character command must have a characters array with at least one character'
            });
            return { isValid: false, errors };
        }

        const validRaces = ['human', 'alien', 'robot'];
        const validFactions = ['player', 'enemy', 'neutral'];
        const validSpeeds = ['slow', 'medium', 'fast'];
        const validOrientations = ['top', 'right', 'bottom', 'left'];

        const characters = cmd.characters as any[];
        const seenNames = new Set<string>();

        characters.forEach((char, index) => {
            // Check name
            if (!char.name) {
                errors.push({
                    field: `characters[${index}].name`,
                    value: undefined,
                    error: 'Required field missing'
                });
            } else if (seenNames.has(char.name)) {
                errors.push({
                    field: `characters[${index}].name`,
                    value: char.name,
                    error: 'Duplicate character name in same command'
                });
            } else {
                seenNames.add(char.name);
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

            // Check location - use rooms from map command and character names being created
            if (!char.location) {
                errors.push({
                    field: `characters[${index}].location`,
                    value: undefined,
                    error: 'Required field missing',
                    suggestions: [...availableRooms, ...characterNamesBeingCreated]
                });
            } else if (!availableRooms.includes(char.location) &&
                      !characterNamesBeingCreated.includes(char.location)) {
                errors.push({
                    field: `characters[${index}].location`,
                    value: char.location,
                    error: 'Location does not exist',
                    suggestions: [...availableRooms, ...characterNamesBeingCreated]
                });
            }

            // Validate palette if present
            if (char.palette) {
                this.validatePalette(char.palette, `characters[${index}].palette`, errors);
            }
        });

        if (errors.length === 0) {
            return {
                isValid: true,
                errors: [],
                command: command
            };
        }

        return {
            isValid: false,
            errors
        };
    }

    private validatePalette(palette: unknown, basePath: string, errors: ValidationError[]): void {
        const paletteObj = palette as Record<string, unknown>;
        const colorFields = ['skin', 'helmet', 'suit'];
        const validColorNames = ['white', 'black', 'red', 'blue', 'green', 'yellow', 'gold',
                                'silver', 'gray', 'brown', 'orange', 'purple', 'pink',
                                'darkred', 'darkblue', 'darkgreen', 'darkgray'];

        colorFields.forEach(field => {
            if (paletteObj[field]) {
                const color = String(paletteObj[field]);

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

    /**
     * Formats validation errors for display
     */
    public formatErrors(errors: ValidationError[]): string {
        let output = 'Story Initialization Validation Failed\n';
        output += '=====================================\n\n';

        errors.forEach((error, index) => {
            output += `Error ${index + 1}: ${error.field}\n`;
            output += `  Issue: ${error.error}\n`;
            if (error.suggestions && error.suggestions.length > 0) {
                output += `  Suggestions: ${error.suggestions.join(', ')}\n`;
            }
            output += '\n';
        });

        return output;
    }
}