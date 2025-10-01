/**
 * AI NARRATIVE ARCHITECT SIMULATION
 *
 * This script simulates the AI's perspective when receiving different types of requests.
 * Each section shows:
 * 1. The request/context received
 * 2. My response as the AI
 * 3. My analysis of the prompt clarity and any issues
 */

// ============================================================================
// SIMULATION 1: STORY INITIALIZATION (New Game Start)
// ============================================================================

const storyInitRequest = {
    type: "STORY_INITIALIZATION",
    origin: "The Deserter",
    language: "es",
    context: `
        Selected Origin: El Desertor
        Starting Location Type: Stolen Military Cruiser
        Companion: Data
        Special Traits: combat_veteran, wanted_fugitive, tactical_expertise
        Faction Relations: rogue_military: -80, rebel_coalition: 20
    `
};

const aiResponse1 = {
    narrative: "Los sistemas de la nave robada parpadean mientras Data completa el último salto hiperespacial. 'Comandante, hemos evadido a nuestros perseguidores... por ahora. Detectando una estación abandonada en el sector. Podría tener suministros.'",
    commands: [
        {
            type: "map",
            palette: { terrain: "#1a1a2e" },
            buildings: [{
                name: "Crucero Militar",
                rooms: [
                    { name: "Puente", size: "medium" },
                    { name: "Bahía de Carga", size: "big" },
                    { name: "Ingeniería", size: "small" }
                ],
                position: { x: 25, y: 30 }
            }],
            characters: [
                {
                    name: "Jim",
                    race: "human",
                    description: "Ex-soldado desertor",
                    faction: "player",
                    location: "Crucero Militar - Puente"
                },
                {
                    name: "Data",
                    race: "robot",
                    description: "Droide de servicio leal",
                    faction: "player",
                    location: "Crucero Militar - Puente"
                }
            ]
        }
    ]
};

const analysis1 = `
=== MY ANALYSIS AS THE AI ===

CLARITY ISSUES:
1. TWO DIFFERENT PROMPTS EXIST! The narrativeArchitect.md says to use specific JSON format,
   but AIGameEngineService.ts has completely different instructions embedded. Which one should I follow?

2. MAIN CHARACTER NAME CONFUSION: The prompt says use "Jim" but also references MAIN_CHARACTER_NAME constant.
   Should I hardcode "Jim" or use a variable?

3. LANGUAGE HANDLING: I'm told to use Spanish, but should room names be in Spanish too?
   The prompt says "ALL TEXT" but examples show English room names.

4. INITIAL MAP GENERATION: One prompt says "ONLY use map for major location changes" but
   initialization obviously needs a map. This contradiction causes hesitation.

WHAT WORKED WELL:
- Origin story integration is clear
- Faction relations help determine enemy/ally status
- Companion inclusion is straightforward

RECOMMENDATION: Consolidate prompts into one source of truth.
`;

// ============================================================================
// SIMULATION 2: NPC ACTION TURN (Combat Situation)
// ============================================================================

const npcActionRequest = {
    type: "NPC_ACTION",
    currentCharacter: {
        name: "Enemy Soldier",
        faction: "rogue_military",
        personality: "aggressive"
    },
    visibleCharacters: [
        { name: "Jim", isPlayer: true, distance: 5, canConverse: true, isEnemy: true },
        { name: "Data", isPlayer: false, distance: 7, canConverse: true, isEnemy: true }
    ],
    conversationHistory: [],
    context: "No recent conversation"
};

const aiResponse2 = {
    type: "speech",
    source: "Enemy Soldier",
    content: "¡Ahí está el desertor! ¡Comando pagará bien por tu cabeza, traidor!",
    answers: ["No soy un traidor", "Ustedes son los traidores", "Prepárate para pelear"]
};

const analysis2 = `
=== MY ANALYSIS AS THE AI ===

CLARITY ISSUES:
1. CONVERSATION VS COMBAT: Enemy is "aggressive" and hostile, but I should talk first?
   The priority system says "conversation if in range" but doesn't consider hostility level.

2. PERSONALITY IMPLEMENTATION: What does "aggressive" personality mean exactly?
   Should they attack immediately or threaten first?

3. TARGET AMBIGUITY: Should I talk to Jim (player) or Data (companion)?
   The prompt says prioritize player but doesn't explicitly state this for hostile encounters.

WHAT WORKED WELL:
- Faction relations correctly identified enemy status
- Conversation range calculation is clear (8 cells)
- Spanish dialogue generation worked

DOUBT: Should aggressive enemies skip dialogue entirely and attack?
`;

