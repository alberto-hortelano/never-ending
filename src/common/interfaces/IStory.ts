export interface IOriginStory {
    id: string;
    name: string;
    nameES: string;
    description: string;
    descriptionES: string;
    startingLocation: string;
    startingCompanion?: {
        name: string;
        type: 'robot' | 'human' | 'alien';
        description: string;
    };
    initialInventory: string[];
    factionRelations: Record<string, number>; // -100 to 100
    specialTraits: string[];
    narrativeHooks: string[];
}

export interface IStoryState {
    selectedOrigin: IOriginStory | null;
    currentChapter: number;
    completedMissions: string[];
    majorDecisions: IStoryDecision[];
    factionReputation: Record<string, number>;
    storyFlags: Set<string>;
    journalEntries: IJournalEntry[];
}

export interface IStoryDecision {
    id: string;
    missionId: string;
    choice: string;
    consequences: string[];
    timestamp: number;
}

export interface IJournalEntry {
    id: string;
    title: string;
    content: string;
    date: string;
    type: 'main' | 'side' | 'faction' | 'personal';
    isRead: boolean;
}

export interface IFaction {
    id: string;
    name: string;
    nameES: string;
    description: string;
    hostile: boolean;
    reputation: number;
    territories: string[];
}

export interface IMissionTemplate {
    id: string;
    type: 'combat' | 'diplomacy' | 'exploration' | 'infiltration' | 'resource';
    requiredOrigin?: string;
    requiredReputation?: { faction: string; min: number };
    requiredFlags?: string[];
    narrativeContext: string;
    mapType: 'spaceship' | 'station' | 'planet' | 'settlement' | 'ruins';
    objectives: string[];
    rewards: {
        reputation?: Record<string, number>;
        items?: string[];
        flags?: string[];
    };
}