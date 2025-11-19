/**
 * Mock AI Provider with hardcoded responses for testing
 */

import { BaseAIProvider } from '../BaseAIProvider';
import {
  IAIProviderConfig,
  IAIResponse,
  IAIRequestOptions,
  IAIProviderFactory
} from '../types';
import { IMessage } from '../../interfaces';

/**
 * Mock scenarios with predefined responses
 */
interface MockScenario {
  name: string;
  triggers: string[];
  responses: string[];
  currentIndex?: number;
}

/**
 * Mock AI Provider for testing without API calls
 */
export class MockProvider extends BaseAIProvider {
  private scenarios: Map<string, MockScenario>;
  private defaultScenario: string = 'exploration';
  private currentScenarioName: string = 'exploration';
  private randomSeed: number;
  private messageHistory: IMessage[] = [];

  constructor(config: IAIProviderConfig) {
    super(
      config,
      {
        streaming: false,
        functionCalling: false,
        maxContextTokens: 100000,
        maxResponseTokens: 4000,
        systemMessages: true,
        vision: false,
        jsonMode: true
      }
    );

    this.randomSeed = (config.options?.seed as number) || Date.now();
    this.scenarios = this.initializeScenarios();
  }

  /**
   * Initialize mock scenarios
   */
  private initializeScenarios(): Map<string, MockScenario> {
    const scenarios = new Map<string, MockScenario>();

    // Exploration scenario
    scenarios.set('exploration', {
      name: 'exploration',
      triggers: ['explore', 'search', 'investigate', 'look'],
      responses: [
        JSON.stringify({
          command: 'movement',
          character: 'Data',
          target: { type: 'direction', value: 'northeast' },
          action: 'search',
          description: 'Data searches the northeast area for clues'
        }),
        JSON.stringify({
          command: 'speech',
          character: 'Data',
          target: { type: 'broadcast' },
          text: 'I am detecting unusual energy signatures in this area. We should proceed with caution.',
          answers: []
        }),
        JSON.stringify({
          command: 'movement',
          character: 'Data',
          target: { type: 'room', value: 'corridor_2' },
          action: 'investigate',
          description: 'Data investigates the corridor'
        }),
        JSON.stringify({
          command: 'speech',
          character: 'Data',
          target: { type: 'character', value: 'Tasha' },
          text: 'Tasha, have you noticed any anomalies in this sector?',
          answers: [
            { text: 'Yes, the readings are unusual', followUpCommand: { command: 'movement', target: { type: 'direction', value: 'north' }, action: 'investigate' } },
            { text: 'No, everything seems normal', followUpCommand: null },
            { text: 'I need more time to analyze', followUpCommand: null }
          ]
        })
      ],
      currentIndex: 0
    });

    // Combat scenario
    scenarios.set('combat', {
      name: 'combat',
      triggers: ['attack', 'fight', 'combat', 'battle', 'enemy'],
      responses: [
        JSON.stringify({
          command: 'attack',
          character: 'Borg',
          target: { type: 'character', value: 'Tasha' },
          weaponType: 'melee',
          description: 'The Borg attacks Tasha with its cybernetic arm'
        }),
        JSON.stringify({
          command: 'movement',
          character: 'Borg',
          target: { type: 'direction', value: 'towards_player' },
          action: 'advance',
          description: 'The Borg advances menacingly'
        }),
        JSON.stringify({
          command: 'speech',
          character: 'Borg',
          target: { type: 'broadcast' },
          text: 'Resistance is futile. You will be assimilated.',
          answers: []
        }),
        JSON.stringify({
          command: 'attack',
          character: 'Borg',
          target: { type: 'character', value: 'Data' },
          weaponType: 'ranged',
          description: 'The Borg fires an energy beam at Data'
        })
      ],
      currentIndex: 0
    });

    // Dialogue scenario
    scenarios.set('dialogue', {
      name: 'dialogue',
      triggers: ['talk', 'speak', 'conversation', 'chat', 'discuss'],
      responses: [
        JSON.stringify({
          command: 'speech',
          character: 'Data',
          target: { type: 'character', value: 'Tasha' },
          text: 'Tasha, what is your assessment of our current situation?',
          answers: [
            { text: 'We need to be cautious', followUpCommand: null },
            { text: 'I think we should advance', followUpCommand: { command: 'movement', target: { type: 'direction', value: 'north' } } },
            { text: 'Let me scout ahead first', followUpCommand: { command: 'movement', target: { type: 'direction', value: 'north' }, action: 'scout' } }
          ]
        }),
        JSON.stringify({
          command: 'speech',
          character: 'Tasha',
          target: { type: 'character', value: 'Data' },
          text: 'Data, can you analyze these readings for me?',
          answers: [
            { text: 'Certainly, give me a moment', followUpCommand: null },
            { text: 'The patterns are concerning', followUpCommand: null },
            { text: 'We should alert the captain', followUpCommand: { command: 'speech', target: { type: 'broadcast' }, text: 'Captain, we have a situation here.' } }
          ]
        })
      ],
      currentIndex: 0
    });

    // Map generation scenario
    scenarios.set('map_generation', {
      name: 'map_generation',
      triggers: ['generate map', 'create map', 'new map', 'build map'],
      responses: [
        JSON.stringify({
          command: 'map',
          variant: 'starship',
          buildings: [
            {
              name: 'Bridge',
              type: 'command_center',
              x: 10,
              y: 5,
              width: 8,
              height: 6,
              rooms: [
                { name: 'Captain Chair', type: 'command', doors: [{ position: 'south', opensTo: 'corridor' }] },
                { name: 'Navigation', type: 'control', doors: [{ position: 'east', opensTo: 'corridor' }] }
              ]
            },
            {
              name: 'Engineering',
              type: 'facility',
              x: 5,
              y: 15,
              width: 10,
              height: 8,
              rooms: [
                { name: 'Main Engineering', type: 'technical', doors: [{ position: 'north', opensTo: 'corridor' }] },
                { name: 'Warp Core', type: 'power', doors: [{ position: 'west', opensTo: 'Main Engineering' }] }
              ]
            }
          ]
        }),
        JSON.stringify({
          command: 'map',
          variant: 'station',
          buildings: [
            {
              name: 'Medical Bay',
              type: 'medical',
              x: 20,
              y: 10,
              width: 7,
              height: 7,
              rooms: [
                { name: 'Surgery', type: 'medical', doors: [{ position: 'south', opensTo: 'corridor' }] },
                { name: 'Recovery', type: 'medical', doors: [{ position: 'east', opensTo: 'Surgery' }] }
              ]
            }
          ]
        })
      ],
      currentIndex: 0
    });

    // Character spawn scenario
    scenarios.set('spawn_character', {
      name: 'spawn_character',
      triggers: ['spawn', 'create character', 'add character', 'new character'],
      responses: [
        JSON.stringify({
          command: 'character',
          name: 'Security Officer',
          type: 'security',
          faction: 'federation',
          location: { type: 'nearPlayer', distance: 3 },
          equipment: ['phaser', 'tricorder'],
          stats: { health: 100, armor: 20 }
        }),
        JSON.stringify({
          command: 'character',
          name: 'Borg Drone',
          type: 'enemy',
          faction: 'borg',
          location: { type: 'room', value: 'Engineering' },
          equipment: ['cybernetic_arm'],
          stats: { health: 150, armor: 40 }
        })
      ],
      currentIndex: 0
    });

    // Item spawn scenario
    scenarios.set('spawn_item', {
      name: 'spawn_item',
      triggers: ['item', 'create item', 'spawn item', 'drop item'],
      responses: [
        JSON.stringify({
          command: 'item',
          name: 'Phaser Rifle',
          type: 'weapon',
          location: { type: 'coordinates', x: 15, y: 10 },
          properties: { damage: 25, range: 10 }
        }),
        JSON.stringify({
          command: 'item',
          name: 'Medical Kit',
          type: 'consumable',
          location: { type: 'character', value: 'Data' },
          properties: { healing: 50 }
        })
      ],
      currentIndex: 0
    });

    // Story initialization
    scenarios.set('story_init', {
      name: 'story_init',
      triggers: ['initialize story', 'start story', 'begin story'],
      responses: [
        JSON.stringify({
          storyName: 'Lost in the Nebula',
          setting: 'A Federation starship trapped in an uncharted nebula',
          protagonists: ['Data', 'Tasha'],
          antagonists: ['Borg Collective'],
          initialObjective: 'Find a way to escape the nebula while avoiding Borg patrols',
          commands: [
            {
              command: 'map',
              variant: 'starship',
              buildings: [
                {
                  name: 'USS Enterprise Section',
                  type: 'starship',
                  x: 0,
                  y: 0,
                  width: 30,
                  height: 20,
                  rooms: []
                }
              ]
            },
            {
              command: 'character',
              name: 'Data',
              type: 'player',
              faction: 'federation',
              location: { type: 'coordinates', x: 10, y: 10 }
            },
            {
              command: 'character',
              name: 'Tasha',
              type: 'companion',
              faction: 'federation',
              location: { type: 'nearCharacter', value: 'Data', distance: 2 }
            }
          ]
        })
      ],
      currentIndex: 0
    });

    return scenarios;
  }

