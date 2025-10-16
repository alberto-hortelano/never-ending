/**
 * WorldThreadManager Service
 * Manages story threads, their lifecycle, and outcomes
 */

import type { IStoryThread, IThreadOutcome, IConsequence } from '../interfaces/worldState';

export class WorldThreadManager {
    private threads: Record<string, IStoryThread> = {};
    private currentTurn: number = 0;

    constructor(
        private onThreadUpdate?: (threads: Record<string, IStoryThread>) => void,
        private onApplyConsequence?: (consequence: IConsequence) => void
    ) {}

    public setThreads(threads: Record<string, IStoryThread>): void {
        this.threads = threads;
    }

    public getThreads(): Record<string, IStoryThread> {
        return this.threads;
    }

    public setCurrentTurn(turn: number): void {
        this.currentTurn = turn;
    }

    /**
     * Create story threads based on the player's origin
     */
    public createOriginThreads(origin: {id?: string, name?: string, traits?: string[]}): void {
        // Skip creation if no valid origin
        if (!origin.name && !origin.id) {
            console.warn('[WorldThreadManager] No valid origin provided, skipping thread creation');
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
            tags: ['origin', 'main']
        };

        this.threads[mainThread.id] = mainThread;

        // Create threads for potential allies and enemies
        if (originName) {
            this.createRelationshipThreads(originName);
        }

        this.notifyUpdate();
    }

    /**
     * Progress story threads based on time
     */
    public advanceThreads(): void {
        Object.values(this.threads).forEach(thread => {
            if (!thread) return;

            if (thread.status === 'building' && thread.tension >= 75) {
                this.activateThread(thread);
            } else if (thread.status === 'active' && thread.tension >= 100) {
                // Trigger thread resolution
                this.resolveThread(thread);
            }

            // Natural tension increase over time
            if (thread.status !== 'resolved' && thread.status !== 'dormant') {
                thread.tension = Math.min(100, thread.tension + 1);
            }
        });

        this.notifyUpdate();
    }

    /**
     * Activate a thread that has built up enough tension
     */
    public activateThread(thread: IStoryThread): void {
        try {
            if (!thread) {
                console.error('[WorldThreadManager] Cannot activate null thread');
                return;
            }

            thread.status = 'active';

            // Generate outcomes if not present
            if (!thread.potentialOutcomes || thread.potentialOutcomes.length === 0) {
                thread.potentialOutcomes = this.generateThreadOutcomes(thread);
            }

            this.notifyUpdate();
        } catch (error) {
            console.error(`[WorldThreadManager] Failed to activate thread: ${thread?.title}`, error);
        }
    }

    /**
     * Resolve a thread with consequences
     */
    public resolveThread(
        thread: IStoryThread,
        selectedOutcome?: IThreadOutcome
    ): void {
        try {
            if (!thread) {
                console.error('[WorldThreadManager] Cannot resolve null thread');
                return;
            }

            // Select outcome based on probabilities or use provided outcome
            const outcome = selectedOutcome || this.selectOutcome(thread.potentialOutcomes);
            if (outcome && this.onApplyConsequence) {
                // Apply consequences with error handling
                outcome.consequences.forEach(consequence => {
                    try {
                        this.onApplyConsequence!(consequence);
                    } catch (error) {
                        console.error(`[WorldThreadManager] Failed to apply consequence for ${thread.title}`, error);
                    }
                });
            }

            thread.status = 'resolved';
            thread.lastUpdated = this.currentTurn;

            this.notifyUpdate();
        } catch (error) {
            console.error(`[WorldThreadManager] Failed to resolve thread: ${thread?.title}`, error);
            // Set to resolved anyway to prevent stuck threads
            thread.status = 'resolved';
            this.notifyUpdate();
        }
    }

    /**
     * Create threads for key relationships based on origin
     */
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
                tags: ['relationship', originName.toLowerCase()]
            };

            this.threads[thread.id] = thread;
        });
    }

    /**
     * Generate origin narrative based on origin name
     */
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

    /**
     * Generate potential outcomes for a group relationship
     */
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

    /**
     * Select outcome based on probabilities
     */
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

    /**
     * Notify that threads have been updated
     */
    private notifyUpdate(): void {
        if (this.onThreadUpdate) {
            this.onThreadUpdate(this.threads);
        }
    }
}
