# Story Example: The Resistance Infiltration

## Overview
This is a comprehensive story example demonstrating all AI story system features in Never Ending. It includes multiple maps, character introductions, item spawning, and complex conversations with decision points.

## Story Context
- **Origin**: Rebel (starts with companion Data, a hacker)
- **Setting**: Post-apocalyptic urban environment
- **Mission**: Infiltrate a corporate facility to steal vital intelligence
- **Characters**: Jim (player), Data (companion), various NPCs introduced during gameplay

## Act 1: The Abandoned Market

### Initial Map Generation
```json
{
  "type": "map",
  "map": {
    "name": "Mercado Abandonado",
    "description": "Un antiguo mercado, ahora refugio de supervivientes y contrabandistas",
    "width": 25,
    "height": 20,
    "rooms": [
      {
        "name": "Entrada Principal",
        "x": 0,
        "y": 0,
        "width": 10,
        "height": 8,
        "type": "entrance",
        "description": "La entrada está llena de escombros y puestos abandonados",
        "doors": [
          { "x": 9, "y": 4, "direction": "east", "to": "Almacén", "type": "normal" }
        ]
      },
      {
        "name": "Almacén",
        "x": 10,
        "y": 0,
        "width": 15,
        "height": 10,
        "type": "storage",
        "description": "Cajas apiladas y estanterías vacías llenan el espacio",
        "doors": [
          { "x": 10, "y": 4, "direction": "west", "to": "Entrada Principal", "type": "normal" },
          { "x": 17, "y": 9, "direction": "south", "to": "Oficina del Jefe", "type": "locked", "keyRequired": "llave_oficina" }
        ]
      },
      {
        "name": "Oficina del Jefe",
        "x": 15,
        "y": 10,
        "width": 10,
        "height": 10,
        "type": "office",
        "description": "Una oficina con mapas y documentos esparcidos",
        "doors": [
          { "x": 17, "y": 10, "direction": "north", "to": "Almacén", "type": "locked", "keyRequired": "llave_oficina" },
          { "x": 24, "y": 15, "direction": "east", "to": "Callejón Trasero", "type": "transition", "transitionTo": "Distrito Industrial" }
        ]
      }
    ],
    "characters": [
      { "name": "Jim", "x": 2, "y": 2, "room": "Entrada Principal" },
      { "name": "Data", "x": 3, "y": 2, "room": "Entrada Principal" },
      { "name": "Marcus", "x": 12, "y": 5, "room": "Almacén" },
      { "name": "Elena", "x": 18, "y": 13, "room": "Oficina del Jefe" }
    ]
  }
}
```

### Initial Characters
```json
[
  {
    "type": "character",
    "character": {
      "name": "Marcus",
      "race": "human",
      "description": "Un contrabandista veterano con cicatrices de batalla",
      "faction": "Contrabandistas",
      "personality": "Cauteloso pero justo",
      "health": 100,
      "position": { "x": 12, "y": 5, "room": "Almacén" }
    }
  },
  {
    "type": "character",
    "character": {
      "name": "Elena",
      "race": "human",
      "description": "La líder de los contrabandistas locales, astuta y peligrosa",
      "faction": "Contrabandistas",
      "personality": "Calculadora y ambiciosa",
      "health": 100,
      "position": { "x": 18, "y": 13, "room": "Oficina del Jefe" }
    }
  }
]
```

### Scene 1: First Contact

**Player Action**: Move Jim towards Marcus in the Almacén

**AI Response**:
```json
{
  "type": "movement",
  "character": "Jim",
  "target": { "x": 11, "y": 5 },
  "path": [[2,2], [3,2], [4,2], [5,3], [6,4], [7,4], [8,4], [9,4], [10,5], [11,5]]
}
```

**AI Initiates Conversation**:
```json
{
  "type": "speech",
  "speaker": "Marcus",
  "target": "Jim",
  "message": "¿Quiénes sois? No os he visto antes por aquí. Este territorio está controlado por los Contrabandistas.",
  "options": [
    "Somos refugiados buscando suministros. No queremos problemas.",
    "Estamos de paso. Buscamos el Distrito Industrial.",
    "Eso no es asunto tuyo. Apártate."
  ]
}
```

**Player Choice**: "Estamos de paso. Buscamos el Distrito Industrial."

**Marcus Response**:
```json
{
  "type": "speech",
  "speaker": "Marcus",
  "target": "Jim",
  "message": "El Distrito Industrial... ese lugar está controlado por NeoCorp. Es peligroso. Necesitaréis la llave de la oficina para acceder al callejón trasero. Elena la tiene, pero no la dará fácilmente.",
  "options": [
    "¿Qué quiere Elena a cambio de la llave?",
    "Podemos negociar con ella.",
    "La conseguiremos de una forma u otra."
  ]
}
```

