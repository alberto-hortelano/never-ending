import type { Actions } from "../actions/Actions";
import type { SelectCharacter } from "../selectcharacter/SelectCharacter";
import type { Conversation } from "../conversation/Conversation";
import type { RotateSelector } from "../rotateselector/RotateSelector";
import type { Inventory } from "../inventory/Inventory";

import { Component } from "../Component";
import { ControlsEvent, ControlsEventsMap, ConversationEvent, ConversationEventsMap, UpdateStateEvent } from "../../common/events";
import { Draggable } from "../../common/helpers/Draggable";

export class Popup extends Component {
    protected override hasCss = true;
    protected override hasHtml = true;
    private dragHelper?: Draggable;
    private isPinned = false;
    private headerElement?: HTMLElement;
    private titleElement?: HTMLElement;
    private pinButton?: HTMLElement;
    private closeButton?: HTMLElement;

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

        this.listen(ControlsEvent.showInventory, (character: ControlsEventsMap[ControlsEvent.showInventory]) => {
            isShowing = true;
            this.showInventory(character);

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

        // Listen for character selections from TalkCharacterList component
        // this.addEventListener('character-selected', () => {
        //     console.log('>>> - Popup - this.addEventListener - character-selected:')
        // });

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
        }
    }

    private showActions(characterName: string) {
        this.clearContent();

        // Create and append actions component
        const actionsComponent = document.createElement('actions-component') as Actions;
        this.appendChild(actionsComponent);

        this.show(`${characterName} - Actions`);

        // Set character name on actions component
        if (actionsComponent && actionsComponent.setCharacterName) {
            actionsComponent.setCharacterName(characterName);
        }
    }

    private showTalk(data: ControlsEventsMap[ControlsEvent.showTalk]) {
        this.clearContent();

        // Create and append select character component
        const selectCharacterComponent = document.createElement('select-character') as SelectCharacter;
        this.appendChild(selectCharacterComponent);

        this.show(`${data.talkingCharacter.name} - Talk to...`);

        // Set options on select character component
        if (selectCharacterComponent && selectCharacterComponent.setOptions) {
            selectCharacterComponent.setOptions({
                characters: [...data.availableCharacters, data.talkingCharacter],
                excludeByName: data.talkingCharacter.name,
                emptyMessage: 'No one else is around to talk to.'
            });
        }

        // Listen for character selection and log the conversation
        selectCharacterComponent.addEventListener('character-selected', (e: Event) => {
            const customEvent = e as CustomEvent;
            const { selectedCharacter } = customEvent.detail;
            console.log(`${data.talkingCharacter.name} talks to ${selectedCharacter.name}`);
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
        if (rotateSelectorComponent && rotateSelectorComponent.setOptions) {
            rotateSelectorComponent.setOptions({
                character: character
            });
        }

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

    private showInventory(character: ControlsEventsMap[ControlsEvent.showInventory]) {
        this.clearContent();

        // Create and append inventory component
        const inventoryComponent = document.createElement('inventory-component') as Inventory;
        this.appendChild(inventoryComponent);

        this.show(`${character.name} - Inventory`);

        // Set options on inventory component
        if (inventoryComponent && inventoryComponent.setOptions) {
            inventoryComponent.setOptions({
                character: character
            });
        }
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
        this.classList.remove('hidden');

        // Setup draggable on first show when shadow DOM is ready (desktop only)
        if (!this.dragHelper && !this.isMobile()) {
            this.setupDraggable();
        }

        // Position popup - mobile uses fixed bottom positioning via CSS
        if (!this.isMobile()) {
            // Desktop: center the popup
            const rect = this.getBoundingClientRect();
            const leftPos = Math.max(0, (window.innerWidth - rect.width) / 2);
            const topPos = Math.max(0, (window.innerHeight - rect.height) / 2);

            this.style.left = `${leftPos}px`;
            this.style.top = `${topPos}px`;
        }

        // Update popup title
        if (this.titleElement) {
            this.titleElement.textContent = title;
        }
    }

    private hide() {
        if (!this.isPinned) {
            this.classList.add('hidden');
        }
    }

    private togglePin() {
        this.isPinned = !this.isPinned;
        if (this.pinButton) {
            this.pinButton.textContent = this.isPinned ? '📌' : '📍';
            this.pinButton.title = this.isPinned ? 'Unpin popup' : 'Pin popup';
        }
    }

    private close() {
        this.isPinned = false;
        this.hide();
    }

    // Custom element setup
    static {
        if (!customElements.get('popup-component')) {
            customElements.define('popup-component', Popup);
        }
    }
}