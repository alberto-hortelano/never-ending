import { ControlsEvent, StateChangeEvent, UpdateStateEvent } from "../../common/events";
import { Component } from "../Component";
import type Movable from "../movable/Movable";
import "../movable/Movable";
import { CharacterService } from "../../common/services/CharacterService";
import { NetworkService } from "../../common/services/NetworkService";
import type { ICharacterVisualState, Direction, ICharacter } from "../../common/interfaces";
import type { DeepReadonly } from "../../common/helpers/types";

export default class Character extends Component {
    protected override hasCss = true;
    protected override hasHtml = true;
    private movable?: HTMLElement;
    private characterElement?: HTMLElement;
    private player: string = '';
    private currentTurn: string = '';
    private isShootingMode: boolean = false;
    private isMeleeMode: boolean = false;
    private root?: ShadowRoot;
    private networkService: NetworkService = NetworkService.getInstance();
    private weaponElement?: HTMLElement;
    private currentVisualState: ICharacterVisualState | null = null;
    private _currentDirection: Direction = 'down'; // Store direction for standalone mode
    private previewData: DeepReadonly<ICharacter> | null = null; // Lightweight preview data

    // Getter for current direction (useful for standalone mode)
    public get currentDirection(): Direction {
        return this._currentDirection;
    }

    // Check if this is a preview component
    private get isPreview(): boolean {
        // Check if marked as preview or has preview data or instance state
        return this.hasAttribute('data-preview') || this.previewData !== null || this.getState() !== Component.gameState;
    }

    // Check if this is a standalone preview (no state at all)
    private get isStandalone(): boolean {
        return this.hasAttribute('data-standalone');
    }

    constructor() {
        super();
    }

