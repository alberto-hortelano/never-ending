import type { SelectCharacter } from "../selectcharacter/SelectCharacter";
import type { Inventory } from "../inventory/Inventory";

import { Component } from "../Component";
import { ControlsEvent, ControlsEventsMap, ConversationEvent, UpdateStateEvent, StateChangeEvent } from "../../common/events";
import { Draggable } from "../../common/helpers/Draggable";
import type { IPopupState } from "../../common/interfaces";
import { i18n } from "../../common/i18n/i18n";

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
        this.updateTranslations();

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

        // Actions are now shown in the BottomBar, not in the popup
        // this.listen(ControlsEvent.showActions, (characterName: ControlsEventsMap[ControlsEvent.showActions]) => {
        //     isShowing = true;
        //     this.showActions(characterName);

        //     // Reset the flag after a short delay to allow the click event to finish bubbling
        //     setTimeout(() => {
        //         isShowing = false;
        //     }, 50);
        // });

        this.listen(ControlsEvent.showTalk, (data: ControlsEventsMap[ControlsEvent.showTalk]) => {
            isShowing = true;
            this.showTalk(data);

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

        // Conversations are now handled by the BottomBar component

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

        // Actions are now in BottomBar, so no need to listen for action-selected events

        // Conversations are now handled by the BottomBar component
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


    private showInventory(characterName: ControlsEventsMap[ControlsEvent.showInventory]) {
        this.clearContent();
        
        // Update selected character in state
        this.dispatch(UpdateStateEvent.uiSelectedCharacter, characterName);

        // Create and append inventory component (no longer needs character-name attribute)
        const inventoryComponent = document.createElement('inventory-component') as Inventory;
        this.appendChild(inventoryComponent);

        this.show(`${characterName} - Inventory`);
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
        // Conversations are now handled by the BottomBar component
        if (popupState.type === 'conversation') {
            // Hide and skip conversation popups as they're handled by BottomBar now
            this.classList.add('hidden');
            return;
        }
        
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
        }

        return {
            type: contentType,
            visible,
            position,
            data: { title: this.titleElement?.textContent || '' },
            isPinned: this.isPinned
        };
    }
    
    private updateTranslations() {
        const root = this.shadowRoot;
        if (!root) return;
        
        // Update button tooltips
        if (this.pinButton) {
            this.pinButton.title = this.isPinned ? i18n.t('popup.close') : i18n.t('popup.pin');
        }
        
        if (this.closeButton) {
            this.closeButton.title = i18n.t('popup.close');
        }
        
        // Update title if it's "Actions"
        if (this.titleElement && this.titleElement.textContent === 'Actions') {
            this.titleElement.textContent = i18n.t('popup.actions');
        }
    }

    // Custom element setup
    static {
        if (!customElements.get('popup-component')) {
            customElements.define('popup-component', Popup);
        }
    }
}