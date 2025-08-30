/**
 * Background Story Generator
 * Generates plausible narratives for off-screen events, character activities,
 * and faction movements to maintain a living world
 */

import type {
    IStoryThread,
    ICharacterProfile,
    IWorldEvent,
    IEmergingConflict,
    IFactionActivity,
    ICharacterGoal,
    IThreadOutcome,
    IConsequence
} from '../interfaces/worldState';

export class BackgroundStoryGenerator {
    private static instance: BackgroundStoryGenerator;
    
    // Story templates for different situations
    private readonly characterActivityTemplates: Map<string, string[]> = new Map([
        ['combat', [
            'preparing for the next confrontation',
            'tending to wounds and resupplying',
            'planning tactical maneuvers',
            'fortifying defensive positions',
            'recruiting allies for the fight ahead'
        ]],
        ['exploration', [
            'scouting unknown territories',
            'searching for valuable resources',
            'mapping new routes',
            'investigating mysterious signals',
            'following ancient clues'
        ]],
        ['social', [
            'negotiating with local contacts',
            'spreading influence through the underworld',
            'gathering information from informants',
            'building trust with potential allies',
            'manipulating rivals through intermediaries'
        ]],
        ['survival', [
            'securing essential supplies',
            'finding safe shelter',
            'avoiding detection by enemies',
            'rationing limited resources',
            'establishing emergency protocols'
        ]]
    ]);
    
    private readonly conflictEscalationTemplates: Map<string, string[]> = new Map([
        ['low', [
            'Tensions simmer beneath the surface',
            'Subtle moves are being made in the shadows',
            'Both sides are testing boundaries',
            'Intelligence gathering intensifies',
            'Proxy agents begin positioning'
        ]],
        ['medium', [
            'Open threats have been exchanged',
            'Resources are being mobilized',
            'Alliances are being tested',
            'Sabotage operations have begun',
            'The point of no return approaches'
        ]],
        ['high', [
            'Armed confrontations have erupted',
            'Battle lines are drawn',
            'Desperate measures are being taken',
            'Collateral damage is mounting',
            'The conflict demands resolution'
        ]]
    ]);
    
    private readonly factionOperationTemplates: Map<string, string[]> = new Map([
        ['Syndicate', [
            'Expanding illegal trade networks through bribery and intimidation',
            'Eliminating rival crime bosses to consolidate power',
            'Corrupting law enforcement to ensure safe operations',
            'Establishing new smuggling routes through contested space',
            'Recruiting desperate refugees into their organization'
        ]],
        ['Rebels', [
            'Coordinating cells across multiple systems for unified action',
            'Intercepting military supply convoys to arm themselves',
            'Broadcasting propaganda to win hearts and minds',
            'Planning simultaneous strikes on key targets',
            'Establishing hidden bases in remote locations'
        ]],
        ['Technomancers', [
            'Excavating ancient ruins for lost technology',
            'Conducting dangerous experiments with alien artifacts',
            'Hoarding advanced technology from other factions',
            'Decrypting pre-collapse databases for knowledge',
            'Creating technological superiority through innovation'
        ]],
        ['Free Worlds', [
            'Negotiating mutual defense pacts with independent systems',
            'Establishing trade agreements to ensure prosperity',
            'Training militia forces to resist occupation',
            'Building diplomatic coalitions against aggression',
            'Protecting refugee populations from exploitation'
        ]],
        ['Military', [
            'Conducting sweep operations to eliminate resistance',
            'Establishing martial law in rebellious sectors',
            'Hunting deserters and traitors with extreme prejudice',
            'Securing strategic resources for the war effort',
            'Installing puppet governments in conquered territories'
        ]]
    ]);
    
    private constructor() {}
    
    public static getInstance(): BackgroundStoryGenerator {
        if (!BackgroundStoryGenerator.instance) {
            BackgroundStoryGenerator.instance = new BackgroundStoryGenerator();
        }
        return BackgroundStoryGenerator.instance;
    }
    
