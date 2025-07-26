import type { DeepReadonly } from "../../common/helpers/types";
import type { ICharacter } from "../../common/interfaces";
import { Component } from "../Component";
import { StateChangeEvent, ControlsEvent, ActionEvent, ActionEventsMap, GameEvent } from "../../common/events";
import { MultiplayerManager } from "../../common/services/MultiplayerManager";

export class TopBar extends Component {
    protected override hasCss = true;
    protected override hasHtml = false;
    private selectedCharacter: DeepReadonly<ICharacter> | null = null;
    private actionPointsBar?: HTMLElement;
    private characterInfo?: HTMLElement;
    private inventoryButton?: HTMLButtonElement;
    private turnIndicatorElement?: HTMLElement;
    private currentActionPoints = 100;
    private currentTurn = '';
    private players: string[] = [];

    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;

        // Create UI structure
        this.createUIStructure(root);

        // Listen for selected character changes
        this.listen(StateChangeEvent.selectedCharacter, (character) => {
            this.selectedCharacter = character;
            this.updateDisplay();
            
            // Request action data for the selected character
            if (character) {
                this.dispatch(ActionEvent.request, character.name);
            }
        });

        // Listen for action updates (action points)
        this.listen(ActionEvent.update, (data: ActionEventsMap[ActionEvent.update]) => {
            console.log('[TopBar] ActionEvent.update received:', {
                characterName: data.characterName,
                pointsLeft: data.characterActions.pointsLeft,
                selectedCharacter: this.selectedCharacter?.name
            });
            if (this.selectedCharacter && data.characterName === this.selectedCharacter.name) {
                this.currentActionPoints = data.characterActions.pointsLeft;
                this.updateActionPoints();
            }
        });

        // Listen for game state changes (turn indicator)
        this.listen(StateChangeEvent.game, (game) => {
            this.currentTurn = game.turn;
            this.players = [...game.players];
            this.updateTurnIndicator();
        });

        return root;
    }

    private createUIStructure(root: ShadowRoot | HTMLElement): void {
        const container = document.createElement('div');
        container.className = 'topbar-container';

        // Character info section (left side)
        this.characterInfo = document.createElement('div');
        this.characterInfo.className = 'character-info';
        container.appendChild(this.characterInfo);

        // Action points display (center-left)
        this.actionPointsBar = document.createElement('div');
        this.actionPointsBar.className = 'action-points-container';
        container.appendChild(this.actionPointsBar);

        // Turn indicator (center-right)
        this.turnIndicatorElement = document.createElement('div');
        this.turnIndicatorElement.className = 'turn-indicator';
        container.appendChild(this.turnIndicatorElement);

        // Inventory button (right side)
        const rightSection = document.createElement('div');
        rightSection.className = 'right-section';
        
        this.inventoryButton = document.createElement('button');
        this.inventoryButton.className = 'inventory-button';
        this.inventoryButton.innerHTML = `
            <span class="icon">🎒</span>
            <span class="label">Inventory</span>
        `;
        this.inventoryButton.addEventListener('click', () => this.onInventoryClick());
        
        rightSection.appendChild(this.inventoryButton);
        container.appendChild(rightSection);

        root.appendChild(container);
        
        // Hide initially if no character selected
        this.updateDisplay();
    }

    private updateDisplay(): void {
        const container = this.shadowRoot?.querySelector('.topbar-container') as HTMLElement;
        if (!container) return;

        if (this.selectedCharacter) {
            container.style.display = 'flex';
            this.updateCharacterInfo();
            this.updateActionPoints();
        } else {
            container.style.display = 'none';
        }
    }

    private updateCharacterInfo(): void {
        if (!this.characterInfo || !this.selectedCharacter) return;

        this.characterInfo.innerHTML = `
            <span class="character-name">${this.selectedCharacter.name}</span>
        `;
    }

    private updateActionPoints(): void {
        if (!this.actionPointsBar || !this.selectedCharacter) return;

        const actionPoints = this.currentActionPoints;
        const maxActionPoints = 100; // Max action points is always 100
        const percentage = (actionPoints / maxActionPoints) * 100;

        this.actionPointsBar.innerHTML = `
            <div class="action-points-label">${this.selectedCharacter.name} - Action Points</div>
            <div class="action-points-bar">
                <div class="action-points-fill" style="width: ${percentage}%"></div>
                <span class="action-points-text">${actionPoints} / ${maxActionPoints}</span>
            </div>
        `;
    }

    private onInventoryClick(): void {
        if (this.selectedCharacter) {
            this.dispatch(ControlsEvent.showInventory, this.selectedCharacter.name);
        }
    }

    private updateTurnIndicator(): void {
        if (!this.turnIndicatorElement) return;

        // Check if it's the current player's turn
        const multiplayerManager = (window as any).multiplayerManager || MultiplayerManager.getInstance();
        const currentPlayerId = multiplayerManager.getCurrentPlayerId();
        const isMultiplayer = multiplayerManager.isInMultiplayerMode();
        
        let isPlayerTurn = false;
        if (isMultiplayer && currentPlayerId) {
            // In multiplayer, check if turn matches current player ID
            isPlayerTurn = this.currentTurn === currentPlayerId;
        } else {
            // In single player, check if it's human turn
            isPlayerTurn = this.currentTurn === 'human';
        }
        
        this.turnIndicatorElement.innerHTML = `
            <div class="turn-info">
                <span class="turn-label">Turn:</span>
                <span class="turn-player">${this.currentTurn || 'Loading...'}</span>
            </div>
            ${isPlayerTurn ? `
                <button class="end-turn-button" id="end-turn-button">
                    End Turn
                </button>
            ` : ''}
        `;

        // Add end turn button listener if it exists
        const endTurnButton = this.turnIndicatorElement.querySelector('.end-turn-button') as HTMLButtonElement;
        if (endTurnButton) {
            endTurnButton.addEventListener('click', () => {
                // Calculate next turn
                const currentIndex = this.players.indexOf(this.currentTurn);
                const nextIndex = (currentIndex + 1) % this.players.length;
                const nextTurn = this.players[nextIndex] || this.currentTurn;

                // Dispatch change turn event
                this.dispatch(GameEvent.changeTurn, {
                    turn: nextTurn,
                    previousTurn: this.currentTurn
                });
            });
        }
    }

    // Custom element setup
    static {
        if (!customElements.get('topbar-component')) {
            customElements.define('topbar-component', TopBar);
        }
    }
}