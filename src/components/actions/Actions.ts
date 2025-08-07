import { Component } from "../Component";
import { ActionEvent, ActionEventsMap, ActionUpdateData, StateChangeEvent } from "../../common/events";

export class Actions extends Component {
    protected override hasCss = true;
    protected override hasHtml = false;
    private actionsGrid?: HTMLElement;
    private selectedCharacter?: string;
    private activeCategory = 'general';

    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;

        // Get active category from attribute if set
        const categoryAttr = this.getAttribute('active-category');
        if (categoryAttr) {
            this.activeCategory = categoryAttr;
        }

        // Create UI structure
        this.createUIStructure(root);

        // Listen for action updates
        this.setupEventListeners();

        // Get selected character from state
        const state = this.getState();
        if (state?.ui.selectedCharacter) {
            this.selectedCharacter = state.ui.selectedCharacter;
            this.dispatch(ActionEvent.request, this.selectedCharacter);
        }

        return root;
    }

    private createUIStructure(root: ShadowRoot | HTMLElement): void {
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
        
        // Listen for selected character changes
        this.listen(StateChangeEvent.uiSelectedCharacter, (characterName) => {
            if (characterName && characterName !== this.selectedCharacter) {
                this.selectedCharacter = characterName;
                this.dispatch(ActionEvent.request, characterName);
            }
        });
    }

    static get observedAttributes() {
        return ['active-category'];
    }

    attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null) {
        if (name === 'active-category' && newValue) {
            this.activeCategory = newValue;
            // Re-render if we have data
            const state = this.getState();
            if (state?.ui.selectedCharacter) {
                this.dispatch(ActionEvent.request, state.ui.selectedCharacter);
            }
        }
    }

    private updateDisplay(data: ActionUpdateData): void {
        // Only update if this is for our current character
        if (data.characterName !== this.selectedCharacter) return;

        if (!this.actionsGrid) return;

        // Update actions grid
        this.updateActionsGrid(data);
    }


    private updateActionsGrid(data: ActionUpdateData): void {
        if (!this.actionsGrid) return;

        // Clear existing content
        this.actionsGrid.innerHTML = '';

        // Map categories to tab names
        const categoryMap: Record<string, string> = {
            'general': 'GENERAL',
            'ranged': 'RANGED COMBAT',
            'melee': 'CLOSE COMBAT'
        };

        // Find the category that matches the active tab
        const targetCategoryName = categoryMap[this.activeCategory];
        const activeCategory = data.categories.find(cat => 
            cat.name.toUpperCase() === targetCategoryName
        );

        if (!activeCategory) {
            // Show message if no category found
            const message = document.createElement('div');
            message.className = 'no-actions-message';
            message.textContent = 'No actions available for this category';
            this.actionsGrid.appendChild(message);
            return;
        }

        // Create single row for active category only
        const row = document.createElement('div');
        row.className = 'action-row';

        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'action-buttons';

        activeCategory.actions.forEach(action => {
            const button = this.createActionButton(action, data);
            buttonsContainer.appendChild(button);
        });

        row.appendChild(buttonsContainer);

        if (this.actionsGrid) {
            this.actionsGrid.appendChild(row);
        }
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

        // Disable shoot action if no ranged weapon
        if (action.id === 'shoot' && data.hasRangedWeapon === false) {
            button.classList.add('disabled');
            button.disabled = true;
            button.title = 'Requires ranged weapon';
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
            'overwatch': characterActions.rangedCombat.overwatch,
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