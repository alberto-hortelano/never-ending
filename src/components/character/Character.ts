import { ControlsEvent, GUIEvent, ControlsEventsMap, StateChangeEvent } from "../../common/events";
import { Component } from "../Component";
import type Movable from "../movable/Movable";
import "../movable/Movable";
import { CharacterService } from "../../common/services/CharacterService";
import { NetworkService } from "../../common/services/NetworkService";

// Type for character event with network flag
interface NetworkCharacterEvent {
    fromNetwork?: boolean;
    [key: string]: unknown;
}

export default class Character extends Component {
    protected override hasCss = true;
    protected override hasHtml = true;
    private movable?: HTMLElement;
    private characterElement?: HTMLElement;
    private player: string = '';
    private currentTurn: string = '';
    private isShootingMode: boolean = false;
    private root?: ShadowRoot;
    private networkService: NetworkService = NetworkService.getInstance();

    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;
        
        // Store the shadow root reference for later use
        this.root = root;

        // Initialize from dataset
        const { race, player, palette, direction, position } = CharacterService.initializeFromDataset(this.dataset);
        this.player = player;

        // Set up DOM elements
        this.listen(ControlsEvent.moveCharacter, caracter => this.onMoveCharacter(caracter), this.id);
        this.characterElement = root.getElementById('character') as HTMLElement;
        this.movable = root.getElementById('movable') as Movable;

        // Apply character race
        if (this.characterElement) {
            this.characterElement.classList.add(race);

            // Set initial direction
            if (direction) {
                const directionClass = CharacterService.getDirectionClass(direction);
                this.characterElement.classList.add(directionClass);
            }
        }

        // Set position
        if (this.movable) {
            this.movable.dataset.x = `${position.x}`;
            this.movable.dataset.y = `${position.y}`;
        }

        // Apply palette styles
        CharacterService.applyPaletteStyles(this, palette);
        this.movable.addEventListener("transitionend", () => {
            this.characterElement?.classList.remove('walk');
            this.dispatch(GUIEvent.movementEnd, this.id);
        });
        this.addEventListener('click', () => {
            if (this.isShootingMode) {
                // In shooting mode, dispatch character click event
                const position = CharacterService.getPositionFromDataset(this.movable!.dataset);
                this.dispatch(ControlsEvent.characterClick, {
                    characterName: this.id,
                    position
                });
            } else if (this.canControlThisCharacter()) {
                this.dispatch(ControlsEvent.showActions, this.id);
            }
        });

        // Get initial turn from CharacterService singleton
        try {
            const characterService = CharacterService.getInstance();
            const currentTurn = characterService.getCurrentTurn();
            if (currentTurn) {
                this.currentTurn = currentTurn;
                this.updateTurnIndicator();
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
            // CharacterService not initialized yet - will get turn from state change event
        }

        // Listen for turn changes
        this.listen(StateChangeEvent.game, (game) => {
            this.currentTurn = game.turn;
            requestAnimationFrame(() => this.updateTurnIndicator());
        });
        
        // Listen for character position changes from state (for multiplayer sync)
        this.listen(StateChangeEvent.characterPosition, (character) => {
            if (character.name === this.id) {
                // Check if this is a network update
                const networkCharacter = character as NetworkCharacterEvent;
                const isNetworkUpdate = networkCharacter.fromNetwork;
                
                // For network updates, we now rely on path-based movement through Movement.ts
                // This ensures smooth animation instead of jumping
                // Direct position updates are only used for teleportation or initial placement
            }
        });

        // Listen for health changes
        this.listen(StateChangeEvent.characterHealth, (character) => {
            // Only update if this component represents the character being damaged
            if (character.name === this.id && this.root) {
                this.updateHealthBar(character.health, character.maxHealth);
            }
        });

        // Listen for character defeat
        this.listen(StateChangeEvent.characterDefeated, (character) => {
            if (character.name === this.id) {
                this.onDefeated();
            }
        }, this.id);

        // Initialize health bar
        const health = parseInt(this.dataset.health || '100');
        const maxHealth = parseInt(this.dataset.maxHealth || '100');

        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
            this.updateHealthBar(health, maxHealth);
        });

        // Listen for shooting mode changes
        this.listen(GUIEvent.shootingModeStart, () => {
            this.isShootingMode = true;
            this.classList.add('shooting-mode');
        });

        this.listen(GUIEvent.shootingModeEnd, () => {
            this.isShootingMode = false;
            this.classList.remove('shooting-mode');
        });

        return root;
    }

    private canControlThisCharacter(): boolean {
        // In multiplayer, check if this character belongs to the current network player
        // and it's their turn
        const networkPlayerId = this.networkService.getPlayerId();

        if (networkPlayerId) {
            // Multiplayer mode: must be this player's character AND their turn
            return this.player === networkPlayerId && this.player === this.currentTurn;
        } else {
            // Single player mode: use normal turn logic
            return CharacterService.canControlCharacter(this.player, this.currentTurn);
        }
    }


    private onMoveCharacter(character: ControlsEventsMap[ControlsEvent.moveCharacter]) {
        if (!this.movable || !this.characterElement) return;

        const currentPosition = CharacterService.getPositionFromDataset(this.movable.dataset);

        const movementData = CharacterService.calculateMovementData(
            currentPosition,
            character.position,
            character.direction
        );

        // Update direction
        this.characterElement.classList.remove(...CharacterService.getDirectionClasses());
        this.characterElement.classList.add(movementData.directionClass);

        // Add walk animation if moving
        if (movementData.isMoving) {
            this.characterElement.classList.add('walk');
        }

        // Update position
        this.movable.dataset.x = `${movementData.position.x}`;
        this.movable.dataset.y = `${movementData.position.y}`;
    }

    private updateTurnIndicator() {
        const shouldShowIndicator = CharacterService.shouldShowTurnIndicator(this.player, this.currentTurn);
        this.characterElement?.classList.toggle('current-player', shouldShowIndicator);

        // In multiplayer, also show if this character belongs to the current network player
        const networkPlayerId = this.networkService.getPlayerId();
        if (networkPlayerId) {
            const isMyCharacter = this.player === networkPlayerId;
            this.characterElement?.classList.toggle('my-character', isMyCharacter);
            this.characterElement?.classList.toggle('opponent-character', !isMyCharacter);
        }
    }

    private updateHealthBar(health: number, maxHealth: number) {
        if (!this.root) {
            console.error('No root shadow DOM found in updateHealthBar');
            return;
        }

        const healthBarFill = this.root.querySelector('.health-bar-fill') as HTMLElement;

        if (healthBarFill) {
            const percentage = Math.max(0, (health / maxHealth) * 100);
            healthBarFill.style.width = `${percentage}%`;

            // Change color based on health percentage
            if (percentage > 60) {
                healthBarFill.style.backgroundColor = '#4CAF50'; // Green
            } else if (percentage > 30) {
                healthBarFill.style.backgroundColor = '#FFA726'; // Orange
            } else {
                healthBarFill.style.backgroundColor = '#F44336'; // Red
            }
        } else {
            console.error('Health bar fill element not found in shadow DOM');
        }
    }

    private onDefeated() {
        // Add defeated visual state
        this.characterElement?.classList.add('defeated');

        // Disable interaction
        this.style.pointerEvents = 'none';

        // Optional: add defeat animation
        this.characterElement?.style.setProperty('opacity', '0.5');
        this.characterElement?.style.setProperty('filter', 'grayscale(1)');
    }

}

customElements.define('character-component', Character);