    disconnectedCallback() {
        // Clean up when component is removed
        if (this.isPreview) {
            // Clear preview data to allow garbage collection
            this.previewData = null;

            // If we still have an instance state (legacy), clear it
            if (this.getState() !== Component.gameState) {
                const state = this.getState();
                if (state) {
                    state.remove(state); // Remove the state's own listeners
                }
                this.setInstanceState(null);
            }
        }
        // Remove this component's listeners from EventBus
        this.eventBus.remove(this);
    }

    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) {
            console.error('[Character] No root returned from super.connectedCallback');
            return root;
        }

        // Store the shadow root reference for later use
        this.root = root;

        // Set up DOM elements
        this.characterElement = root.getElementById('character') as HTMLElement;
        this.movable = root.getElementById('movable') as Movable;
        this.weaponElement = root.querySelector('.weapon') as HTMLElement;

        // If standalone, just setup basic display and wait for updateAppearance calls
        if (this.isStandalone) {
            return root;
        }

        // If we have preview data, use it instead of looking up in state
        if (this.previewData) {
            this.applyPreviewData();
            return root;
        }

        // Get character data from state
        const state = this.getState();
        // For preview characters with IDs like "icon-data", extract the actual character name
        const characterName = this.id.startsWith('icon-') ? this.id.substring(5) : this.id;
        const stateCharacter = state?.findCharacter(characterName);

        if (!stateCharacter) {
            console.error(`Character ${this.id} not found in state`);
            return root;
        }

        // Extract all data from state
        const { race, player, palette, direction, position, health, maxHealth } = stateCharacter;
        this.player = player;

        const healthPercentage = Math.max(0, (health / maxHealth) * 100);
        const isDefeated = health <= 0;

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
            healthBarPercentage: healthPercentage,
            healthBarColor: CharacterService.calculateHealthColor(healthPercentage),
            isDefeated: isDefeated,
            isCurrentTurn: false
        };

        // Dispatch initial visual state (skip if preview mode)
        if (!this.isPreview) {
            this.dispatch(UpdateStateEvent.uiCharacterVisual, {
                characterId: this.id,
                visualState: initialVisualState
            });
        }

        // Listen for visual state changes (skip if preview mode)
        if (!this.isPreview) {
            this.listen(StateChangeEvent.uiVisualStates, (visualStates) => {
                const myVisualState = visualStates.characters[this.id];
                if (myVisualState) {
                    this.applyVisualState(myVisualState as ICharacterVisualState);
                }
            });
        }

        // Apply initial action if in preview mode
        if (this.isPreview && stateCharacter.action && this.characterElement) {
            this.characterElement.classList.add(stateCharacter.action);
        }

        // Remove the transitionend listener - walk class removal is handled by AnimationService
        // when the full movement animation completes, not when individual transitions end
        
        // Click handler for desktop
        const handleInteraction = () => {
            if (this.isShootingMode || this.isMeleeMode) {
                // In shooting or melee mode, dispatch character click event
                this.dispatch(ControlsEvent.characterClick, {
                    characterName: this.id,
                    position: stateCharacter.position
                });
            } else if (this.canControlThisCharacter()) {
                // If clicking on own character, show actions
                this.dispatch(ControlsEvent.showActions, this.id);
            } else {
                // If clicking on another character (NPC or enemy), trigger talk
                const currentPlayer = this.getState()?.game.turn;
                if (currentPlayer && stateCharacter.player !== currentPlayer) {
                    // Get the current selected character to perform the talk action
                    const selectedCharacter = this.getState()?.ui.selectedCharacter;
                    if (selectedCharacter) {
                        this.dispatch(ControlsEvent.talk, selectedCharacter);
                    }
                }
            }
        };
        
        // Add both click and touch listeners
        this.addEventListener('click', handleInteraction);
        this.addEventListener('touchstart', (e) => {
            e.preventDefault(); // Prevent default touch behavior
            handleInteraction();
        });

        // Get initial turn from state
        const gameState = this.getState();
        if (gameState) {
            this.currentTurn = gameState.game.turn;
            this.updateTurnIndicator();
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
                        // Note: NOT setting isDefeated here - that's handled by the defeated event
                    }
                });
            }
        });

        // Listen for character defeat
        this.listen(StateChangeEvent.characterDefeated, (character) => {
            if (character.name === this.id) {
                this.onDefeated();
            }
        });

        // Listen for character direction changes
        this.listen(StateChangeEvent.characterDirection, (character) => {
            if (character.name === this.id) {
                this.updateDirection(character.direction);
            }
        });

        // Initialize health bar
        // Already have health data from above, reuse it
        const healthPercent = healthPercentage;
        const healthColor = CharacterService.calculateHealthColor(healthPercent);

        // Update health in visual state
        this.dispatch(UpdateStateEvent.uiCharacterVisual, {
            characterId: this.id,
            visualState: {
                healthBarPercentage: healthPercent,
                healthBarColor: healthColor
            }
        });

        // Listen for interaction mode changes
        this.listen(StateChangeEvent.uiInteractionMode, (mode) => {
            this.isShootingMode = mode.type === 'shooting';
            this.isMeleeMode = mode.type === 'melee';

            // Update visual state to reflect combat modes
            if (this.isShootingMode) {
                this.classList.add('shooting-mode');
                this.classList.remove('melee-mode');
            } else if (this.isMeleeMode) {
                this.classList.add('melee-mode');
                this.classList.remove('shooting-mode');
            } else {
                this.classList.remove('shooting-mode');
                this.classList.remove('melee-mode');
            }
        });

        return root;
    }

    // Public method to update character appearance
    public updateAppearance(race: string, palette: { skin: string; helmet: string; suit: string }, direction: string, action?: string, weapon?: string) {
        if (!this.characterElement || !this.root) {
            return;
        }

        // Store direction for standalone mode
        this._currentDirection = direction as Direction;

        // Remove old rotation classes
        const allRotationClasses = CharacterService.getDirectionClasses();
        allRotationClasses.forEach(cls => {
            this.characterElement!.classList.remove(cls);
        });

        // Remove old race classes
        ['human', 'robot', 'alien'].forEach(r => {
            if (r !== race) {
                this.characterElement!.classList.remove(r);
            }
        });

        // Remove old action classes
        ['idle', 'walk', 'shoot'].forEach(a => {
            if (a !== action) {
                this.characterElement!.classList.remove(a);
            }
        });

        // Ensure base class is present
        if (!this.characterElement.classList.contains('character')) {
            this.characterElement.classList.add('character');
        }

        // Add race class
        this.characterElement.classList.add(race);

        // Add direction/rotation class
        const directionClass = CharacterService.getDirectionClass(direction as Direction);
        this.characterElement.classList.add(directionClass);

        // Apply action class
        if (action && this.characterElement) {
            // Remove all possible action classes first
            const allActions = ['idle', 'walk', 'shoot', 'powerStrike', 'slash', 'fastAttack', 'feint', 'breakGuard', 'defeated'];
            allActions.forEach(a => this.characterElement!.classList.remove(a));
            // Add the current action
            this.characterElement.classList.add(action);
        }

        // Update palette on the host element (this component)
        if (palette && typeof palette === 'object') {
            this.style.setProperty('--skin', palette.skin || '#E5B887');
            this.style.setProperty('--helmet', palette.helmet || '#4A5568');
            this.style.setProperty('--suit', palette.suit || '#2D3748');
        }

        // Update weapon
        if (this.isPreview || this.isStandalone) {
            // In preview/standalone mode, handle weapon classes directly
            // First remove all weapon classes
            const allWeapons = ['pistol', 'sword', 'knife', 'rifle', 'polearm', 'shotgun', 'smg'];
            allWeapons.forEach(w => this.characterElement?.classList.remove(w));

            // Then add the current weapon if needed
            const meleeActions = ['powerStrike', 'slash', 'fastAttack', 'feint', 'breakGuard'];
            const showWeapon = weapon && (action === 'shoot' || meleeActions.includes(action || ''));
            if (showWeapon) {
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

        // Add race class from state
        const state = this.getState();
        // For preview characters with IDs like "icon-data", extract the actual character name
        const characterName = this.id.startsWith('icon-') ? this.id.substring(5) : this.id;
        const stateCharacter = state?.findCharacter(characterName);
        const race = stateCharacter?.race || 'human';
        classes.push(race);

        // Check if character is defeated
        const isDefeated = this.currentVisualState?.isDefeated;

        // Add visual state classes if available
        if (this.currentVisualState) {
            // Add direction class
            const directionClass = CharacterService.getDirectionClass(this.currentVisualState.direction);
            classes.push(directionClass);

            // Add persistent classes from visual state (but filter out action classes if defeated)
            if (!isDefeated) {
                classes.push(...this.currentVisualState.classList);
            } else {
                // If defeated, filter out action classes
                const actionClasses = ['walk', 'shoot', 'idle', 'powerStrike', 'slash', 'fastAttack', 'feint', 'breakGuard'];
                const filteredClasses = this.currentVisualState.classList.filter(cls => !actionClasses.includes(cls));
                classes.push(...filteredClasses);
            }

            // Add temporary classes (like 'shoot') only if not defeated
            if (!isDefeated && this.currentVisualState.temporaryClasses) {
                classes.push(...this.currentVisualState.temporaryClasses);
            }

            // Add weapon class if equipped (but not if defeated)
            if (!isDefeated && this.currentVisualState.weaponClass) {
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
            if (isDefeated) {
                classes.push('defeated');
            }
        }

        // Apply all classes at once
        this.characterElement.className = classes.join(' ');
    }

    private updateDirection(direction: Direction) {
        if (!this.characterElement) return;

        // Get current character state from state instead of dataset
        const state = this.getState();
        // For preview characters with IDs like "icon-data", extract the actual character name
        const characterName = this.id.startsWith('icon-') ? this.id.substring(5) : this.id;
        const stateCharacter = state?.findCharacter(characterName);
        if (!stateCharacter) return;

        const race = stateCharacter.race;
        const palette = stateCharacter.palette;

        // Update the character's visual appearance with new direction
        this.updateAppearance(race, palette, direction);

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

        // Get current turn from state for most up-to-date value
        const state = this.getState();
        const currentTurn = state?.game.turn ?? this.currentTurn;

        if (networkPlayerId) {
            // Multiplayer mode: must be this player's character AND their turn
            return this.player === networkPlayerId && this.player === currentTurn;
        } else {
            // Single player mode: use normal turn logic
            return CharacterService.canControlCharacter(this.player, currentTurn);
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
                    this.movable!.style.setProperty(prop, value);
                } else if (prop === '--skin' || prop === '--helmet' || prop === '--suit') {
                    // Palette updates on the component itself
                    this.style.setProperty(prop, value);
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
        // The defeated visual state is already being set by UIState.updateCharacterDefeated
        // which is called by the State class when it receives the characterDefeated event.
        // However, let's ensure our local visual state is updated immediately
        if (this.currentVisualState) {
            this.currentVisualState.isDefeated = true;
            // Clear any action-related temporary classes
            this.currentVisualState.temporaryClasses = [];
            // Update classes immediately
            this.updateCharacterClasses();
        }
        
        // Also ensure the character element removes action classes immediately
        if (this.characterElement) {
            const actionClasses = ['walk', 'shoot', 'idle', 'powerStrike', 'slash', 'fastAttack', 'feint', 'breakGuard'];
            actionClasses.forEach(cls => this.characterElement!.classList.remove(cls));
        }
    }

    /**
     * Set preview data for lightweight character display
     * This is more efficient than creating a full State instance
     */
    public setPreviewData(character: DeepReadonly<ICharacter>) {
        this.previewData = character;

        // If shadow root exists, update the display immediately
        if (this.root && this.characterElement) {
            this.applyPreviewData();
        }
    }

    private applyPreviewData() {
        if (!this.previewData || !this.characterElement) return;

        const character = this.previewData;

        // Apply basic appearance
        this.characterElement.className = 'character';
        this.characterElement.classList.add(character.race || 'human');
        this.characterElement.classList.add(character.action || 'idle');

        // Apply palette if available
        if (character.palette) {
            this.style.setProperty('--skin', character.palette.skin);
            this.style.setProperty('--helmet', character.palette.helmet);
            this.style.setProperty('--suit', character.palette.suit);
        }

        // Apply health bar
        const healthPercentage = Math.max(0, ((character.health ?? 100) / (character.maxHealth ?? 100)) * 100);
        this.updateHealthBar(healthPercentage, healthPercentage > 25 ? 'green' : 'red');

        // Apply direction
        this._currentDirection = character.direction || 'down';
        this.characterElement.dataset.direction = this._currentDirection;

        // Apply defeated state if needed
        if ((character.health ?? 100) <= 0) {
            this.characterElement.classList.add('defeated');
        }
    }

}

customElements.define('character-component', Character);