    /**
     * Generate activity narrative for an off-screen character
     */
    public generateCharacterActivity(
        character: ICharacterProfile,
        context: 'combat' | 'exploration' | 'social' | 'survival' = 'exploration'
    ): string {
        const templates = this.characterActivityTemplates.get(context) || ['continuing their journey'];
        const template = templates[Math.floor(Math.random() * templates.length)];
        
        // Customize based on character personality
        let modifier = '';
        if (character.personality.aggression > 70) {
            modifier = 'aggressively ';
        } else if (character.personality.cunning > 70) {
            modifier = 'carefully ';
        } else if (character.personality.compassion > 70) {
            modifier = 'thoughtfully ';
        }
        
        return `${character.name} is ${modifier}${template}`;
    }
    
    /**
     * Generate narrative for character relationships evolving
     */
    public generateRelationshipDevelopment(
        char1: string,
        char2: string,
        currentRelation: 'ally' | 'enemy' | 'neutral' | 'rival' | 'friend',
        change: 'improve' | 'deteriorate' | 'complicate'
    ): string {
        // Create context-aware templates based on current relationship
        const templates: Record<string, string[]> = {
            'improve': this.getImprovementTemplates(char1, char2, currentRelation),
            'deteriorate': this.getDeteriorationTemplates(char1, char2, currentRelation),
            'complicate': this.getComplicationTemplates(char1, char2, currentRelation)
        };
        
        const options = templates[change] || templates['complicate'];
        const selectedOption = options ? options[Math.floor(Math.random() * options.length)] : undefined;
        return selectedOption || 'Relationship evolves in unexpected ways';
    }
    
    private getImprovementTemplates(char1: string, char2: string, currentRelation: string): string[] {
        switch (currentRelation) {
            case 'enemy':
                return [
                    `Former enemies ${char1} and ${char2} begin to see each other in a new light`,
                    `${char1} saves ${char2}'s life, challenging their enmity`,
                    `A greater threat forces ${char1} and ${char2} to reconsider their hostility`
                ];
            case 'neutral':
                return [
                    `${char1} and ${char2} find common ground despite their differences`,
                    `A shared experience brings ${char1} and ${char2} closer`,
                    `${char1} begins to earn ${char2}'s respect through recent actions`
                ];
            case 'rival':
                return [
                    `Rivals ${char1} and ${char2} develop mutual respect through competition`,
                    `${char1} and ${char2} realize their rivalry pushes both to greatness`,
                    `A crisis transforms the rivalry between ${char1} and ${char2} into partnership`
                ];
            case 'friend':
                return [
                    `The friendship between ${char1} and ${char2} deepens through shared trials`,
                    `${char1} and ${char2} prove their loyalty to each other`,
                    `Trust between friends ${char1} and ${char2} becomes unbreakable`
                ];
            case 'ally':
            default:
                return [
                    `Allied forces ${char1} and ${char2} strengthen their coordination`,
                    `${char1} and ${char2} develop deeper strategic understanding`,
                    `The alliance between ${char1} and ${char2} evolves beyond mere convenience`
                ];
        }
    }
    
    private getDeteriorationTemplates(char1: string, char2: string, currentRelation: string): string[] {
        switch (currentRelation) {
            case 'ally':
                return [
                    `The alliance between ${char1} and ${char2} shows signs of strain`,
                    `${char1}'s decisions anger their ally ${char2}`,
                    `Trust between allies ${char1} and ${char2} begins to crack`
                ];
            case 'friend':
                return [
                    `A betrayal shakes the friendship between ${char1} and ${char2}`,
                    `${char1} and ${char2} find their friendship tested beyond limits`,
                    `Old friends ${char1} and ${char2} drift apart over fundamental differences`
                ];
            case 'neutral':
                return [
                    `Tensions rise as ${char1} and ${char2} clash over resources`,
                    `${char1}'s actions push ${char2} toward hostility`,
                    `Misunderstandings poison relations between ${char1} and ${char2}`
                ];
            case 'rival':
                return [
                    `The rivalry between ${char1} and ${char2} turns bitter and personal`,
                    `${char1} and ${char2}'s competition escalates to dangerous levels`,
                    `Respect between rivals ${char1} and ${char2} transforms into hatred`
                ];
            case 'enemy':
            default:
                return [
                    `The enmity between ${char1} and ${char2} reaches new depths`,
                    `${char1} swears vengeance against ${char2}`,
                    `Any hope of reconciliation between ${char1} and ${char2} dies`
                ];
        }
    }
    
