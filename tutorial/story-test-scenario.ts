/**
 * Story Test Scenario: The Resistance Infiltration
 * 
 * This file contains the complete test scenario for demonstrating
 * all AI story system features in Never Ending.
 */

export interface StoryCommand {
  type: 'map' | 'character' | 'speech' | 'movement' | 'attack' | 'item' | 'storyline';
  data: any;
  expectedBehavior?: any;
}

export interface PlayerAction {
  type: string;
  target?: string;
  choice?: number;
  position?: { x: number; y: number };
}

export interface TestScene {
  name: string;
  aiCommands: StoryCommand[];
  playerActions?: PlayerAction[];
  validations: string[];
  screenshot?: string;
}

export const resistanceInfiltrationScenario = {
  metadata: {
    name: 'The Resistance Infiltration',
    origin: 'rebel',
    language: 'es',
    duration: 'medium', // 15-20 minutes
    difficulty: 'normal'
  },

  initialState: {
    playerCharacter: 'Jim',
    companion: 'Data',
    startingFaction: 'Rebels',
    reputation: {
      Rebels: 50,
      NeoCorp: -30,
      Contrabandistas: 0,
      Neutral: 0
    }
  },

  act1: {
    name: 'The Abandoned Market',
    
    mapGeneration: {
      command: {
        type: 'map',
        map: {
          name: 'Mercado Abandonado',
          description: 'Un antiguo mercado, ahora refugio de supervivientes y contrabandistas',
          width: 25,
          height: 20,
          rooms: [
            {
              name: 'Entrada Principal',
              x: 0, y: 0, width: 10, height: 8,
              type: 'entrance',
              doors: [{ x: 9, y: 4, direction: 'east', to: 'Almacén', type: 'normal' }]
            },
            {
              name: 'Almacén',
              x: 10, y: 0, width: 15, height: 10,
              type: 'storage',
              doors: [
                { x: 10, y: 4, direction: 'west', to: 'Entrada Principal', type: 'normal' },
                { x: 17, y: 9, direction: 'south', to: 'Oficina del Jefe', type: 'locked', keyRequired: 'llave_oficina' }
              ]
            },
            {
              name: 'Oficina del Jefe',
              x: 15, y: 10, width: 10, height: 10,
              type: 'office',
              doors: [
                { x: 17, y: 10, direction: 'north', to: 'Almacén', type: 'locked', keyRequired: 'llave_oficina' },
                { x: 24, y: 15, direction: 'east', to: 'Callejón Trasero', type: 'transition', transitionTo: 'Distrito Industrial' }
              ]
            }
          ]
        }
      },
      validations: [
        'Map renders correctly with all rooms',
        'Doors are properly connected',
        'Locked doors show lock icon',
        'Characters placed in correct positions'
      ]
    },

    characters: [
      {
        command: {
          type: 'character',
          character: {
            name: 'Marcus',
            race: 'human',
            description: 'Un contrabandista veterano con cicatrices de batalla',
            faction: 'Contrabandistas',
            health: 100,
            position: { x: 12, y: 5, room: 'Almacén' }
          }
        }
      },
      {
        command: {
          type: 'character',
          character: {
            name: 'Elena',
            race: 'human',
            description: 'La líder de los contrabandistas locales',
            faction: 'Contrabandistas',
            health: 100,
            position: { x: 18, y: 13, room: 'Oficina del Jefe' }
          }
        }
      }
    ],

    scenes: [
      {
        name: 'First Contact',
        trigger: 'player_movement',
        playerAction: { type: 'movement', target: 'Marcus' },
        aiResponse: {
          type: 'speech',
          speaker: 'Marcus',
          target: 'Jim',
          message: '¿Quiénes sois? No os he visto antes por aquí.',
          options: [
            'Somos refugiados buscando suministros.',
            'Estamos de paso. Buscamos el Distrito Industrial.',
            'Eso no es asunto tuyo.'
          ]
        },
        playerChoice: 1, // "Estamos de paso..."
        validation: 'Conversation UI appears with options'
      },

      {
        name: 'Victor Introduction',
        trigger: 'story_progression',
        command: {
          type: 'character',
          character: {
            name: 'Víctor',
            race: 'human',
            description: 'Un informante nervioso',
            faction: 'Neutral',
            health: 80,
            position: { x: 8, y: 3, room: 'Entrada Principal' }
          }
        },
        followUp: {
          type: 'item',
          item: {
            name: 'Tarjeta de Acceso NeoCorp',
            type: 'key',
            carrier: 'Víctor'
          }
        },
        validation: 'New character appears with item'
      },

      {
        name: 'Combat Encounter',
        trigger: 'victor_conversation',
        spawnEnemy: {
          type: 'character',
          character: {
            name: 'Guardia NeoCorp',
            faction: 'NeoCorp',
            hostile: true,
            position: { x: 5, y: 7, room: 'Entrada Principal' }
          }
        },
        aiAttack: {
          type: 'attack',
          attacker: 'Guardia NeoCorp',
          target: 'Víctor',
          attackType: 'kill'
        },
        decision: {
          type: 'storyline',
          title: 'Decisión Crítica',
          options: [
            { text: 'Proteger a Víctor', reputation: { NeoCorp: -20, Rebels: 10 } },
            { text: 'Entregar a Víctor', reputation: { NeoCorp: 15, Rebels: -30 } }
          ]
        },
        validation: 'Combat initiated, decision prompt appears'
      }
    ]
  },

  act2: {
    name: 'Industrial District',
    
    transition: {
      trigger: {
        type: 'storyline',
        title: 'Hacia el Distrito Industrial',
        action: 'map',
        requiresAccept: true
      },
      validation: 'Map transition prompt appears'
    },

    mapGeneration: {
      command: {
        type: 'map',
        map: {
          name: 'Distrito Industrial',
          description: 'Fábricas abandonadas bajo control de NeoCorp',
          width: 30,
          height: 25,
          rooms: [
            {
              name: 'Puerta de Seguridad',
              x: 0, y: 10, width: 8, height: 8,
              type: 'checkpoint'
            },
            {
              name: 'Patio Central',
              x: 8, y: 5, width: 14, height: 15,
              type: 'courtyard'
            },
            {
              name: 'Laboratorio',
              x: 22, y: 8, width: 8, height: 10,
              type: 'lab',
              requiresKey: 'Tarjeta de Acceso NeoCorp'
            },
            {
              name: 'Almacén de Armas',
              x: 10, y: 20, width: 10, height: 5,
              type: 'armory'
            }
          ]
        }
      },
      preservedCharacters: ['Jim', 'Data'],
      validation: 'New map loads with preserved characters'
    },

    scenes: [
      {
        name: 'AI Conversation',
        npcs: ['Capitán Torres', 'Dr. Chen'],
        conversation: {
          type: 'ai_to_ai',
          speaker1: 'Capitán Torres',
          speaker2: 'Dr. Chen',
          observedBy: ['Jim', 'Data'],
          topic: 'experiments'
        },
        validation: 'NPCs converse while player observes'
      },

      {
        name: 'Weapon Discovery',
        location: 'Almacén de Armas',
        item: {
          type: 'item',
          item: {
            name: 'Rifle de Plasma',
            type: 'weapon',
            damage: 45,
            range: 15,
            position: { x: 15, y: 22 }
          }
        },
        validation: 'Weapon spawns and can be equipped'
      },

      {
        name: 'Final Decision',
        location: 'Laboratorio',
        decision: {
          type: 'storyline',
          title: 'El Momento de la Verdad',
          critical: true,
          options: [
            { id: 'stealth', text: 'Robar datos y escapar' },
            { id: 'combat', text: 'Confrontar al Dr. Chen' },
            { id: 'recruit', text: 'Reclutar al Dr. Chen' }
          ],
          consequences: {
            stealth: { missionComplete: true, combatAvoided: true },
            combat: { initiatesCombat: true, alertsBase: true },
            recruit: { gainAlly: 'Dr. Chen', reputationBonus: 20 }
          }
        },
        validation: 'Decision affects story outcome'
      }
    ]
  },

  testChecklist: {
    core: [
      'Game loads with correct origin story',
      'Initial map generates properly',
      'Characters spawn in correct positions',
      'Movement system works (click to move)',
      'Pathfinding avoids obstacles'
    ],
    
    conversations: [
      'Speech bubbles appear at correct range',
      'Conversation UI shows options',
      'Player choices affect responses',
      'AI-to-AI conversations work',
      'Conversation history maintained'
    ],
    
    combat: [
      'Attack commands execute properly',
      'Line of sight validation works',
      'Damage is calculated and applied',
      'Death removes characters',
      'Combat log updates correctly'
    ],
    
    items: [
      'Items spawn at correct positions',
      'Items can be picked up',
      'Inventory updates properly',
      'Keys unlock correct doors',
      'Weapons change combat stats'
    ],
    
    story: [
      'Story flags track decisions',
      'Reputation changes apply',
      'Map transitions preserve state',
      'Storyline actions trigger correctly',
      'Multiple endings accessible'
    ],
    
    ai: [
      'AI generates contextual responses',
      'Commands are validated properly',
      'Language consistency maintained',
      'Story continuity preserved',
      'Error handling for invalid commands'
    ]
  },

  screenshotGuide: {
    tutorial: [
      { id: 'main-menu', description: 'Origin selection screen' },
      { id: 'initial-map', description: 'First map with characters' },
      { id: 'movement', description: 'Character moving with path highlight' },
      { id: 'conversation', description: 'Dialogue UI with options' },
      { id: 'combat', description: 'Combat encounter in progress' },
      { id: 'inventory', description: 'Item management screen' },
      { id: 'map-transition', description: 'Transition prompt' },
      { id: 'new-map', description: 'Second map after transition' },
      { id: 'ai-conversation', description: 'NPCs talking to each other' },
      { id: 'final-decision', description: 'Critical story choice' }
    ]
  }
};

// Export test utilities
export const runStoryTest = async (page: any) => {
  // This would be imported by actual e2e tests
  console.log('Running story scenario:', resistanceInfiltrationScenario.metadata.name);
  
  // Test implementation would go here
  // This is a template for e2e test writers
};

export const validateSceneTransition = (fromScene: string, toScene: string) => {
  // Validation logic for scene transitions
  return true;
};

export const checkAIResponse = (command: StoryCommand, response: any) => {
  // Validate AI responses match expected format
  return true;
};

export default resistanceInfiltrationScenario;