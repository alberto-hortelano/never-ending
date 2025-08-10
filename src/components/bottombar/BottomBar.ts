import { Component } from "../Component";
import { ControlsEvent, UpdateStateEvent, StateChangeEvent } from "../../common/events";
import type { Actions } from "../actions/Actions";

export default class BottomBar extends Component {
    protected override hasCss = true;
    protected override hasHtml = true;
    
    private meleeActionsVisible = false;
    
    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;
        
        this.setupEventListeners(root);
        
        return root;
    }
    
    private setupEventListeners(root: ShadowRoot) {
        // Listen for show actions event
        this.listen(ControlsEvent.showActions, (characterName: string) => {
            this.showCharacterActions(characterName, root);
        });
        
        // Listen for melee toggle
        this.listen(ControlsEvent.toggleMelee, (_characterName: string) => {
            this.toggleMeleeActions(root);
        });
        
        // Listen for interaction mode changes to show/hide mobile hints
        this.listen(StateChangeEvent.uiInteractionMode, (mode) => {
            this.updateMobileHint(mode, root);
        });
    }
    
    private updateMobileHint(mode: any, root: ShadowRoot) {
        const hint = root.querySelector('.overwatch-mobile-hint') as HTMLElement;
        if (!hint) return;
        
        // Only show hint on mobile when in overwatch mode
        if (this.isMobile() && mode?.type === 'overwatch') {
            hint.style.display = 'block';
        } else {
            hint.style.display = 'none';
        }
    }
    
    private isMobile(): boolean {
        return window.innerWidth <= 768;
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
        
        // Create and append actions component (no category filter)
        const actionsComponent = document.createElement('actions-component') as Actions;
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
    
    private toggleMeleeActions(root: ShadowRoot) {
        const meleeContainer = root.querySelector('.melee-actions-container') as HTMLElement;
        if (!meleeContainer) return;
        
        this.meleeActionsVisible = !this.meleeActionsVisible;
        
        if (this.meleeActionsVisible) {
            meleeContainer.style.display = 'flex';
            // Create melee actions component
            meleeContainer.innerHTML = '';
            const meleeActions = document.createElement('actions-component') as Actions;
            meleeActions.setAttribute('melee-only', 'true');
            meleeContainer.appendChild(meleeActions);
        } else {
            meleeContainer.style.display = 'none';
            meleeContainer.innerHTML = '';
        }
        
        // Update the main actions to reflect the toggle state
        const state = this.getState();
        if (state?.ui?.selectedCharacter) {
            this.showCharacterActions(state.ui.selectedCharacter, root);
        }
    }
}

customElements.define('bottom-bar', BottomBar);