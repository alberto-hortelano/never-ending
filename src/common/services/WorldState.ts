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
    IFactionActivity,
    IWorldContext,
    IWorldStateUpdate,
    IThreadOutcome,
    IConsequence
} from '../interfaces/worldState';
import type { IStoryState } from '../interfaces';
import type { DeepReadonly } from '../helpers/types';

import { EventBus } from '../events/EventBus';
import { StateChangeEvent, UpdateStateEvent, StateChangeEventsMap, UpdateStateEventsMap } from '../events/StateEvents';

export class WorldState extends EventBus<StateChangeEventsMap, UpdateStateEventsMap> {
    private static instance: WorldState;
    
    private worldState: IWorldState = {
        threads: new Map(),
        characters: new Map(),
        events: [],
        conflicts: [],
        factionActivities: new Map(),
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
    private logCategories = new Set(['init', 'update', 'thread', 'event', 'error']);
    
    private constructor() {
        super();
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
            this.createOriginThreads(storyState.selectedOrigin);
        }
        
        // Initialize faction activities
        this.initializeFactionActivities(storyState.factionReputation || {});
        
        // Create character profiles for known NPCs
        this.initializeCharacterProfiles();
        
        this.isInitialized = true;
        this.log('init', 'Initialization complete');
    }
    
    /**
     * Create story threads based on the player's origin
     */
    private createOriginThreads(origin: {id?: string, name?: string, traits?: string[]}): void {
        // Skip creation if no valid origin
        if (!origin.name && !origin.id) {
            console.warn('[WorldState] No valid origin provided, skipping thread creation');
            return;
        }
        const originName = origin.name || origin.id || '';
        
        // Create a thread for the main origin conflict
        const mainThread: IStoryThread = {
            id: `origin_${originName}_main`,
            type: 'conflict',
            title: `${originName} Main Conflict`,
            participants: ['player'],
            status: 'active',
            tension: 30,
            potentialOutcomes: [],
            currentNarrative: this.generateOriginNarrative(originName),
            lastUpdated: this.currentTurn,
            priority: 'high',
            tags: new Set(['origin', 'main'])
        };
        
        this.worldState.threads.set(mainThread.id, mainThread);
        
        // Create threads for potential allies and enemies
        if (originName) {
            this.createRelationshipThreads(originName);
        }
    }
    
    private generateOriginNarrative(originName: string): string {
        const narratives: Record<string, string> = {
            'The Deserter': 'Military forces are closing in. Former comrades have been spotted in nearby systems.',
            'The Scavenger': 'Word of the ancient artifact has spread. Multiple factions are mobilizing salvage teams.',
            'The Investigator': 'The Syndicate has noticed your investigation. Counter-intelligence operations are being prepared.',
            'The Rebel': 'Your sabotage has triggered a massive security response. Loyalist forces are on high alert.',
            'The Survivor': 'Resources are dwindling in the refugee sectors. Desperate groups are forming alliances.'
        };
        
        return narratives[originName] || 'Your journey begins in uncertain times. The galaxy watches with interest as new players enter the game.';
    }
    
    private createRelationshipThreads(originName: string): void {
        // Create threads for key relationships based on origin
        const relationships: Record<string, string[]> = {
            'The Deserter': ['Former Squadron', 'Military Command', 'Underground Network'],
            'The Scavenger': ['Salvage Guild', 'Tech Collectors', 'Artifact Hunters'],
            'The Investigator': ['Informant Network', 'Syndicate Enforcers', 'Corrupt Officials'],
            'The Rebel': ['Resistance Cells', 'Government Forces', 'Sympathizers'],
            'The Survivor': ['Fellow Refugees', 'Aid Organizations', 'Exploitation Gangs']
        };
        
        const groups = relationships[originName] || [];
        groups.forEach(group => {
            const thread: IStoryThread = {
                id: `relationship_${group.replace(/\s+/g, '_').toLowerCase()}`,
                type: 'relationship',
                title: `Relations with ${group}`,
                participants: [group],
                status: 'building',
                tension: Math.random() * 50 + 10,
                potentialOutcomes: this.generatePotentialOutcomes(group),
                currentNarrative: `The ${group} are aware of your presence and considering their response.`,
                lastUpdated: this.currentTurn,
                priority: 'medium',
                tags: new Set(['relationship', originName.toLowerCase()])
            };
            
            this.worldState.threads.set(thread.id, thread);
        });
    }
    
