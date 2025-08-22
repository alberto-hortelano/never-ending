import type { 
    IStoryPlan, 
    IMission, 
    IScreenContext,
    IOriginStory,
    IStoryState,
    IMessage,
    ICharacter,
    IObjective,
    INPCWithPurpose,
    IStoryObject
} from '../interfaces';
import { AIGameEngineService } from './AIGameEngineService';
import { EventBus } from '../events/EventBus';
import { UpdateStateEvent, UpdateStateEventsMap } from '../events/StateEvents';

export interface StoryPlanRequest {
    origin: IOriginStory;
    currentState?: IStoryState;
    playerDecisions?: string[];
}

export interface StoryPlanResponse {
    storyPlan: IStoryPlan;
    immediateContext: IScreenContext;
}

export class StoryPlanner extends EventBus<{}, UpdateStateEventsMap> {
    private static instance: StoryPlanner;
    private aiService: AIGameEngineService;
    private currentStoryPlan: IStoryPlan | null = null;
    private currentMission: IMission | null = null;
    
    private constructor() {
        super();
        this.aiService = AIGameEngineService.getInstance();
    }
    
    public static getInstance(): StoryPlanner {
        if (!StoryPlanner.instance) {
            StoryPlanner.instance = new StoryPlanner();
        }
        return StoryPlanner.instance;
    }
    
    /**
     * Generate a comprehensive story plan based on the selected origin
     */
    public async generateStoryPlan(request: StoryPlanRequest): Promise<IStoryPlan> {
        const messages: IMessage[] = [];
        
        // Build the story planning prompt
        const prompt = this.buildStoryPlanPrompt(request);
        messages.push({
            role: 'user',
            content: prompt
        });
        
        try {
            // Request story plan from AI
            const response = await this.aiService.requestMapGeneration(
                'story_planning',
                prompt,
                request.currentState
            );
            
            if (response && typeof response === 'object' && 'storyPlan' in response) {
                this.currentStoryPlan = response.storyPlan as IStoryPlan;
                
                // Dispatch state update with new story plan
                this.dispatch(UpdateStateEvent.storyState, {
                    storyPlan: this.currentStoryPlan
                });
                
                return this.currentStoryPlan;
            }
            
            // Return default story plan if AI fails
            return this.createDefaultStoryPlan(request.origin);
        } catch (error) {
            console.error('[StoryPlanner] Failed to generate story plan:', error);
            return this.createDefaultStoryPlan(request.origin);
        }
    }
    
    /**
     * Get context for the current screen/mission
     */
    public async getScreenContext(
        currentMission: IMission | null,
        visibleCharacters: ICharacter[],
        storyState: IStoryState
    ): Promise<IScreenContext> {
        if (!this.currentStoryPlan) {
            // Generate story plan if not exists
            if (storyState.selectedOrigin) {
                await this.generateStoryPlan({
                    origin: storyState.selectedOrigin,
                    currentState: storyState
                });
            }
        }
        
        const context: IScreenContext = {
            currentMission: currentMission || this.currentMission,
            currentObjectives: this.getCurrentObjectives(currentMission),
            visibleObjects: this.getVisibleStoryObjects(),
            activeNPCs: this.enrichNPCsWithPurpose(visibleCharacters, currentMission),
            narrativeHooks: this.getNarrativeHooks(currentMission),
            suggestedActions: this.getSuggestedActions(currentMission, visibleCharacters)
        };
        
        return context;
    }
    
    /**
     * Update story plan based on player actions
     */
    public async updateStoryPlan(
        action: string,
        consequence: string,
        storyState: IStoryState
    ): Promise<void> {
        if (!this.currentStoryPlan || !storyState.selectedOrigin) {
            return;
        }
        
        const messages: IMessage[] = [];
        
        messages.push({
            role: 'user',
            content: `Update the story plan based on:
Action taken: ${action}
Consequence: ${consequence}
Current Act: ${this.currentStoryPlan.currentAct}
Current Scene: ${this.currentStoryPlan.currentScene}

Adjust future missions and narrative beats to reflect this change.
Return updated story plan maintaining consistency with established narrative.`
        });
        
        try {
            const response = await this.aiService.requestMapGeneration(
                'story_update',
                messages[0]?.content || '',
                storyState
            );
            
            if (response && typeof response === 'object' && 'storyPlan' in response) {
                this.currentStoryPlan = response.storyPlan as IStoryPlan;
                
                // Update state
                this.dispatch(UpdateStateEvent.storyState, {
                    storyPlan: this.currentStoryPlan
                });
            }
        } catch (error) {
            console.error('[StoryPlanner] Failed to update story plan:', error);
        }
    }
    
