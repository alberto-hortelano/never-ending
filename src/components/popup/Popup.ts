// import type { SelectCharacter } from "../selectcharacter/SelectCharacter";
// import type { Inventory } from "../inventory/Inventory";

import { Component } from "../Component";
import { UpdateStateEvent, StateChangeEvent } from "../../common/events";
// import { Draggable } from "../../common/helpers/Draggable";
import type { IPopupState } from "../../common/interfaces";
import { i18n } from "../../common/i18n/i18n";

export class Popup extends Component {
    protected override hasCss = true;
    protected override hasHtml = true;
    // private dragHelper?: Draggable;
    private isPinned = false;
    // private headerElement?: HTMLElement; // Not used since dragging is disabled
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
        // this.headerElement = root.querySelector('.popup-header') as HTMLElement; // Not used since dragging is disabled
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
        // Conversations are now handled by the BottomBar component

        // Close popup when clicking outside (if not pinned)
        document.addEventListener('click', (e) => {
            if (!this.isPinned && !this.contains(e.target as Node)) {
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
            this.pinButton.title = this.isPinned ? i18n.t('popup.unpin') : i18n.t('popup.pin');
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
            this.pinButton.title = this.isPinned ? i18n.t('popup.unpin') : i18n.t('popup.pin');
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
            // SELECT-CHARACTER is now in BottomBar
            // else if (firstChild.tagName === 'SELECT-CHARACTER') contentType = 'actions';
            else if (firstChild.tagName === 'ROTATE-SELECTOR') contentType = 'rotate';
            // INVENTORY-COMPONENT is now in BottomBar
            // else if (firstChild.tagName === 'INVENTORY-COMPONENT') contentType = 'inventory';
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