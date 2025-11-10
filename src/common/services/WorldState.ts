/**
 * WorldState Service
 * Manages the living world narrative system, tracking parallel narratives,
 * character motivations, and emergent events happening in the background
 */

import type {
    IWorldState,
    IStoryThread,
    ICharacterProfile,
    IWorldEvent,
    IEmergingConflict,
    IWorldContext,
    IWorldStateUpdate,
    IConsequence
} from '../interfaces/worldState';
import type { IStoryState } from '../interfaces';
import type { DeepReadonly } from '../helpers/types';

import { EventBus } from '../events/EventBus';
import { StateChangeEvent, UpdateStateEvent, StateChangeEventsMap, UpdateStateEventsMap } from '../events/StateEvents';
import { WorldThreadManager } from './WorldThreadManager';
import { WorldFactionManager } from './WorldFactionManager';
import { WorldEventGenerator } from './WorldEventGenerator';

export class WorldState extends EventBus<StateChangeEventsMap, UpdateStateEventsMap> {
    private static instance: WorldState;
    
    private worldState: IWorldState = {
        threads: {},
        characters: {},
        events: [],
        conflicts: [],
        factionActivities: {},
        narrativePressure: {
            suggestedFocus: 'exploration',
            activeThemes: [],
            momentum: 'building',
            recommendedEvents: []
        },
        lastMajorUpdate: 0
    };
    
    private currentTurn: number = 0;
    private updateInterval: number = 5; // Update every N turns
    private isInitialized: boolean = false;
    private debugMode: boolean = false;
    private logCategories = ['init', 'update', 'thread', 'event', 'error'];
    private threadManager: WorldThreadManager;
    private factionManager: WorldFactionManager;
    private eventGenerator: WorldEventGenerator;
    
    private constructor() {
        super();
        this.threadManager = new WorldThreadManager(
            (threads) => { this.worldState.threads = threads; },
            (consequence) => { this.applyConsequence(consequence); }
        );
        this.threadManager.setThreads(this.worldState.threads);

        this.factionManager = new WorldFactionManager(
            (activities) => { this.worldState.factionActivities = activities; }
        );
        this.factionManager.setActivities(this.worldState.factionActivities);

        this.eventGenerator = new WorldEventGenerator(
            (events) => { this.worldState.events.push(...events); },
            (conflicts) => { this.worldState.conflicts.push(...conflicts); },
            (pressure) => { this.worldState.narrativePressure = pressure; }
        );

        this.setupEventListeners();
    }
    
    public static getInstance(): WorldState {
        if (!WorldState.instance) {
            WorldState.instance = new WorldState();
            // Make it available globally for debugging
            if (typeof window !== 'undefined') {
                // Note: Assigning the class itself, not the instance, for proper debug access
                (window as Window & { WorldState?: typeof WorldState }).WorldState = WorldState;
                console.log('[WorldState] Debug console commands available:');
                console.log('  WorldState.getInstance().getDebugInfo()');
                console.log('  WorldState.getInstance().getWorldContext()');
                console.log('  WorldState.getInstance().forceUpdate()');
                console.log('  WorldState.getInstance().enableDebug()');
                console.log('  WorldState.getInstance().testCombat(["char1", "char2"])');
            }
        }
        return WorldState.instance;
    }
    
    private setupEventListeners(): void {
        // Listen for game events that should trigger world updates
        this.listen(StateChangeEvent.characterDefeated, (character) => {
            this.handleCharacterDefeat(character.name);
        });
        
        this.listen(StateChangeEvent.game, (game) => {
            if (game && typeof game === 'object' && 'turn' in game) {
                this.currentTurn = parseInt(String((game as {turn?: string | number}).turn || 0));
                this.threadManager.setCurrentTurn(this.currentTurn);
                this.factionManager.setCurrentTurn(this.currentTurn);
                this.checkForScheduledUpdates();
            }
        });
    }
    
    /**
     * Initialize the world state based on the current story
     */
    public initialize(storyState: DeepReadonly<IStoryState>): void {
        if (this.isInitialized) return;
        
        this.log('init', 'Initializing with story state', storyState);
        
        // Create initial story threads based on origin
        if (storyState.selectedOrigin) {
            this.threadManager.createOriginThreads(storyState.selectedOrigin);
        }
        
        // Initialize faction activities
        this.factionManager.initialize(storyState.factionReputation || {});
        
        // Create character profiles for known NPCs
        this.initializeCharacterProfiles();
        
        this.isInitialized = true;
        this.log('init', 'Initialization complete');
    }
    
