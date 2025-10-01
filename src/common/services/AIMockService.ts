import {
    AICommand,
    MovementCommand,
    SpeechCommand,
    AttackCommand,
    MapCommand,
    CharacterCommand
} from './AICommandParser';
import type { IMessage } from '../interfaces';
import type { GameContext } from './AIContextBuilder';
import { SeededRandom } from '../helpers/SeededRandom';

interface MockScenario {
    id: string;
    turns: MockTurn[];
    currentTurn: number;
}

interface MockTurn {
    context: string; // What context triggers this response
    responses: MockResponse[];
}

interface MockResponse {
    character: string;
    command: MovementCommand | SpeechCommand | AttackCommand | MapCommand | CharacterCommand;
    delay?: number; // Optional delay to simulate thinking
}

/**
 * Mock AI service for development and testing
 * Provides preset, story-coherent responses without API calls
 */
export class AIMockService {
    private static instance: AIMockService;
    private currentScenario: MockScenario;
    private turnCounter: Map<string, number> = new Map();
    private rng: SeededRandom;
    private readonly defaultSeed = 42; // Fixed seed for reproducible mock behavior

    // Predefined scenarios with coherent story progression
    private readonly scenarios: MockScenario[] = [
        {
            id: 'exploration_encounter',
            currentTurn: 0,
            turns: [
                // Turn 1: Data detects something and warns player
                {
                    context: 'Data',
                    responses: [
                        {
                            character: 'Data',
                            command: {
                                type: 'movement',
                                characters: [{
                                    name: 'Data',
                                    location: 'player'
                                }]
                            } as MovementCommand
                        },
                        {
                            character: 'Data',
                            command: {
                                type: 'speech',
                                source: 'Data',
                                content: 'Comandante, mis sensores detectan múltiples formas de vida aproximándose. Análisis preliminar sugiere hostiles armados a 200 metros.',
                                answers: [
                                    '¿Cuántos son?',
                                    'Prepárate para combate',
                                    'Busquemos cobertura'
                                ]
                            } as SpeechCommand,
                            delay: 500
                        }
                    ]
                },
                // Turn 2: Enemy appears and questions
                {
                    context: 'enemy',
                    responses: [
                        {
                            character: 'enemy_soldier_1',
                            command: {
                                type: 'movement',
                                characters: [{
                                    name: 'enemy_soldier_1',
                                    location: 'player'
                                }]
                            } as MovementCommand
                        },
                        {
                            character: 'enemy_soldier_1',
                            command: {
                                type: 'speech',
                                source: 'enemy_soldier_1',
                                content: '¡Alto ahí! ¿Desertor o espía? El Comando Estelar no tolera traidores. Explícate rápido o abrimos fuego.',
                                answers: [
                                    'Soy un superviviente, no un desertor',
                                    'El Comando ya no existe, la guerra terminó',
                                    'Baja el arma, podemos hablar'
                                ]
                            } as SpeechCommand,
                            delay: 800
                        }
                    ]
                },
                // Turn 3: Resolution - combat or negotiation
                {
                    context: 'enemy_hostile',
                    responses: [
                        {
                            character: 'enemy_soldier_1',
                            command: {
                                type: 'speech',
                                source: 'enemy_soldier_1',
                                content: '¡Mentiras! El Comando paga bien por desertores como tú. ¡Prepárense para abrir fuego!',
                                answers: []
                            } as SpeechCommand
                        },
                        {
                            character: 'enemy_soldier_1',
                            command: {
                                type: 'attack',
                                characters: [{
                                    name: 'enemy_soldier_1',
                                    target: 'player',
                                }]
                            } as AttackCommand,
                            delay: 1000
                        }
                    ]
                }
            ]
        },
        {
            id: 'defensive_position',
            currentTurn: 0,
            turns: [
                // Turn 1: Data suggests defensive strategy
                {
                    context: 'Data',
                    responses: [
                        {
                            character: 'Data',
                            command: {
                                type: 'speech',
                                source: 'Data',
                                content: 'Comandante, esta posición es tácticamente ventajosa. Recomiendo establecer un perímetro defensivo. Detecto movimiento al noreste.',
                                answers: [
                                    'Establece vigilancia',
                                    '¿Qué tipo de movimiento?',
                                    'Avancemos con cautela'
                                ]
                            } as SpeechCommand
                        }
                    ]
                },
                // Turn 2: Enemy patrol approaches
                {
                    context: 'enemy_patrol',
                    responses: [
                        {
                            character: 'enemy_soldier_2',
                            command: {
                                type: 'movement',
                                characters: [{
                                    name: 'enemy_soldier_2',
                                    location: 'Barracks'  // Use room name instead of coordinates
                                }]
                            } as MovementCommand
                        },
                        {
                            character: 'enemy_soldier_2',
                            command: {
                                type: 'attack',
                                characters: [{
                                    name: 'enemy_soldier_2',
                                    target: 'area',
                                }]
                            } as AttackCommand,
                            delay: 500
                        }
                    ]
                },
                // Turn 3: Data provides tactical update
                {
                    context: 'Data',
                    responses: [
                        {
                            character: 'Data',
                            command: {
                                type: 'speech',
                                source: 'Data',
                                content: 'Patrulla enemiga en vigilancia. Probabilidad de detección: 67%. Sugiero maniobra de flanqueo o esperar apertura.',
                                answers: []
                            } as SpeechCommand
                        }
                    ]
                }
            ]
        }
    ];

