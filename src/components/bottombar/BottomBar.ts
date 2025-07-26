import { Component } from "../Component";
import { ControlsEvent } from "../../common/events";
import type { Actions } from "../actions/Actions";

export default class BottomBar extends Component {
    protected override hasCss = true;
    protected override hasHtml = true;
    
    private isCollapsed = false;
    
    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;
        
        this.setupEventListeners(root);
        this.setupCollapsibleBehavior(root);
        
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
        
        // Clear existing content
        actionsContainer.innerHTML = '';
        
        // Create and append actions component
        const actionsComponent = document.createElement('actions-component') as Actions;
        actionsComponent.setAttribute('character-name', characterName);
        actionsContainer.appendChild(actionsComponent);
        
        // Update state
        actionsContainer.classList.add('has-actions');
        
        // Expand the bar on mobile if collapsed
        if (this.isCollapsed && window.innerWidth <= 768) {
            const toggleButton = root.querySelector('.toggle-button') as HTMLButtonElement;
            const bottomBar = root.querySelector('.bottom-bar') as HTMLElement;
            if (toggleButton && bottomBar) {
                this.isCollapsed = false;
                bottomBar.classList.remove('collapsed');
                toggleButton.innerHTML = '▼';
                toggleButton.setAttribute('title', 'Collapse actions bar');
            }
        }
    }
    
    private setupCollapsibleBehavior(root: ShadowRoot) {
        const toggleButton = root.querySelector('.toggle-button') as HTMLButtonElement;
        const bottomBar = root.querySelector('.bottom-bar') as HTMLElement;
        
        if (toggleButton && bottomBar) {
            toggleButton.addEventListener('click', () => {
                this.isCollapsed = !this.isCollapsed;
                
                if (this.isCollapsed) {
                    bottomBar.classList.add('collapsed');
                    toggleButton.innerHTML = '▲';
                    toggleButton.setAttribute('title', 'Expand actions bar');
                } else {
                    bottomBar.classList.remove('collapsed');
                    toggleButton.innerHTML = '▼';
                    toggleButton.setAttribute('title', 'Collapse actions bar');
                }
                
                this.dispatchEvent(new CustomEvent('collapsed-changed', {
                    detail: { collapsed: this.isCollapsed },
                    bubbles: true,
                    composed: true
                }));
            });
        }
    }
}

customElements.define('bottom-bar', BottomBar);