    private getComplicationTemplates(char1: string, char2: string, currentRelation: string): string[] {
        switch (currentRelation) {
            case 'ally':
                return [
                    `${char1} and ${char2} must balance alliance with conflicting interests`,
                    `External pressures test the alliance between ${char1} and ${char2}`,
                    `${char1} owes ${char2} a debt that complicates their partnership`
                ];
            case 'enemy':
                return [
                    `Enemies ${char1} and ${char2} are forced to work together temporarily`,
                    `${char1} and ${char2} discover disturbing connections between them`,
                    `The conflict between ${char1} and ${char2} draws in unexpected parties`
                ];
            case 'friend':
                return [
                    `${char1} and ${char2}'s friendship faces impossible choices`,
                    `Secrets threaten the bond between ${char1} and ${char2}`,
                    `${char1} must choose between loyalty to ${char2} and their principles`
                ];
            case 'rival':
                return [
                    `${char1} and ${char2}'s rivalry becomes entangled with larger conflicts`,
                    `Third parties manipulate the rivalry between ${char1} and ${char2}`,
                    `${char1} and ${char2} discover their competition serves hidden agendas`
                ];
            case 'neutral':
            default:
                return [
                    `${char1} and ${char2}'s relationship becomes increasingly complex`,
                    `Conflicting interests strain interactions between ${char1} and ${char2}`,
                    `External forces manipulate ${char1} and ${char2} against each other`
                ];
        }
    }
    
    /**
     * Generate faction operation narrative
     */
    public generateFactionOperation(faction: string): string {
        const templates = this.factionOperationTemplates.get(faction) || [
            'consolidating their power base',
            'expanding their sphere of influence',
            'securing vital resources',
            'eliminating potential threats',
            'pursuing their mysterious agenda'
        ];
        
        const template = templates[Math.floor(Math.random() * templates.length)];
        return template || 'consolidating their position';
    }
    
    /**
     * Generate conflict escalation narrative
     */
    public generateConflictNarrative(conflict: IEmergingConflict): string {
        const intensity = conflict.escalation < 33 ? 'low' : 
                         conflict.escalation < 66 ? 'medium' : 'high';
        
        const templates = this.conflictEscalationTemplates.get(intensity) || ['The situation develops'];
        const template = templates[Math.floor(Math.random() * templates.length)];
        
        const participants = conflict.instigators.concat(conflict.targets).join(' and ');
        
        return `Between ${participants}: ${template}. The stakes: ${conflict.stakes}.`;
    }
    
    /**
     * Generate world event description
     */
    public generateWorldEventDescription(event: IWorldEvent): string {
        const templates: Record<string, string[]> = {
            'political': [
                'A major shift in galactic politics is underway',
                'Power structures are being challenged across multiple systems',
                'Secret negotiations could reshape alliances',
                'A political scandal threatens to destabilize the region',
                'New leadership emerges with radical ideas'
            ],
            'military': [
                'Military forces are mobilizing across the sector',
                'A major offensive has been launched',
                'Strategic positions are being fortified',
                'Arms races escalate between rival factions',
                'Mercenary groups flood the region seeking profit'
            ],
            'economic': [
                'Trade routes are disrupted by recent events',
                'Economic sanctions create desperate situations',
                'A resource shortage threatens stability',
                'Black markets flourish amid chaos',
                'Wealth redistribution causes social upheaval'
            ],
            'discovery': [
                'An ancient artifact has been uncovered',
                'New technology changes the balance of power',
                'A lost colony has been rediscovered',
                'Scientific breakthrough offers hope and danger',
                'Hidden truths about the past emerge'
            ],
            'disaster': [
                'A catastrophe threatens millions of lives',
                'Natural disasters create refugee crises',
                'System failures cascade across infrastructure',
                'Environmental collapse forces mass migrations',
                'An epidemic spreads through populated areas'
            ]
        };
        
        const options = templates[event.type] || ['Significant events unfold'];
        const base = options ? options[Math.floor(Math.random() * options.length)] : 'Significant events unfold';
        
        const affected = event.affectedFactions.length > 0 
            ? ` The ${event.affectedFactions.join(', ')} are particularly affected.`
            : '';
        
        return base + affected;
    }
    