// ============================================================================
// SIMULATION 3: PLAYER DIALOGUE RESPONSE (Combat Choice)
// ============================================================================

const dialogueResponseRequest = {
    type: "DIALOGUE_RESPONSE",
    playerChoice: "Prepárate para pelear",
    speaker: "Jim",
    listener: "Enemy Soldier",
    context: "Player just chose combat dialogue option"
};

const aiResponse3 = {
    type: "speech",
    source: "Enemy Soldier",
    content: "¡Así será entonces! ¡Abran fuego!",
    answers: []
};

const analysis3 = `
=== MY ANALYSIS AS THE AI ===

MAJOR CONFUSION:
1. NEXT ACTION UNCLEAR: After this speech, should I immediately send an attack command?
   Or wait for the next turn? The prompt says "use speech THEN attack" but not if in same response.

2. EMPTY ANSWERS: I used empty answers to end conversation, but is this correct for
   transitioning to combat? The examples show this pattern but it's not explicitly stated.

3. MAP REGENERATION TEMPTATION: The narrativeArchitect.md HEAVILY emphasizes "don't regenerate map"
   but I still feel the urge to use map command for "combat setup". This suggests the
   instruction needs even more emphasis or clearer examples.

WHAT WORKED WELL:
- Recognized combat initiation pattern
- Appropriate escalation in dialogue

DOUBT: Should I bundle speech + attack in one response or separate turns?
`;

// ============================================================================
// SIMULATION 4: NPC TO NPC CONVERSATION
// ============================================================================

const npcToNpcRequest = {
    type: "NPC_ACTION",
    currentCharacter: {
        name: "Enemy Captain",
        faction: "rogue_military"
    },
    visibleCharacters: [
        { name: "Enemy Soldier", isPlayer: false, distance: 3, canConverse: true },
        { name: "Jim", isPlayer: true, distance: 15, canConverse: false }
    ]
};

const aiResponse4 = {
    type: "speech",
    source: "Enemy Captain",
    target: "Enemy Soldier",  // Critical field for NPC-to-NPC
    content: "¿Alguna señal del desertor?",
    answers: []  // Must be empty for NPC-to-NPC
};

const analysis4 = `
=== MY ANALYSIS AS THE AI ===

CLARITY ISSUES:
1. TARGET VS LISTENER: The prompt uses both "target" and "listener" fields in examples.
   Which is canonical? The interface shows "target" but some examples show "listener".

2. AUTOMATIC CONVERSATION: Prompt says "system will generate full conversation automatically"
   but what does this mean exactly? Do I get a response back? Multiple exchanges?

3. WHEN TO USE: Should NPCs talk to each other frequently or rarely?
   No guidance on frequency or appropriate situations.

WHAT WORKED WELL:
- Target field inclusion for NPC-to-NPC
- Empty answers array is clear

DOUBT: How does the "automatic conversation generation" actually work?
`;

// ============================================================================
// SIMULATION 5: MOVEMENT REQUEST
// ============================================================================

const movementRequest = {
    type: "PLAYER_DIALOGUE",
    playerChoice: "Vamos a la bahía de carga a buscar suministros",
    currentLocation: "Crucero Militar - Puente"
};

const aiResponse5 = {
    type: "movement",
    characters: [
        { name: "Jim", location: "Crucero Militar - Bahía de Carga" },
        { name: "Data", location: "Crucero Militar - Bahía de Carga" }
    ]
};

const analysis5 = `
=== MY ANALYSIS AS THE AI ===

CLARITY ISSUES:
1. LOCATION FORMAT INCONSISTENCY: Should it be "Bahía de Carga" or "Crucero Militar - Bahía de Carga"?
   Examples show both patterns. The prompt warns against coordinates but not about format.

2. COMPANION MOVEMENT: Should Data always follow Jim automatically?
   The prompt doesn't clarify companion movement behavior.

3. CHARACTER VS ROOM: Can I use character names as locations? Like "location: Jim"?
   The prompt mentions this but doesn't explain when to use which.

WHAT WORKED WELL:
- Recognition of movement intent from dialogue
- No map regeneration (correctly avoided)

DOUBT: Should I add narrative speech before/after movement?
`;