    private initializeCharacterProfiles(): void {
        // This will be populated as characters are encountered
        // For now, create profiles for companion characters
        const dataProfile: ICharacterProfile = {
            id: 'Data',
            name: 'Data',
            goals: [
                {
                    id: 'protect_player',
                    description: 'Protect the commander at all costs',
                    priority: 'critical',
                    progress: 100,
                    blockers: [],
                    allies: ['player'],
                    enemies: []
                }
            ],
            fears: ['Deactivation', 'Memory wipe', 'Losing the commander'],
            desires: ['Efficiency', 'Order', 'Commander safety'],
            relationships: {
                'player': {
                    characterId: 'player',
                    type: 'ally',
                    trust: 100,
                    respect: 90,
                    fear: 0,
                    history: ['Loyal service since desertion'],
                    lastInteraction: this.currentTurn
                }
            },
            currentActivity: 'Analyzing tactical data',
            locationBelief: 'With the commander',
            knowledge: ['Military protocols', 'Commander history'],
            resources: [],
            personality: {
                aggression: 20,
                loyalty: 100,
                greed: 0,
                honor: 80,
                cunning: 60,
                compassion: 40
            }
        };

        this.worldState.characters['Data'] = dataProfile;
    }
    
    /**
     * Process a world update based on game events
     */
    public processUpdate(update: IWorldStateUpdate): void {
        this.log('update', 'Processing update', update);
        
        switch (update.trigger) {
            case 'combat':
                this.processCombatUpdate(update);
                break;
            case 'conversation':
                this.processConversationUpdate(update);
                break;
            case 'discovery':
                this.processDiscoveryUpdate(update);
                break;
            case 'mission':
                this.processMissionUpdate(update);
                break;
            case 'turn':
                this.processTurnUpdate(update);
                break;
            case 'movement':
                this.processMovementUpdate(update);
                break;
        }
        
        // Update narrative pressure based on recent events
        this.eventGenerator.updatePressure(
            this.threadManager.getThreads(),
            this.worldState.narrativePressure,
            this.currentTurn
        );
    }
    
    private processCombatUpdate(update: IWorldStateUpdate): void {
        // Increase tension in conflict threads
        Object.values(this.threadManager.getThreads()).forEach(thread => {
            if (thread && thread.type === 'conflict' && thread.status !== 'resolved') {
                thread.tension = Math.min(100, thread.tension + 10);
                thread.lastUpdated = this.currentTurn;
            }
        });

        // Update participating character relationships
        if (update.participants) {
            this.updateCharacterRelationships(update.participants, 'combat');
        }
    }
    
    private processConversationUpdate(update: IWorldStateUpdate): void {
        // Update relationship threads
        if (update.participants && update.participants.length >= 2) {
            const [speaker, listener] = update.participants;

            // Find or create relationship thread
            const threadId = `dialogue_${speaker}_${listener}`;
            const threads = this.threadManager.getThreads();
            let thread = threads[threadId];

            if (!thread && speaker && listener) {
                thread = this.createRelationshipThread(speaker, listener);
                threads[threadId] = thread;
            }

            // Update thread based on conversation outcome
            if (thread) {
                thread.tension = Math.max(0, thread.tension + (update.outcome === 'positive' ? -5 : 5));
                thread.lastUpdated = this.currentTurn;
            }
        }
    }
    
    private createRelationshipThread(char1: string, char2: string): IStoryThread {
        return {
            id: `dialogue_${char1}_${char2}`,
            type: 'relationship',
            title: `${char1} and ${char2} Relationship`,
            participants: [char1, char2],
            status: 'building',
            tension: 50,
            potentialOutcomes: [],
            currentNarrative: `${char1} and ${char2} are establishing their relationship`,
            lastUpdated: this.currentTurn,
            priority: 'low',
            tags: ['dialogue', 'relationship']
        };
    }
    
    private processDiscoveryUpdate(update: IWorldStateUpdate): void {
        // Create event thread for discoveries
        const event: IWorldEvent = {
            id: `discovery_${Date.now()}`,
            type: 'discovery',
            title: 'New Discovery',
            description: update.outcome || 'Something significant has been discovered',
            affectedFactions: [],
            affectedSystems: update.location ? [update.location] : [],
            startTurn: this.currentTurn,
            duration: 10,
            intensity: 'moderate',
            consequences: []
        };
        
        this.worldState.events.push(event);
    }
    