    /**
     * Generate character goal narrative
     */
    public generateCharacterGoal(character: ICharacterProfile): ICharacterGoal {
        const goalTemplates = [
            {
                description: `Secure safe passage to a neutral system`,
                priority: 'medium' as const,
                blockers: ['Lack of fuel', 'Enemy blockades', 'No trusted pilot'],
                allies: ['Smugglers', 'Free traders'],
                enemies: ['Border patrols', 'Bounty hunters']
            },
            {
                description: `Acquire vital intelligence about enemy movements`,
                priority: 'high' as const,
                blockers: ['No contacts in the area', 'Communication jamming'],
                allies: ['Information brokers', 'Defectors'],
                enemies: ['Counter-intelligence', 'Double agents']
            },
            {
                description: `Build alliance with local faction`,
                priority: 'medium' as const,
                blockers: ['Trust issues', 'Conflicting interests'],
                allies: ['Mutual enemies', 'Shared contacts'],
                enemies: ['Rival factions', 'Saboteurs']
            },
            {
                description: `Obtain critical supplies for survival`,
                priority: 'critical' as const,
                blockers: ['Resource scarcity', 'Hostile territory'],
                allies: ['Black market dealers', 'Sympathizers'],
                enemies: ['Raiders', 'Corrupt officials']
            }
        ];
        
        const template = goalTemplates[Math.floor(Math.random() * goalTemplates.length)]
        if (!template) {
            return {
                id: `goal_${character.id}_${Date.now()}`,
                description: 'Survive another day',
                priority: 'high',
                progress: 0,
                blockers: [],
                allies: [],
                enemies: []
            };
        };
        
        return {
            id: `goal_${character.id}_${Date.now()}`,
            description: template.description,
            priority: template.priority,
            progress: Math.floor(Math.random() * 30),
            blockers: template.blockers ? template.blockers.slice(0, Math.floor(Math.random() * 2) + 1) : [],
            allies: template.allies ? template.allies.slice(0, Math.floor(Math.random() * 2) + 1) : [],
            enemies: template.enemies ? template.enemies.slice(0, Math.floor(Math.random() * 2) + 1) : []
        };
    }
    
    /**
     * Generate story thread narrative
     */
    public generateThreadNarrative(thread: IStoryThread): string {
        const statusNarratives: Record<string, string> = {
            'dormant': 'lies dormant, waiting for the right moment',
            'building': 'slowly builds toward an inevitable confrontation',
            'active': 'demands immediate attention and action',
            'resolved': 'has reached its conclusion, for better or worse'
        };
        
        const typeDescriptions: Record<string, string> = {
            'character': 'Personal story',
            'faction': 'Faction politics',
            'event': 'Major event',
            'relationship': 'Relationship dynamic',
            'conflict': 'Growing conflict'
        };
        
        const type = typeDescriptions[thread.type] || 'Story thread';
        const status = statusNarratives[thread.status];
        const tension = thread.tension > 75 ? ' Critical tension levels detected.' :
                       thread.tension > 50 ? ' Tension is rising.' :
                       thread.tension > 25 ? ' Situation remains manageable.' :
                       ' Minimal immediate concern.';
        
        return `${type}: "${thread.title}" ${status}.${tension}`;
    }
    
