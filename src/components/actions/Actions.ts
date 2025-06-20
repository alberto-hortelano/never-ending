import { Component } from "../Component";

export class Actions extends Component {
    protected override hasCss = true;
    protected override hasHtml = true;
    private characterName?: string;

    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;

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

        return root;
    }

    setCharacterName(characterName: string) {
        this.characterName = characterName;
    }

    private handleActionClick(action: string) {
        // TODO: Dispatch appropriate action event based on action type
        console.log(`Action clicked: ${action} for character: ${this.characterName}`);
        
        // Dispatch custom event to notify parent
        this.dispatchEvent(new CustomEvent('action-selected', {
            detail: { action, characterName: this.characterName },
            bubbles: true
        }));
    }

    // Custom element setup
    static {
        if (!customElements.get('actions-component')) {
            customElements.define('actions-component', Actions);
        }
    }
}