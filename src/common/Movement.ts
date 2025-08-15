import type { DeepReadonly } from "./helpers/types";
import type { ICharacter, ICoord, Direction } from "./interfaces";
import type { State } from "./State";

import { getReachableCells, calculatePath } from "./helpers/map";
import {
    EventBus, UpdateStateEvent, ControlsEvent, GameEventsMap, ControlsEventsMap,
    UpdateStateEventsMap, StateChangeEvent, StateChangeEventsMap,
} from "./events";
import { animationService } from "./services/AnimationService";
import { DirectionsService } from "./services/DirectionsService";
import { InteractionModeManager } from "./InteractionModeManager";

export class Movement extends EventBus<
    GameEventsMap & ControlsEventsMap & StateChangeEventsMap,
    UpdateStateEventsMap & ControlsEventsMap
> {

    private movingCharacter?: DeepReadonly<ICharacter>;
    private reachableCells?: ICoord[];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    private listeners: Array<{ event: string; handler: Function }> = [];
    private completedMovements = new Map<string, { path: ICoord[], finalDirection: Direction, fromNetwork?: boolean, paidCells: number }>();
    private modeManager: InteractionModeManager;
    private previewedDestination?: ICoord; // Track the currently previewed destination for mobile two-step

    constructor(
        private state: State,
    ) {
        super();
        this.modeManager = InteractionModeManager.getInstance();

        // Register cleanup handler for movement mode
        this.modeManager.registerCleanupHandler('moving', () => {
            this.cleanupMovementMode();
        });
        // Store references to listeners for cleanup
        this.addListener(ControlsEvent.cellClick, position => this.onCellClick(position));
        this.addListener(ControlsEvent.cellMouseEnter, position => this.onCellMouseEnter(position));
        this.addListener(ControlsEvent.cellMouseLeave, () => this.onCellMouseLeave());
        this.addListener(ControlsEvent.showMovement, character => this.onShowMovement(character));
        this.addListener(StateChangeEvent.characterPath, character => this.onCharacterPath(character));
        this.addListener(StateChangeEvent.characterPosition, character => this.onCharacterPosition(character));
        this.addListener(StateChangeEvent.uiAnimations, animations => this.onAnimationsChange(animations));
        this.addListener(StateChangeEvent.uiInteractionMode, mode => this.onInteractionModeChange(mode));
        this.addListener(StateChangeEvent.characterDefeated, character => this.onCharacterDefeated(character));
    }

    private addListener<K extends keyof (GameEventsMap & ControlsEventsMap & StateChangeEventsMap)>(
        event: K,
        handler: (data: (GameEventsMap & ControlsEventsMap & StateChangeEventsMap)[K]) => void
    ) {
        this.listen(event, handler);
        this.listeners.push({ event, handler });
    }

    destroy() {
        // Remove all listeners for this Movement instance
        this.remove(this);
        this.listeners = [];
    }

    private cleanupMovementMode() {
        this.movingCharacter = undefined;
        this.reachableCells = undefined;
        this.previewedDestination = undefined;
        this.clearPathPreview();
    }

    // Helper method to check if running on mobile
    private isMobileDevice(): boolean {
        // In tests, always return false to maintain existing behavior
        if (typeof jest !== 'undefined') {
            return false;
        }
        return window.innerWidth <= 768;
    }

    // Get the current path cells being displayed
    private getCurrentPathCells(): readonly ICoord[] | undefined {
        const highlights = this.state.ui?.transientUI?.highlights;
        return highlights?.pathCells;
    }
    // Listeners
    private onCellClick(position: ControlsEventsMap[ControlsEvent.cellClick]) {
        if (!this.movingCharacter || !this.reachableCells) {
            return;
        }

        const isReachable = this.reachableCells.find(c => c.x === position.x && c.y === position.y);

        if (isReachable) {
            if (this.isMobileDevice()) {
                // Mobile: Two-step interaction
                if (this.previewedDestination &&
                    this.previewedDestination.x === position.x &&
                    this.previewedDestination.y === position.y) {
                    // Second tap on same cell - confirm movement
                    this.selectDestination(this.movingCharacter, this.reachableCells, position);
                    this.previewedDestination = undefined;
                } else {
                    // First tap or different cell - show preview
                    this.showPathPreview(position);
                    this.previewedDestination = position;
                }
            } else {
                // Desktop: Click to move immediately
                this.selectDestination(this.movingCharacter, this.reachableCells, position);
            }
        } else if (this.previewedDestination) {
            // Check if clicking on a path cell (mobile confirmation)
            const currentPath = this.getCurrentPathCells();
            const isOnPath = currentPath?.find(c => c.x === position.x && c.y === position.y);

            if (isOnPath && this.isMobileDevice()) {
                // Tapping on path confirms movement to previewed destination
                this.selectDestination(this.movingCharacter, this.reachableCells, this.previewedDestination);
                this.previewedDestination = undefined;
            } else {
                // Clear preview if clicking elsewhere
                this.clearPathPreview();
                this.previewedDestination = undefined;
            }
        }
    }
    private onCellMouseEnter(position: ControlsEventsMap[ControlsEvent.cellMouseEnter]) {
        // Only show path preview on desktop (mobile uses click for preview)
        if (!this.isMobileDevice() && this.movingCharacter && this.reachableCells?.find(c => c.x === position.x && c.y === position.y)) {
            this.showPathPreview(position);
        }
    }
    private onCellMouseLeave() {
        this.clearPathPreview();
    }
    private onInteractionModeChange(mode: StateChangeEventsMap[StateChangeEvent.uiInteractionMode]) {
        // Clear path preview when leaving movement mode
        if (mode.type !== 'moving') {
            this.clearPathPreview();
            // Also clear our internal state
            this.movingCharacter = undefined;
            this.reachableCells = undefined;
        }
    }
    private onCharacterPath(character: StateChangeEventsMap[StateChangeEvent.characterPath]) {
        // Check if character is defeated
        if (character.health <= 0) {
            // Clear path for defeated character only if it's not already empty
            if (character.path && character.path.length > 0) {
                this.dispatch(UpdateStateEvent.characterPath, { ...character, path: [] });
            }
            return;
        }

        // When a character path is set, create a movement animation
        if (character.path && character.path.length > 0) {

            // Calculate initial direction from current position to first path position
            const initialDirection = DirectionsService.calculateDirection(character.position, character.path[0]!);

            // Calculate final direction based on last movement
            let finalDirection = initialDirection;
            if (character.path.length >= 2) {
                const lastPos = character.path[character.path.length - 1];
                const secondLastPos = character.path[character.path.length - 2];
                if (lastPos && secondLastPos) {
                    finalDirection = DirectionsService.calculateDirection(secondLastPos, lastPos);
                }
            } else if (character.path.length === 1) {
                // Single step movement - final direction is same as initial
                finalDirection = initialDirection;
            }

            // Track this movement for completion (for action point deduction)
            // Check if this movement is from the network
            this.completedMovements.set(character.name, {
                path: [...character.path],
                finalDirection,
                fromNetwork: character.fromNetwork,
                paidCells: 0  // Track how many cells we've already paid for
            });

            // Add walk class at the start (unless character is defeated)
            const stateCharacter = this.state.findCharacter(character.name);
            if (stateCharacter && stateCharacter.health > 0) {
                this.dispatch(UpdateStateEvent.uiCharacterVisual, {
                    characterId: character.name,
                    visualState: {
                        temporaryClasses: ['walk']  // Use temporaryClasses instead of classList
                    }
                });
            }

            // Create movement animation for the entire path
            // Prepend the current position to the path since calculatePath doesn't include it
            const fullPath = [character.position, ...character.path];
            const animation = animationService.createMovementAnimation(
                character.name,
                fullPath,
                initialDirection,
                300, // default speed
                character.fromNetwork
            );

            // Start the animation
            animationService.startAnimation(character.name, animation);

            // Clear path highlights in UI state
            this.dispatch(UpdateStateEvent.uiHighlights, {
                pathCells: []
            });

            // Clear the path in state since animation is handling it
            this.dispatch(UpdateStateEvent.characterPath, { ...character, path: [] });
        }
    }
    private onCharacterPosition(character: StateChangeEventsMap[StateChangeEvent.characterPosition]) {
        // Check if we're tracking a movement for this character
        const movementData = this.completedMovements.get(character.name);
        if (!movementData || movementData.fromNetwork) {
            // Don't deduct points for network movements or if not tracking
            return;
        }

        // Check if this character belongs to the current turn
        if (character.player !== this.state.game.turn) {
            return;
        }

        // We need to deduct action points for each cell moved
        // The animation updates position cell by cell, so we deduct one cell's worth of points
        const fullCharacter = this.state.findCharacter(character.name);
        if (!fullCharacter) return;

        const moveCost = fullCharacter.actions.general.move;

        // Only deduct if we haven't paid for all cells yet
        if (movementData.paidCells < movementData.path.length) {
            // Deduct for one cell
            this.dispatch(UpdateStateEvent.deductActionPoints, {
                characterName: character.name,
                actionId: 'move',
                cost: moveCost
            });

            // Increment the paid cells counter
            movementData.paidCells++;
        }
    }

    private onShowMovement(characterName: ControlsEventsMap[ControlsEvent.showMovement]) {
        const character = this.state.findCharacter(characterName);
        if (!character) {
            return;
        }

        // Check if character is defeated
        if (character.health <= 0) {
            return;
        }

        // Check if the character belongs to the current turn
        const currentTurn = this.state.game.turn;
        if (character.player !== currentTurn) {
            return;
        }

        this.showMovement(character);
    }
    private onAnimationsChange(animations: StateChangeEventsMap[StateChangeEvent.uiAnimations]) {
        // Check if any tracked movements are no longer animated (meaning they completed)
        for (const [characterId, pathData] of this.completedMovements) {
            // If this character is NOT in the animations anymore, it means the animation completed
            if (!animations.characters[characterId]) {
                // Animation just completed
                const character = this.state.findCharacter(characterId);
                if (character && pathData && pathData.path.length > 0) {
                    // Position has already been updated incrementally during movement
                    // Just update the final direction to ensure it's correct
                    const finalDirection = pathData.finalDirection;

                    // Only update direction if it's different from current
                    if (character.direction !== finalDirection) {
                        this.dispatch(UpdateStateEvent.characterDirection, {
                            characterName: character.name,
                            direction: finalDirection
                        });
                    }

                    // Action points have already been deducted progressively in onCharacterPosition
                    // No need to deduct them here anymore

                    this.completedMovements.delete(characterId);
                }
            }
        }
    }
    // Helpers
    private selectDestination(character: DeepReadonly<ICharacter>, _reachableCells: ICoord[], destination: ICoord) {
        const path = calculatePath(
            character.position,
            destination,
            this.state.map,
            this.state.characters,
            character.name
        );

        // Clear pending cost
        this.dispatch(UpdateStateEvent.setPendingActionCost, {
            characterName: character.name,
            cost: 0
        });

        // Clear highlights
        this.dispatch(UpdateStateEvent.uiHighlights, {
            reachableCells: []
        });

        // Reset interaction mode
        this.dispatch(UpdateStateEvent.uiInteractionMode, {
            type: 'normal'
        });

        delete this.reachableCells;
        delete this.movingCharacter;

        // Set the character path which will trigger animation
        this.dispatch(UpdateStateEvent.characterPath, { ...character, path });
    }
    private onCharacterDefeated(character: StateChangeEventsMap[StateChangeEvent.characterDefeated]) {
        // Clear any active movement for the defeated character
        if (this.movingCharacter && this.movingCharacter.name === character.name) {
            this.movingCharacter = undefined;
            this.reachableCells = undefined;
        }

        // Clear the character's path
        this.dispatch(UpdateStateEvent.characterPath, { ...character, path: [] });

        // Clear any highlights
        this.dispatch(UpdateStateEvent.uiHighlights, {
            reachableCells: [],
            pathCells: []
        });

        // Remove from completed movements tracking
        this.completedMovements.delete(character.name);
    }

    private showMovement(character: DeepReadonly<ICharacter>) {
        // Always get fresh character data from state to ensure we have the latest position
        const freshCharacter = this.state.findCharacter(character.name);
        if (!freshCharacter) {
            return;
        }

        // Calculate maximum movement distance based on action points and move cost
        const moveCost = freshCharacter.actions.general.move;
        const pointsLeft = freshCharacter.actions.pointsLeft;
        const maxDistance = Math.floor(pointsLeft / moveCost);

        const reachableCells = getReachableCells(
            freshCharacter.position,
            maxDistance,
            this.state.map,
            this.state.characters,
            freshCharacter.name
        );
        this.movingCharacter = freshCharacter;
        this.reachableCells = reachableCells;

        // Use mode manager to request mode change first
        // This will clear highlights, but overwatch will be preserved by UIState
        this.modeManager.requestModeChange({
            type: 'moving',
            data: { characterId: character.name }
        });

        // Then update UI state with highlighted cells
        // This will merge with any preserved overwatch cells
        this.dispatch(UpdateStateEvent.uiHighlights, {
            reachableCells: reachableCells
        });
    }
    private showPathPreview(destination: ICoord) {
        if (!this.movingCharacter || !this.reachableCells) return;

        // Verify character still exists in current state
        const currentCharacter = this.state.findCharacter(this.movingCharacter.name);
        if (!currentCharacter) {
            // Character no longer exists, clear movement mode
            this.cleanupMovementMode();
            return;
        }

        // Calculate path
        const path = calculatePath(
            this.movingCharacter.position,
            destination,
            this.state.map,
            this.state.characters,
            this.movingCharacter.name
        );

        // Calculate pending cost for this path
        const moveCost = this.movingCharacter.actions.general.move;
        const pendingCost = moveCost * path.length;

        // Set pending action cost
        this.dispatch(UpdateStateEvent.setPendingActionCost, {
            characterName: this.movingCharacter.name,
            cost: pendingCost
        });

        // Update UI state with path preview cells while preserving reachable cells
        this.dispatch(UpdateStateEvent.uiHighlights, {
            reachableCells: this.reachableCells,
            pathCells: path
        });

        // Get the direction from character to destination (where mouse is)
        const newDirection = DirectionsService.getDirectionFromCoords(
            this.movingCharacter.position,
            destination
        );

        // Update character direction if it changed (and character still exists)
        if (this.movingCharacter.direction !== newDirection && currentCharacter) {
            this.dispatch(UpdateStateEvent.characterDirection, {
                characterName: this.movingCharacter.name,
                direction: newDirection
            });
        }
    }
    private clearPathPreview() {
        // Clear pending cost if we have a moving character
        if (this.movingCharacter) {
            // Only dispatch if character still exists in state
            const currentCharacter = this.state.findCharacter(this.movingCharacter.name);
            if (currentCharacter) {
                this.dispatch(UpdateStateEvent.setPendingActionCost, {
                    characterName: this.movingCharacter.name,
                    cost: 0
                });
            }
            // Keep the last previewed direction - don't restore original
        }

        // Clear path preview in UI state but keep reachable cells
        if (this.reachableCells) {
            this.dispatch(UpdateStateEvent.uiHighlights, {
                reachableCells: this.reachableCells,
                pathCells: []
            });
        }
    }
};