    private generatePotentialOutcomes(group: string): IThreadOutcome[] {
        return [
            {
                id: `${group}_alliance`,
                description: `Form an alliance with ${group}`,
                probability: 0.3,
                consequences: [
                    {
                        type: 'relationship',
                        target: group,
                        value: 'ally',
                        description: `${group} becomes a reliable ally`
                    }
                ]
            },
            {
                id: `${group}_conflict`,
                description: `Open conflict with ${group}`,
                probability: 0.3,
                consequences: [
                    {
                        type: 'relationship',
                        target: group,
                        value: 'enemy',
                        description: `${group} becomes hostile`
                    }
                ]
            },
            {
                id: `${group}_neutral`,
                description: `Maintain cautious neutrality`,
                probability: 0.4,
                consequences: [
                    {
                        type: 'relationship',
                        target: group,
                        value: 'neutral',
                        description: `${group} remains watchful but uncommitted`
                    }
                ]
            }
        ];
    }
    
    private initializeFactionActivities(factionReputation: Record<string, number>): void {
        const factions = Object.keys(factionReputation).length > 0 
            ? Object.keys(factionReputation)
            : ['Syndicate', 'Rebels', 'Technomancers', 'Free Worlds', 'Military'];
        
        factions.forEach(faction => {
            const reputation = factionReputation[faction] || 0;
            // Use reputation to influence resources - higher reputation = more resources
            const influenceBase = reputation > 0 ? 100 + reputation : 50;
            const militaryBase = reputation > 0 ? 50 + (reputation / 2) : 20;
            
            const activity: IFactionActivity = {
                factionId: faction,
                currentOperations: this.generateFactionOperations(faction),
                territories: [],
                resources: [
                    { type: 'influence', amount: Math.random() * 50 + influenceBase },
                    { type: 'military', amount: Math.random() * 30 + militaryBase }
                ],
                activeAgents: [],
                currentGoals: this.generateFactionGoals(faction),
                relationships: new Map()
            };
            
            // Set relationships with other factions based on reputation differences
            factions.forEach(otherFaction => {
                if (otherFaction !== faction) {
                    const myRep = factionReputation[faction] || 0;
                    const theirRep = factionReputation[otherFaction] || 0;
                    // Factions with similar reputation levels have better relationships
                    const basRelation = Math.random() * 200 - 100;
                    const repModifier = -Math.abs(myRep - theirRep) / 2;
                    activity.relationships.set(otherFaction, basRelation + repModifier);
                }
            });
            
            this.worldState.factionActivities.set(faction, activity);
        });
    }
    
    private generateFactionOperations(faction: string): string[] {
        const operations: Record<string, string[]> = {
            'Syndicate': ['Expanding smuggling routes', 'Eliminating competition', 'Corrupting officials'],
            'Rebels': ['Recruiting sympathizers', 'Planning strikes', 'Securing supply lines'],
            'Technomancers': ['Searching for artifacts', 'Conducting experiments', 'Hoarding technology'],
            'Free Worlds': ['Defending territories', 'Negotiating alliances', 'Resisting control'],
            'Military': ['Hunting deserters', 'Securing strategic points', 'Enforcing order']
        };
        
        return operations[faction] || ['Consolidating power'];
    }
    
    private generateFactionGoals(faction: string): string[] {
        const goals: Record<string, string[]> = {
            'Syndicate': ['Control all trade routes', 'Eliminate rivals', 'Maximize profits'],
            'Rebels': ['Overthrow the regime', 'Liberate oppressed systems', 'Build coalition'],
            'Technomancers': ['Unlock ancient secrets', 'Achieve technological supremacy', 'Control information'],
            'Free Worlds': ['Maintain independence', 'Create mutual defense pact', 'Promote free trade'],
            'Military': ['Restore order', 'Eliminate threats', 'Expand control']
        };
        
        return goals[faction] || ['Survive and thrive'];
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
            relationships: new Map([
                ['player', {
                    characterId: 'player',
                    type: 'ally',
                    trust: 100,
                    respect: 90,
                    fear: 0,
                    history: ['Loyal service since desertion'],
                    lastInteraction: this.currentTurn
                }]
            ]),
            currentActivity: 'Analyzing tactical data',
            locationBelief: 'With the commander',
            knowledge: new Set(['Military protocols', 'Commander history']),
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
        
        this.worldState.characters.set('Data', dataProfile);
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
        this.updateNarrativePressure();
    }
    