### Scene 2: New Character Introduction (Mid-Game)

**AI Introduces New Character**:
```json
{
  "type": "character",
  "character": {
    "name": "Víctor",
    "race": "human",
    "description": "Un informante nervioso con información valiosa",
    "faction": "Neutral",
    "personality": "Paranoico y hablador",
    "health": 80,
    "position": { "x": 8, "y": 3, "room": "Entrada Principal" }
  }
}
```

**Víctor Appears and Speaks**:
```json
{
  "type": "speech",
  "speaker": "Víctor",
  "target": "Jim",
  "message": "¡Esperad! He oído que buscáis entrar en NeoCorp. Tengo información... pero necesito salir de aquí vivo. Los guardias me buscan.",
  "options": [
    "Te protegeremos si compartes lo que sabes.",
    "¿Qué tipo de información tienes?",
    "No tenemos tiempo para esto."
  ]
}
```

### Scene 3: Item Generation (Mid-Game)

**AI Spawns Key Item**:
```json
{
  "type": "item",
  "item": {
    "name": "Tarjeta de Acceso NeoCorp",
    "type": "key",
    "description": "Una tarjeta de seguridad con el logo de NeoCorp",
    "position": { "x": 7, "y": 3 },
    "carrier": "Víctor"
  }
}
```

**Víctor Offers Item**:
```json
{
  "type": "speech",
  "source": "Víctor",
  "content": "Tengo esta tarjeta de acceso. La robé cuando escapé de NeoCorp. Os la daré si me ayudáis a llegar al refugio del norte.",
  "answers": ["Acepto el trato", "Necesito pensarlo"],
  "action": "item"
}
```

### Scene 4: Combat Encounter

**AI Spawns Enemy Reinforcements**:
```json
{
  "type": "character",
  "character": {
    "name": "Guardia NeoCorp",
    "race": "human",
    "description": "Un soldado corporativo con armadura táctica",
    "faction": "NeoCorp",
    "personality": "Agresivo y leal",
    "health": 120,
    "position": { "x": 5, "y": 7, "room": "Entrada Principal" }
  }
}
```

**Guard Attacks**:
```json
{
  "type": "attack",
  "attacker": "Guardia NeoCorp",
  "target": "Víctor",
  "attackType": "kill",
  "message": "¡Ahí está el traidor! ¡Eliminadlo!"
}
```

**Player Decision Point - Speech with Action**:
```json
{
  "type": "speech",
  "source": "Narrador",
  "title": "Decisión Crítica",
  "description": "Los guardias de NeoCorp han encontrado a Víctor. Debes decidir rápidamente.",
  "action": "character",
  "options": [
    {
      "text": "Proteger a Víctor y enfrentar a los guardias",
      "consequences": "reputation:NeoCorp:-20,reputation:Rebels:+10"
    },
    {
      "text": "Entregar a Víctor para ganar favor con NeoCorp",
      "consequences": "reputation:NeoCorp:+15,reputation:Rebels:-30"
    }
  ]
}
```

## Act 2: Industrial District (Map Transition)

### Scene 5: Map Transition Trigger

**After Getting the Office Key from Elena**:
```json
{
  "type": "speech",
  "source": "Narrador",
  "title": "Hacia el Distrito Industrial",
  "description": "Con la llave en mano, el equipo se prepara para infiltrar el Distrito Industrial controlado por NeoCorp.",
  "action": "map",
  "message": "¿Estás listo para continuar hacia el Distrito Industrial?"
}
```

**Player Accepts → New Map Generation**:
```json
{
  "type": "map",
  "map": {
    "name": "Distrito Industrial",
    "description": "Fábricas abandonadas y almacenes corporativos bajo control de NeoCorp",
    "width": 30,
    "height": 25,
    "rooms": [
      {
        "name": "Puerta de Seguridad",
        "x": 0,
        "y": 10,
        "width": 8,
        "height": 8,
        "type": "checkpoint",
        "doors": [
          { "x": 7, "y": 14, "direction": "east", "to": "Patio Central", "type": "normal" }
        ]
      },
      {
        "name": "Patio Central",
        "x": 8,
        "y": 5,
        "width": 14,
        "height": 15,
        "type": "courtyard",
        "doors": [
          { "x": 8, "y": 14, "direction": "west", "to": "Puerta de Seguridad", "type": "normal" },
          { "x": 21, "y": 10, "direction": "east", "to": "Laboratorio", "type": "locked", "keyRequired": "Tarjeta de Acceso NeoCorp" },
          { "x": 15, "y": 19, "direction": "south", "to": "Almacén de Armas", "type": "normal" }
        ]
      },
      {
        "name": "Laboratorio",
        "x": 22,
        "y": 8,
        "width": 8,
        "height": 10,
        "type": "lab",
        "doors": [
          { "x": 22, "y": 10, "direction": "west", "to": "Patio Central", "type": "locked" }
        ]
      },
      {
        "name": "Almacén de Armas",
        "x": 10,
        "y": 20,
        "width": 10,
        "height": 5,
        "type": "armory"
      }
    ],
    "characters": [
      { "name": "Jim", "x": 2, "y": 14, "room": "Puerta de Seguridad" },
      { "name": "Data", "x": 3, "y": 14, "room": "Puerta de Seguridad" },
      { "name": "Capitán Torres", "x": 15, "y": 12, "room": "Patio Central" },
      { "name": "Dr. Chen", "x": 25, "y": 13, "room": "Laboratorio" }
    ]
  }
}
```