    private processMissionUpdate(_update: IWorldStateUpdate): void {
        // Update relevant story threads based on mission progress
        Object.values(this.threadManager.getThreads()).forEach(thread => {
            if (thread && thread.tags.includes('mission') && thread.status === 'active') {
                thread.tension = Math.min(100, thread.tension + 15);
                thread.lastUpdated = this.currentTurn;
            }
        });
    }
    
    private processTurnUpdate(_update: IWorldStateUpdate): void {
        // Regular turn-based updates
        this.threadManager.advanceThreads();
        this.factionManager.updateActivities();
        this.eventGenerator.checkForConflicts(
            this.worldState.characters,
            this.factionManager.getActivities(),
            this.worldState.conflicts
        );
    }
    
    private processMovementUpdate(update: IWorldStateUpdate): void {
        // Track character movements for location beliefs
        if (update.participants && update.location) {
            update.participants.forEach(character => {
                const profile = this.worldState.characters[character];
                if (profile) {
                    profile.locationBelief = update.location!;
                    profile.lastSeen = {
                        location: update.location!,
                        turn: this.currentTurn
                    };
                }
            });
        }
    }
    
    private updateCharacterRelationships(participants: string[], context: string): void {
        // Update relationships between participants based on context
        for (let i = 0; i < participants.length - 1; i++) {
            for (let j = i + 1; j < participants.length; j++) {
                const participant1 = participants[i];
                const participant2 = participants[j];
                if (!participant1 || !participant2) continue;

                const char1 = this.worldState.characters[participant1];
                const char2 = this.worldState.characters[participant2];

                if (char1 && char2) {
                    // Update or create relationships
                    const rel1 = char1.relationships[participant2] || {
                        characterId: participant2,
                        type: 'neutral' as const,
                        trust: 0,
                        respect: 0,
                        fear: 0,
                        history: [],
                        lastInteraction: this.currentTurn
                    };

                    // Adjust based on context
                    if (context === 'combat') {
                        rel1.fear = Math.min(100, rel1.fear + 10);
                        rel1.respect = Math.max(-100, rel1.respect - 5);
                    }

                    rel1.history.push(`${context} at turn ${this.currentTurn}`);
                    rel1.lastInteraction = this.currentTurn;

                    char1.relationships[participant2] = rel1;
                }
            }
        }
    }
    
    
    private applyConsequence(consequence: IConsequence): void {
        // DEBUG: console.log(`[WorldState] Applying consequence:`, consequence);
        
        switch (consequence.type) {
            case 'reputation':
                // Update faction reputation
                this.dispatch(UpdateStateEvent.storyState, {
                    factionReputation: {
                        [consequence.target]: Number(consequence.value)
                    }
                });
                break;
            case 'storyFlag':
                // Set story flag
                this.dispatch(UpdateStateEvent.storyState, {
                    storyFlags: new Set([String(consequence.value)])
                });
                break;
            // Add more consequence types as needed
        }
    }
    private checkForScheduledUpdates(): void {
        // Perform major updates at intervals
        if (this.currentTurn % this.updateInterval === 0) {
            this.performMajorUpdate();
        }
    }
    
    private performMajorUpdate(): void {
        // DEBUG: console.log('[WorldState] Performing major update at turn', this.currentTurn);

        // Generate new events
        this.eventGenerator.generateEvents(
            this.currentTurn,
            this.threadManager.getThreads(),
            this.worldState.characters,
            this.factionManager.getActivities()
        );

        // Update all character profiles
        this.updateCharacterProfiles();

        // Prune old resolved threads
        this.pruneOldThreads();

        this.worldState.lastMajorUpdate = this.currentTurn;
    }
    
    private updateCharacterProfiles(): void {
        // Update character goals and activities
        Object.values(this.worldState.characters).forEach(character => {
            if (!character) return;

            // Progress goals
            character.goals.forEach(goal => {
                if (goal.progress < 100 && Math.random() < 0.1) {
                    goal.progress = Math.min(100, goal.progress + 10);
                }
            });

            // Update current activity
            if (Math.random() < 0.2) {
                character.currentActivity = this.generateCharacterActivity(character);
            }
        });
    }
    
