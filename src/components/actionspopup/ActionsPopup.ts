import { Component } from "../Component";
import { ControlsEvent, ControlsEventsMap } from "../../common/events";
import { Draggable } from "../../common/helpers/Draggable";

export class ActionsPopup extends Component {
    protected override hasCss = true;
    protected override hasHtml = true;
    private dragHelper?: Draggable;
    private isPinned = false;
    private characterName?: string;
    private headerElement?: HTMLElement;
    private pinButton?: HTMLElement;
    private closeButton?: HTMLElement;

    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;

        // Store shadow DOM element references immediately (Pattern 1)
        this.headerElement = root.querySelector('.popup-header') as HTMLElement;
        this.pinButton = root.querySelector('.pin-button') as HTMLElement;
        this.closeButton = root.querySelector('.close-button') as HTMLElement;

        // Setup event listeners for action buttons
        const actionButtons = root.querySelectorAll('.action-button');
        actionButtons.forEach(button => {
            button.addEventListener('click', () => {
                const action = button.getAttribute('data-action');
                if (action) {
                    this.handleActionClick(action);
                }
            });
        });

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
            this.characterName = characterName;
            isShowing = true;
            this.show();

            // Reset the flag after a short delay to allow the click event to finish bubbling
            setTimeout(() => {
                isShowing = false;
            }, 50);
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
    }

    private setupDraggable() {
        // Ensure the component is positioned absolutely for dragging
        this.style.position = 'absolute';

        if (this.headerElement) {
            this.dragHelper = new Draggable(this, this.headerElement);
        }
    }

    private show() {
        this.classList.remove('hidden');

        // Setup draggable on first show when shadow DOM is ready
        if (!this.dragHelper) {
            this.setupDraggable();
        }

        // Position popup at center of screen
        const rect = this.getBoundingClientRect();
        const leftPos = Math.max(0, (window.innerWidth - rect.width) / 2);
        const topPos = Math.max(0, (window.innerHeight - rect.height) / 2);

        this.style.left = `${leftPos}px`;
        this.style.top = `${topPos}px`;
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

    private handleActionClick(action: string) {
        // TODO: Dispatch appropriate action event based on action type
        console.log(`Action clicked: ${action} for character: ${this.characterName}`);

        if (!this.isPinned) {
            this.hide();
        }
    }

    // Custom element setup
    static {
        if (!customElements.get('actions-popup')) {
            customElements.define('actions-popup', ActionsPopup);
        }
    }
}