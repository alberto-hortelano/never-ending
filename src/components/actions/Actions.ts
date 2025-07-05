import { Component } from "../Component";
import { ActionsRegistry, ActionItem, ActionCategory } from "../../common/services/ActionsRegistry";

export class Actions extends Component {
    protected override hasCss = true;
    protected override hasHtml = false;
    private characterName?: string;
    private actionsData: ActionCategory[] = [];

    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;

        // Get actions from registry
        this.actionsData = ActionsRegistry.getDefaultActions();

        // Generate HTML and bind events directly
        this.generateActionsWithEvents(root);

        return root;
    }

    private generateActionsWithEvents(root: ShadowRoot | HTMLElement): void {
        const actionsGrid = document.createElement('div');
        actionsGrid.className = 'actions-grid';

        this.actionsData.forEach(category => {
            const column = document.createElement('div');
            column.className = 'action-column';

            const header = document.createElement('h4');
            header.textContent = category.name;
            column.appendChild(header);

            category.actions.forEach(action => {
                const button = document.createElement('button');
                button.className = 'action-button';

                const icon = document.createElement('span');
                icon.className = 'action-icon';
                icon.textContent = action.icon;

                const label = document.createElement('span');
                label.className = 'action-label';
                label.textContent = action.label;

                button.appendChild(icon);
                button.appendChild(label);
                button.addEventListener('click', () => this.handleActionClick(action));
                column.appendChild(button);
            });

            actionsGrid.appendChild(column);
        });

        root.appendChild(actionsGrid);
    }

    setCharacterName(characterName: string) {
        this.characterName = characterName;
    }

    private handleActionClick(action: ActionItem) {
        if (!this.characterName) {
            throw new Error('Missing character name at Actions');
        }

        // Dispatch the action's associated event
        this.dispatch(action.event, this.characterName);

        // Dispatch custom event to notify parent
        this.dispatchEvent(new CustomEvent('action-selected', {
            detail: { action: action.id, characterName: this.characterName },
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