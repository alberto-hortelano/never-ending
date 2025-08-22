import { EventBus } from '../events/EventBus';
import { UpdateStateEvent, StateChangeEvent } from '../events/StateEvents';
import type { UpdateStateEventsMap, StateChangeEventsMap } from '../events/StateEvents';
import type { IStoryState, IStoryPlan, IMission } from '../interfaces';
import type { DeepReadonly } from '../helpers/types';

export class StoryState extends EventBus<UpdateStateEventsMap, StateChangeEventsMap> {
    private _story: IStoryState = {
        selectedOrigin: null,
        currentChapter: 0,
        completedMissions: [],
        majorDecisions: [],
        factionReputation: {},
        storyFlags: new Set<string>(),
        journalEntries: [],
        storyPlan: undefined,
        currentMissionId: undefined,
        completedObjectives: []
    };
    
    private saveCallback?: () => void;
    private isPreview: boolean;
    
    constructor(saveCallback?: () => void, isPreview = false) {
        super();
        this.saveCallback = saveCallback;
        this.isPreview = isPreview;
        
        // Listen for story state updates
        if (!isPreview) {
            this.listen(UpdateStateEvent.storyState, (storyUpdate) => {
                this.updateStoryState(storyUpdate);
            });
        }
    }
    
    get story(): DeepReadonly<IStoryState> {
        return {
            ...this._story,
            storyFlags: new Set(this._story.storyFlags) // Clone the Set for readonly
        };
    }

    // Internal getter for mutable access
    getInternalStory(): IStoryState {
        return this._story;
    }
    
    set story(newStory: IStoryState) {
        this._story = {
            ...newStory,
            storyFlags: new Set(newStory.storyFlags) // Ensure it's a Set
        };
    }
    
    private updateStoryState(update: Partial<IStoryState>) {
        // Update selected origin
        if (update.selectedOrigin !== undefined) {
            this._story.selectedOrigin = update.selectedOrigin;
        }
        
        // Update chapter
        if (update.currentChapter !== undefined) {
            this._story.currentChapter = update.currentChapter;
        }
        
        // Update completed missions
        if (update.completedMissions) {
            this._story.completedMissions = [...update.completedMissions];
        }
        
        // Update major decisions
        if (update.majorDecisions) {
            this._story.majorDecisions = [...update.majorDecisions];
        }
        
        // Update faction reputation
        if (update.factionReputation) {
            this._story.factionReputation = { ...update.factionReputation };
        }
        
        // Update story flags
        if (update.storyFlags) {
            this._story.storyFlags = new Set(update.storyFlags);
        }
        
        // Update journal entries
        if (update.journalEntries) {
            this._story.journalEntries = [...update.journalEntries];
        }
        
        // Update story plan
        if (update.storyPlan !== undefined) {
            this._story.storyPlan = update.storyPlan;
        }
        
        // Update current mission ID
        if (update.currentMissionId !== undefined) {
            this._story.currentMissionId = update.currentMissionId;
        }
        
        // Update completed objectives
        if (update.completedObjectives) {
            if (!this._story.completedObjectives) {
                this._story.completedObjectives = [];
            }
            // Add new completed objectives to the list
            for (const objId of update.completedObjectives) {
                if (!this._story.completedObjectives.includes(objId)) {
                    this._story.completedObjectives.push(objId);
                }
            }
        }
        
        // Dispatch state change event
        if (!this.isPreview) {
            this.dispatch(StateChangeEvent.storyState, this.story);
        }
        
        // Save state
        if (this.saveCallback) {
            this.saveCallback();
        }
    }
    
    // Helper methods
    public hasStoryFlag(flag: string): boolean {
        return this._story.storyFlags.has(flag);
    }
    
    public addStoryFlag(flag: string) {
        const newFlags = new Set(this._story.storyFlags);
        newFlags.add(flag);
        this.updateStoryState({ storyFlags: newFlags });
    }
    
    public removeStoryFlag(flag: string) {
        const newFlags = new Set(this._story.storyFlags);
        newFlags.delete(flag);
        this.updateStoryState({ storyFlags: newFlags });
    }
    
    public getFactionReputation(faction: string): number {
        return this._story.factionReputation[faction] || 0;
    }
    
    public addJournalEntry(entry: IStoryState['journalEntries'][0]) {
        const newEntries = [...this._story.journalEntries, entry];
        this.updateStoryState({ journalEntries: newEntries });
    }
    
    public markJournalAsRead(entryId: string) {
        const newEntries = this._story.journalEntries.map(entry =>
            entry.id === entryId ? { ...entry, isRead: true } : entry
        );
        this.updateStoryState({ journalEntries: newEntries });
    }
    
    // Story plan methods
    public getStoryPlan(): IStoryPlan | undefined {
        return this._story.storyPlan;
    }
    
    public setStoryPlan(plan: IStoryPlan) {
        this.updateStoryState({ storyPlan: plan });
    }
    
    public getCurrentMissionId(): string | undefined {
        return this._story.currentMissionId;
    }
    
    public getCurrentMission(): IMission | undefined {
        if (!this._story.storyPlan || !this._story.currentMissionId) {
            return undefined;
        }
        
        for (const act of this._story.storyPlan.acts) {
            const mission = act.missions.find(m => m.id === this._story.currentMissionId);
            if (mission) {
                return mission;
            }
        }
        
        return undefined;
    }
    
    public isObjectiveCompleted(objectiveId: string): boolean {
        return this._story.completedObjectives?.includes(objectiveId) || false;
    }
    
    public markMissionCompleted(missionId: string) {
        const newMissions = [...this._story.completedMissions];
        if (!newMissions.includes(missionId)) {
            newMissions.push(missionId);
            this.updateStoryState({ completedMissions: newMissions });
        }
    }
}