    private constructor() {
        // Initialize with fixed seed for consistent mock responses
        this.rng = new SeededRandom(this.defaultSeed);
        // Start with the first scenario
        this.currentScenario = JSON.parse(JSON.stringify(this.scenarios[0]));
    }

    public static getInstance(): AIMockService {
        if (!AIMockService.instance) {
            AIMockService.instance = new AIMockService();
        }
        return AIMockService.instance;
    }

    /**
     * Process an AI action request and return a mock response
     */
    public async requestAIAction(
        context: GameContext,
    ): Promise<{ messages: IMessage[], command: AICommand | null }> {
        // Extract character name from context
        const characterName = context.currentCharacter?.name || 'unknown';

        // Get or initialize turn count for this character
        let turnIndex = this.turnCounter.get(characterName) || 0;

        // Ensure we don't exceed available turns
        if (turnIndex >= this.currentScenario.turns.length) {
            // Cycle back or switch scenarios
            turnIndex = 0;
            // Use RNG to randomly pick next scenario for variety while maintaining reproducibility
            const nextScenarioIndex = this.rng.nextInt(this.scenarios.length);
            this.currentScenario = JSON.parse(JSON.stringify(this.scenarios[nextScenarioIndex]));
        }

        const currentTurn = this.currentScenario.turns[turnIndex];

        // Find appropriate response for this character
        const response = currentTurn?.responses.find(r =>
            r.character.toLowerCase() === characterName.toLowerCase() ||
            r.character === 'Data' && characterName === 'Data' ||
            r.character.includes('enemy') && characterName.includes('enemy')
        ) || currentTurn?.responses[0];

        if (!response) {
            // Default idle response
            return {
                messages: [],
                command: null
            };
        }

        // Update turn counter
        this.turnCounter.set(characterName, turnIndex + 1);

        // Simulate thinking delay if specified
        if (response.delay) {
            await new Promise(resolve => setTimeout(resolve, response.delay));
        }

        // Log the mock AI decision - only speech content
        if (response.command.type === 'speech') {
            const speechCmd = response.command as SpeechCommand;
            console.log(`[AI] ${characterName}: "${speechCmd.content?.substring(0, 60)}..."`);
        } else {
            console.log(`[AI] ${characterName}: ${response.command.type}`);
        }

        return {
            messages: [],
            command: response.command
        };
    }

    /**
     * Process dialogue response for conversations
     */
    public async requestDialogueResponse(
        _speaker: string,
        listener: string,
        playerChoice: string,
    ): Promise<{ messages: IMessage[], command: AICommand | null }> {
        // Generate contextual response based on player choice
        let responseContent = '';
        let answers: string[] = [];

        // Analyze player choice for appropriate response
        if (playerChoice.toLowerCase().includes('desertor') || playerChoice.toLowerCase().includes('superviviente')) {
            responseContent = 'Todos dicen lo mismo. El Comando tiene formas de verificar la lealtad. Última oportunidad: ¿vienes con nosotros o resistirás?';
            answers = ['Iré con ustedes', 'Prefiero morir libre', 'Data, necesito apoyo'];
        } else if (playerChoice.toLowerCase().includes('comando') || playerChoice.toLowerCase().includes('guerra')) {
            responseContent = 'El Comando Estelar persiste donde hay orden. Los desertores como tú socavan todo lo que construimos. ¡Ríndete ahora!';
            answers = [];
        } else if (playerChoice.toLowerCase().includes('hablar') || playerChoice.toLowerCase().includes('baja')) {
            responseContent = 'No negociamos con desertores. Pero... tal vez haya información que valga tu vida. ¿Qué sabes de otros supervivientes?';
            answers = ['Estoy solo', 'Hay un asentamiento al oeste', 'No diré nada'];
        } else {
            // Default response
            responseContent = 'Tus palabras no cambiarán nada. El protocolo es claro con los desertores.';
            answers = [];
        }

        const command: SpeechCommand = {
            type: 'speech',
            source: listener,
            content: responseContent,
            answers: answers
        };

        return {
            messages: [],
            command: command
        };
    }

