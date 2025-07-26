import type { DeepReadonly } from "../../common/helpers/types";
import type { ICharacter } from "../../common/interfaces";
import { Component } from "../Component";
import { StateChangeEvent, ActionEvent, ActionEventsMap, ActionUpdateData } from "../../common/events";

export class BottomBar extends Component {
    protected override hasCss = true;
    protected override hasHtml = false;
    private selectedCharacter: DeepReadonly<ICharacter> | null = null;
    private actionsContainer?: HTMLElement;
    private toggleButton?: HTMLButtonElement;
    private isExpanded = false;
    private currentTab: 'close' | 'ranged' = 'close';
    private actionData?: ActionUpdateData;

    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;

        // Create UI structure
        this.createUIStructure(root);

        // Listen for selected character changes
        this.listen(StateChangeEvent.selectedCharacter, (character) => {
            this.selectedCharacter = character;
            this.updateDisplay();
            
            // Request actions for the selected character
            if (character) {
                this.dispatch(ActionEvent.request, character.name);
            }
        });

        // Listen for action updates
        this.listen(ActionEvent.update, (data: ActionEventsMap[ActionEvent.update]) => {
            if (this.selectedCharacter && data.characterName === this.selectedCharacter.name) {
                this.actionData = data;
                this.renderActions();
            }
        });