    /**
     * Generate potential outcomes for a story thread
     */
    public generateThreadOutcomes(thread: IStoryThread): IThreadOutcome[] {
        const outcomes: IThreadOutcome[] = [];
        
        // Generate 2-4 potential outcomes
        const outcomeCount = Math.floor(Math.random() * 3) + 2;
        
        for (let i = 0; i < outcomeCount; i++) {
            const isPositive = i === 0; // At least one positive outcome
            const isNegative = i === 1; // At least one negative outcome
            // const isNeutral = i >= 2;   // Additional outcomes are neutral
            
            let description: string;
            let consequences: IConsequence[] = [];
            
            if (thread.type === 'conflict') {
                if (isPositive) {
                    description = 'Peaceful resolution through negotiation';
                    consequences = [{
                        type: 'reputation',
                        target: thread.participants[0] || 'world',
                        value: 10,
                        description: 'Reputation improved through diplomacy'
                    }];
                } else if (isNegative) {
                    description = 'Violent escalation with casualties';
                    consequences = [{
                        type: 'reputation',
                        target: thread.participants[0] || 'world',
                        value: -20,
                        description: 'Reputation damaged by violence'
                    }];
                } else {
                    description = 'Uneasy stalemate maintains status quo';
                    consequences = [{
                        type: 'storyFlag',
                        target: 'world',
                        value: `stalemate_${thread.id}`,
                        description: 'Conflict remains unresolved'
                    }];
                }
            } else if (thread.type === 'relationship') {
                if (isPositive) {
                    description = 'Trust and cooperation flourish';
                    consequences = [{
                        type: 'relationship',
                        target: thread.participants.join('_'),
                        value: 'ally',
                        description: 'Relationship strengthens'
                    }];
                } else if (isNegative) {
                    description = 'Betrayal destroys all trust';
                    consequences = [{
                        type: 'relationship',
                        target: thread.participants.join('_'),
                        value: 'enemy',
                        description: 'Relationship becomes hostile'
                    }];
                } else {
                    description = 'Relationship remains complicated';
                    consequences = [{
                        type: 'relationship',
                        target: thread.participants.join('_'),
                        value: 'neutral',
                        description: 'Relationship stays uncertain'
                    }];
                }
            } else {
                // Generic outcomes for other thread types
                const genericOutcomes = [
                    'The situation resolves favorably',
                    'Things take a turn for the worse',
                    'An unexpected development changes everything',
                    'The status quo is maintained'
                ];
                description = genericOutcomes[i % genericOutcomes.length] || 'Unknown outcome';
            }
            
            outcomes.push({
                id: `outcome_${thread.id}_${i}`,
                description,
                probability: 1 / outcomeCount, // Equal probability for now
                consequences,
                requiredConditions: []
            });
        }
        
        return outcomes;
    }
    
    /**
     * Generate a complete background narrative for the current world state
     */
    public generateWorldNarrative(
        activeThreads: IStoryThread[],
        recentEvents: IWorldEvent[],
        factionActivities: Map<string, IFactionActivity>
    ): string {
        const narratives: string[] = [];
        
        // Add most important thread
        if (activeThreads.length > 0) {
            const mainThread = activeThreads[0];
            if (mainThread) {
                narratives.push(this.generateThreadNarrative(mainThread));
            }
        }
        
        // Add recent world event
        if (recentEvents.length > 0) {
            const event = recentEvents[0];
            if (event) {
                narratives.push(this.generateWorldEventDescription(event));
            }
        }
        
        // Add faction activity
        const factions = Array.from(factionActivities.keys());
        if (factions.length > 0) {
            const faction = factions[Math.floor(Math.random() * factions.length)];
            if (faction) {
                narratives.push(`The ${faction}: ${this.generateFactionOperation(faction)}`);
            }
        }
        
        // Combine into cohesive narrative
        return narratives.join(' Meanwhile, ');
    }
    
    /**
     * Generate narrative hooks for AI to incorporate
     */
    public generateNarrativeHooks(context: {
        narrativePressure?: { momentum?: string },
        characterMotivations?: Map<string, string[]>,
        emergingConflicts?: unknown[]
    }): string[] {
        const hooks: string[] = [];
        
        // Add tension-based hooks
        if (context.narrativePressure?.momentum === 'climactic') {
            hooks.push('The situation is reaching a critical turning point');
            hooks.push('Decisions made now will have lasting consequences');
        } else if (context.narrativePressure?.momentum === 'building') {
            hooks.push('Tensions are rising across multiple fronts');
            hooks.push('Various forces are positioning for advantage');
        }
        
        // Add character-based hooks
        if (context.characterMotivations && context.characterMotivations.size > 0) {
            hooks.push('Characters are pursuing their own agendas');
            hooks.push('Hidden motivations may soon be revealed');
        }
        
        // Add conflict-based hooks
        if (context.emergingConflicts && context.emergingConflicts.length > 0) {
            hooks.push('Conflicts are escalating in the background');
            hooks.push('The player may be drawn into larger disputes');
        }
        
        return hooks;
    }
}