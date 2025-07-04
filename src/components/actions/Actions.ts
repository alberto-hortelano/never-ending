import { ControlsEvent } from "../../common/events";
import { Component } from "../Component";

interface ActionItem {
    id: string;
    label: string;
    icon: string;
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
            { id: "move", label: "Move", icon: "🚶", event: ControlsEvent.showMovement },
            { id: "talk", label: "Talk", icon: "💬", event: ControlsEvent.talk },
            { id: "use", label: "Use", icon: "✋", event: ControlsEvent.use },
            { id: "rotate", label: "Rotate", icon: "🔄", event: ControlsEvent.rotate },
            { id: "inventory", label: "Inventory", icon: "🎒", event: ControlsEvent.inventory }
        ]
    }, {
        name: "Ranged Combat",
        actions: [
            { id: "shoot", label: "Shoot", icon: "🔫", event: ControlsEvent.showShooting },
            { id: "aim", label: "Aim", icon: "🎯", event: ControlsEvent.showMovement },
            { id: "suppress", label: "Suppress", icon: "💥", event: ControlsEvent.showMovement },
            { id: "cover", label: "Cover", icon: "🛡️", event: ControlsEvent.showMovement },
            { id: "throw", label: "Throw", icon: "🤾", event: ControlsEvent.showMovement }
        ]
    }, {
        name: "Close Combat",
        actions: [
            { id: "power-strike", label: "Power Strike", icon: "💪", event: ControlsEvent.showMovement },
            { id: "slash", label: "Slash", icon: "⚔️", event: ControlsEvent.showMovement },
            { id: "fast-attack", label: "Fast Attack", icon: "⚡", event: ControlsEvent.showMovement },
            { id: "feint", label: "Feint", icon: "🎭", event: ControlsEvent.showMovement },
            { id: "break-guard", label: "Break Guard", icon: "🔨", event: ControlsEvent.showMovement }
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