    /**
     * Advance to the next mission in the story
     */
    public advanceToNextMission(): IMission | null {
        if (!this.currentStoryPlan) {
            return null;
        }
        
        const currentAct = this.currentStoryPlan.acts[this.currentStoryPlan.currentAct];
        if (!currentAct) {
            return null;
        }
        
        // Find next uncompleted mission
        for (const mission of currentAct.missions) {
            if (!mission.isCompleted) {
                this.currentMission = mission;
                mission.isCurrent = true;
                
                // Update state
                this.dispatch(UpdateStateEvent.storyState, {
                    currentMissionId: mission.id
                });
                
                return mission;
            }
        }
        
        // Move to next act if all missions completed
        if (this.currentStoryPlan.currentAct < this.currentStoryPlan.acts.length - 1) {
            this.currentStoryPlan.currentAct++;
            this.currentStoryPlan.currentScene = 0;
            
            const nextAct = this.currentStoryPlan.acts[this.currentStoryPlan.currentAct];
            if (nextAct && nextAct.missions.length > 0) {
                const firstMission = nextAct.missions[0];
                if (firstMission) {
                    this.currentMission = firstMission;
                    this.currentMission.isCurrent = true;
                    return this.currentMission;
                }
            }
        }
        
        return null;
    }
    
    /**
     * Mark an objective as completed
     */
    public completeObjective(objectiveId: string): void {
        if (!this.currentMission) {
            return;
        }
        
        const objective = this.currentMission?.objectives.find(o => o.id === objectiveId);
        if (objective && this.currentMission) {
            objective.completed = true;
            
            // Check if all primary objectives are completed
            const allPrimaryCompleted = this.currentMission.objectives
                .filter(o => o.type === 'primary')
                .every(o => o.completed);
            
            if (allPrimaryCompleted && this.currentMission) {
                this.currentMission.isCompleted = true;
                this.advanceToNextMission();
            }
            
            // Update state
            this.dispatch(UpdateStateEvent.storyState, {
                completedObjectives: [objectiveId]
            });
        }
    }
    
    // Private helper methods
    
    private buildStoryPlanPrompt(request: StoryPlanRequest): string {
        const origin = request.origin;
        
        return `# STORY PLAN GENERATION REQUEST

Generate a comprehensive story plan for "Never Ending" based on the following origin:

## Selected Origin: ${origin.nameES}
- Description: ${origin.descriptionES}
- Starting Location: ${origin.startingLocation}
- Special Traits: ${origin.specialTraits.join(', ')}
- Faction Relations: ${Object.entries(origin.factionRelations).map(([f, v]) => `${f}: ${v}`).join(', ')}

## Requirements:
Create a multi-act story with the following structure:

1. **Overall Narrative** (200 words)
   - Main story arc connecting all acts
   - Central conflict and resolution path
   - Thematic elements

2. **Three Acts** each containing:
   - Act title and description (Spanish and English)
   - 3-5 missions per act
   - Key characters and their roles
   - Important objects and their purposes
   - Climax description

3. **Each Mission** should include:
   - Mission name and type
   - Clear objectives (primary and secondary)
   - Required objects or items
   - NPCs with defined roles
   - Map context (environment, atmosphere)
   - Narrative hooks for player engagement

4. **Character Details**:
   - Define 5-7 key characters across all acts
   - Include motivations and relationships
   - Specify when they appear in the story

5. **Object Significance**:
   - List critical story objects
   - Explain their purpose and importance
   - Define where they can be found

## Response Format:
Return a JSON object with type "storyPlan" containing the full story structure.

{
  "type": "storyPlan",
  "storyPlan": {
    "overallNarrative": "...",
    "theme": "...",
    "acts": [...],
    "currentAct": 0,
    "currentScene": 0,
    "totalEstimatedMissions": 12
  }
}

Remember: All player-facing text should be primarily in Spanish.`;
    }
    
