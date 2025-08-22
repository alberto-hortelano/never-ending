import { Component } from "../Component";
import { ControlsEvent, UpdateStateEvent, StateChangeEvent, ConversationEvent, ConversationEventsMap } from "../../common/events";
import type { Actions } from "../actions/Actions";
import type { Conversation } from "../conversation/Conversation";
import { i18n } from "../../common/i18n/i18n";

export default class BottomBar extends Component {
    protected override hasCss = true;
    protected override hasHtml = true;
    
    private meleeActionsVisible = false;
    private conversationComponent?: Conversation;
    private conversationSection?: HTMLElement;
    private isConversationVisible = false;
    
    constructor() {
        super();
        // Listen for language changes
        this.listen(StateChangeEvent.language, () => {
            this.updateTranslations();
        });
    }
    
    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;
        
        // Get reference to conversation section
        this.conversationSection = root.querySelector('.conversation-section') as HTMLElement;
        
        this.setupEventListeners(root);
        this.updateTranslations();
        
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
        
        // Store the last conversation data to re-dispatch after component creation
        let lastConversationData: ConversationEventsMap[ConversationEvent.update] | null = null;
        
        // Listen for conversation events
        this.listen(ConversationEvent.start, (data: ConversationEventsMap[ConversationEvent.start]) => {
            console.log('[BottomBar] Received ConversationEvent.start:', data);
            this.showConversation();
        });
        
        this.listen(ConversationEvent.update, (data: ConversationEventsMap[ConversationEvent.update]) => {
            console.log('[BottomBar] Received ConversationEvent.update:', data);
            lastConversationData = data;
            
            // If conversation is not visible yet, show it
            if (!this.isConversationVisible) {
                console.log('[BottomBar] Conversation not visible, showing it now');
                this.showConversation();
                
                // Re-dispatch the update event after a short delay to ensure the component is ready
                setTimeout(() => {
                    if (lastConversationData) {
                        console.log('[BottomBar] Re-dispatching conversation update to newly created component');
                        this.dispatch(ConversationEvent.update, lastConversationData);
                    }
                }, 100);
            } else {
                console.log('[BottomBar] Conversation already visible');
            }
        });
    }
    
    private updateMobileHint(mode: any, root: ShadowRoot) {
        // Hide all hints first
        const allHints = root.querySelectorAll('.mobile-hint') as NodeListOf<HTMLElement>;
        allHints.forEach(hint => hint.style.display = 'none');
        
        // Only show hints on mobile
        if (!this.isMobile()) return;
        
        // Show appropriate hint based on mode
        let hintToShow: HTMLElement | null = null;
        
        switch (mode?.type) {
            case 'overwatch':
                hintToShow = root.querySelector('.overwatch-mobile-hint');
                break;
            case 'moving':
                hintToShow = root.querySelector('.movement-mobile-hint');
                break;
            case 'shooting':
                hintToShow = root.querySelector('.shooting-mobile-hint');
                break;
        }
        
        if (hintToShow) {
            hintToShow.style.display = 'block';
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
    
    private showConversation() {
        console.log('[BottomBar] showConversation called');
        if (!this.conversationSection) {
            console.error('[BottomBar] No conversation section found!');
            return;
        }
        
        // Create conversation component if it doesn't exist
        if (!this.conversationComponent) {
            console.log('[BottomBar] Creating conversation-ui component');
            this.conversationComponent = document.createElement('conversation-ui') as Conversation;
            this.conversationSection.appendChild(this.conversationComponent);
            console.log('[BottomBar] Conversation component created and appended');
            
            // Listen for conversation-ended event
            this.conversationComponent.addEventListener('conversation-ended', () => {
                console.log('[BottomBar] Received conversation-ended event');
                // Close immediately when user clicks close button
                this.hideConversation();
            });
        } else {
            console.log('[BottomBar] Conversation component already exists');
        }
        
        // Show the conversation section
        this.conversationSection.style.display = 'block';
        this.isConversationVisible = true;
        console.log('[BottomBar] Conversation section shown');
        
        // Notify that bottom bar has expanded
        this.dispatch(UpdateStateEvent.uiBottomBarExpanded, true);
    }
    
    private hideConversation() {
        if (!this.conversationSection) return;
        
        this.conversationSection.style.display = 'none';
        this.isConversationVisible = false;
        
        // Clear the conversation component
        if (this.conversationComponent) {
            this.conversationSection.removeChild(this.conversationComponent);
            this.conversationComponent = undefined;
        }
        
        // Notify that bottom bar has collapsed
        this.dispatch(UpdateStateEvent.uiBottomBarExpanded, false);
    }
    
    private updateTranslations() {
        const root = this.shadowRoot;
        if (!root) return;
        
        // Update mobile hints
        const movementHint = root.querySelector('.movement-mobile-hint');
        const shootingHint = root.querySelector('.shooting-mobile-hint');
        const overwatchHint = root.querySelector('.overwatch-mobile-hint');
        
        if (movementHint) movementHint.textContent = i18n.t('bottombar.tapToMove');
        if (shootingHint) shootingHint.textContent = i18n.t('bottombar.holdToRotate');
        if (overwatchHint) overwatchHint.textContent = i18n.t('bottombar.pinchToZoom');
    }
}

customElements.define('bottom-bar', BottomBar);