/**
 * Living World State Interfaces
 * These interfaces define the structure for the background narrative system
 * that maintains parallel storylines and character motivations
 */

export interface IStoryThread {
    id: string;
    type: 'character' | 'faction' | 'event' | 'relationship' | 'conflict';
    title: string;
    participants: string[];  // Character or faction IDs involved
    status: 'dormant' | 'building' | 'active' | 'resolved';
    tension: number;  // 0-100, how close to triggering an event
    potentialOutcomes: IThreadOutcome[];
    currentNarrative: string;  // High-level description of what's happening
    lastUpdated: number;  // Turn number when last updated
    priority: 'low' | 'medium' | 'high';  // How important for current context
    tags: Set<string>;  // For categorization and filtering
}

export interface IThreadOutcome {
    id: string;
    description: string;
    probability: number;  // 0-1
    consequences: IConsequence[];
    requiredConditions?: string[];  // Story flags or conditions needed
}

export interface IConsequence {
    type: 'reputation' | 'relationship' | 'spawn' | 'storyFlag' | 'resource' | 'conflict';
    target: string;  // Who/what is affected
    value: string | number;  // The change or new value
    description: string;
}

export interface ICharacterProfile {
    id: string;
    name: string;
    goals: ICharacterGoal[];
    fears: string[];
    desires: string[];
    relationships: Map<string, IRelationship>;
    currentActivity: string;  // What they're doing right now
    locationBelief: string;  // Where they are or heading
    knowledge: Set<string>;  // Story facts they're aware of
    resources: ICharacterResource[];
    personality: IPersonalityTraits;
    lastSeen?: { location: string; turn: number };
}

export interface ICharacterGoal {
    id: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    progress: number;  // 0-100
    blockers: string[];  // What's preventing achievement
    allies: string[];  // Who might help
    enemies: string[];  // Who might hinder
}

export interface IRelationship {
    characterId: string;
    type: 'ally' | 'enemy' | 'neutral' | 'rival' | 'friend' | 'suspicious' | 'romantic';
    trust: number;  // -100 to 100
    respect: number;  // -100 to 100
    fear: number;  // 0 to 100
    history: string[];  // Key events in relationship
    lastInteraction?: number;  // Turn number
}

export interface IPersonalityTraits {
    aggression: number;  // 0-100
    loyalty: number;  // 0-100
    greed: number;  // 0-100
    honor: number;  // 0-100
    cunning: number;  // 0-100
    compassion: number;  // 0-100
}

export interface ICharacterResource {
    type: 'credits' | 'influence' | 'information' | 'military' | 'tech';
    amount: number;
    source?: string;
}

export interface IWorldEvent {
    id: string;
    type: 'political' | 'military' | 'economic' | 'discovery' | 'disaster';
    title: string;
    description: string;
    affectedFactions: string[];
    affectedSystems: string[];
    startTurn: number;
    duration: number;  // How many turns it lasts
    intensity: 'minor' | 'moderate' | 'major' | 'critical';
    consequences: IConsequence[];
}

export interface IEmergingConflict {
    id: string;
    type: 'resource' | 'territorial' | 'ideological' | 'personal' | 'revenge';
    instigators: string[];
    targets: string[];
    stakes: string;  // What's at risk
    escalation: number;  // 0-100, how close to open conflict
    possibleResolutions: string[];
    currentState: string;
}

export interface IFactionActivity {
    factionId: string;
    currentOperations: string[];
    territories: string[];
    resources: ICharacterResource[];
    activeAgents: string[];  // Character IDs working for them
    currentGoals: string[];
    relationships: Map<string, number>;  // Faction ID -> reputation
}

export interface IWorldState {
    threads: Map<string, IStoryThread>;
    characters: Map<string, ICharacterProfile>;
    events: IWorldEvent[];
    conflicts: IEmergingConflict[];
    factionActivities: Map<string, IFactionActivity>;
    narrativePressure: INarrativePressure;
    lastMajorUpdate: number;  // Turn number
}

export interface INarrativePressure {
    suggestedFocus: 'action' | 'dialogue' | 'exploration' | 'tension' | 'resolution';
    activeThemes: string[];  // Current story themes
    momentum: 'building' | 'steady' | 'climactic' | 'falling';
    recommendedEvents: string[];  // Event IDs that could trigger
}

export interface IWorldContext {
    nearbyThreads: IStoryThread[];  // Threads relevant to current situation
    characterMotivations: Map<string, string[]>;  // Character -> current goals
    emergingConflicts: IEmergingConflict[];
    offscreenEvents: IWorldEvent[];  // Things happening elsewhere
    narrativePressure: string;  // Suggested story direction
    relevantHistory: string[];  // Important past events
}

export interface IWorldStateUpdate {
    trigger: 'combat' | 'conversation' | 'discovery' | 'mission' | 'turn' | 'movement';
    participants?: string[];
    location?: string;
    outcome?: string;
    metadata?: Record<string, unknown>;
}