    private createDefaultStoryPlan(origin: IOriginStory): IStoryPlan {
        return {
            overallNarrative: `A story of ${origin.name} struggling to survive in the post-collapse galaxy.`,
            theme: 'Survival and redemption',
            acts: [
                {
                    id: 'act1',
                    actNumber: 1,
                    title: 'The Beginning',
                    titleES: 'El Comienzo',
                    description: 'The journey begins with uncertainty and danger.',
                    descriptionES: 'El viaje comienza con incertidumbre y peligro.',
                    missions: [],
                    keyCharacters: [],
                    keyObjects: [],
                    climaxDescription: 'A shocking revelation changes everything.'
                }
            ],
            currentAct: 0,
            currentScene: 0,
            totalEstimatedMissions: 10
        };
    }
    
    private getCurrentObjectives(mission: IMission | null): IObjective[] {
        if (!mission) {
            return [];
        }
        
        return mission.objectives.filter(o => !o.completed);
    }
    
    private getVisibleStoryObjects(): IStoryObject[] {
        if (!this.currentStoryPlan || !this.currentMission) {
            return [];
        }
        
        const currentAct = this.currentStoryPlan.acts[this.currentStoryPlan.currentAct];
        if (!currentAct) {
            return [];
        }
        
        // Return objects relevant to current mission
        return currentAct.keyObjects.filter(obj => 
            this.currentMission?.requiredObjects.includes(obj.id)
        );
    }
    
    private enrichNPCsWithPurpose(
        characters: ICharacter[],
        mission: IMission | null
    ): INPCWithPurpose[] {
        if (!mission) {
            return characters as INPCWithPurpose[];
        }
        
        return characters.map(char => {
            const npcRole = mission.npcs.find(npc => npc.name === char.name);
            
            return {
                ...char,
                narrativePurpose: npcRole?.purpose || 'background character',
                currentObjective: npcRole?.purpose || 'patrol',
                dialogueTopics: npcRole?.dialogue || []
            } as INPCWithPurpose;
        });
    }
    
    private getNarrativeHooks(mission: IMission | null): string[] {
        if (!mission) {
            return [];
        }
        
        return mission.narrativeHooks;
    }
    
    private getSuggestedActions(
        mission: IMission | null,
        visibleCharacters: ICharacter[]
    ): string[] {
        const suggestions: string[] = [];
        
        if (!mission) {
            suggestions.push('Explore the area');
            return suggestions;
        }
        
        // Suggest actions based on objectives
        for (const objective of mission.objectives) {
            if (!objective.completed) {
                for (const condition of objective.conditions) {
                    switch (condition.type) {
                        case 'talk':
                            if (visibleCharacters.some(c => c.name === condition.target)) {
                                suggestions.push(`Talk to ${condition.target}`);
                            }
                            break;
                        case 'reach':
                            suggestions.push(`Move to ${condition.location || 'objective'}`);
                            break;
                        case 'collect':
                            suggestions.push(`Find and collect ${condition.target}`);
                            break;
                        case 'kill':
                            if (visibleCharacters.some(c => c.name === condition.target)) {
                                suggestions.push(`Eliminate ${condition.target}`);
                            }
                            break;
                    }
                }
            }
        }
        
        return suggestions;
    }
    
    /**
     * Get the current story plan
     */
    public getStoryPlan(): IStoryPlan | null {
        return this.currentStoryPlan;
    }
    
    /**
     * Set the story plan (for loading saved games)
     */
    public setStoryPlan(plan: IStoryPlan): void {
        this.currentStoryPlan = plan;
        
        // Find current mission
        const currentAct = plan.acts[plan.currentAct];
        if (currentAct) {
            this.currentMission = currentAct.missions.find(m => m.isCurrent) || null;
        }
    }
}