        return root;
    }

    private createUIStructure(root: ShadowRoot | HTMLElement): void {
        const container = document.createElement('div');
        container.className = 'bottombar-container';

        // Mobile toggle button
        this.toggleButton = document.createElement('button');
        this.toggleButton.className = 'mobile-toggle';
        this.toggleButton.innerHTML = `
            <span class="toggle-icon">▲</span>
            <span class="toggle-label">Actions</span>
        `;
        this.toggleButton.addEventListener('click', () => this.toggleExpanded());
        container.appendChild(this.toggleButton);

        // Tab switcher for combat types
        const tabSwitcher = document.createElement('div');
        tabSwitcher.className = 'tab-switcher';
        
        const closeTab = document.createElement('button');
        closeTab.className = 'tab-button active';
        closeTab.textContent = 'Close Combat';
        closeTab.addEventListener('click', () => this.switchTab('close'));
        
        const rangedTab = document.createElement('button');
        rangedTab.className = 'tab-button';
        rangedTab.textContent = 'Ranged Combat';
        rangedTab.addEventListener('click', () => this.switchTab('ranged'));
        
        tabSwitcher.appendChild(closeTab);
        tabSwitcher.appendChild(rangedTab);
        container.appendChild(tabSwitcher);

        // Actions container
        this.actionsContainer = document.createElement('div');
        this.actionsContainer.className = 'actions-container';
        container.appendChild(this.actionsContainer);

        root.appendChild(container);
        
        // Hide initially if no character selected
        this.updateDisplay();
    }

    private updateDisplay(): void {
        const container = this.shadowRoot?.querySelector('.bottombar-container') as HTMLElement;
        if (!container) return;

        if (this.selectedCharacter) {
            container.style.display = 'flex';
        } else {
            container.style.display = 'none';
        }
    }

    private toggleExpanded(): void {
        this.isExpanded = !this.isExpanded;
        const container = this.shadowRoot?.querySelector('.bottombar-container') as HTMLElement;
        const toggleIcon = this.toggleButton?.querySelector('.toggle-icon') as HTMLElement;
        
        if (container) {
            container.classList.toggle('expanded', this.isExpanded);
        }
        
        if (toggleIcon) {
            toggleIcon.textContent = this.isExpanded ? '▼' : '▲';
        }
    }

    private switchTab(tab: 'close' | 'ranged'): void {
        this.currentTab = tab;
        
        // Update tab buttons
        const tabs = this.shadowRoot?.querySelectorAll('.tab-button');
        tabs?.forEach((tabButton, index) => {
            if (index === 0) { // Close combat tab
                tabButton.classList.toggle('active', tab === 'close');
            } else { // Ranged combat tab
                tabButton.classList.toggle('active', tab === 'ranged');
            }
        });
        
        this.renderActions();
    }

    private renderActions(): void {
        if (!this.actionsContainer || !this.actionData) return;

        // Clear existing content
        this.actionsContainer.innerHTML = '';

        // Filter categories based on current tab
        const relevantCategories = this.actionData.categories.filter(category => {
            if (this.currentTab === 'close') {
                return category.name === 'General' || category.name === 'Close Combat';
            } else {
                return category.name === 'General' || category.name === 'Ranged Combat';
            }
        });

        // Create action grid
        const actionGrid = document.createElement('div');
        actionGrid.className = 'action-grid';

        relevantCategories.forEach(category => {
            category.actions.forEach(action => {
                const button = this.createActionButton(action);
                actionGrid.appendChild(button);
            });
        });

        this.actionsContainer.appendChild(actionGrid);
    }

    private createActionButton(action: ActionUpdateData['categories'][0]['actions'][0]): HTMLButtonElement {
        const button = document.createElement('button');
        button.className = 'action-button';
        button.dataset.actionId = action.id;

        // Special handling for movement action
        if (action.id === 'move') {
            button.classList.add('selected'); // Pre-selected
        }

        const cost = this.getActionCost(action.id);
        const pointsLeft = this.actionData?.characterActions.pointsLeft || 0;

        button.innerHTML = `
            <span class="action-icon">${action.icon}</span>
            <span class="action-label">${action.label}</span>
            <span class="action-cost">${cost}</span>
        `;

        // Disable if not enough points
        if (cost > pointsLeft) {
            button.classList.add('disabled');
            button.disabled = true;
        }

        // Disable shoot action if no ranged weapon
        if (action.id === 'shoot' && this.actionData?.hasRangedWeapon === false) {
            button.classList.add('disabled');
            button.disabled = true;
            button.title = 'Requires ranged weapon';
        }

        // Add click handler
        button.addEventListener('click', () => {
            if (this.selectedCharacter) {
                // Remove selected class from all buttons
                this.actionsContainer?.querySelectorAll('.action-button').forEach(btn => {
                    btn.classList.remove('selected');
                });
                
                // Add selected class to clicked button
                button.classList.add('selected');

                // Dispatch action selected event
                this.dispatch(ActionEvent.selected, {
                    action: action.id,
                    characterName: this.selectedCharacter.name
                });
            }
        });

        return button;
    }

    private getActionCost(actionId: string): number {
        if (!this.actionData) return 0;
        
        const actionCosts: Record<string, number> = {
            // General
            'move': this.actionData.characterActions.general.move,
            'talk': this.actionData.characterActions.general.talk,
            'use': this.actionData.characterActions.general.use,
            'rotate': this.actionData.characterActions.general.rotate,
            'inventory': this.actionData.characterActions.general.inventory,
            // Ranged Combat
            'shoot': this.actionData.characterActions.rangedCombat.shoot,
            'aim': this.actionData.characterActions.rangedCombat.aim,
            'suppress': this.actionData.characterActions.rangedCombat.suppress,
            'cover': this.actionData.characterActions.rangedCombat.cover,
            'throw': this.actionData.characterActions.rangedCombat.throw,
            // Close Combat
            'power-strike': this.actionData.characterActions.closeCombat.powerStrike,
            'slash': this.actionData.characterActions.closeCombat.slash,
            'fast-attack': this.actionData.characterActions.closeCombat.fastAttack,
            'feint': this.actionData.characterActions.closeCombat.feint,
            'break-guard': this.actionData.characterActions.closeCombat.breakGuard
        };

        return actionCosts[actionId] || 0;
    }

    // Custom element setup
    static {
        if (!customElements.get('bottombar-component')) {
            customElements.define('bottombar-component', BottomBar);
        }
    }
}