import { ControlsEvent, StateChangeEvent, UpdateStateEvent } from "../../common/events";
import { Component } from "../Component";
import type Movable from "../movable/Movable";
import "../movable/Movable";
import { CharacterService } from "../../common/services/CharacterService";
import { NetworkService } from "../../common/services/NetworkService";
import type { ICharacterVisualState } from "../../common/interfaces";

// Type for character event with network flag
// interface NetworkCharacterEvent {
//     fromNetwork?: boolean;
//     [key: string]: unknown;
// }

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
    private visualState?: ICharacterVisualState;

    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;
        
        // Store the shadow root reference for later use
        this.root = root;

        // Initialize from dataset
        const { race, player, palette, direction, position } = CharacterService.initializeFromDataset(this.dataset);
        this.player = player;

        // Set up DOM elements
        this.characterElement = root.getElementById('character') as HTMLElement;
        this.movable = root.getElementById('movable') as Movable;

        // Initialize visual state in UI state
        const initialVisualState: Partial<ICharacterVisualState> = {
            direction: direction || 'down',
            classList: [race],
            styles: {
                '--x': `${position.x}`,
                '--y': `${position.y}`,
                '--palette-skin': palette.skin,
                '--palette-helmet': palette.helmet,
                '--palette-suit': palette.suit
            },
            healthBarPercentage: 100,
            healthBarColor: '#4ade80',
            isDefeated: false,
            isCurrentTurn: false
        };
        
        // Dispatch initial visual state
        this.dispatch(UpdateStateEvent.uiCharacterVisual, {
            characterId: this.id,
            visualState: initialVisualState
        });
        
        // Listen for visual state changes
        this.listen(StateChangeEvent.uiVisualStates, (visualStates) => {
            const myVisualState = visualStates.characters[this.id];
            if (myVisualState) {
                this.applyVisualState(myVisualState as ICharacterVisualState);
            }
        });
        
        this.movable.addEventListener("transitionend", () => {
            // Animation completed - update state to remove walk class
            if (this.visualState?.classList.includes('walk')) {
                const updatedClasses = this.visualState.classList.filter(c => c !== 'walk');
                this.dispatch(UpdateStateEvent.uiCharacterVisual, {
                    characterId: this.id,
                    visualState: { classList: updatedClasses }
                });
            }
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
                // const networkCharacter = character as NetworkCharacterEvent;
                // const isNetworkUpdate = networkCharacter.fromNetwork;
                
                // For network updates, we now rely on path-based movement through Movement.ts
                // This ensures smooth animation instead of jumping
                // Direct position updates are only used for teleportation or initial placement
            }
        });

        // Listen for health changes
        this.listen(StateChangeEvent.characterHealth, (character) => {
            if (character.name === this.id) {
                const percentage = Math.max(0, (character.health / character.maxHealth) * 100);
                const color = this.calculateHealthColor(percentage);
                
                this.dispatch(UpdateStateEvent.uiCharacterVisual, {
                    characterId: this.id,
                    visualState: {
                        healthBarPercentage: percentage,
                        healthBarColor: color
                    }
                });
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
        const percentage = Math.max(0, (health / maxHealth) * 100);
        const color = this.calculateHealthColor(percentage);

        // Update health in visual state
        this.dispatch(UpdateStateEvent.uiCharacterVisual, {
            characterId: this.id,
            visualState: {
                healthBarPercentage: percentage,
                healthBarColor: color
            }
        });

        // Listen for interaction mode changes
        this.listen(StateChangeEvent.uiInteractionMode, (mode) => {
            this.isShootingMode = mode.type === 'shooting';
            
            // Update visual state to reflect shooting mode
            if (this.isShootingMode) {
                this.classList.add('shooting-mode');
            } else {
                this.classList.remove('shooting-mode');
            }
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


    private applyVisualState(visualState: ICharacterVisualState) {
        this.visualState = visualState;
        
        if (!this.characterElement || !this.movable) return;
        
        // Update classes
        this.characterElement.className = 'character'; // Reset to base class
        visualState.classList.forEach(cls => {
            this.characterElement!.classList.add(cls);
        });
        
        // Add direction class
        const directionClass = CharacterService.getDirectionClass(visualState.direction);
        this.characterElement.classList.add(directionClass);
        
        // Add state-based classes
        if (visualState.isCurrentTurn) {
            this.characterElement.classList.add('current-player');
        }
        if (visualState.isMyCharacter) {
            this.characterElement.classList.add('my-character');
        }
        if (visualState.isOpponentCharacter) {
            this.characterElement.classList.add('opponent-character');
        }
        if (visualState.isDefeated) {
            this.characterElement.classList.add('defeated');
        }
        
        // Update styles
        if (visualState.styles) {
            Object.entries(visualState.styles).forEach(([prop, value]) => {
                if (prop === '--x' || prop === '--y') {
                    // Position updates for movable element
                    const coord = prop === '--x' ? 'x' : 'y';
                    this.movable!.dataset[coord] = value;
                } else if (prop.startsWith('--palette-')) {
                    // Palette updates on the component itself
                    this.style.setProperty(prop, value);
                }
            });
        }
        
        // Update health bar
        this.updateHealthBar(visualState.healthBarPercentage, visualState.healthBarColor);
        
        // Update interaction state
        this.style.pointerEvents = visualState.isDefeated ? 'none' : '';
        if (visualState.isDefeated) {
            this.characterElement.style.opacity = '0.5';
            this.characterElement.style.filter = 'grayscale(1)';
        } else {
            this.characterElement.style.opacity = '';
            this.characterElement.style.filter = '';
        }
    }

    private updateTurnIndicator() {
        const shouldShowIndicator = CharacterService.shouldShowTurnIndicator(this.player, this.currentTurn);
        const networkPlayerId = this.networkService.getPlayerId();
        const isMyCharacter = networkPlayerId ? this.player === networkPlayerId : false;
        const isOpponentCharacter = networkPlayerId ? this.player !== networkPlayerId : false;
        
        // Update visual state
        this.dispatch(UpdateStateEvent.uiCharacterVisual, {
            characterId: this.id,
            visualState: {
                isCurrentTurn: shouldShowIndicator,
                isMyCharacter,
                isOpponentCharacter
            }
        });
    }

    private updateHealthBar(percentage: number, color: string) {
        if (!this.root) return;
        
        const healthBarFill = this.root.querySelector('.health-bar-fill') as HTMLElement;
        if (healthBarFill) {
            healthBarFill.style.width = `${percentage}%`;
            healthBarFill.style.backgroundColor = color;
        }
    }
    
    private calculateHealthColor(percentage: number): string {
        if (percentage > 60) return '#4ade80'; // Green
        if (percentage > 30) return '#ffa726'; // Orange
        return '#f44336'; // Red
    }

    private onDefeated() {
        // Update visual state to defeated
        this.dispatch(UpdateStateEvent.uiCharacterVisual, {
            characterId: this.id,
            visualState: {
                isDefeated: true
            }
        });
    }

}

customElements.define('character-component', Character);
