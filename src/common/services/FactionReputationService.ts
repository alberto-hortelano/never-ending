import { EventBus } from '../events/EventBus';
import { UpdateStateEvent, UpdateStateEventsMap } from '../events/StateEvents';
import type { IStoryState } from '../interfaces';
import { factions } from '../data/originStories';

export interface ReputationChange {
    faction: string;
    amount: number;
    reason: string;
}

export interface ReputationLevel {
    min: number;
    max: number;
    name: string;
    nameES: string;
    hostile: boolean;
}

export class FactionReputationService {
    private static instance: FactionReputationService;
    private eventBus: EventBus<UpdateStateEventsMap, UpdateStateEventsMap>;
    
    private readonly reputationLevels: ReputationLevel[] = [
        { min: -100, max: -80, name: 'Nemesis', nameES: 'Némesis', hostile: true },
        { min: -79, max: -50, name: 'Hostile', nameES: 'Hostil', hostile: true },
        { min: -49, max: -20, name: 'Unfriendly', nameES: 'Poco Amistoso', hostile: true },
        { min: -19, max: 19, name: 'Neutral', nameES: 'Neutral', hostile: false },
        { min: 20, max: 49, name: 'Friendly', nameES: 'Amistoso', hostile: false },
        { min: 50, max: 79, name: 'Allied', nameES: 'Aliado', hostile: false },
        { min: 80, max: 100, name: 'Honored', nameES: 'Honorado', hostile: false }
    ];
    
    private constructor() {
        this.eventBus = new EventBus();
    }
    
    public static getInstance(): FactionReputationService {
        if (!FactionReputationService.instance) {
            FactionReputationService.instance = new FactionReputationService();
        }
        return FactionReputationService.instance;
    }
    
    /**
     * Change faction reputation
     */
    public changeReputation(
        currentState: IStoryState,
        changes: ReputationChange[]
    ): Record<string, number> {
        const newReputation = { ...currentState.factionReputation };
        
        for (const change of changes) {
            if (!(change.faction in factions)) {
                console.warn(`Unknown faction: ${change.faction}`);
                continue;
            }
            
            const oldValue = newReputation[change.faction] || 0;
            const newValue = Math.max(-100, Math.min(100, oldValue + change.amount));
            newReputation[change.faction] = newValue;
            
            // Log reputation change
            console.log(`[Reputation] ${change.faction}: ${oldValue} → ${newValue} (${change.reason})`);
            
            // Check for reputation level changes
            const oldLevel = this.getReputationLevel(oldValue);
            const newLevel = this.getReputationLevel(newValue);
            
            if (oldLevel.name !== newLevel.name) {
                this.notifyReputationLevelChange(change.faction, oldLevel, newLevel);
            }
        }
        
        // Update state with new reputation
        // Note: We're dispatching a partial story state update here
        // The state handler will merge this with the existing story state
        this.eventBus.dispatch(UpdateStateEvent.storyState, {
            factionReputation: newReputation
        } as Partial<IStoryState>);
        
        return newReputation;
    }
    
    /**
     * Get reputation level for a value
     */
    public getReputationLevel(reputation: number): ReputationLevel {
        for (const level of this.reputationLevels) {
            if (reputation >= level.min && reputation <= level.max) {
                return level;
            }
        }
        // Default to neutral
        return { min: -19, max: 19, name: 'Neutral', nameES: 'Neutral', hostile: false };
    }
    
    /**
     * Check if faction is hostile
     */
    public isFactionHostile(reputation: number): boolean {
        return this.getReputationLevel(reputation).hostile;
    }
    
    /**
     * Get faction standing description
     */
    public getFactionStanding(faction: string, reputation: number): string {
        const level = this.getReputationLevel(reputation);
        // Type assertion needed because factions is a const object with known keys
        const factionData = faction in factions ? (factions as Record<string, {id: string; name: string; nameES: string; description: string}>)[faction] : null;
        
        if (!factionData) return 'Unknown faction';
        
        return `${factionData.nameES}: ${level.nameES} (${reputation})`;
    }
    
    /**
     * Calculate reputation changes from player actions
     */
    public calculateActionReputation(
        action: string,
        targetFaction?: string,
        alliedFactions?: string[]
    ): ReputationChange[] {
        const changes: ReputationChange[] = [];
        
        switch (action) {
            case 'kill_enemy':
                if (targetFaction) {
                    changes.push({ faction: targetFaction, amount: -20, reason: 'Killed faction member' });
                    // Allied factions also lose rep
                    alliedFactions?.forEach(ally => {
                        changes.push({ faction: ally, amount: -10, reason: 'Killed ally of faction' });
                    });
                }
                break;
                
            case 'complete_mission':
                if (targetFaction) {
                    changes.push({ faction: targetFaction, amount: 15, reason: 'Completed mission' });
                }
                break;
                
            case 'spare_enemy':
                if (targetFaction) {
                    changes.push({ faction: targetFaction, amount: 10, reason: 'Showed mercy' });
                }
                break;
                
            case 'betray_ally':
                if (targetFaction) {
                    changes.push({ faction: targetFaction, amount: -50, reason: 'Betrayal' });
                }
                break;
                
            case 'deliver_item':
                if (targetFaction) {
                    changes.push({ faction: targetFaction, amount: 5, reason: 'Delivered goods' });
                }
                break;
        }
        
        return changes;
    }
    
    /**
     * Get available missions based on reputation
     */
    public getAvailableMissions(reputation: Record<string, number>): string[] {
        const available: string[] = [];
        
        // Check each faction for mission availability
        for (const [faction, rep] of Object.entries(reputation)) {
            const level = this.getReputationLevel(rep);
            
            if (!level.hostile) {
                // Friendly factions offer missions
                if (rep >= 20) {
                    available.push(`${faction}_trade_mission`);
                }
                if (rep >= 50) {
                    available.push(`${faction}_combat_mission`);
                }
                if (rep >= 80) {
                    available.push(`${faction}_special_mission`);
                }
            }
        }
        
        return available;
    }
    
    /**
     * Notify when reputation level changes
     */
    private notifyReputationLevelChange(
        faction: string,
        oldLevel: ReputationLevel,
        newLevel: ReputationLevel
    ): void {
        // Type assertion for factions object
        const factionData = faction in factions ? (factions as Record<string, {id: string; name: string; nameES: string; description: string}>)[faction] : null;
        if (!factionData) return;
        
        // Add journal entry about reputation change
        const entry = {
            id: `rep_${faction}_${Date.now()}`,
            title: `Reputación: ${factionData.nameES}`,
            content: `Tu reputación con ${factionData.nameES} ha cambiado de ${oldLevel.nameES} a ${newLevel.nameES}.`,
            date: new Date().toISOString(),
            type: 'faction' as const,
            isRead: false
        };
        
        // This would dispatch to add journal entry
        console.log('[Reputation Change]', entry);
    }
}