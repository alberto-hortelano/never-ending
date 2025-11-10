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
import { StoryPlanValidator } from './StoryPlanValidator';
import { LANGUAGE_NAMES, type LanguageCode } from '../constants';

export interface StoryPlanRequest {
    origin: IOriginStory;
    currentState?: IStoryState;
    playerDecisions?: string[];
    language?: LanguageCode;
}

export class StoryPlanner extends EventBus<UpdateStateEventsMap, UpdateStateEventsMap> {
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
            // Request story plan from AI with validation
            const response = await this.aiService.requestValidatedStoryPlan(
                'story_planning',
                prompt,
                request.currentState
            );
            
            if (response && typeof response === 'object' && 'storyPlan' in response) {
                // The story plan has already been validated by requestValidatedStoryPlan
                // But we'll do an additional check to be safe
                const validator = new StoryPlanValidator();
                const storyPlan = response.storyPlan as IStoryPlan;
                
                // Auto-fix any remaining issues
                const fixedPlan = validator.attemptAutoFix(storyPlan as unknown as Record<string, unknown>) as unknown as IStoryPlan;
                
                // Validate the fixed plan
                const validationResult = validator.validate(fixedPlan);
                
                if (validationResult.isValid) {
                    this.currentStoryPlan = fixedPlan;
                } else {
                    console.warn('[StoryPlanner] Story plan still has issues after auto-fix:', validationResult.errors);
                    // Use it anyway but log the issues
                    this.currentStoryPlan = fixedPlan;
                }
                
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
     * Generate the next mission in the story on-demand
     */
    public async generateNextMission(
        missionOutline: IMission,
        actId: string,
        storyState: IStoryState,
        language: LanguageCode = 'en'
    ): Promise<IMission | null> {
        if (!this.currentStoryPlan) {
            console.error('[StoryPlanner] Cannot generate mission - no story plan exists');
            return null;
        }

        const messages: IMessage[] = [];

        // Build prompt for mission generation
        const prompt = this.buildMissionGenerationPrompt(
            missionOutline,
            actId,
            storyState,
            language
        );

        messages.push({
            role: 'user',
            content: prompt
        });

        try {
            const response = await this.aiService.requestMapGeneration(
                'mission_generation',
                prompt,
                storyState
            );

            if (response && typeof response === 'object' && 'mission' in response) {
                const fullMission = response.mission as IMission;

                // Ensure the mission has the correct IDs
                fullMission.id = missionOutline.id;
                fullMission.actId = actId;

                // Update the mission in the story plan
                const act = this.currentStoryPlan.acts.find(a => a.id === actId);
                if (act) {
                    const missionIndex = act.missions.findIndex(m => m.id === missionOutline.id);
                    if (missionIndex >= 0) {
                        act.missions[missionIndex] = fullMission;
                    }

                    // Update state
                    this.dispatch(UpdateStateEvent.storyState, {
                        storyPlan: this.currentStoryPlan
                    });
                }

                return fullMission;
            }

            console.error('[StoryPlanner] Failed to generate mission - invalid response');
            return null;
        } catch (error) {
            console.error('[StoryPlanner] Failed to generate next mission:', error);
            return null;
        }
    }

    /**
     * Build prompt for generating a full mission from an outline
     */
    private buildMissionGenerationPrompt(
        missionOutline: IMission,
        actId: string,
        storyState: IStoryState,
        language: LanguageCode
    ): string {
        const currentAct = this.currentStoryPlan?.acts.find(a => a.id === actId);

        return `# MISSION GENERATION REQUEST

Language: Generate all text content in ${LANGUAGE_NAMES[language]}.

Generate FULL details for the following mission outline:

## Mission Outline:
- Name: ${missionOutline.name}
- Type: ${missionOutline.type}
- Brief Description: ${missionOutline.description}

## Story Context:
- Overall Narrative: ${this.currentStoryPlan?.overallNarrative || 'Unknown'}
- Theme: ${this.currentStoryPlan?.theme || 'Unknown'}
- Current Act: ${currentAct?.title || 'Unknown'} - ${currentAct?.description || ''}
- Completed Missions: ${storyState.completedMissions.join(', ') || 'None'}

## Requirements:
Generate FULL mission details including:

1. **Mission Details**:
   - name: Keep the same name
   - type: Keep the same type (${missionOutline.type})
   - description: Expand into a full detailed description (2-3 sentences)

2. **Objectives** (2-4 objectives):
   - Each with type: EXACTLY one of [primary, secondary, hidden]
   - Clear description
   - conditions: Array with type being EXACTLY one of [kill, reach, collect, talk, survive, escort, destroy]

3. **Map Context**:
   - environment: EXACTLY one of [spaceship, station, planet, settlement, ruins, wilderness]
   - atmosphere: Detailed atmosphere description
   - lightingCondition: EXACTLY one of [bright, normal, dim, dark]

4. **NPCs** (2-4 NPCs):
   - Each with: name, purpose, dialogue array (2-3 dialogue options)

5. **Narrative Elements**:
   - requiredObjects: Array of object IDs if needed
   - narrativeHooks: Array of 2-3 narrative hooks for engagement
   - estimatedDuration: Number (minutes)

## Response Format:
Return a JSON object with type "mission":

{
  "type": "mission",
  "mission": {
    "id": "${missionOutline.id}",
    "actId": "${actId}",
    "name": "${missionOutline.name}",
    "description": "Full detailed description...",
    "type": "${missionOutline.type}",
    "objectives": [
      {
        "id": "obj1",
        "type": "primary",
        "description": "...",
        "completed": false,
        "conditions": [
          {"type": "reach", "location": "..."}
        ]
      }
    ],
    "mapContext": {
      "environment": "spaceship",
      "atmosphere": "...",
      "lightingCondition": "dim"
    },
    "requiredObjects": [],
    "npcs": [
      {"name": "...", "purpose": "...", "dialogue": ["...", "..."]}
    ],
    "narrativeHooks": ["...", "..."],
    "estimatedDuration": 15,
    "isCompleted": false,
    "isCurrent": false
  }
}`;
    }

    /**
     * Get context for the current screen/mission
     */
    public async getScreenContext(
        currentMission: IMission | null,
        visibleCharacters: ICharacter[],
        storyState: IStoryState,
        language: LanguageCode = 'en'
    ): Promise<IScreenContext> {
        // Use existing story plan from state if available
        if (!this.currentStoryPlan && storyState.storyPlan) {
            this.currentStoryPlan = storyState.storyPlan;
        }
        
        // Only generate new story plan if none exists anywhere
        if (!this.currentStoryPlan && !storyState.storyPlan) {
            // Check if mock mode is enabled
            const isMockEnabled = localStorage.getItem('ai_mock_enabled') === 'true';
            
            if (isMockEnabled) {
                // Use a default story plan in mock mode
                if (storyState.selectedOrigin) {
                    this.currentStoryPlan = this.createDefaultStoryPlan(storyState.selectedOrigin);
                }
            } else {
                // Generate story plan if not exists
                if (storyState.selectedOrigin) {
                    await this.generateStoryPlan({
                        origin: storyState.selectedOrigin,
                        currentState: storyState,
                        language: language
                    });
                }
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
     * Generates full mission details on-demand if the mission is just an outline
     */
    public async advanceToNextMission(storyState?: IStoryState, language?: LanguageCode): Promise<IMission | null> {
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
                // Check if mission has full details or just outline
                // A mission outline has empty objectives array
                const needsGeneration = !mission.objectives || mission.objectives.length === 0;

                if (needsGeneration && storyState) {
                    console.log(`[StoryPlanner] Generating full details for mission: ${mission.name}`);
                    const fullMission = await this.generateNextMission(
                        mission,
                        currentAct.id,
                        storyState,
                        language || 'en'
                    );

                    if (fullMission) {
                        this.currentMission = fullMission;
                        fullMission.isCurrent = true;

                        // Update state
                        this.dispatch(UpdateStateEvent.storyState, {
                            currentMissionId: fullMission.id
                        });

                        return fullMission;
                    } else {
                        console.error('[StoryPlanner] Failed to generate mission details');
                        // Fall back to using the outline
                        this.currentMission = mission;
                        mission.isCurrent = true;
                        return mission;
                    }
                } else {
                    // Mission already has full details
                    this.currentMission = mission;
                    mission.isCurrent = true;

                    // Update state
                    this.dispatch(UpdateStateEvent.storyState, {
                        currentMissionId: mission.id
                    });

                    return mission;
                }
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
                    // Check if this mission needs generation too
                    const needsGeneration = !firstMission.objectives || firstMission.objectives.length === 0;

                    if (needsGeneration && storyState) {
                        const fullMission = await this.generateNextMission(
                            firstMission,
                            nextAct.id,
                            storyState,
                            language || 'en'
                        );

                        if (fullMission) {
                            this.currentMission = fullMission;
                            fullMission.isCurrent = true;
                            return fullMission;
                        }
                    }

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
    public async completeObjective(objectiveId: string, storyState?: IStoryState, language?: LanguageCode): Promise<void> {
        if (!this.currentMission) {
            return;
        }

        // Ensure objectives is an array before trying to find
        if (!Array.isArray(this.currentMission.objectives)) {
            console.warn('[StoryPlanner] Current mission has no objectives array');
            return;
        }

        const objective = this.currentMission.objectives.find(o => o.id === objectiveId);
        if (objective && this.currentMission) {
            objective.completed = true;

            // Check if all primary objectives are completed
            const allPrimaryCompleted = this.currentMission.objectives
                .filter(o => o.type === 'primary')
                .every(o => o.completed);

            if (allPrimaryCompleted && this.currentMission) {
                this.currentMission.isCompleted = true;
                await this.advanceToNextMission(storyState, language);
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
        const language = request.language || 'en';

        // Use the appropriate language version of origin
        const originName = language === 'es' ? (origin.nameES || origin.name) : origin.name;
        const originDesc = language === 'es' ? (origin.descriptionES || origin.description) : origin.description;

        return `# INCREMENTAL STORY PLAN GENERATION REQUEST

Language: Generate all text content in ${LANGUAGE_NAMES[language]}.

Generate an INCREMENTAL story plan for "Never Ending" based on the following origin.
This should provide background context and the current mission only. Future missions will be generated as the story evolves.

## Selected Origin: ${originName}
- Description: ${originDesc}
- Starting Location: ${origin.startingLocation}
- Special Traits: ${origin.specialTraits.join(', ')}
- Faction Relations: ${Object.entries(origin.factionRelations).map(([f, v]) => `${f}: ${v}`).join(', ')}

## Requirements:
Create an incremental story plan with:

1. **Overall Narrative** (200 words)
   - Background story and setting
   - Central conflict and themes
   - Overall story direction (NOT detailed missions)

2. **Current Act Only** (Act 1):
   - Act title and description
   - FIRST mission with FULL details (the current mission)
   - 2-3 BRIEF mission outlines (name, type, one sentence description only)
   - Key characters for THIS act (3-5 characters)
   - Important objects for THIS act
   - Climax description for this act

3. **First Mission (FULL DETAILS)**:
   - name: Mission name (string)
   - type: EXACTLY one of [combat, exploration, infiltration, diplomacy, survival]
   - description: Full mission description
   - objectives: Array of objectives, each with:
     * type: EXACTLY one of [primary, secondary, hidden]
     * description: Clear objective description
     * conditions: Array with type being EXACTLY one of [kill, reach, collect, talk, survive, escort, destroy]
   - mapContext object with:
     * environment: EXACTLY one of [spaceship, station, planet, settlement, ruins, wilderness]
     * atmosphere: Description of the atmosphere (string)
     * lightingCondition: EXACTLY one of [bright, normal, dim, dark]
   - NPCs with defined roles (2-4 NPCs)
   - Required objects or items
   - Narrative hooks for player engagement

4. **Next 2-3 Missions (BRIEF OUTLINES ONLY)**:
   - Just: id, name, type, brief description (one sentence)
   - NO full details - these will be generated later

## CRITICAL ENUM VALUES (use EXACTLY these values):
- Mission type: combat, exploration, infiltration, diplomacy, survival
- Objective type: primary, secondary, hidden
- Condition type: kill, reach, collect, talk, survive, escort, destroy
- Environment: spaceship, station, planet, settlement, ruins, wilderness
- Lighting: bright, normal, dim, dark

## Response Format:
Return a JSON object with type "storyPlan" containing ONLY the current context:

{
  "type": "storyPlan",
  "storyPlan": {
    "overallNarrative": "...",
    "theme": "...",
    "acts": [
      {
        "id": "act1",
        "actNumber": 1,
        "title": "...",
        "description": "...",
        "missions": [
          {
            "id": "mission1",
            "actId": "act1",
            "name": "...",
            "description": "...",
            "type": "combat",
            "objectives": [
              {
                "id": "obj1",
                "type": "primary",
                "description": "...",
                "completed": false,
                "conditions": [
                  {"type": "kill", "target": "..."}
                ]
              }
            ],
            "mapContext": {
              "environment": "spaceship",
              "atmosphere": "...",
              "lightingCondition": "dim"
            },
            "requiredObjects": [],
            "npcs": [
              {"name": "...", "purpose": "...", "dialogue": ["..."]}
            ],
            "narrativeHooks": ["..."],
            "estimatedDuration": 15,
            "isCompleted": false,
            "isCurrent": true
          },
          {
            "id": "mission2",
            "actId": "act1",
            "name": "...",
            "description": "Brief one sentence description",
            "type": "exploration",
            "objectives": [],
            "mapContext": {
              "environment": "settlement",
              "atmosphere": "Por determinar",
              "lightingCondition": "normal"
            },
            "requiredObjects": [],
            "npcs": [],
            "narrativeHooks": [],
            "estimatedDuration": 15,
            "isCompleted": false,
            "isCurrent": false
          }
        ],
        "keyCharacters": [],
        "keyObjects": [],
        "climaxDescription": "..."
      }
    ],
    "currentAct": 0,
    "currentScene": 0,
    "totalEstimatedMissions": 10
  }
}`;
    }
    
    private createDefaultStoryPlan(origin: IOriginStory): IStoryPlan {
        // Use appropriate language based on user preference
        const originName = origin.nameES || origin.name;
        return {
            overallNarrative: `Una historia de ${originName} luchando por sobrevivir en la galaxia post-colapso. En un universo fragmentado donde las antiguas estructuras de poder han colapsado, deben forjar su propio camino entre facciones rivales, peligros desconocidos y secretos del pasado.`,
            theme: 'Supervivencia y redención',
            acts: [
                {
                    id: 'act1',
                    actNumber: 1,
                    title: 'El Comienzo',
                    description: 'El viaje comienza con incertidumbre y peligro. Los primeros pasos en un mundo desconocido.',
                    missions: [
                        {
                            id: 'mission1',
                            actId: 'act1',
                            name: 'Primera Exploración',
                            description: 'Familiarízate con el entorno y evalúa la situación.',
                            type: 'exploration',
                            objectives: [
                                {
                                    id: 'obj1',
                                    type: 'primary',
                                    description: 'Explora el área inicial',
                                    completed: false,
                                    conditions: [
                                        { type: 'reach', location: 'area objetivo' }
                                    ]
                                }
                            ],
                            mapContext: {
                                environment: origin.startingLocation as 'spaceship' | 'station' | 'planet' | 'settlement' | 'ruins' | 'wilderness',
                                atmosphere: 'Ambiente desconocido y potencialmente peligroso',
                                lightingCondition: 'normal'
                            },
                            requiredObjects: [],
                            npcs: [],
                            narrativeHooks: ['¿Qué secretos esconde este lugar?', '¿Quién más podría estar aquí?'],
                            estimatedDuration: 15,
                            isCompleted: false,
                            isCurrent: true
                        },
                        {
                            id: 'mission2',
                            actId: 'act1',
                            name: 'Encuentro Inesperado',
                            description: 'Un encuentro cambia el curso de los acontecimientos.',
                            type: 'diplomacy',
                            objectives: [],
                            mapContext: {
                                environment: 'settlement',
                                atmosphere: 'Por determinar',
                                lightingCondition: 'normal'
                            },
                            requiredObjects: [],
                            npcs: [],
                            narrativeHooks: [],
                            estimatedDuration: 15,
                            isCompleted: false,
                            isCurrent: false
                        },
                        {
                            id: 'mission3',
                            actId: 'act1',
                            name: 'Primera Amenaza',
                            description: 'El peligro se hace presente y hay que actuar.',
                            type: 'combat',
                            objectives: [],
                            mapContext: {
                                environment: 'ruins',
                                atmosphere: 'Por determinar',
                                lightingCondition: 'normal'
                            },
                            requiredObjects: [],
                            npcs: [],
                            narrativeHooks: [],
                            estimatedDuration: 15,
                            isCompleted: false,
                            isCurrent: false
                        }
                    ],
                    keyCharacters: [],
                    keyObjects: [],
                    climaxDescription: 'Una revelación impactante lo cambia todo.'
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
        
        return Array.isArray(mission.objectives) 
            ? mission.objectives.filter(o => !o.completed)
            : [];
    }
    
    private getVisibleStoryObjects(): IStoryObject[] {
        if (!this.currentStoryPlan || !this.currentMission) {
            return [];
        }
        
        const currentAct = this.currentStoryPlan.acts[this.currentStoryPlan.currentAct];
        if (!currentAct || !Array.isArray(currentAct.keyObjects)) {
            return [];
        }
        
        // Ensure requiredObjects is an array before filtering
        if (!Array.isArray(this.currentMission?.requiredObjects)) {
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
            const npcRole = Array.isArray(mission.npcs) 
                ? mission.npcs.find(npc => npc.name === char.name)
                : undefined;
            
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
        
        return Array.isArray(mission.narrativeHooks) 
            ? mission.narrativeHooks
            : [];
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
        if (Array.isArray(mission.objectives)) {
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