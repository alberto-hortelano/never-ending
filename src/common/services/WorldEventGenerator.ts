/**
 * WorldEventGenerator
 * Generates world events, detects emerging conflicts, and updates narrative pressure
 */

import type {
    IWorldEvent,
    IEmergingConflict,
    INarrativePressure,
    IStoryThread,
    ICharacterProfile,
    IFactionActivity
} from '../interfaces/worldState';

export class WorldEventGenerator {
    constructor(
        private onEventsGenerated?: (events: IWorldEvent[]) => void,
        private onConflictsDetected?: (conflicts: IEmergingConflict[]) => void,
        private onPressureUpdate?: (pressure: INarrativePressure) => void
    ) {}

    public generateEvents(
        currentTurn: number,
        _threads: Record<string, IStoryThread>,
        _characters: Record<string, ICharacterProfile>,
        factionActivities: Record<string, IFactionActivity>
    ): IWorldEvent[] {
        const events: IWorldEvent[] = [];

        // Generate random world events occasionally
        if (Math.random() < 0.2) {
            const event: IWorldEvent = {
                id: `event_${Date.now()}`,
                type: (['political', 'military', 'economic', 'discovery', 'disaster'] as const)[Math.floor(Math.random() * 5)] as ('political' | 'military' | 'economic' | 'discovery' | 'disaster'),
                title: this.generateEventTitle(),
                description: this.generateEventDescription(),
                affectedFactions: this.selectRandomFactions(factionActivities),
                affectedSystems: [],
                startTurn: currentTurn,
                duration: Math.floor(Math.random() * 10) + 5,
                intensity: (['minor', 'moderate', 'major'] as const)[Math.floor(Math.random() * 3)] as ('minor' | 'moderate' | 'major' | 'critical'),
                consequences: []
            };

            events.push(event);

            // Log event generation (debug purposes)
            // console.log(`[WorldEventGenerator] New world event: ${event.title}`, { type: event.type, intensity: event.intensity });
        }

        // Notify parent if events were generated
        if (events.length > 0 && this.onEventsGenerated) {
            this.onEventsGenerated(events);
        }

        return events;
    }

    public checkForConflicts(
        _characters: Record<string, ICharacterProfile>,
        factionActivities: Record<string, IFactionActivity>,
        _existingConflicts: IEmergingConflict[]
    ): IEmergingConflict[] {
        // Check faction relationships for potential conflicts
        const conflicts: IEmergingConflict[] = [];

        Object.entries(factionActivities).forEach(([faction1, activity1]) => {
            if (!activity1) return;

            Object.entries(activity1.relationships).forEach(([faction2, reputation]) => {
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

        // Notify parent if conflicts were detected
        if (conflicts.length > 0 && this.onConflictsDetected) {
            this.onConflictsDetected(conflicts);
        }

        return conflicts;
    }

    public updatePressure(
        threads: Record<string, IStoryThread>,
        existingPressure: INarrativePressure,
        _currentTurn: number
    ): INarrativePressure {
        const activeThreadCount = Object.values(threads)
            .filter(t => t && t.status === 'active').length;

        const highTensionCount = Object.values(threads)
            .filter(t => t && t.tension > 75).length;

        const pressure: INarrativePressure = { ...existingPressure };

        // Determine narrative pressure based on world state
        if (highTensionCount > 3) {
            pressure.momentum = 'climactic';
            pressure.suggestedFocus = 'action';
        } else if (activeThreadCount > 2) {
            pressure.momentum = 'building';
            pressure.suggestedFocus = 'tension';
        } else {
            pressure.momentum = 'steady';
            pressure.suggestedFocus = 'exploration';
        }

        // Update active themes based on current threads
        const themes = new Set<string>();
        Object.values(threads).forEach(thread => {
            if (thread) {
                thread.tags.forEach(tag => themes.add(tag));
            }
        });
        pressure.activeThemes = Array.from(themes);

        // Notify parent of update
        if (this.onPressureUpdate) {
            this.onPressureUpdate(pressure);
        }

        return pressure;
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

    private selectRandomFactions(factionActivities: Record<string, IFactionActivity>): string[] {
        const allFactions = Object.keys(factionActivities);
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
}