    /**
     * Mock story initialization
     */
    public async requestStoryInitialization(
    ): Promise<{ commands: AICommand[], narrative?: string }> {

        // Return a more complex tactical map for a stolen military cruiser
        const mapCommand: MapCommand = {
            type: 'map',
            seed: this.rng.getSeed(), // Use fixed seed for consistent map generation
            palette: {
                terrain: '#1a1a2e'  // Dark space/metal floor
            },
            buildings: [
                // Main ship structure
                {
                    name: 'Bridge Section',
                    rooms: [
                        {
                            name: 'Bridge',
                            size: 'big'
                        },
                        {
                            name: 'Navigation',
                            size: 'small'
                        },
                        {
                            name: 'Communications',
                            size: 'small'
                        }
                    ],
                    position: { x: 10, y: 10 },
                    palette: {
                        floor: '#2a2a3e',
                        innerWalls: '#3a3a4e',
                        outerWalls: '#4a4a5e'
                    }
                },
                // Engineering section
                {
                    name: 'Engineering Bay',
                    rooms: [
                        {
                            name: 'Engine Room',
                            size: 'big'
                        },
                        {
                            name: 'Power Core',
                            size: 'medium'
                        },
                        {
                            name: 'Maintenance',
                            size: 'small'
                        }
                    ],
                    position: { x: 35, y: 15 },
                    palette: {
                        floor: '#3e2a2a',
                        innerWalls: '#4e3a3a',
                        outerWalls: '#5e4a4a'
                    }
                },
                // Crew quarters
                {
                    name: 'Crew Quarters',
                    rooms: [
                        {
                            name: 'Barracks',
                            size: 'medium'
                        },
                        {
                            name: 'Medical Bay',
                            size: 'small'
                        },
                        {
                            name: 'Armory',
                            size: 'small'
                        }
                    ],
                    position: { x: 20, y: 30 },
                    palette: {
                        floor: '#2a3e2a',
                        innerWalls: '#3a4e3a',
                        outerWalls: '#4a5e4a'
                    }
                },
                // Cargo hold
                {
                    name: 'Cargo Hold',
                    rooms: [
                        {
                            name: 'Main Hold',
                            size: 'big'
                        },
                        {
                            name: 'Storage A',
                            size: 'small'
                        },
                        {
                            name: 'Storage B',
                            size: 'small'
                        }
                    ],
                    position: { x: 5, y: 35 },
                    palette: {
                        floor: '#2e2e2e',
                        innerWalls: '#3e3e3e',
                        outerWalls: '#4e4e4e'
                    }
                }
            ],
            characters: [
                {
                    name: 'enemy_patrol_leader',
                    race: 'human',
                    description: 'Líder de patrulla del Comando',
                    location: 'Bridge',  // Use room name instead of coordinates
                    speed: 'medium',
                    orientation: 'bottom',
                    palette: {
                        skin: '#d7a55f',
                        helmet: '#2a2a2a',
                        suit: '#404040'
                    }
                },
                {
                    name: 'enemy_soldier_1',
                    race: 'human',
                    description: 'Soldado del Comando',
                    location: 'Engine Room',  // Use room name instead of coordinates
                    speed: 'medium',
                    orientation: 'left',
                    palette: {
                        skin: '#c8956d',
                        helmet: '#333333',
                        suit: '#3a3a3a'
                    }
                },
                {
                    name: 'enemy_soldier_2',
                    race: 'human',
                    description: 'Guardia del Comando',
                    location: 'Navigation',  // Use room name instead of coordinates
                    speed: 'slow',
                    orientation: 'right',
                    palette: {
                        skin: '#b8a590',
                        helmet: '#2d2d2d',
                        suit: '#454545'
                    }
                }
            ],
            doors: [
                // Bridge connections
                {
                    type: 'regular',
                    position: { x: 18, y: 15 },
                    side: 'east'
                },
                // Engineering connections
                {
                    type: 'regular',
                    position: { x: 35, y: 20 },
                    side: 'south'
                },
                // Crew quarters connections
                {
                    type: 'regular',
                    position: { x: 25, y: 30 },
                    side: 'north'
                },
                // Cargo hold connections
                {
                    type: 'locked',
                    position: { x: 10, y: 35 },
                    side: 'west'
                }
            ]
        };

        const commands: AICommand[] = [
            mapCommand
        ];

        const narrative = 'El crucero militar robado flota silencioso en el espacio. Los sistemas de emergencia tiñen los pasillos de rojo intermitente. Data detecta múltiples señales de vida a bordo - parece que el Comando Estelar ya los encontró. Debes llegar al puente de mando antes que sea demasiado tarde...';

        return { commands, narrative };
    }

    /**
     * Reset the mock service to start from the beginning
     */
    public reset(): void {
        this.turnCounter.clear();
        this.rng.reset(); // Reset RNG to ensure consistent behavior
        this.currentScenario = JSON.parse(JSON.stringify(this.scenarios[0]));
    }

    /**
     * Switch to a specific scenario
     */
    public setScenario(scenarioId: string): void {
        const scenario = this.scenarios.find(s => s.id === scenarioId);
        if (scenario) {
            this.currentScenario = JSON.parse(JSON.stringify(scenario));
            this.turnCounter.clear();
        }
    }

    /**
     * Set a custom seed for the random number generator
     * Useful for testing or specific mock scenarios
     */
    public setSeed(seed: number): void {
        this.rng.reset(seed);
    }
}