    private generateCharacterActivity(character: ICharacterProfile): string {
        // Generate activity based on character's personality and goals
        const activities: string[] = [];
        
        // Add activities based on personality traits
        if (character.personality.aggression > 70) {
            activities.push('Preparing for confrontation', 'Hunting enemies', 'Securing weapons');
        }
        if (character.personality.cunning > 70) {
            activities.push('Setting traps', 'Gathering intelligence', 'Planning strategic moves');
        }
        if (character.personality.greed > 70) {
            activities.push('Searching for valuables', 'Negotiating deals', 'Counting profits');
        }
        if (character.personality.loyalty > 70) {
            activities.push('Protecting allies', 'Coordinating with faction', 'Following orders');
        }
        if (character.personality.compassion > 70) {
            activities.push('Helping civilians', 'Tending to wounded', 'Distributing supplies');
        }
        
        // Add activities based on current goals
        if (character.goals && character.goals.length > 0) {
            const primaryGoal = character.goals[0];
            if (primaryGoal?.priority === 'critical') {
                activities.push(`Urgently working on: ${primaryGoal.description}`);
            } else if (primaryGoal?.priority === 'high') {
                activities.push(`Focusing on: ${primaryGoal.description}`);
            }
        }
        
        // Add default activities if none match
        if (activities.length === 0) {
            activities.push('Planning next move', 'Gathering resources', 'Laying low');
        }
        
        const activity = activities[Math.floor(Math.random() * activities.length)];
        return activity || 'Maintaining position';
    }
    
    private pruneOldThreads(): void {
        // Remove resolved threads older than 20 turns
        const cutoff = this.currentTurn - 20;
        const threads = this.threadManager.getThreads();

        Object.entries(threads).forEach(([id, thread]) => {
            if (thread && thread.status === 'resolved' && thread.lastUpdated < cutoff) {
                delete threads[id];
                // DEBUG: console.log(`[WorldState] Pruned old thread: ${thread.title}`);
            }
        });
    }
    
    private handleCharacterDefeat(characterName: string): void {
        // Update character profile
        const profile = this.worldState.characters[characterName];
        if (profile) {
            profile.currentActivity = 'Defeated';

            // Update relationships
            Object.values(profile.relationships).forEach(rel => {
                if (rel) {
                    rel.history.push(`Defeated at turn ${this.currentTurn}`);
                }
            });
        }

        // Update related threads
        Object.values(this.threadManager.getThreads()).forEach(thread => {
            if (thread && thread.participants.includes(characterName)) {
                thread.tension = Math.max(0, thread.tension - 20);
                if (thread.status === 'active') {
                    thread.status = 'building';
                }
            }
        });
    }
    
    /**
     * Get world context relevant to current situation
     */
    public getWorldContext(location?: string, participants?: string[]): IWorldContext {
        const context: IWorldContext = {
            nearbyThreads: this.getRelevantThreads(location, participants),
            characterMotivations: this.getCharacterMotivations(participants),
            emergingConflicts: this.getActiveConflicts(),
            offscreenEvents: this.getOffscreenEvents(),
            narrativePressure: this.getNarrativeSuggestion(),
            relevantHistory: this.getRelevantHistory(participants)
        };
        
        return context;
    }
    
    private getRelevantThreads(_location?: string, participants?: string[]): IStoryThread[] {
        const relevant: IStoryThread[] = [];

        Object.values(this.threadManager.getThreads()).forEach(thread => {
            if (!thread) return;

            // Include if participants are involved
            if (participants && thread.participants.some(p => participants.includes(p))) {
                relevant.push(thread);
            }
            // Include high priority threads
            else if (thread.priority === 'high' && thread.status !== 'resolved') {
                relevant.push(thread);
            }
            // Include active threads with high tension
            else if (thread.status === 'active' && thread.tension > 75) {
                relevant.push(thread);
            }
        });

        // Sort by priority and tension
        return relevant.sort((a, b) => {
            const priorityWeight = { high: 3, medium: 2, low: 1 };
            const aPriority = priorityWeight[a.priority] * a.tension;
            const bPriority = priorityWeight[b.priority] * b.tension;
            return bPriority - aPriority;
        }).slice(0, 5); // Limit to top 5
    }
    
    private getCharacterMotivations(participants?: string[]): Record<string, string[]> {
        const motivations: Record<string, string[]> = {};

        if (participants) {
            participants.forEach(participant => {
                const profile = this.worldState.characters[participant];
                if (profile) {
                    const goals = profile.goals
                        .filter(g => g.priority === 'high' || g.priority === 'critical')
                        .map(g => g.description);
                    motivations[participant] = goals;
                }
            });
        }

        return motivations;
    }
    
    private getActiveConflicts(): IEmergingConflict[] {
        return this.worldState.conflicts
            .filter(c => c.escalation > 50)
            .sort((a, b) => b.escalation - a.escalation)
            .slice(0, 3);
    }
    
