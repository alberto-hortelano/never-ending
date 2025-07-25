import { ControlsEvent, StateChangeEvent, UpdateStateEvent } from "../../common/events";
import { Component } from "../Component";
import type Movable from "../movable/Movable";
import "../movable/Movable";
import { CharacterService } from "../../common/services/CharacterService";
import { NetworkService } from "../../common/services/NetworkService";
import type { ICharacterVisualState, Direction } from "../../common/interfaces";

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
    private weaponElement?: HTMLElement;
    private currentVisualState: ICharacterVisualState | null = null;

    constructor() {
        super();
    }

    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) {
            console.error('[Character] No root returned from super.connectedCallback');
            return root;
        }

        // Store the shadow root reference for later use
        this.root = root;

        // Initialize from dataset
        const { race, player, palette, direction, position } = CharacterService.initializeFromDataset(this.dataset);
        this.player = player;

        // Set up DOM elements
        this.characterElement = root.getElementById('character') as HTMLElement;
        this.movable = root.getElementById('movable') as Movable;
        this.weaponElement = root.querySelector('.weapon') as HTMLElement;

        // Initialize visual state in UI state
        const initialVisualState: Partial<ICharacterVisualState> = {
            direction: direction || 'down',
            classList: [race],
            styles: {
                '--x': `${position.x}`,
                '--y': `${position.y}`,
                '--skin': palette.skin,
                '--helmet': palette.helmet,
                '--suit': palette.suit
            },
            healthBarPercentage: 100,
            healthBarColor: '#4ade80',
            isDefeated: false,
            isCurrentTurn: false
        };

        // Dispatch initial visual state (skip if preview mode)
        if (!this.dataset.isPreview) {
            this.dispatch(UpdateStateEvent.uiCharacterVisual, {
                characterId: this.id,
                visualState: initialVisualState
            });
        }

        // Listen for visual state changes (skip if preview mode)
        if (!this.dataset.isPreview) {
            this.listen(StateChangeEvent.uiVisualStates, (visualStates) => {
                const myVisualState = visualStates.characters[this.id];
                if (myVisualState) {
                    this.applyVisualState(myVisualState as ICharacterVisualState);
                }
            });
        }

        // Apply initial action if in preview mode
        if (this.dataset.isPreview && this.dataset.action && this.characterElement) {
            this.characterElement.classList.add(this.dataset.action);
        }

        // Remove the transitionend listener - walk class removal is handled by AnimationService
        // when the full movement animation completes, not when individual transitions end
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
                const color = CharacterService.calculateHealthColor(percentage);

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

        // Listen for character direction changes
        this.listen(StateChangeEvent.characterDirection, (character) => {
            if (character.name === this.id) {
                this.updateDirection(character.direction);
            }
        });

        // Initialize health bar
        const health = parseInt(this.dataset.health || '100');
        const maxHealth = parseInt(this.dataset.maxHealth || '100');
        const percentage = Math.max(0, (health / maxHealth) * 100);
        const color = CharacterService.calculateHealthColor(percentage);

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

    // Public method to update character appearance
    public updateAppearance(race: string, palette: { skin: string; helmet: string; suit: string }, direction: string, action?: string, weapon?: string) {
        if (!this.characterElement || !this.root) {
            return;
        }

        // Store current action class - use the provided action parameter directly
        const currentActionClass = action;

        // Update race class
        this.characterElement.className = 'character';
        this.characterElement.classList.add(race);

        // Update direction
        const directionClass = CharacterService.getDirectionClass(direction as Direction);
        this.characterElement.classList.add(directionClass);

        // Apply action class
        if (currentActionClass) {
            this.characterElement.classList.add(currentActionClass);
        }

        // Update palette on the host element (this component)
        if (palette && typeof palette === 'object') {
            this.style.setProperty('--skin', palette.skin || '#E5B887');
            this.style.setProperty('--helmet', palette.helmet || '#4A5568');
            this.style.setProperty('--suit', palette.suit || '#2D3748');

            // Update dataset with new palette values
            this.dataset.skin = palette.skin;
            this.dataset.helmet = palette.helmet;
            this.dataset.suit = palette.suit;
        }

        // Update weapon
        if (this.dataset.isPreview) {
            // In preview mode, handle weapon classes directly without updateCharacterClasses
            if (weapon && currentActionClass === 'shoot') {
                this.characterElement.classList.add(weapon);
            }
        } else {
            this.updateWeaponDisplay(weapon);
        }
    }

    private updateWeaponDisplay(weapon?: string) {
        if (!this.weaponElement) return;

        // Remove all weapon classes
        this.weaponElement.className = 'weapon';

        if (weapon) {
            // Store weapon class in visual state if we have one
            if (this.currentVisualState) {
                this.currentVisualState.weaponClass = weapon;
            }
            // Update classes to include weapon
            this.updateCharacterClasses();
        } else {
            if (this.currentVisualState) {
                this.currentVisualState.weaponClass = undefined;
            }
            this.updateCharacterClasses();
        }
    }

    private updateCharacterClasses() {
        if (!this.characterElement) return;

        // Start with base class
        const classes = ['character'];

        // Add race class
        const race = this.dataset.race || 'human';
        classes.push(race);

        // Add visual state classes if available
        if (this.currentVisualState) {
            // Add direction class
            const directionClass = CharacterService.getDirectionClass(this.currentVisualState.direction);
            classes.push(directionClass);

            // Add persistent classes from visual state
            classes.push(...this.currentVisualState.classList);

            // Add temporary classes (like 'shoot')
            if (this.currentVisualState.temporaryClasses) {
                classes.push(...this.currentVisualState.temporaryClasses);
            }

            // Add weapon class if equipped
            if (this.currentVisualState.weaponClass) {
                classes.push(this.currentVisualState.weaponClass);
            }

            // Add state-based classes
            if (this.currentVisualState.isCurrentTurn) {
                classes.push('current-player');
            }
            if (this.currentVisualState.isMyCharacter) {
                classes.push('my-character');
            }
            if (this.currentVisualState.isOpponentCharacter) {
                classes.push('opponent-character');
            }
            if (this.currentVisualState.isDefeated) {
                classes.push('defeated');
            }
        }


        // Apply all classes at once
        this.characterElement.className = classes.join(' ');
    }

    private updateDirection(direction: Direction) {
        if (!this.characterElement) return;

        // Get current character state
        const race = this.dataset.race || 'human';
        const palette = {
            skin: this.dataset.skin || 'white',
            helmet: this.dataset.helmet || 'black',
            suit: this.dataset.suit || 'red'
        };

        // Update the character's visual appearance with new direction
        this.updateAppearance(race, palette, direction);

        // Update the dataset for consistency
        this.dataset.direction = direction;

        // Update visual state
        this.dispatch(UpdateStateEvent.uiCharacterVisual, {
            characterId: this.id,
            visualState: {
                direction: direction
            }
        });
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
        if (!this.characterElement || !this.movable) return;


        // Store the visual state for class management
        this.currentVisualState = visualState;

        // Update all classes using centralized method
        this.updateCharacterClasses();

        // Update styles
        if (visualState.styles) {
            Object.entries(visualState.styles).forEach(([prop, value]) => {
                if (prop === '--x' || prop === '--y') {
                    // Position updates for movable element
                    const coord = prop === '--x' ? 'x' : 'y';
                    this.movable!.dataset[coord] = value;
                } else if (prop === '--skin' || prop === '--helmet' || prop === '--suit') {
                    // Palette updates on the component itself
                    this.style.setProperty(prop, value);
                    // Also update the dataset to keep it in sync
                    const paletteKey = prop.substring(2); // Remove '--' prefix
                    this.dataset[paletteKey] = value;
                } else if (prop.startsWith('--')) {
                    // Other CSS custom properties
                    this.style.setProperty(prop, value);
                }
            });
        }

        // Update health bar
        this.updateHealthBar(visualState.healthBarPercentage, visualState.healthBarColor);

        // Update interaction state
        this.style.pointerEvents = visualState.isDefeated ? 'none' : '';

        // Update weapon display
        if (visualState.equippedWeapon !== undefined) {
            this.updateWeaponDisplay(visualState.equippedWeapon);
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
