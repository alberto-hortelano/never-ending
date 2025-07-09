import { Component } from "../Component";
import { ActionsRegistry, ActionItem, ActionCategory } from "../../common/services/ActionsRegistry";
import { StateChangeEvent, UpdateStateEvent } from "../../common/events";
import { ICharacterActions } from "../../common/interfaces";
import { DeepReadonly } from "../../common/helpers/types";

export class Actions extends Component {
    protected override hasCss = true;
    protected override hasHtml = false;
    private characterName?: string;
    private actionsData: ActionCategory[] = [];
    private characterActions?: DeepReadonly<ICharacterActions>;
    private pointsDisplay?: HTMLElement;

    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;

        // Get actions from registry
        this.actionsData = ActionsRegistry.getDefaultActions();

        // Generate HTML and bind events directly
        this.generateActionsWithEvents(root);

        // Listen for character action updates
        this.listen(StateChangeEvent.characterActions, (character) => {
            if (character.name === this.characterName) {
                this.characterActions = character.actions;
                this.updateDisplay(root);
            }
        });

        return root;
    }

    private generateActionsWithEvents(root: ShadowRoot | HTMLElement): void {
        // Create points display
        this.pointsDisplay = document.createElement('div');
        this.pointsDisplay.className = 'points-display';
        this.updatePointsDisplay();
        root.appendChild(this.pointsDisplay);

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
                button.dataset.actionId = action.id;

                const icon = document.createElement('span');
                icon.className = 'action-icon';
                icon.textContent = action.icon;

                const label = document.createElement('span');
                label.className = 'action-label';
                label.textContent = action.label;

                const cost = document.createElement('span');
                cost.className = 'action-cost';
                cost.textContent = this.getActionCost(action.id).toString();

                button.appendChild(icon);
                button.appendChild(label);
                button.appendChild(cost);
                button.addEventListener('click', () => this.handleActionClick(action));
                column.appendChild(button);
            });

            actionsGrid.appendChild(column);
        });

        root.appendChild(actionsGrid);
    }

    setCharacterName(characterName: string) {
        this.characterName = characterName;
        
        // Request character data from state
        const state = (window as any).game?.state;
        if (state) {
            const character = state.findCharacter(characterName);
            if (character) {
                this.characterActions = character.actions;
                const root = this.shadowRoot;
                if (root) {
                    this.updateDisplay(root);
                }
            }
        }
    }

    private getActionCost(actionId: string): number {
        if (!this.characterActions) return 0;
        
        // Map action IDs to their costs
        const actionCosts: Record<string, number> = {
            // General
            'move': this.characterActions.general.move,
            'talk': this.characterActions.general.talk,
            'use': this.characterActions.general.use,
            'rotate': this.characterActions.general.rotate,
            'inventory': this.characterActions.general.inventory,
            // Ranged Combat
            'shoot': this.characterActions.rangedCombat.shoot,
            'aim': this.characterActions.rangedCombat.aim,
            'suppress': this.characterActions.rangedCombat.suppress,
            'cover': this.characterActions.rangedCombat.cover,
            'throw': this.characterActions.rangedCombat.throw,
            // Close Combat
            'power-strike': this.characterActions.closeCombat.powerStrike,
            'slash': this.characterActions.closeCombat.slash,
            'fast-attack': this.characterActions.closeCombat.fastAttack,
            'feint': this.characterActions.closeCombat.feint,
            'break-guard': this.characterActions.closeCombat.breakGuard
        };
        
        return actionCosts[actionId] || 0;
    }

    private updatePointsDisplay(): void {
        if (!this.pointsDisplay) return;
        
        const points = this.characterActions?.pointsLeft ?? 100;
        const percentage = points; // Since max is 100, points = percentage
        
        this.pointsDisplay.innerHTML = `
            <div class="points-bar" style="--points-percentage: ${percentage}%">
                <span class="points-text">Action Points: ${points}</span>
            </div>
        `;
    }

    private updateDisplay(root: ShadowRoot | HTMLElement): void {
        // Update points display
        this.updatePointsDisplay();
        
        // Update button states
        const buttons = root.querySelectorAll('.action-button');
        buttons.forEach(button => {
            const actionId = (button as HTMLElement).dataset.actionId;
            if (actionId) {
                const cost = this.getActionCost(actionId);
                const pointsLeft = this.characterActions?.pointsLeft ?? 0;
                
                // Update cost display
                const costElement = button.querySelector('.action-cost');
                if (costElement) {
                    costElement.textContent = cost.toString();
                }
                
                // Disable if not enough points
                if (cost > pointsLeft) {
                    button.classList.add('disabled');
                    (button as HTMLButtonElement).disabled = true;
                } else {
                    button.classList.remove('disabled');
                    (button as HTMLButtonElement).disabled = false;
                }
            }
        });
    }

    private handleActionClick(action: ActionItem) {
        if (!this.characterName) {
            throw new Error('Missing character name at Actions');
        }

        const cost = this.getActionCost(action.id);
        const pointsLeft = this.characterActions?.pointsLeft ?? 0;
        
        // Check if player has enough points
        if (cost > pointsLeft) {
            console.warn(`Not enough action points for ${action.id}. Cost: ${cost}, Available: ${pointsLeft}`);
            return;
        }

        // For actions that don't have their own handlers yet, deduct points here
        // This ensures immediate UI feedback for all actions
        if (cost > 0 && ['use', 'aim', 'suppress', 'cover', 'throw', 'power-strike', 'slash', 'fast-attack', 'feint', 'break-guard'].includes(action.id)) {
            this.dispatch(UpdateStateEvent.deductActionPoints, {
                characterName: this.characterName,
                actionId: action.id,
                cost: cost
            });
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