    private getOffscreenEvents(): IWorldEvent[] {
        const currentTurn = this.currentTurn;
        return this.worldState.events
            .filter(e => e.startTurn <= currentTurn && e.startTurn + e.duration > currentTurn)
            .filter(e => e.intensity === 'major' || e.intensity === 'critical')
            .slice(0, 3);
    }
    
    private getNarrativeSuggestion(): string {
        const pressure = this.worldState.narrativePressure;
        const suggestions: Record<string, string> = {
            'action': 'Tension is high. Combat or decisive action would be appropriate.',
            'dialogue': 'Characters have much to discuss. Conversation could reveal important information.',
            'exploration': 'The world awaits discovery. Exploration could uncover new opportunities.',
            'tension': 'Conflicts are building. Choices now will have significant consequences.',
            'resolution': 'Story threads are ready to conclude. Major decisions await.'
        };
        
        return suggestions[pressure.suggestedFocus] || 'The story continues to unfold.';
    }
    
    private getRelevantHistory(participants?: string[]): string[] {
        const history: string[] = [];

        if (participants) {
            participants.forEach(participant => {
                const profile = this.worldState.characters[participant];
                if (profile) {
                    Object.values(profile.relationships).forEach(rel => {
                        if (rel && rel.history.length > 0) {
                            history.push(...rel.history.slice(-2)); // Last 2 events
                        }
                    });
                }
            });
        }

        return history.slice(0, 5); // Limit to 5 most recent
    }
    
    /**
     * Generate narrative summary for AI context
     */
    public generateNarrativeSummary(): string {
        const activeThreads = Object.values(this.threadManager.getThreads())
            .filter(t => t && t.status === 'active')
            .map(t => t!.currentNarrative)
            .join(' ');

        const worldEvents = this.worldState.events
            .filter(e => e.intensity === 'major' || e.intensity === 'critical')
            .map(e => e.description)
            .join(' ');

        const conflicts = this.worldState.conflicts
            .filter(c => c.escalation > 75)
            .map(c => c.currentState)
            .join(' ');

        return `World State: ${activeThreads} ${worldEvents} ${conflicts}`.trim();
    }
    
    // ============= DEBUG METHODS =============
    
    /**
     * Enable debug mode for detailed logging
     */
    public enableDebug(categories?: string[]): void {
        this.debugMode = true;
        if (categories) {
            this.logCategories = categories;
        }
    }
    
    /**
     * Disable debug mode
     */
    public disableDebug(): void {
        this.debugMode = false;
        // DEBUG: console.log('[WorldState] Debug mode disabled');
    }
    
    /**
     * Get comprehensive debug information about the world state
     */
    public getDebugInfo(): unknown {
        const threads = Object.values(this.threadManager.getThreads()).filter(t => t !== undefined);
        const characters = Object.values(this.worldState.characters).filter(c => c !== undefined);
        const factions = Object.values(this.worldState.factionActivities).filter(f => f !== undefined);

        const info = {
            initialized: this.isInitialized,
            currentTurn: this.currentTurn,
            debugMode: this.debugMode,
            threads: {
                total: Object.keys(this.threadManager.getThreads()).length,
                active: threads.filter(t => t.status === 'active').length,
                building: threads.filter(t => t.status === 'building').length,
                resolved: threads.filter(t => t.status === 'resolved').length,
                dormant: threads.filter(t => t.status === 'dormant').length,
                details: threads.map(t => ({
                    id: t.id,
                    type: t.type,
                    title: t.title,
                    status: t.status,
                    tension: t.tension,
                    participants: t.participants,
                    narrative: t.currentNarrative
                }))
            },
            characters: {
                total: Object.keys(this.worldState.characters).length,
                profiles: characters.map(c => ({
                    id: c.id,
                    name: c.name,
                    faction: 'independent',  // No faction in ICharacterProfile
                    currentActivity: c.currentActivity,
                    goals: c.goals?.length || 0,
                    relationships: Object.keys(c.relationships).length
                }))
            },
            worldEvents: {
                total: this.worldState.events.length,
                active: this.worldState.events.filter(e =>
                    e.startTurn <= this.currentTurn &&
                    e.startTurn + e.duration > this.currentTurn
                ).length,
                recent: this.worldState.events.slice(-3).map(e => ({
                    title: e.title,
                    type: e.type,
                    intensity: e.intensity
                }))
            },
            factions: {
                total: Object.keys(this.worldState.factionActivities).length,
                activities: factions.map(f => ({
                    faction: f.factionId,
                    operations: f.currentOperations,
                    goals: f.currentGoals
                }))
            },
            conflicts: {
                total: this.worldState.conflicts.length,
                active: this.worldState.conflicts.filter(c => c.escalation > 50).length,
                highTension: this.worldState.conflicts.filter(c => c.escalation > 75).map(c => ({
                    id: c.id,
                    factions: [...c.instigators, ...c.targets],
                    escalation: c.escalation,
                    state: c.currentState
                }))
            },
            narrativePressure: this.worldState.narrativePressure
        };

        // DEBUG: console.log('[WorldState] Debug Info:', info);
        return info;
    }
    
