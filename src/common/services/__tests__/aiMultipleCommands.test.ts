import { AICommandValidator } from '../AICommandValidator';
import { State } from '../../State';

describe('AICommandValidator - Multiple Commands Detection', () => {
    let validator: AICommandValidator;
    let state: State;

    beforeEach(() => {
        // Create state with mock data
        const testState: any = {
            characters: [
                { name: 'Player', health: 100, position: { x: 5, y: 5 } },
                { name: 'Enemy1', health: 100, position: { x: 10, y: 10 } },
                { name: 'NPC1', health: 100, position: { x: 15, y: 15 } }
            ],
            map: []
        };
        state = new State(testState);
        validator = new AICommandValidator(state);
    });

    describe('Single Command Validation', () => {
        it('should accept a valid single speech command', () => {
            const command = {
                type: 'speech',
                source: 'NPC',
                content: 'Hello there!'
            };

            const result = validator.validateCommand(command);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should accept a valid single movement command', () => {
            const command = {
                type: 'movement',
                characters: [
                    { name: 'Enemy1', location: 'center' }
                ]
            };

            const result = validator.validateCommand(command);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
    });

    describe('Multiple Commands Detection', () => {
        it('should reject an array of commands', () => {
            const commands = [
                { type: 'speech', source: 'NPC1', content: 'Hello' },
                { type: 'speech', source: 'NPC2', content: 'Hi' }
            ];

            const result = validator.validateCommand(commands);
            expect(result.isValid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]!.error).toContain('Multiple commands detected');
            expect(result.errors[0]!.error).toContain('ONE command object');
        });

        it('should reject commands wrapped in a commands array', () => {
            const command = {
                commands: [
                    { type: 'speech', source: 'NPC', content: 'Hello' }
                ]
            };

            const result = validator.validateCommand(command);
            expect(result.isValid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]!.field).toBe('commands');
            expect(result.errors[0]!.error).toContain('only for story initialization');
        });

        it('should reject multiple speech fields in single object', () => {
            const command = {
                type: 'speech',
                speech1: { source: 'NPC1', content: 'Hello' },
                speech2: { source: 'NPC2', content: 'Hi' }
            };

            const result = validator.validateCommand(command);
            expect(result.isValid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]!.error).toContain('Multiple command fields detected');
        });

        it('should reject multiple movement fields in single object', () => {
            const command = {
                type: 'movement',
                movement1: { characters: [] },
                movement2: { characters: [] }
            };

            const result = validator.validateCommand(command);
            expect(result.isValid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]!.error).toContain('Multiple command fields detected');
        });
    });

    describe('Error Messages', () => {
        it('should provide clear suggestions for array errors', () => {
            const commands = [
                { type: 'speech', source: 'NPC', content: 'Hello' }
            ];

            const result = validator.validateCommand(commands);
            expect(result.isValid).toBe(false);
            expect(result.errors[0]!.suggestions).toBeDefined();
            expect(result.errors[0]!.suggestions![0]).toContain('single command object');
        });

        it('should provide clear suggestions for commands field errors', () => {
            const command = {
                commands: [{ type: 'speech', source: 'NPC', content: 'Hello' }]
            };

            const result = validator.validateCommand(command);
            expect(result.isValid).toBe(false);
            expect(result.errors[0]!.suggestions).toBeDefined();
            expect(result.errors[0]!.suggestions![0]).toContain('{"type": "speech"');
        });
    });
});