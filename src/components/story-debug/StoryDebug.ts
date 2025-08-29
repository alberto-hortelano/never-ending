import { Component } from '../Component';
import { WorldState } from '../../common/services/WorldState';

export class StoryDebug extends Component {
    override hasCss = true;
    override hasHtml = true;
    
    private worldState: WorldState;
    private updateInterval?: number;
    private isExpanded = false;
    
    constructor() {
        super();
        this.worldState = WorldState.getInstance();
    }
    
    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return;
        
        this.setupEventListeners(root);
        this.startAutoUpdate();
        this.updateContent(root);
        
        // Enable debug mode when panel is created
        this.worldState.enableDebug();
        
        return root;
    }
    
    disconnectedCallback() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
    }
    
    private setupEventListeners(root: ShadowRoot): void {
        // Toggle button
        const toggleBtn = root.querySelector('.toggle-btn');
        toggleBtn?.addEventListener('click', () => {
            this.isExpanded = !this.isExpanded;
            const panel = root.querySelector('.debug-panel');
            panel?.classList.toggle('expanded', this.isExpanded);
            toggleBtn.textContent = this.isExpanded ? '📊 Hide Debug' : '📊 Story Debug';
        });
        
        // Tab buttons
        const tabBtns = root.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                const tab = target.dataset.tab;
                if (!tab) return;
                
                // Update active tab
                tabBtns.forEach(b => b.classList.remove('active'));
                target.classList.add('active');
                
                // Show corresponding content
                const contents = root.querySelectorAll('.tab-content');
                contents.forEach(content => {
                    const element = content as HTMLElement;
                    element.style.display = element.id === `${tab}-content` ? 'block' : 'none';
                });
            });
        });
        
        // Action buttons
        const forceMinorBtn = root.querySelector('#force-minor-update');
        forceMinorBtn?.addEventListener('click', () => {
            this.worldState.forceUpdate('minor');
            this.updateContent(root);
        });
        
        const forceMajorBtn = root.querySelector('#force-major-update');
        forceMajorBtn?.addEventListener('click', () => {
            this.worldState.forceUpdate('major');
            this.updateContent(root);
        });
        
        const testCombatBtn = root.querySelector('#test-combat');
        testCombatBtn?.addEventListener('click', () => {
            this.worldState.testCombat(['player', 'TestEnemy']);
            this.updateContent(root);
        });
        
        const testConversationBtn = root.querySelector('#test-conversation');
        testConversationBtn?.addEventListener('click', () => {
            this.worldState.testConversation('player', 'TestNPC', 'positive');
            this.updateContent(root);
        });
        
        const testEventBtn = root.querySelector('#test-event');
        testEventBtn?.addEventListener('click', () => {
            this.worldState.testMajorEvent();
            this.updateContent(root);
        });
    }
    
    private startAutoUpdate(): void {
        // Update every 2 seconds
        this.updateInterval = window.setInterval(() => {
            if (this.isExpanded && this.shadowRoot) {
                this.updateContent(this.shadowRoot);
            }
        }, 2000);
    }
    
    private updateContent(root: ShadowRoot): void {
        const debugInfo = this.worldState.getDebugInfo();
        const worldContext = this.worldState.getWorldContext();
        const suggestions = this.worldState.getNarrativeSuggestions();
        
        // Update overview
        const overviewContent = root.querySelector('#overview-content');
        if (overviewContent) {
            overviewContent.innerHTML = `
                <div class="stat-grid">
                    <div class="stat">
                        <span class="label">Turn:</span>
                        <span class="value">${debugInfo.currentTurn}</span>
                    </div>
                    <div class="stat">
                        <span class="label">Threads:</span>
                        <span class="value">${debugInfo.threads.active}/${debugInfo.threads.total}</span>
                    </div>
                    <div class="stat">
                        <span class="label">Characters:</span>
                        <span class="value">${debugInfo.characters.total}</span>
                    </div>
                    <div class="stat">
                        <span class="label">Events:</span>
                        <span class="value">${debugInfo.worldEvents.active}/${debugInfo.worldEvents.total}</span>
                    </div>
                    <div class="stat">
                        <span class="label">Conflicts:</span>
                        <span class="value">${debugInfo.conflicts.active}/${debugInfo.conflicts.total}</span>
                    </div>
                    <div class="stat">
                        <span class="label">Narrative:</span>
                        <span class="value">${debugInfo.narrativePressure.suggestedFocus}</span>
                    </div>
                </div>
                <div class="suggestions">
                    <h4>Narrative Suggestions:</h4>
                    <ul>
                        ${suggestions.map(s => `<li>${s}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
        
        // Update threads
        const threadsContent = root.querySelector('#threads-content');
        if (threadsContent) {
            threadsContent.innerHTML = `
                <div class="thread-list">
                    ${debugInfo.threads.details.map((thread: any) => `
                        <div class="thread-item ${thread.status}">
                            <div class="thread-header">
                                <span class="thread-title">${thread.title}</span>
                                <span class="thread-status">${thread.status}</span>
                            </div>
                            <div class="thread-info">
                                <span>Type: ${thread.type}</span>
                                <span>Tension: ${thread.tension}%</span>
                            </div>
                            <div class="thread-narrative">${thread.narrative}</div>
                            <div class="thread-participants">Participants: ${thread.participants.join(', ')}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        // Update characters
        const charactersContent = root.querySelector('#characters-content');
        if (charactersContent) {
            charactersContent.innerHTML = `
                <div class="character-list">
                    ${debugInfo.characters.profiles.map((char: any) => `
                        <div class="character-item">
                            <div class="character-name">${char.name}</div>
                            <div class="character-info">
                                <span>Faction: ${char.faction || 'None'}</span>
                                <span>Goals: ${char.goals}</span>
                                <span>Relations: ${char.relationships}</span>
                            </div>
                            <div class="character-activity">${char.currentActivity || 'Idle'}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        // Update events
        const eventsContent = root.querySelector('#events-content');
        if (eventsContent) {
            const recentEvents = debugInfo.worldEvents.recent || [];
            eventsContent.innerHTML = `
                <div class="event-list">
                    <h4>Recent Events:</h4>
                    ${recentEvents.map((event: any) => `
                        <div class="event-item ${event.intensity}">
                            <div class="event-title">${event.title}</div>
                            <div class="event-info">
                                <span>Type: ${event.type}</span>
                                <span>Intensity: ${event.intensity}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="context-summary">
                    <h4>World Context:</h4>
                    <div class="context-pressure">
                        <strong>Narrative Pressure:</strong> ${worldContext.narrativePressure}
                    </div>
                    <div class="context-conflicts">
                        <strong>Emerging Conflicts:</strong> ${worldContext.emergingConflicts.length}
                    </div>
                    <div class="context-offscreen">
                        <strong>Offscreen Events:</strong> ${worldContext.offscreenEvents.length}
                    </div>
                </div>
            `;
        }
    }
}

customElements.define('story-debug', StoryDebug);