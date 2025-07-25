import type { Actions } from "../actions/Actions";
import type { SelectCharacter } from "../selectcharacter/SelectCharacter";
import type { Conversation } from "../conversation/Conversation";
import type { RotateSelector } from "../rotateselector/RotateSelector";
import type { Inventory } from "../inventory/Inventory";

import { Component } from "../Component";
import { ControlsEvent, ControlsEventsMap, ConversationEvent, ConversationEventsMap, UpdateStateEvent, StateChangeEvent } from "../../common/events";
import { Draggable } from "../../common/helpers/Draggable";
import type { IPopupState } from "../../common/interfaces";

export class Popup extends Component {
    protected override hasCss = true;
    protected override hasHtml = true;
    private dragHelper?: Draggable;
    private isPinned = false;
    private headerElement?: HTMLElement;
    private titleElement?: HTMLElement;
    private pinButton?: HTMLElement;
    private closeButton?: HTMLElement;
    private popupId = 'main-popup';  // Single main popup for now

    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;

        // Store shadow DOM element references immediately (Pattern 1)
        this.headerElement = root.querySelector('.popup-header') as HTMLElement;
        this.titleElement = root.querySelector('.popup-header h3') as HTMLElement;
        this.pinButton = root.querySelector('.pin-button') as HTMLElement;
        this.closeButton = root.querySelector('.close-button') as HTMLElement;

        // Setup pin and close button listeners
        this.pinButton?.addEventListener('click', () => this.togglePin());
        this.closeButton?.addEventListener('click', () => this.close());

        this.classList.add('hidden');
        this.setupEventListeners();

        // Listen for popup state changes
        this.listen(StateChangeEvent.uiTransient, (transientUI) => {
            const popupState = transientUI.popups[this.popupId];
            if (popupState) {
                this.applyPopupState(popupState as IPopupState);
            } else {
                // No popup state means it should be hidden
                this.classList.add('hidden');
            }
        });