### Scene 6: AI-to-AI Conversation (Player Observes)

**NPCs Converse While Player is Nearby**:
```json
{
  "type": "speech",
  "speaker": "Capitán Torres",
  "target": "Dr. Chen",
  "message": "Doctor, los experimentos están progresando según lo previsto?",
  "observedBy": ["Jim", "Data"]
}
```

```json
{
  "type": "speech",
  "speaker": "Dr. Chen",
  "target": "Capitán Torres",
  "message": "Los sujetos muestran resistencia. Necesitamos más tiempo... o más sujetos.",
  "observedBy": ["Jim", "Data"]
}
```

### Scene 7: Item Discovery in New Map

**Weapon Spawn in Armory**:
```json
{
  "type": "item",
  "item": {
    "name": "Rifle de Plasma",
    "type": "weapon",
    "damage": 45,
    "range": 15,
    "description": "Un arma experimental de NeoCorp",
    "position": { "x": 15, "y": 22, "room": "Almacén de Armas" }
  }
}
```

### Scene 8: Critical Decision with Multiple Outcomes

**Final Confrontation**:
```json
{
  "type": "speech",
  "source": "Narrador",
  "title": "El Momento de la Verdad",
  "description": "Has llegado al laboratorio. Dr. Chen tiene la información que necesitas, pero también podría ser un valioso aliado.",
  "action": "character",
  "options": [
    {
      "text": "Robar los datos y escapar silenciosamente",
      "outcome": "stealth_escape"
    },
    {
      "text": "Confrontar al Dr. Chen y exigir cooperación",
      "outcome": "confrontation"
    },
    {
      "text": "Intentar reclutar al Dr. Chen para la resistencia",
      "outcome": "recruitment"
    }
  ]
}
```

## Game Flow Summary

### Player Actions Demonstrated:
1. **Movement** - Moving characters tactically
2. **Conversation Choices** - Selecting dialogue options that affect story
3. **Combat Decisions** - Choosing when to fight or negotiate
4. **Exploration** - Finding items and secrets
5. **Map Transitions** - Moving between locations
6. **Strategic Choices** - Decisions that affect faction reputation

### AI Story Commands Used:
1. **map** - Two complete map generations
2. **character** - Multiple NPCs introduced mid-game
3. **speech** - Various conversation types including AI-to-AI, narrative transitions, and decision points
4. **item** - Key items and weapons spawned dynamically
5. **movement** - AI-controlled character positioning
6. **attack** - Combat encounters

### Story Elements:
- **Persistent Characters**: Jim and Data remain throughout
- **Dynamic NPCs**: Marcus, Elena, Víctor, Guards, Torres, Dr. Chen
- **Faction System**: Contrabandistas, NeoCorp, Rebels, Neutral
- **Reputation Changes**: Based on player decisions
- **Item Progression**: Keys, access cards, weapons
- **Map Transitions**: From Market to Industrial District
- **Multiple Endings**: Based on final laboratory decision

## Testing Checkpoints

For E2E tests, verify:
1. Initial map loads with correct rooms and doors
2. Characters spawn in correct positions
3. Movement pathfinding works correctly
4. Conversations trigger at proper range
5. Items can be picked up and used
6. Locked doors require correct keys
7. Map transitions preserve character state
8. Combat system processes attacks correctly
9. Reputation changes affect NPC behavior
10. Story flags track player decisions

## Screenshot Opportunities

Ideal moments for tutorial screenshots:
1. Initial map view with characters
2. First conversation with Marcus
3. Víctor's introduction (new character spawn)
4. Combat encounter with NeoCorp guard
5. Map transition to Industrial District
6. AI-to-AI conversation observation
7. Finding the Plasma Rifle
8. Final decision at the laboratory