  /**
   * Provider-specific initialization
   */
  protected async performInitialization(): Promise<void> {
    // Mock provider doesn't need real initialization
    this.logger.info('Mock provider initialized with scenarios', {
      scenarios: Array.from(this.scenarios.keys())
    });
  }

  /**
   * Send message and return mock response
   */
  protected async performSendMessage(messages: IMessage[], _options?: IAIRequestOptions): Promise<IAIResponse> {
    // Add to history
    this.messageHistory.push(...messages);

    // Get the last user message
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) {
      // Return a default response if no messages
      return {
        content: JSON.stringify({ command: 'idle' }),
        model: 'mock-1.0',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, cost: 0 }
      };
    }
    const content = lastMessage.content.toLowerCase();

    // Detect scenario from message content
    let selectedScenario = this.detectScenario(content);

    // Get response from scenario
    const response = this.getScenarioResponse(selectedScenario);

    // Add some delay to simulate API call
    await this.delay(100 + Math.random() * 400);

    return {
      content: response,
      model: 'mock-1.0',
      metadata: {
        scenario: selectedScenario.name,
        responseIndex: selectedScenario.currentIndex
      },
      usage: {
        promptTokens: this.estimateTokens(messages.map(m => m.content).join(' ')),
        completionTokens: this.estimateTokens(response),
        totalTokens: 0,
        cost: 0
      }
    };
  }

  /**
   * Detect scenario from message content
   */
  private detectScenario(content: string): MockScenario {
    // Check each scenario's triggers
    for (const scenario of this.scenarios.values()) {
      for (const trigger of scenario.triggers) {
        if (content.includes(trigger)) {
          this.currentScenarioName = scenario.name;
          return scenario;
        }
      }
    }

    // Check for specific command types in the content
    if (content.includes('"command":"map"') || content.includes('generate') && content.includes('map')) {
      return this.scenarios.get('map_generation')!;
    }
    if (content.includes('"command":"character"') || content.includes('spawn') && content.includes('character')) {
      return this.scenarios.get('spawn_character')!;
    }
    if (content.includes('"command":"item"') || content.includes('item')) {
      return this.scenarios.get('spawn_item')!;
    }
    if (content.includes('story') && (content.includes('init') || content.includes('start'))) {
      return this.scenarios.get('story_init')!;
    }
    if (content.includes('attack') || content.includes('combat') || content.includes('enemy')) {
      return this.scenarios.get('combat')!;
    }
    if (content.includes('speak') || content.includes('talk') || content.includes('dialogue')) {
      return this.scenarios.get('dialogue')!;
    }

    // Default to current scenario or exploration
    return this.scenarios.get(this.currentScenarioName) || this.scenarios.get(this.defaultScenario)!;
  }

  /**
   * Get response from scenario
   */
  private getScenarioResponse(scenario: MockScenario): string {
    const index = scenario.currentIndex || 0;
    const response = scenario.responses[index] || JSON.stringify({ command: 'idle' });

    // Update index for next response (cycle through responses)
    scenario.currentIndex = (index + 1) % scenario.responses.length;

    // Add some variation based on seed
    if (this.shouldAddVariation() && response) {
      return this.addVariationToResponse(response);
    }

    return response;
  }

  /**
   * Check if we should add variation based on seed
   */
  private shouldAddVariation(): boolean {
    // Simple pseudo-random based on seed and message count
    const hash = (this.randomSeed + this.messageHistory.length) * 2654435761;
    return (hash % 100) < 30; // 30% chance of variation
  }

  /**
   * Add variation to response
   */
  private addVariationToResponse(response: string): string {
    try {
      const parsed = JSON.parse(response);

      // Add variation based on command type
      if (parsed.command === 'movement' && parsed.target?.type === 'direction') {
        // Occasionally change direction
        const directions = ['north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest'];
        const hash = (this.randomSeed + this.messageHistory.length) * 2654435761;
        parsed.target.value = directions[hash % directions.length];
      }

      if (parsed.command === 'speech' && parsed.text) {
        // Add slight variation to speech
        const prefixes = ['', 'Hmm... ', 'Indeed. ', 'I see. ', 'Fascinating. '];
        const hash = (this.randomSeed + this.messageHistory.length) * 2654435761;
        parsed.text = prefixes[hash % prefixes.length] + parsed.text;
      }

      return JSON.stringify(parsed);
    } catch {
      // If not JSON, return as-is
      return response;
    }
  }

  /**
   * Validate configuration
   */
  protected async performConfigValidation(): Promise<boolean> {
    // Mock provider doesn't need validation
    return true;
  }

  /**
   * Reset provider state
   */
  protected override performReset(): void {
    // Reset all scenario indices
    for (const scenario of this.scenarios.values()) {
      scenario.currentIndex = 0;
    }
    this.messageHistory = [];
    this.currentScenarioName = this.defaultScenario;
    this.logger.info('Mock provider reset');
  }
}

/**
 * Factory for creating MockProvider instances
 */
export class MockProviderFactory implements IAIProviderFactory {
  create(config: IAIProviderConfig): MockProvider {
    return new MockProvider(config);
  }

  supports(config: IAIProviderConfig): boolean {
    return config.provider === 'mock' || config.provider === 'test';
  }
}

// Register factory with manager on import
import { AIProviderManager } from '../AIProviderManager';

const manager = AIProviderManager.getInstance();
manager.registerFactory('mock', new MockProviderFactory());
manager.registerFactory('test', new MockProviderFactory());

// Auto-register mock provider configuration
manager.registerProvider({
  provider: 'mock',
  name: 'Mock AI Provider',
  enabled: true,
  priority: 100, // Low priority (high number)
  options: {
    seed: Date.now()
  }
}).catch(error => {
  console.error('Failed to register mock provider:', error);
});