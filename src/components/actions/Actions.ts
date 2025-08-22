import { Component } from "../Component";
import { ActionEvent, ActionEventsMap, ActionUpdateData, StateChangeEvent } from "../../common/events";
import { i18n } from "../../common/i18n/i18n";

export class Actions extends Component {
    protected override hasCss = true;
    protected override hasHtml = false;
    private actionsGrid?: HTMLElement;
    private selectedCharacter?: string;
    private meleeOnly = false;
    private isInShootingMode = false;

    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;

        // Check if this is melee-only mode
        this.meleeOnly = this.hasAttribute('melee-only');

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
        
        // Listen for interaction mode changes to track shooting mode
        this.listen(StateChangeEvent.uiInteractionMode, (mode) => {
            const wasInShootingMode = this.isInShootingMode;
            this.isInShootingMode = mode.type === 'shooting';
            
            // Re-render if shooting mode changed
            if (wasInShootingMode !== this.isInShootingMode) {
                const state = this.getState();
                if (state?.ui.selectedCharacter) {
                    this.dispatch(ActionEvent.request, state.ui.selectedCharacter);
                }
            }
        });
        
        // Listen for language changes
        this.listen(StateChangeEvent.language, () => {
            // Re-render with new translations
            const state = this.getState();
            if (state?.ui.selectedCharacter) {
                this.dispatch(ActionEvent.request, state.ui.selectedCharacter);
            }
        });
    }

    static get observedAttributes() {
        return ['melee-only'];
    }

    attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null) {
        if (name === 'melee-only') {
            this.meleeOnly = newValue !== null;
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

        const row = document.createElement('div');
        row.className = 'action-row';

        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'action-buttons';

        if (this.meleeOnly) {
            // Show only melee actions
            const meleeCategory = data.categories.find(cat => 
                cat.name.toUpperCase() === 'CLOSE COMBAT'
            );
            
            if (meleeCategory) {
                meleeCategory.actions.forEach(action => {
                    // Skip the melee toggle button in melee-only mode
                    if (action.id !== 'melee') {
                        const button = this.createActionButton(action, data);
                        buttonsContainer.appendChild(button);
                    }
                });
            }
        } else {
            // Show general and ranged actions, but save melee button for last
            let meleeButton: HTMLButtonElement | null = null;
            
            data.categories.forEach(category => {
                if (category.name.toUpperCase() !== 'CLOSE COMBAT') {
                    category.actions.forEach(action => {
                        if (action.id === 'melee') {
                            // Create melee button but don't add it yet
                            meleeButton = this.createMeleeToggleButton(action, data);
                        } else if (action.id === 'shoot' && this.isInShootingMode) {
                            // Transform shoot button to aim if in shooting mode
                            const aimAction = { ...action, id: 'aim', label: i18n.t('action.aim'), icon: '🎯' };
                            const button = this.createActionButton(aimAction, data);
                            buttonsContainer.appendChild(button);
                        } else {
                            const button = this.createActionButton(action, data);
                            buttonsContainer.appendChild(button);
                        }
                    });
                }
            });
            
            // Add melee button at the end
            if (meleeButton) {
                buttonsContainer.appendChild(meleeButton);
            }
        }

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
            button.title = i18n.t('action.requiresRangedWeapon');
        }

        // Add click handler
        button.addEventListener('click', () => {
            // Handle shoot/aim transformation
            if (action.id === 'shoot') {
                this.isInShootingMode = true;
                // Dispatch the shoot action
                this.dispatch(ActionEvent.selected, {
                    action: 'shoot',
                    characterName: data.characterName
                });
                // Re-render to show aim button
                const state = this.getState();
                if (state?.ui.selectedCharacter) {
                    this.dispatch(ActionEvent.request, state.ui.selectedCharacter);
                }
            } else if (action.id === 'aim') {
                // Aim uses the showAiming event
                this.dispatch(ActionEvent.selected, {
                    action: 'aim',
                    characterName: data.characterName
                });
            } else {
                // All other actions
                this.dispatch(ActionEvent.selected, {
                    action: action.id,
                    characterName: data.characterName
                });
            }

            // Dispatch custom event to notify parent
            this.dispatchEvent(new CustomEvent('action-selected', {
                detail: { action: action.id, characterName: data.characterName },
                bubbles: true
            }));
        });

        return button;
    }

    private createMeleeToggleButton(action: ActionUpdateData['categories'][0]['actions'][0], data: ActionUpdateData): HTMLButtonElement {
        const button = document.createElement('button');
        button.className = 'action-button melee-toggle';
        button.dataset.actionId = action.id;

        const icon = document.createElement('span');
        icon.className = 'action-icon';
        icon.textContent = action.icon;

        const label = document.createElement('span');
        label.className = 'action-label';
        label.textContent = action.label;

        // Add toggle indicator instead of cost
        const toggleIndicator = document.createElement('span');
        toggleIndicator.className = 'toggle-indicator';
        toggleIndicator.textContent = '▼'; // Down arrow when closed
        
        // Check if melee is currently open
        const bottomBar = document.querySelector('bottom-bar');
        const meleeContainer = bottomBar?.shadowRoot?.querySelector('.melee-actions-container') as HTMLElement;
        if (meleeContainer && meleeContainer.style.display === 'flex') {
            button.classList.add('active');
            toggleIndicator.textContent = '▲'; // Up arrow when open
        }

        button.appendChild(icon);
        button.appendChild(label);
        button.appendChild(toggleIndicator);

        // Add click handler
        button.addEventListener('click', () => {
            // Toggle the active state
            button.classList.toggle('active');
            const isActive = button.classList.contains('active');
            toggleIndicator.textContent = isActive ? '▲' : '▼';
            
            // Dispatch the toggle event
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
            'inventory': characterActions.general.inventory,
            'melee': 0, // Melee toggle is free
            // Ranged Combat
            'shoot': characterActions.rangedCombat.shoot,
            'aim': characterActions.rangedCombat.aim,
            'overwatch': characterActions.rangedCombat.overwatch,
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