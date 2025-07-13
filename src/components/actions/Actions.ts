import { Component } from "../Component";
import { ActionEvent, ActionEventsMap, ActionUpdateData } from "../../common/events";

export class Actions extends Component {
    protected override hasCss = true;
    protected override hasHtml = false;
    private pointsDisplay?: HTMLElement;
    private actionsGrid?: HTMLElement;

    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;

        // Create UI structure
        this.createUIStructure(root);

        // Listen for action updates
        this.setupEventListeners();

        // Get character name from attribute and request actions
        const characterName = this.getAttribute('character-name');
        console.log('Actions component: character-name attribute is', characterName);
        if (characterName) {
            this.dispatch(ActionEvent.request, characterName);
        } else {
            console.warn('Actions component: No character-name attribute found');
        }

        return root;
    }

    private createUIStructure(root: ShadowRoot | HTMLElement): void {
        // Create points display
        this.pointsDisplay = document.createElement('div');
        this.pointsDisplay.className = 'points-display';
        root.appendChild(this.pointsDisplay);

        // Create actions grid
        this.actionsGrid = document.createElement('div');
        this.actionsGrid.className = 'actions-grid';
        root.appendChild(this.actionsGrid);
    }

    private setupEventListeners(): void {
        this.listen(ActionEvent.update, (data: ActionEventsMap[ActionEvent.update]) => {
            this.updateDisplay(data);
        });

        this.listen(ActionEvent.error, (error: ActionEventsMap[ActionEvent.error]) => {
            console.warn('Action error:', error);
        });
    }

    private updateDisplay(data: ActionUpdateData): void {
        // Only update if this is for our current character
        const characterName = this.getAttribute('character-name');
        if (data.characterName !== characterName) return;

        if (!this.pointsDisplay || !this.actionsGrid) return;

        // Update points display
        this.updatePointsDisplay(data.characterActions.pointsLeft);

        // Update actions grid
        this.updateActionsGrid(data);
    }

    private updatePointsDisplay(pointsLeft: number): void {
        if (!this.pointsDisplay) return;

        const percentage = pointsLeft; // Since max is 100, points = percentage

        this.pointsDisplay.innerHTML = `
            <div class="points-bar" style="--points-percentage: ${percentage}%">
                <span class="points-text">Action Points: ${pointsLeft}</span>
            </div>
        `;
    }

    private updateActionsGrid(data: ActionUpdateData): void {
        if (!this.actionsGrid) return;

        // Clear existing content
        this.actionsGrid.innerHTML = '';

        // Create columns for each category
        data.categories.forEach(category => {
            const column = document.createElement('div');
            column.className = 'action-column';

            const header = document.createElement('h4');
            header.textContent = category.name;
            column.appendChild(header);

            category.actions.forEach(action => {
                const button = this.createActionButton(action, data);
                column.appendChild(button);
            });

            if (this.actionsGrid) {
                this.actionsGrid.appendChild(column);
            }
        });
    }

    private createActionButton(action: ActionUpdateData['categories'][0]['actions'][0], data: ActionUpdateData): HTMLButtonElement {
        const button = document.createElement('button');
        button.className = 'action-button';
        button.dataset.actionId = action.id;

        const icon = document.createElement('span');
        icon.className = 'action-icon';
        icon.textContent = action.icon;

        const label = document.createElement('span');
        label.className = 'action-label';
        label.textContent = action.label;

        const cost = this.getActionCost(action.id, data.characterActions);
        const costElement = document.createElement('span');
        costElement.className = 'action-cost';
        costElement.textContent = cost.toString();

        button.appendChild(icon);
        button.appendChild(label);
        button.appendChild(costElement);

        // Disable if not enough points
        const pointsLeft = data.characterActions.pointsLeft;
        if (cost > pointsLeft) {
            button.classList.add('disabled');
            button.disabled = true;
        }

        // Add click handler
        button.addEventListener('click', () => {
            this.dispatch(ActionEvent.selected, {
                action: action.id,
                characterName: data.characterName
            });

            // Dispatch custom event to notify parent
            this.dispatchEvent(new CustomEvent('action-selected', {
                detail: { action: action.id, characterName: data.characterName },
                bubbles: true
            }));
        });

        return button;
    }

    private getActionCost(actionId: string, characterActions: ActionUpdateData['characterActions']): number {
        const actionCosts: Record<string, number> = {
            // General
            'move': characterActions.general.move,
            'talk': characterActions.general.talk,
            'use': characterActions.general.use,
            'rotate': characterActions.general.rotate,
            'inventory': characterActions.general.inventory,
            // Ranged Combat
            'shoot': characterActions.rangedCombat.shoot,
            'aim': characterActions.rangedCombat.aim,
            'suppress': characterActions.rangedCombat.suppress,
            'cover': characterActions.rangedCombat.cover,
            'throw': characterActions.rangedCombat.throw,
            // Close Combat
            'power-strike': characterActions.closeCombat.powerStrike,
            'slash': characterActions.closeCombat.slash,
            'fast-attack': characterActions.closeCombat.fastAttack,
            'feint': characterActions.closeCombat.feint,
            'break-guard': characterActions.closeCombat.breakGuard
        };

        return actionCosts[actionId] || 0;
    }

    // Custom element setup
    static {
        if (!customElements.get('actions-component')) {
            customElements.define('actions-component', Actions);
        }
    }
}