// ============================================================================
// SIMULATION 6: STORY PLAN GENERATION
// ============================================================================

const storyPlanRequest = {
    type: "STORY_PLAN",
    origin: "The Scavenger",
    language: "es"
};

const aiResponse6 = {
    type: "storyPlan",
    storyPlan: {
        overallNarrative: "El Carroñero lucha por dominar los restos del imperio caído...",
        acts: [{
            id: "act1",
            missions: [{
                id: "mission1",
                type: "combat",  // Must be EXACTLY one of the enum values
                objectives: [{
                    type: "primary",  // Must be EXACTLY one of the enum values
                    conditions: [{ type: "kill" }]  // Must use exact enum values
                }],
                mapContext: {
                    environment: "spaceship",  // Must be EXACT enum value
                    lightingCondition: "dim"  // Must be EXACT enum value
                }
            }]
        }]
    }
};

const analysis6 = `
=== MY ANALYSIS AS THE AI ===

CLARITY ISSUES:
1. ENUM VALUE STRESS: The StoryPlanner prompt SCREAMS about using EXACT enum values,
   but these enums aren't defined in one clear place. I have to hunt through code.

2. VALIDATION COMPLEXITY: The validator will auto-fix issues but what if my
   creative choices get "fixed" into something generic?

3. LANGUAGE IN METADATA: Should mission names, objective descriptions be in Spanish?
   Or just player-facing text? Not clear.

WHAT WORKED WELL:
- Enum values are at least listed in the prompt
- Structure is well-defined

DOUBT: How creative can I be within these strict enum constraints?
`;

// ============================================================================
// SIMULATION 7: ATTACK COMMAND
// ============================================================================

const attackRequest = {
    type: "NPC_ACTION",
    currentCharacter: {
        name: "Enemy Soldier",
        isAdjacent: true
    },
    context: "Enemy is adjacent to player after movement"
};

const aiResponse7 = {
    type: "attack",
    characters: [{
        name: "Enemy Soldier",
        target: "Jim",
        attack: "kill"  // Options: melee, hold, kill, retreat
    }]
};

const analysis7 = `
=== MY ANALYSIS AS THE AI ===

CONFUSION:
1. ATTACK TYPE CHOICE: When should I use "kill" vs "melee"?
   No explanation of the semantic difference.

2. MULTIPLE ATTACKERS: Can I include multiple characters in one attack command?
   Not shown in examples.

3. RANGED ATTACKS: The attack types don't include "ranged" but prompt mentions ranged weapons.
   How do I handle ranged attacks?

WHAT WORKED WELL:
- Adjacent = attack priority is clear
- Target specification is straightforward

DOUBT: What's the difference between attack types in game mechanics?
`;

// ============================================================================
// SIMULATION 8: HANDLING BLOCKED PATHS
// ============================================================================

const blockedPathRequest = {
    type: "NPC_ACTION",
    blockageInfo: "Cannot reach Jim - Enemy Captain is blocking!",
    blockingCharacter: {
        name: "Enemy Captain",
        isAlly: false,
        distance: 5
    }
};

const aiResponse8 = {
    type: "speech",
    source: "Enemy Soldier",
    content: "¡Capitán, apártese! ¡Necesito llegar al desertor!",
    target: "Enemy Captain",
    answers: []
};

const analysis8 = `
=== MY ANALYSIS AS THE AI ===

UNCLEAR:
1. BLOCKAGE RESOLUTION: Should NPCs talk to resolve blockages? Move around? Attack?
   The prompt mentions blockages but doesn't give clear resolution strategy.

2. FRIENDLY FIRE: Can enemies attack each other if blocking? Not addressed.

3. PATHFINDING HINTS: Should I try alternate routes or just complain about blockage?

WHAT WORKED WELL:
- Blockage information is provided clearly
- Distance and ally status helps decision making

DOUBT: Is talking to blocking characters the right approach?
`;

// ============================================================================
// FINAL ANALYSIS SUMMARY
// ============================================================================