    /**
     * Force a world update (for testing)
     */
    public forceUpdate(type: 'minor' | 'major' = 'minor'): void {
        // DEBUG: console.log(`[WorldState] Forcing ${type} update at turn ${this.currentTurn}`);

        if (type === 'major') {
            this.performMajorUpdate();
        } else {
            // Trigger a minor update by advancing a random thread
            const threads = Object.values(this.threadManager.getThreads()).filter(t => t !== undefined);
            if (threads.length > 0) {
                const randomThread = threads[Math.floor(Math.random() * threads.length)];
                if (randomThread) {
                    randomThread.tension = Math.min(100, randomThread.tension + 20);
                    if (randomThread.tension > 80 && randomThread.status === 'building') {
                        this.threadManager.activateThread(randomThread);
                    }
                    // DEBUG: console.log(`[WorldState] Advanced thread: ${randomThread.title} (tension: ${randomThread.tension})`);
                }
            }
        }
    }
    
    /**
     * Test combat scenario (for debugging)
     */
    public testCombat(participants: string[], outcome?: string): void {
        // DEBUG: console.log('[WorldState] Testing combat scenario:', { participants, outcome });
        this.processCombatUpdate({
            trigger: 'combat',
            participants,
            outcome: outcome || 'ongoing',
            location: 'test_location',
            metadata: {
                turn: this.currentTurn
            }
        });
    }
    
    /**
     * Test conversation scenario (for debugging)
     */
    public testConversation(speaker: string, listener: string, outcome?: string): void {
        // DEBUG: console.log('[WorldState] Testing conversation scenario:', { speaker, listener, outcome });
        this.processConversationUpdate({
            trigger: 'conversation',
            participants: [speaker, listener],
            outcome: outcome || 'neutral',
            metadata: {
                turn: this.currentTurn
            }
        });
    }
    
    /**
     * Test major world event (for debugging)
     */
    public testMajorEvent(): void {
        // DEBUG: console.log('[WorldState] Testing major world event');
        this.eventGenerator.generateEvents(
            this.currentTurn,
            this.threadManager.getThreads(),
            this.worldState.characters,
            this.factionManager.getActivities()
        );
        const latestEvent = this.worldState.events[this.worldState.events.length - 1];
        if (latestEvent) {
            // DEBUG: console.log('[WorldState] Generated event:', latestEvent);
        }
    }
    
    /**
     * Get narrative suggestions for current state
     */
    public getNarrativeSuggestions(): string[] {
        const suggestions: string[] = [];

        // Check for threads ready to activate
        Object.values(this.threadManager.getThreads()).forEach(thread => {
            if (thread && thread.status === 'building' && thread.tension > 70) {
                suggestions.push(`Thread "${thread.title}" is ready to activate (tension: ${thread.tension})`);
            }
        });

        // Check for conflicts escalating
        this.worldState.conflicts.forEach(conflict => {
            if (conflict.escalation > 80) {
                suggestions.push(`Conflict involving ${[...conflict.instigators, ...conflict.targets].join(' and ')} is critical`);
            }
        });

        // Check narrative pressure
        const pressure = this.worldState.narrativePressure;
        suggestions.push(`Narrative focus suggestion: ${pressure.suggestedFocus}`);
        suggestions.push(`Current momentum: ${pressure.momentum}`);

        return suggestions;
    }
    
    /**
     * Enhanced logging with categories and timestamps
     */
    private log(category: string, _message: string, _data?: unknown): void {
        if (!this.debugMode || !this.logCategories.includes(category)) {
            return;
        }

        // const timestamp = new Date().toISOString();
        // const turn = `T${this.currentTurn}`;
        // const prefix = `[WorldState][${category}][${turn}][${timestamp}]`;

        // if (data) {
        //     // DEBUG: console.log(prefix, message, data);
        // } else {
        //     // DEBUG: console.log(prefix, message);
        // }
    }
    
}