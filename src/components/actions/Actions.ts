import { ControlsEvent } from "../../common/events";
import { Component } from "../Component";

interface ActionItem {
    id: string;
    label: string;
    event: ControlsEvent;
}

interface ActionCategory {
    name: string;
    actions: ActionItem[];
}

export class Actions extends Component {
    protected override hasCss = true;
    protected override hasHtml = false;
    private characterName?: string;

    private actionsData: ActionCategory[] = [{
        name: "General",
        actions: [
            { id: "move", label: "Move", event: ControlsEvent.showMovement },
            { id: "talk", label: "Talk", event: ControlsEvent.showMovement },
            { id: "use", label: "Use", event: ControlsEvent.showMovement }
        ]
    }, {
        name: "Ranged Combat",
        actions: [
            { id: "shoot", label: "Shoot", event: ControlsEvent.showMovement },
            { id: "aim", label: "Aim", event: ControlsEvent.showMovement },
            { id: "suppress", label: "Suppress", event: ControlsEvent.showMovement },
            { id: "cover", label: "Cover", event: ControlsEvent.showMovement },
            { id: "throw", label: "Throw", event: ControlsEvent.showMovement }
        ]
    }, {
        name: "Close Combat",
        actions: [
            { id: "power-strike", label: "Power Strike", event: ControlsEvent.showMovement },
            { id: "slash", label: "Slash", event: ControlsEvent.showMovement },
            { id: "fast-attack", label: "Fast Attack", event: ControlsEvent.showMovement },
            { id: "feint", label: "Feint", event: ControlsEvent.showMovement },
            { id: "break-guard", label: "Break Guard", event: ControlsEvent.showMovement }
        ]
    }];

    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;

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
                button.textContent = action.label;
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
        console.log(`Action clicked: ${action.id} for character: ${this.characterName} - ${action.event}`);
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