        return root;
    }

    private setupEventListeners() {
        let isShowing = false;

        this.listen(ControlsEvent.showActions, (characterName: ControlsEventsMap[ControlsEvent.showActions]) => {
            isShowing = true;
            this.showActions(characterName);

            // Reset the flag after a short delay to allow the click event to finish bubbling
            setTimeout(() => {
                isShowing = false;
            }, 50);
        });

        this.listen(ControlsEvent.showTalk, (data: ControlsEventsMap[ControlsEvent.showTalk]) => {
            isShowing = true;
            this.showTalk(data);

            // Reset the flag after a short delay to allow the click event to finish bubbling
            setTimeout(() => {
                isShowing = false;
            }, 50);
        });

        this.listen(ControlsEvent.showRotate, (character: ControlsEventsMap[ControlsEvent.showRotate]) => {
            isShowing = true;
            this.showRotate(character);

            // Reset the flag after a short delay to allow the click event to finish bubbling
            setTimeout(() => {
                isShowing = false;
            }, 50);
        });

        this.listen(ControlsEvent.showInventory, (characterName: ControlsEventsMap[ControlsEvent.showInventory]) => {
            isShowing = true;
            this.showInventory(characterName);

            // Reset the flag after a short delay to allow the click event to finish bubbling
            setTimeout(() => {
                isShowing = false;
            }, 50);
        });

        // Listen for conversation start to create the conversation UI with loading state
        this.listen(ConversationEvent.start, (data: ConversationEventsMap[ConversationEvent.start]) => {
            isShowing = true;
            this.showConversationLoading(data);

            // Reset the flag after a short delay to allow the click event to finish bubbling
            setTimeout(() => {
                isShowing = false;
            }, 50);
        });

        // Listen for conversation updates to show the conversation UI
        this.listen(ConversationEvent.update, (data: ConversationEventsMap[ConversationEvent.update]) => {
            // Only create new conversation UI if one doesn't exist
            const existingConversation = this.querySelector('conversation-ui');
            if (!existingConversation) {
                isShowing = true;
                this.showConversation(data);

                // Reset the flag after a short delay to allow the click event to finish bubbling
                setTimeout(() => {
                    isShowing = false;
                }, 50);
            }
        });

        // Close popup when clicking outside (if not pinned)
        document.addEventListener('click', (e) => {
            if (!isShowing && !this.isPinned && !this.contains(e.target as Node)) {
                this.hide();
            }
        });

        // Prevent popup from closing when clicking inside
        this.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Listen for action selections from child Actions component
        this.addEventListener('action-selected', () => {
            if (!this.isPinned) {
                this.hide();
            }
        });

        // Listen for conversation updates from Conversation component
        this.addEventListener('conversation-updated', () => {
            // Keep popup open during conversations
        });
    }

    private isMobile(): boolean {
        return window.innerWidth <= 768;
    }

    private setupDraggable() {
        // Ensure the component is positioned absolutely for dragging
        this.style.position = 'absolute';

        if (this.headerElement) {
            this.dragHelper = new Draggable(this, this.headerElement);

            // Listen for mouseup/touchend to detect drag end and update state
            const updatePositionInState = () => {
                const popupState = this.getPopupStateFromDOM();
                if (popupState && popupState.visible) {
                    this.dispatch(UpdateStateEvent.uiPopup, {
                        popupId: this.popupId,
                        popupState
                    });
                }
            };

            document.addEventListener('mouseup', updatePositionInState);
            document.addEventListener('touchend', updatePositionInState);
        }
    }

    private showActions(characterName: string) {
        this.clearContent();

        // Create and append actions component
        const actionsComponent = document.createElement('actions-component') as Actions;
        actionsComponent.setAttribute('character-name', characterName);
        this.appendChild(actionsComponent);

        this.show(`${characterName} - Actions`);
    }

    private showTalk(data: ControlsEventsMap[ControlsEvent.showTalk]) {
        this.clearContent();

        // Create and append select character component
        const selectCharacterComponent = document.createElement('select-character') as SelectCharacter;
        this.appendChild(selectCharacterComponent);

        this.show(`${data.talkingCharacter.name} - Talk to...`);

        // Set options on select character component
        selectCharacterComponent.setOptions({
            characters: [...data.availableCharacters, data.talkingCharacter],
            excludeByName: data.talkingCharacter.name,
            emptyMessage: 'No one else is around to talk to.'
        });

        // Listen for character selection and log the conversation
        selectCharacterComponent.addEventListener('character-selected', (e: Event) => {
            const customEvent = e as CustomEvent;
            const { selectedCharacter } = customEvent.detail;
            this.dispatch(ConversationEvent.start, { talkingCharacter: data.talkingCharacter, targetCharacter: selectedCharacter })
        });
    }

    private showRotate(character: ControlsEventsMap[ControlsEvent.showRotate]) {
        this.clearContent();

        // Create and append rotate selector component
        const rotateSelectorComponent = document.createElement('rotate-selector') as RotateSelector;
        this.appendChild(rotateSelectorComponent);

        this.show(`${character.name} - Rotate`);

        // Set options on rotate selector component
        rotateSelectorComponent.setOptions({
            character: character
        });

        // Listen for direction selection
        rotateSelectorComponent.addEventListener('direction-selected', (e: Event) => {
            const customEvent = e as CustomEvent;
            const { character, direction } = customEvent.detail;
            // Dispatch event to update character direction
            this.dispatch(UpdateStateEvent.characterDirection, {
                characterName: character.name,
                direction: direction
            });
            if (!this.isPinned) {
                this.hide();
            }
        });
    }

    private showInventory(characterName: ControlsEventsMap[ControlsEvent.showInventory]) {
        this.clearContent();

        // Create and append inventory component
        const inventoryComponent = document.createElement('inventory-component') as Inventory;
        inventoryComponent.setAttribute('character-name', characterName);
        this.appendChild(inventoryComponent);

        this.show(`${characterName} - Inventory`);
    }

    private showConversationLoading(data: ConversationEventsMap[ConversationEvent.start]) {
        this.clearContent();

        // Create and append conversation UI component
        const conversationComponent = document.createElement('conversation-ui') as Conversation;
        this.appendChild(conversationComponent);

        const title = `${data.talkingCharacter.name} - Conversation`;
        this.show(title);
    }

    private showConversation(data: ConversationEventsMap[ConversationEvent.update]) {
        this.clearContent();

        // Create and append conversation UI component
        const conversationComponent = document.createElement('conversation-ui') as Conversation;
        this.appendChild(conversationComponent);

        // Determine title based on conversation type
        const title = data.type === 'speech' && data.source
            ? `${data.source} - Conversation`
            : 'Conversation';

        this.show(title);
    }

    private clearContent() {
        // Remove all child components
        while (this.firstChild) {
            this.removeChild(this.firstChild);
        }
    }

    private show(title: string) {
        // Setup draggable on first show when shadow DOM is ready (desktop only)
        if (!this.dragHelper && !this.isMobile()) {
            this.setupDraggable();
        }

        // Calculate position for desktop
        let position = undefined;
        if (!this.isMobile()) {
            // Desktop: center the popup
            const rect = this.getBoundingClientRect();
            const leftPos = Math.max(0, (window.innerWidth - rect.width) / 2);
            const topPos = Math.max(0, (window.innerHeight - rect.height) / 2);
            position = { x: leftPos, y: topPos };
        }

        // Get current content type from the first child element
        let contentType: IPopupState['type'] = 'actions';
        const firstChild = this.firstElementChild;
        if (firstChild) {
            if (firstChild.tagName === 'ACTIONS-COMPONENT') contentType = 'actions';
            else if (firstChild.tagName === 'SELECT-CHARACTER') contentType = 'actions'; // Talk uses actions type
            else if (firstChild.tagName === 'ROTATE-SELECTOR') contentType = 'rotate';
            else if (firstChild.tagName === 'INVENTORY-COMPONENT') contentType = 'inventory';
            else if (firstChild.tagName === 'CONVERSATION-UI') contentType = 'conversation';
        }

        // Update popup state
        this.dispatch(UpdateStateEvent.uiPopup, {
            popupId: this.popupId,
            popupState: {
                type: contentType,
                visible: true,
                position,
                data: { title },
                isPinned: this.isPinned
            }
        });

        // Also dispatch the legacy popup show event for Board compatibility
        this.dispatch(UpdateStateEvent.uiBoardVisual, {
            updates: { hasPopupActive: true }
        });
    }

    private hide() {
        if (!this.isPinned) {
            // Only dispatch UI events if State is initialized
            // During game initialization, State might not be ready yet
            try {
                // Update state to hide popup
                this.dispatch(UpdateStateEvent.uiPopup, {
                    popupId: this.popupId,
                    popupState: null
                });

                // Update board visual state
                this.dispatch(UpdateStateEvent.uiBoardVisual, {
                    updates: { hasPopupActive: false }
                });
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (e) {
                // State not initialized yet, ignore
            }
        }
    }

    private togglePin() {
        this.isPinned = !this.isPinned;
        if (this.pinButton) {
            this.pinButton.textContent = this.isPinned ? '📌' : '📍';
            this.pinButton.title = this.isPinned ? 'Unpin popup' : 'Pin popup';
        }

        // Update pinned state in UI state
        const popupState = this.getPopupStateFromDOM();
        if (popupState) {
            this.dispatch(UpdateStateEvent.uiPopup, {
                popupId: this.popupId,
                popupState: {
                    ...popupState,
                    isPinned: this.isPinned
                }
            });
        }
    }

    private close() {
        this.isPinned = false;
        // Update state to hide popup
        this.dispatch(UpdateStateEvent.uiPopup, {
            popupId: this.popupId,
            popupState: null
        });

        // Update board visual state
        this.dispatch(UpdateStateEvent.uiBoardVisual, {
            updates: { hasPopupActive: false }
        });
    }

    private applyPopupState(popupState: IPopupState) {
        // Apply visibility
        if (popupState.visible) {
            this.classList.remove('hidden');
        } else {
            this.classList.add('hidden');
        }

        // Apply position for desktop
        if (popupState.position && !this.isMobile()) {
            this.style.left = `${popupState.position.x}px`;
            this.style.top = `${popupState.position.y}px`;
        }

        // Apply title
        if (this.titleElement && popupState.data?.title) {
            this.titleElement.textContent = popupState.data.title;
        }

        // Apply pinned state
        this.isPinned = popupState.isPinned || false;
        if (this.pinButton) {
            this.pinButton.textContent = this.isPinned ? '📌' : '📍';
            this.pinButton.title = this.isPinned ? 'Unpin popup' : 'Pin popup';
        }
    }

    private getPopupStateFromDOM(): IPopupState | null {
        // Get current state from DOM for updates
        const visible = !this.classList.contains('hidden');
        if (!visible) return null;

        const rect = this.getBoundingClientRect();
        const position = !this.isMobile() ? { x: rect.left, y: rect.top } : undefined;

        // Determine content type
        let contentType: IPopupState['type'] = 'actions';
        const firstChild = this.firstElementChild;
        if (firstChild) {
            if (firstChild.tagName === 'ACTIONS-COMPONENT') contentType = 'actions';
            else if (firstChild.tagName === 'SELECT-CHARACTER') contentType = 'actions';
            else if (firstChild.tagName === 'ROTATE-SELECTOR') contentType = 'rotate';
            else if (firstChild.tagName === 'INVENTORY-COMPONENT') contentType = 'inventory';
            else if (firstChild.tagName === 'CONVERSATION-UI') contentType = 'conversation';
        }

        return {
            type: contentType,
            visible,
            position,
            data: { title: this.titleElement?.textContent || '' },
            isPinned: this.isPinned
        };
    }

    // Custom element setup
    static {
        if (!customElements.get('popup-component')) {
            customElements.define('popup-component', Popup);
        }
    }
}