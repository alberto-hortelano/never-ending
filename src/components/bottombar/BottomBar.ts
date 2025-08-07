import { Component } from "../Component";
import { ControlsEvent, UpdateStateEvent } from "../../common/events";
import type { Actions } from "../actions/Actions";

export default class BottomBar extends Component {
    protected override hasCss = true;
    protected override hasHtml = true;
    
    private activeTab = 'general';
    private touchStartX = 0;
    private touchEndX = 0;
    
    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;
        
        this.setupEventListeners(root);
        this.setupTabNavigation(root);
        this.setupSwipeGestures(root);
        
        return root;
    }
    
    private setupEventListeners(root: ShadowRoot) {
        // Listen for show actions event
        this.listen(ControlsEvent.showActions, (characterName: string) => {
            this.showCharacterActions(characterName, root);
        });
    }
    
    private showCharacterActions(characterName: string, root: ShadowRoot) {
        const actionsContainer = root.querySelector('.actions-container');
        if (!actionsContainer) return;
        
        // Clear any existing highlights before showing new character actions
        this.clearMovementHighlights();
        
        // Update selected character in state
        this.dispatch(UpdateStateEvent.uiSelectedCharacter, characterName);
        
        // Clear existing content
        actionsContainer.innerHTML = '';
        
        // Create and append actions component with active tab filter
        const actionsComponent = document.createElement('actions-component') as Actions;
        actionsComponent.setAttribute('active-category', this.activeTab);
        actionsContainer.appendChild(actionsComponent);
        
        // Update state
        actionsContainer.classList.add('has-actions');
        
        // Automatically show movement reachable cells when character is selected
        this.dispatch(ControlsEvent.showMovement, characterName);
    }
    
    private clearMovementHighlights() {
        // Clear any existing movement highlights and reset interaction mode
        this.dispatch(UpdateStateEvent.uiHighlights, {
            reachableCells: [],
            pathCells: [],
            targetableCells: []
        });
        
        this.dispatch(UpdateStateEvent.uiInteractionMode, {
            type: 'normal'
        });
    }
    
    private setupTabNavigation(root: ShadowRoot) {
        const tabButtons = root.querySelectorAll('.tab-button');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLButtonElement;
                const tabName = target.dataset.tab;
                if (!tabName) return;
                
                // Update active tab
                this.activeTab = tabName;
                
                // Update UI
                tabButtons.forEach(btn => btn.classList.remove('active'));
                target.classList.add('active');
                
                // Update actions component if it exists
                const actionsContainer = root.querySelector('.actions-container');
                const existingActions = actionsContainer?.querySelector('actions-component') as Actions;
                if (existingActions) {
                    existingActions.setAttribute('active-category', tabName);
                }
                
                // Refresh actions display
                const state = this.getState();
                if (state?.ui?.selectedCharacter) {
                    this.showCharacterActions(state.ui.selectedCharacter, root);
                }
            });
        });
    }


    private setupSwipeGestures(root: ShadowRoot) {
        const barContent = root.querySelector('.bar-content') as HTMLElement;
        if (!barContent) return;
        
        // Touch event handlers for swipe detection
        barContent.addEventListener('touchstart', (e) => {
            const touch = e.changedTouches[0];
            if (touch) {
                this.touchStartX = touch.screenX;
            }
        }, { passive: true });
        
        barContent.addEventListener('touchend', (e) => {
            const touch = e.changedTouches[0];
            if (touch) {
                this.touchEndX = touch.screenX;
                this.handleSwipe(root);
            }
        }, { passive: true });
    }

    private handleSwipe(root: ShadowRoot) {
        const swipeThreshold = 50;
        const diff = this.touchStartX - this.touchEndX;
        
        if (Math.abs(diff) < swipeThreshold) return;
        
        const tabs = this.getAvailableTabs();
        const currentIndex = tabs.indexOf(this.activeTab);
        
        if (diff > 0 && currentIndex < tabs.length - 1) {
            // Swipe left - next tab
            const nextTab = tabs[currentIndex + 1];
            const button = root.querySelector(`[data-tab="${nextTab}"]`) as HTMLButtonElement;
            if (button) button.click();
        } else if (diff < 0 && currentIndex > 0) {
            // Swipe right - previous tab
            const prevTab = tabs[currentIndex - 1];
            const button = root.querySelector(`[data-tab="${prevTab}"]`) as HTMLButtonElement;
            if (button) button.click();
        }
    }

    private getAvailableTabs(): string[] {
        return ['general', 'ranged', 'melee'];
    }
}

customElements.define('bottom-bar', BottomBar);