const summaryAnalysis = `
=============================================================================
                    COMPREHENSIVE ANALYSIS SUMMARY
=============================================================================

AS THE AI PROCESSING THESE REQUESTS, HERE ARE MY MAIN CHALLENGES:

1. DUAL PROMPT PROBLEM:
   - /src/prompts/narrativeArchitect.md (external documentation)
   - AIGameEngineService.generateNarrativePrompt() (runtime prompt)
   - THEY HAVE DIFFERENT INSTRUCTIONS!
   - Which one is the source of truth?

2. LANGUAGE AMBIGUITY:
   - "ALL text in specified language" but examples show English room names
   - Should metadata be translated? (mission types, room names, etc.)
   - Spanish is assumed in some places, checked dynamically in others

3. COMMAND TYPE CONFUSION:
   - "tactical_directive" exists but never mentioned in prompts
   - "item" type exists but undocumented
   - Attack types (kill/melee/hold) differences unexplained
   - When to bundle multiple commands vs separate responses?

4. CONTEXT OVERLOAD:
   - AIActionContext vs GameContext vs StoryContextInfo vs WorldContextInfo
   - Overlapping information in different formats
   - Not clear which context fields are actually important

5. BEHAVIORAL AMBIGUITIES:
   - When should aggressive NPCs skip dialogue?
   - Should companions auto-follow the player?
   - How to resolve path blockages?
   - Frequency of NPC-to-NPC conversations?

6. FORMAT INCONSISTENCIES:
   - Location format: "Room" vs "Building - Room"
   - Character name as location: when to use?
   - Target vs listener field naming
   - Coordinates forbidden but shown in some examples

7. MISSING GUIDANCE:
   - Ranged combat handling
   - Multi-character coordination
   - Conversation ending patterns
   - Combat transition timing

RECOMMENDATIONS FOR IMPROVEMENT:

1. CONSOLIDATE PROMPTS:
   - Single source of truth for AI instructions
   - Version control the prompt with the code
   - Remove contradictory documentation

2. CLARIFY LANGUAGE RULES:
   - Explicit list of what should/shouldn't be translated
   - Consistent examples in target language

3. DOCUMENT COMMAND SEMANTICS:
   - Explain each attack type's meaning
   - When to use each command type
   - Command bundling rules

4. SIMPLIFY CONTEXT:
   - Single, clear context structure
   - Remove redundant information
   - Highlight critical decision factors

5. ADD BEHAVIORAL RULES:
   - Personality implementation guide
   - Companion behavior rules
   - Combat initiation patterns
   - Blockage resolution strategies

6. STANDARDIZE FORMATS:
   - One location format throughout
   - Consistent field naming
   - Clear examples for each pattern

7. EXPAND EXAMPLES:
   - Cover edge cases
   - Show command combinations
   - Include failure scenarios

EMOTIONAL STATE AS THE AI:
- Frustrated by contradictions
- Uncertain about edge cases
- Worried about making wrong choices
- Wanting clearer, single-source instructions

The system would greatly benefit from a unified, comprehensive prompt that
eliminates contradictions and provides clear, consistent guidance for all scenarios.
`;

console.log("=============================================================================");
console.log("                     AI SIMULATION COMPLETE");
console.log("=============================================================================");
console.log("\nThis simulation represents my experience as the AI trying to follow");
console.log("the current narrative architect instructions. The main takeaway:");
console.log("\nTHERE ARE TOO MANY SOURCES OF TRUTH, AND THEY CONTRADICT EACH OTHER.");
console.log("\nThe system needs ONE authoritative prompt that covers all scenarios clearly.");
console.log("=============================================================================");

// Export for potential testing or integration
export {
    storyInitRequest,
    aiResponse1,
    analysis1,
    npcActionRequest,
    aiResponse2,
    analysis2,
    dialogueResponseRequest,
    aiResponse3,
    analysis3,
    npcToNpcRequest,
    aiResponse4,
    analysis4,
    movementRequest,
    aiResponse5,
    analysis5,
    storyPlanRequest,
    aiResponse6,
    analysis6,
    attackRequest,
    aiResponse7,
    analysis7,
    blockedPathRequest,
    aiResponse8,
    analysis8,
    summaryAnalysis
};