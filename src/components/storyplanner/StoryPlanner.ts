import { Component } from '../Component';
import { StateChangeEvent } from '../../common/events/StateEvents';
import { StoryPlanner } from '../../common/services/StoryPlanner';
import type { IStoryPlan, IMission, IKeyCharacter, IStoryObject, IStoryAct } from '../../common/interfaces';
import { i18n } from '../../common/i18n/i18n';

export class StoryPlannerComponent extends Component {
    private storyPlanner: StoryPlanner;
    private currentPlan: IStoryPlan | null = null;
    private currentMission: IMission | null = null;
    private isCollapsed: boolean = false;
    private showDebug: boolean = false;
    
    constructor() {
        super();
        this.hasHtml = true;
        this.hasCss = true;
        this.storyPlanner = StoryPlanner.getInstance();
    }
    
    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;
        
        this.setupEventListeners(root);
        this.setupStateListeners();
        
        // Load initial story plan if available
        const currentPlan = this.storyPlanner.getStoryPlan();
        if (currentPlan) {
            this.updateDisplay(currentPlan);
        }
        
        return root;
    }
    
    private setupEventListeners(root: ShadowRoot) {
        // Toggle collapse
        const toggleBtn = root.querySelector('[data-action="toggle-details"]');
        toggleBtn?.addEventListener('click', () => {
            this.toggleCollapse(root);
        });
        
        // Refresh story plan
        const refreshBtn = root.querySelector('[data-action="refresh-plan"]');
        refreshBtn?.addEventListener('click', () => {
            this.refreshStoryPlan();
        });
        
        // Toggle debug
        const debugBtn = root.querySelector('[data-action="toggle-debug"]');
        debugBtn?.addEventListener('click', () => {
            this.toggleDebug(root);
        });
    }
    
    private setupStateListeners() {
        // Listen for story state changes
        this.listen(StateChangeEvent.storyState, (storyState) => {
            if (storyState.storyPlan) {
                // Deep clone to convert DeepReadonly to regular type
                const plan = JSON.parse(JSON.stringify(storyState.storyPlan)) as IStoryPlan;
                this.updateDisplay(plan);
            }
            
            // Update current mission if changed
            if (storyState.currentMissionId && this.currentPlan) {
                const mission = this.findMissionById(storyState.currentMissionId);
                if (mission) {
                    this.currentMission = mission;
                    this.updateMissionDisplay(mission);
                }
            }
            
            // Update objectives completion
            if (storyState.completedObjectives) {
                const objectives = [...storyState.completedObjectives];
                this.updateObjectivesCompletion(objectives);
            }
        });
    }
    
    private updateDisplay(plan: IStoryPlan) {
        this.currentPlan = plan;
        const root = this.shadowRoot;
        if (!root) return;
        
        // Update narrative
        const narrativeEl = root.querySelector('[data-field="narrative"]');
        if (narrativeEl) {
            narrativeEl.textContent = plan.overallNarrative;
        }
        
        // Update theme
        const themeEl = root.querySelector('[data-field="theme"]');
        if (themeEl) {
            themeEl.textContent = plan.theme;
        }
        
        // Update current act
        const currentAct = plan.acts[plan.currentAct];
        if (currentAct) {
            this.updateActDisplay(currentAct, plan.currentAct);
            
            // Update current mission
            const currentMission = currentAct.missions.find(m => m.isCurrent);
            if (currentMission) {
                this.currentMission = currentMission;
                this.updateMissionDisplay(currentMission);
            }
            
            // Update key characters
            this.updateCharactersDisplay(currentAct.keyCharacters);
            
            // Update important objects
            this.updateObjectsDisplay(currentAct.keyObjects);
        }
        
        // Update debug info if enabled
        if (this.showDebug) {
            this.updateDebugDisplay(plan);
        }
    }
    
    private updateActDisplay(act: IStoryAct, _actNumber: number) {
        const root = this.shadowRoot;
        if (!root) return;
        
        const actTitleEl = root.querySelector('[data-field="act-title"]');
        if (actTitleEl) {
            actTitleEl.textContent = act.titleES || act.title;
        }
        
        const actProgressEl = root.querySelector('[data-field="act-progress"]');
        if (actProgressEl) {
            const completedMissions = act.missions.filter((m: IMission) => m.isCompleted).length;
            actProgressEl.textContent = `${i18n.t('ui.mission')} ${completedMissions + 1}/${act.missions.length}`;
        }
        
        const actDescEl = root.querySelector('[data-field="act-description"]');
        if (actDescEl) {
            actDescEl.textContent = act.descriptionES || act.description;
        }
    }
    
    private updateMissionDisplay(mission: IMission) {
        const root = this.shadowRoot;
        if (!root) return;
        
        // Update mission name
        const nameEl = root.querySelector('[data-field="mission-name"]');
        if (nameEl) {
            nameEl.textContent = mission.nameES || mission.name;
        }
        
        // Update mission type
        const typeEl = root.querySelector('[data-field="mission-type"]');
        if (typeEl) {
            typeEl.textContent = mission.type;
            typeEl.setAttribute('data-type', mission.type);
        }
        
        // Update mission description
        const descEl = root.querySelector('[data-field="mission-description"]');
        if (descEl) {
            descEl.textContent = mission.descriptionES || mission.description;
        }
        
        // Update objectives
        const objList = root.querySelector('[data-list="objectives"]');
        if (objList) {
            objList.innerHTML = '';
            mission.objectives.forEach(obj => {
                const li = document.createElement('li');
                li.className = obj.type;
                if (obj.completed) {
                    li.classList.add('completed');
                }
                li.textContent = obj.descriptionES || obj.description;
                objList.appendChild(li);
            });
        }
        
        // Update narrative hooks
        const hooksEl = root.querySelector('[data-field="hooks"]');
        if (hooksEl && mission.narrativeHooks.length > 0) {
            hooksEl.innerHTML = `<p>${mission.narrativeHooks.join(' • ')}</p>`;
        }
    }
    
    private updateCharactersDisplay(characters: IKeyCharacter[]) {
        const root = this.shadowRoot;
        if (!root) return;
        
        const grid = root.querySelector('[data-grid="characters"]');
        if (!grid) return;
        
        grid.innerHTML = '';
        characters.forEach(char => {
            const card = document.createElement('div');
            card.className = 'character-card';
            
            const name = document.createElement('div');
            name.className = 'character-name';
            name.textContent = char.name;
            
            const role = document.createElement('div');
            role.className = `character-role ${char.role}`;
            role.textContent = char.role;
            
            card.appendChild(name);
            card.appendChild(role);
            grid.appendChild(card);
        });
    }
    
    private updateObjectsDisplay(objects: IStoryObject[]) {
        const root = this.shadowRoot;
        if (!root) return;
        
        const list = root.querySelector('[data-list="objects"]');
        if (!list) return;
        
        list.innerHTML = '';
        objects.forEach(obj => {
            const item = document.createElement('div');
            item.className = 'object-item';
            
            const name = document.createElement('span');
            name.className = 'object-name';
            name.textContent = obj.nameES || obj.name;
            
            const significance = document.createElement('span');
            significance.className = `object-significance ${obj.significance}`;
            significance.textContent = obj.significance;
            
            item.appendChild(name);
            item.appendChild(significance);
            list.appendChild(item);
        });
    }
    
    private updateObjectivesCompletion(completedIds: string[]) {
        const root = this.shadowRoot;
        if (!root || !this.currentMission) return;
        
        const objList = root.querySelector('[data-list="objectives"]');
        if (!objList) return;
        
        const items = objList.querySelectorAll('li');
        this.currentMission.objectives.forEach((obj, index) => {
            if (completedIds.includes(obj.id) && items[index]) {
                items[index].classList.add('completed');
                obj.completed = true;
            }
        });
    }
    
    private toggleCollapse(root: ShadowRoot) {
        this.isCollapsed = !this.isCollapsed;
        
        const planner = root.querySelector('.story-planner');
        const toggleBtn = root.querySelector('.toggle-btn');
        
        if (planner) {
            planner.classList.toggle('collapsed', this.isCollapsed);
        }
        
        if (toggleBtn) {
            toggleBtn.classList.toggle('collapsed', this.isCollapsed);
        }
    }
    
    private toggleDebug(root: ShadowRoot) {
        this.showDebug = !this.showDebug;
        
        const debugSection = root.querySelector('[data-debug="true"]') as HTMLElement;
        if (debugSection) {
            debugSection.style.display = this.showDebug ? 'block' : 'none';
            
            if (this.showDebug && this.currentPlan) {
                this.updateDebugDisplay(this.currentPlan);
            }
        }
    }
    
    private updateDebugDisplay(plan: IStoryPlan) {
        const root = this.shadowRoot;
        if (!root) return;
        
        const debugEl = root.querySelector('[data-field="debug"]');
        if (debugEl) {
            const debugInfo = {
                currentAct: plan.currentAct,
                currentScene: plan.currentScene,
                totalMissions: plan.totalEstimatedMissions,
                actsCount: plan.acts.length,
                currentMissionId: this.currentMission?.id
            };
            debugEl.textContent = JSON.stringify(debugInfo, null, 2);
        }
    }
    
    private async refreshStoryPlan() {
        // This would typically call the server to get an updated story plan
        console.log('[StoryPlanner] Refreshing story plan...');
        
        // For now, just re-display current plan
        if (this.currentPlan) {
            this.updateDisplay(this.currentPlan);
        }
    }
    
    private findMissionById(missionId: string): IMission | null {
        if (!this.currentPlan) return null;
        
        for (const act of this.currentPlan.acts) {
            const mission = act.missions.find(m => m.id === missionId);
            if (mission) {
                return mission;
            }
        }
        
        return null;
    }
    
    public show() {
        const root = this.shadowRoot;
        if (root) {
            const planner = root.querySelector('.story-planner') as HTMLElement;
            if (planner) {
                planner.style.display = 'flex';
            }
        }
    }
    
    public hide() {
        const root = this.shadowRoot;
        if (root) {
            const planner = root.querySelector('.story-planner') as HTMLElement;
            if (planner) {
                planner.style.display = 'none';
            }
        }
    }
}

// Register the component
customElements.define('story-planner', StoryPlannerComponent);