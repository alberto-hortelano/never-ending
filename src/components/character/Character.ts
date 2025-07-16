import { ControlsEvent, GUIEvent, ControlsEventsMap, StateChangeEvent } from "../../common/events";
import { Component } from "../Component";
import type Movable from "../movable/Movable";
import "../movable/Movable";
import { CharacterService } from "../../common/services/CharacterService";

export default class Character extends Component {
    protected override hasCss = true;
    protected override hasHtml = true;
    private movable?: HTMLElement;
    private characterElement?: HTMLElement;
    private player: string = '';
    private currentTurn: string = '';
    private isShootingMode: boolean = false;
    private root?: ShadowRoot;

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
            } else if (CharacterService.canControlCharacter(this.player, this.currentTurn)) {
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
        
        // Listen for health changes
        this.listen(StateChangeEvent.characterHealth, (character) => {
            // Only update if this component represents the character being damaged
            if (character.name === this.id && this.root) {
                console.log(`Updating health bar for ${character.name}: ${character.health}/${character.maxHealth}`);
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
    }
    
    private updateHealthBar(health: number, maxHealth: number) {
        if (!this.root) {
            console.error('No root shadow DOM found in updateHealthBar');
            return;
        }
        
        const healthBarFill = this.root.querySelector('.health-bar-fill') as HTMLElement;
        console.log('Health bar fill element:', healthBarFill);
        
        if (healthBarFill) {
            const percentage = Math.max(0, (health / maxHealth) * 100);
            console.log(`Setting health bar width to ${percentage}%`);
            healthBarFill.style.width = `${percentage}%`;
            
            // Change color based on health percentage
            if (percentage > 60) {
                healthBarFill.style.backgroundColor = '#4CAF50'; // Green
            } else if (percentage > 30) {
                healthBarFill.style.backgroundColor = '#FFA726'; // Orange
            } else {
                healthBarFill.style.backgroundColor = '#F44336'; // Red
            }
            console.log('Health bar updated successfully');
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
