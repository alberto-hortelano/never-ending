/**
 * WorldFactionManager
 * Manages faction activities, operations, goals, and inter-faction relationships
 */

import type { IFactionActivity } from '../interfaces/worldState';

export class WorldFactionManager {
    private factionActivities: Record<string, IFactionActivity> = {};

    constructor(
        private onActivitiesUpdate?: (activities: Record<string, IFactionActivity>) => void
    ) {}

    public setActivities(activities: Record<string, IFactionActivity>): void {
        this.factionActivities = activities;
    }

    public getActivities(): Record<string, IFactionActivity> {
        return this.factionActivities;
    }

    public setCurrentTurn(_turn: number): void {
        // Turn tracking can be added here if needed for future features
    }

    public initialize(factionReputation: Record<string, number>): void {
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
                currentOperations: this.generateOperations(faction),
                territories: [],
                resources: [
                    { type: 'influence', amount: Math.random() * 50 + influenceBase },
                    { type: 'military', amount: Math.random() * 30 + militaryBase }
                ],
                activeAgents: [],
                currentGoals: this.generateGoals(faction),
                relationships: {}
            };

            // Set relationships with other factions based on reputation differences
            factions.forEach(otherFaction => {
                if (otherFaction !== faction) {
                    const myRep = factionReputation[faction] || 0;
                    const theirRep = factionReputation[otherFaction] || 0;
                    // Factions with similar reputation levels have better relationships
                    const basRelation = Math.random() * 200 - 100;
                    const repModifier = -Math.abs(myRep - theirRep) / 2;
                    activity.relationships[otherFaction] = basRelation + repModifier;
                }
            });

            this.factionActivities[faction] = activity;
        });

        // Notify parent of update
        if (this.onActivitiesUpdate) {
            this.onActivitiesUpdate(this.factionActivities);
        }
    }

    public updateActivities(): void {
        // Update faction activities each turn
        Object.entries(this.factionActivities).forEach(([factionId, activity]) => {
            if (!activity) return;

            // Rotate operations occasionally
            if (Math.random() < 0.1) {
                activity.currentOperations = this.generateOperations(factionId);
            }

            // Adjust resources
            activity.resources.forEach(resource => {
                resource.amount = Math.max(0, resource.amount + (Math.random() * 10 - 3));
            });
        });

        // Notify parent of update
        if (this.onActivitiesUpdate) {
            this.onActivitiesUpdate(this.factionActivities);
        }
    }

    private generateOperations(faction: string): string[] {
        const operations: Record<string, string[]> = {
            'Syndicate': ['Expanding smuggling routes', 'Eliminating competition', 'Corrupting officials'],
            'Rebels': ['Recruiting sympathizers', 'Planning strikes', 'Securing supply lines'],
            'Technomancers': ['Searching for artifacts', 'Conducting experiments', 'Hoarding technology'],
            'Free Worlds': ['Defending territories', 'Negotiating alliances', 'Resisting control'],
            'Military': ['Hunting deserters', 'Securing strategic points', 'Enforcing order']
        };

        return operations[faction] || ['Consolidating power'];
    }

    private generateGoals(faction: string): string[] {
        const goals: Record<string, string[]> = {
            'Syndicate': ['Control all trade routes', 'Eliminate rivals', 'Maximize profits'],
            'Rebels': ['Overthrow the regime', 'Liberate oppressed systems', 'Build coalition'],
            'Technomancers': ['Unlock ancient secrets', 'Achieve technological supremacy', 'Control information'],
            'Free Worlds': ['Maintain independence', 'Create mutual defense pact', 'Promote free trade'],
            'Military': ['Restore order', 'Eliminate threats', 'Expand control']
        };

        return goals[faction] || ['Survive and thrive'];
    }
}