    private processCombatUpdate(update: IWorldStateUpdate): void {
        // Increase tension in conflict threads
        this.worldState.threads.forEach(thread => {
            if (thread.type === 'conflict' && thread.status !== 'resolved') {
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
            let thread = this.worldState.threads.get(threadId);
            
            if (!thread && speaker && listener) {
                thread = this.createRelationshipThread(speaker, listener);
                this.worldState.threads.set(threadId, thread);
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
            tags: new Set(['dialogue', 'relationship'])
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
        this.worldState.threads.forEach(thread => {
            if (thread.tags.has('mission') && thread.status === 'active') {
                thread.tension = Math.min(100, thread.tension + 15);
                thread.lastUpdated = this.currentTurn;
            }
        });
    }
    
    private processTurnUpdate(_update: IWorldStateUpdate): void {
        // Regular turn-based updates
        this.advanceStoryThreads();
        this.updateFactionActivities();
        this.checkForEmergingConflicts();
    }
    
    private processMovementUpdate(update: IWorldStateUpdate): void {
        // Track character movements for location beliefs
        if (update.participants && update.location) {
            update.participants.forEach(character => {
                const profile = this.worldState.characters.get(character);
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
                
                const char1 = this.worldState.characters.get(participant1);
                const char2 = this.worldState.characters.get(participant2);
                
                if (char1 && char2) {
                    // Update or create relationships
                    const rel1 = char1.relationships.get(participant2) || {
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
                    
                    char1.relationships.set(participant2, rel1);
                }
            }
        }
    }
    
    private advanceStoryThreads(): void {
        // Progress story threads based on time
        this.worldState.threads.forEach(thread => {
            if (thread.status === 'building' && thread.tension >= 75) {
                this.activateThread(thread);
            } else if (thread.status === 'active' && thread.tension >= 100) {
                // Trigger thread resolution
                this.resolveThread(thread, undefined);
            }
            
            // Natural tension increase over time
            if (thread.status !== 'resolved' && thread.status !== 'dormant') {
                thread.tension = Math.min(100, thread.tension + 1);
            }
        });
    }
    
    private activateThread(thread: IStoryThread): void {
        try {
            if (!thread) {
                this.log('error', 'Cannot activate null thread');
                return;
            }
            
            thread.status = 'active';
            
            // Generate outcomes if not present
            if (!thread.potentialOutcomes || thread.potentialOutcomes.length === 0) {
                thread.potentialOutcomes = this.generateThreadOutcomes(thread);
            }
            
            this.log('thread', `Thread activated: ${thread.title}`, { tension: thread.tension });
        } catch (error) {
            this.log('error', `Failed to activate thread: ${thread?.title}`, error);
        }
    }
    
    private resolveThread(thread: IStoryThread, selectedOutcome?: IThreadOutcome): void {
        try {
            if (!thread) {
                this.log('error', 'Cannot resolve null thread');
                return;
            }
            
            this.log('thread', `Resolving thread: ${thread.title}`);
            
            // Select outcome based on probabilities or use provided outcome
            const outcome = selectedOutcome || this.selectOutcome(thread.potentialOutcomes);
            if (outcome) {
                // Apply consequences with error handling
                outcome.consequences.forEach(consequence => {
                    this.safeExecute(() => this.applyConsequence(consequence), `applyConsequence for ${thread.title}`);
                });
            }
            
            thread.status = 'resolved';
            thread.lastUpdated = this.currentTurn;
        } catch (error) {
            this.log('error', `Failed to resolve thread: ${thread?.title}`, error);
            // Set to resolved anyway to prevent stuck threads
            thread.status = 'resolved';
        }
    }
    
    private selectOutcome(outcomes: IThreadOutcome[]): IThreadOutcome | null {
        if (!outcomes || outcomes.length === 0) return null;
        
        const rand = Math.random();
        let cumulative = 0;
        
        for (const outcome of outcomes) {
            cumulative += outcome.probability;
            if (rand <= cumulative) {
                return outcome;
            }
        }
        
        return outcomes[outcomes.length - 1] || null;
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
    
    private updateFactionActivities(): void {
        // Update faction activities each turn
        this.worldState.factionActivities.forEach((activity, factionId) => {
            // Rotate operations occasionally
            if (Math.random() < 0.1) {
                activity.currentOperations = this.generateFactionOperations(factionId);
            }
            
            // Adjust resources
            activity.resources.forEach(resource => {
                resource.amount = Math.max(0, resource.amount + (Math.random() * 10 - 3));
            });
        });
    }
    
    private checkForEmergingConflicts(): void {
        // Check faction relationships for potential conflicts
        const conflicts: IEmergingConflict[] = [];
        
        this.worldState.factionActivities.forEach((activity1, faction1) => {
            activity1.relationships.forEach((reputation, faction2) => {
                if (reputation < -50 && Math.random() < 0.05) {
                    // Potential conflict emerging
                    const conflict: IEmergingConflict = {
                        id: `conflict_${faction1}_${faction2}_${Date.now()}`,
                        type: 'territorial',
                        instigators: [faction1],
                        targets: [faction2],
                        stakes: 'Control over disputed territories',
                        escalation: Math.abs(reputation) / 2,
                        possibleResolutions: ['Negotiation', 'Show of force', 'Third party mediation'],
                        currentState: 'Tensions rising'
                    };
                    
                    conflicts.push(conflict);
                }
            });
        });
        
        // Add new conflicts to world state
        this.worldState.conflicts.push(...conflicts);
    }
    
    private updateNarrativePressure(): void {
        const activeThreadCount = Array.from(this.worldState.threads.values())
            .filter(t => t.status === 'active').length;
        
        const highTensionCount = Array.from(this.worldState.threads.values())
            .filter(t => t.tension > 75).length;
        
        // Determine narrative pressure based on world state
        if (highTensionCount > 3) {
            this.worldState.narrativePressure.momentum = 'climactic';
            this.worldState.narrativePressure.suggestedFocus = 'action';
        } else if (activeThreadCount > 2) {
            this.worldState.narrativePressure.momentum = 'building';
            this.worldState.narrativePressure.suggestedFocus = 'tension';
        } else {
            this.worldState.narrativePressure.momentum = 'steady';
            this.worldState.narrativePressure.suggestedFocus = 'exploration';
        }
        
        // Update active themes based on current threads
        const themes = new Set<string>();
        this.worldState.threads.forEach(thread => {
            thread.tags.forEach(tag => themes.add(tag));
        });
        this.worldState.narrativePressure.activeThemes = Array.from(themes);
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
        this.generateWorldEvents();
        
        // Update all character profiles
        this.updateCharacterProfiles();
        
        // Prune old resolved threads
        this.pruneOldThreads();
        
        this.worldState.lastMajorUpdate = this.currentTurn;
    }
    
    private generateWorldEvents(): void {
        // Generate random world events occasionally
        if (Math.random() < 0.2) {
            const event: IWorldEvent = {
                id: `event_${Date.now()}`,
                type: (['political', 'military', 'economic', 'discovery', 'disaster'] as const)[Math.floor(Math.random() * 5)] as ('political' | 'military' | 'economic' | 'discovery' | 'disaster'),
                title: this.generateEventTitle(),
                description: this.generateEventDescription(),
                affectedFactions: this.selectRandomFactions(),
                affectedSystems: [],
                startTurn: this.currentTurn,
                duration: Math.floor(Math.random() * 10) + 5,
                intensity: (['minor', 'moderate', 'major'] as const)[Math.floor(Math.random() * 3)] as ('minor' | 'moderate' | 'major' | 'critical'),
                consequences: []
            };
            
            this.worldState.events.push(event);
            this.log('event', `New world event: ${event.title}`, { type: event.type, intensity: event.intensity });
        }
    }
    
    private generateEventTitle(): string {
        const titles = [
            'Supply Line Disruption',
            'Faction Alliance Formed',
            'Technology Breakthrough',
            'System Blockade',
            'Refugee Crisis',
            'Black Market Surge',
            'Military Mobilization',
            'Diplomatic Summit'
        ];
        const title = titles[Math.floor(Math.random() * titles.length)];
        return title || 'Mysterious Occurrence';
    }
    
    private generateEventDescription(): string {
        return 'Significant developments are unfolding across the galaxy.';
    }
    
    private selectRandomFactions(): string[] {
        const allFactions = Array.from(this.worldState.factionActivities.keys());
        const count = Math.floor(Math.random() * 3) + 1;
        const selected: string[] = [];
        
        for (let i = 0; i < count && allFactions.length > 0; i++) {
            const index = Math.floor(Math.random() * allFactions.length);
            const faction = allFactions[index];
            if (faction) {
                selected.push(faction);
            }
            allFactions.splice(index, 1);
        }
        
        return selected;
    }
    
    private updateCharacterProfiles(): void {
        // Update character goals and activities
        this.worldState.characters.forEach(character => {
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
            activities.push('Protecting allies', 'Coordinating with team', 'Following orders');
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
        
        this.worldState.threads.forEach((thread, id) => {
            if (thread.status === 'resolved' && thread.lastUpdated < cutoff) {
                this.worldState.threads.delete(id);
                // DEBUG: console.log(`[WorldState] Pruned old thread: ${thread.title}`);
            }
        });
    }
    
    private handleCharacterDefeat(characterName: string): void {
        // Update character profile
        const profile = this.worldState.characters.get(characterName);
        if (profile) {
            profile.currentActivity = 'Defeated';
            
            // Update relationships
            profile.relationships.forEach(rel => {
                rel.history.push(`Defeated at turn ${this.currentTurn}`);
            });
        }
        
        // Update related threads
        this.worldState.threads.forEach(thread => {
            if (thread.participants.includes(characterName)) {
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
        
        this.worldState.threads.forEach(thread => {
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
    
    private getCharacterMotivations(participants?: string[]): Map<string, string[]> {
        const motivations = new Map<string, string[]>();
        
        if (participants) {
            participants.forEach(participant => {
                const profile = this.worldState.characters.get(participant);
                if (profile) {
                    const goals = profile.goals
                        .filter(g => g.priority === 'high' || g.priority === 'critical')
                        .map(g => g.description);
                    motivations.set(participant, goals);
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
                const profile = this.worldState.characters.get(participant);
                if (profile) {
                    profile.relationships.forEach(rel => {
                        if (rel.history.length > 0) {
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
        const activeThreads = Array.from(this.worldState.threads.values())
            .filter(t => t.status === 'active')
            .map(t => t.currentNarrative)
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
            this.logCategories = new Set(categories);
        }
        // DEBUG: console.log('[WorldState] Debug mode enabled for categories:', Array.from(this.logCategories));
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
        const info = {
            initialized: this.isInitialized,
            currentTurn: this.currentTurn,
            debugMode: this.debugMode,
            threads: {
                total: this.worldState.threads.size,
                active: Array.from(this.worldState.threads.values()).filter(t => t.status === 'active').length,
                building: Array.from(this.worldState.threads.values()).filter(t => t.status === 'building').length,
                resolved: Array.from(this.worldState.threads.values()).filter(t => t.status === 'resolved').length,
                dormant: Array.from(this.worldState.threads.values()).filter(t => t.status === 'dormant').length,
                details: Array.from(this.worldState.threads.values()).map(t => ({
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
                total: this.worldState.characters.size,
                profiles: Array.from(this.worldState.characters.values()).map(c => ({
                    id: c.id,
                    name: c.name,
                    faction: 'independent',  // No faction in ICharacterProfile
                    currentActivity: c.currentActivity,
                    goals: c.goals?.length || 0,
                    relationships: c.relationships.size
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
                total: this.worldState.factionActivities.size,
                activities: Array.from(this.worldState.factionActivities.values()).map(f => ({
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
            const threads = Array.from(this.worldState.threads.values());
            if (threads.length > 0) {
                const randomThread = threads[Math.floor(Math.random() * threads.length)];
                if (randomThread) {
                    randomThread.tension = Math.min(100, randomThread.tension + 20);
                    if (randomThread.tension > 80 && randomThread.status === 'building') {
                        this.activateThread(randomThread);
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
        this.generateWorldEvents();
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
        this.worldState.threads.forEach(thread => {
            if (thread.status === 'building' && thread.tension > 70) {
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
        if (!this.debugMode || !this.logCategories.has(category)) {
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
    
    /**
     * Safely execute a function with error handling
     */
    private safeExecute(fn: () => void, context: string): void {
        try {
            fn();
        } catch (error) {
            this.log('error', `Error in ${context}`, error);
            // Continue processing other threads/updates
        }
    }
    
    /**
     * Generate potential outcomes for a thread
     */
    private generateThreadOutcomes(thread: IStoryThread): IThreadOutcome[] {
        const outcomes: IThreadOutcome[] = [];
        
        // Generate 2-3 potential outcomes based on thread type
        const outcomeCount = Math.floor(Math.random() * 2) + 2;
        
        for (let i = 0; i < outcomeCount; i++) {
            const isPositive = i === 0; // At least one positive outcome
            const isNegative = i === 1; // At least one negative outcome
            
            outcomes.push({
                id: `${thread.id}_outcome_${i}`,
                description: isPositive ? 'Positive resolution' : isNegative ? 'Negative resolution' : 'Neutral resolution',
                probability: 1 / outcomeCount,
                consequences: []
            });
        }
        
        return outcomes;
    }
}