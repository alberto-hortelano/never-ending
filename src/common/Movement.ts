import type { DeepReadonly } from "./helpers/types";
import type { ICharacter, ICoord, Direction } from "./interfaces";
import type { State } from "./State";

import { getReachableCells, calculatePath } from "./helpers/map";
import {
    EventBus, UpdateStateEvent, ControlsEvent, GameEventsMap, ControlsEventsMap,
    UpdateStateEventsMap, StateChangeEvent, StateChangeEventsMap,
} from "./events";
import { animationService } from "./services/AnimationService";

export class Movement extends EventBus<
    GameEventsMap & ControlsEventsMap & StateChangeEventsMap,
    UpdateStateEventsMap & ControlsEventsMap
> {

    private movingCharacter?: DeepReadonly<ICharacter>;
    private reachableCells?: ICoord[];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    private listeners: Array<{ event: string; handler: Function }> = [];
    private completedMovements = new Map<string, { path: ICoord[], finalDirection: string, fromNetwork?: boolean }>();

    constructor(
        private state: State,
    ) {
        super();
        // Store references to listeners for cleanup
        this.addListener(ControlsEvent.cellClick, position => this.onCellClick(position));
        this.addListener(ControlsEvent.showMovement, character => this.onShowMovement(character));
        this.addListener(StateChangeEvent.characterPath, character => this.onCharacterPath(character));
        this.addListener(StateChangeEvent.uiAnimations, animations => this.onAnimationsChange(animations));
    }

    private addListener<K extends keyof (GameEventsMap & ControlsEventsMap & StateChangeEventsMap)>(
        event: K,
        handler: (data: (GameEventsMap & ControlsEventsMap & StateChangeEventsMap)[K]) => void
    ) {
        this.listen(event, handler);
        this.listeners.push({ event: event as string, handler });
    }

    destroy() {
        // Remove all listeners for this Movement instance
        this.remove(this);
        this.listeners = [];
    }
    // Listeners
    private onCellClick(position: ControlsEventsMap[ControlsEvent.cellClick]) {
        if (this.movingCharacter && this.reachableCells?.find(c => c.x === position.x && c.y === position.y)) {
            this.selectDestination(this.movingCharacter, this.reachableCells, position);
        }
    }
    private onCharacterPath(character: StateChangeEventsMap[StateChangeEvent.characterPath]) {
        // When a character path is set, create a movement animation
        if (character.path && character.path.length > 0) {

            // Calculate initial direction from current position to first path position
            const initialDirection = this.calculateDirection(character.position, character.path[0]!) as Direction;

            // Calculate final direction based on last movement
            let finalDirection = initialDirection;
            if (character.path.length >= 2) {
                const lastPos = character.path[character.path.length - 1];
                const secondLastPos = character.path[character.path.length - 2];
                if (lastPos && secondLastPos) {
                    finalDirection = this.calculateDirection(secondLastPos, lastPos) as Direction;
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
                fromNetwork: character.fromNetwork
            });

            // Add walk class at the start
            this.dispatch(UpdateStateEvent.uiCharacterVisual, {
                characterId: character.name,
                visualState: {
                    classList: ['walk']
                }
            });

            // Create movement animation for the entire path
            // Prepend the current position to the path since calculatePath doesn't include it
            const fullPath = [character.position, ...character.path];
            const animation = animationService.createMovementAnimation(
                character.name,
                fullPath,
                initialDirection
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
    private onShowMovement(characterName: ControlsEventsMap[ControlsEvent.showMovement]) {
        const character = this.state.findCharacter(characterName);
        if (!character) return;

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
                    // Update final position in state
                    const finalPosition = pathData.path[pathData.path.length - 1];
                    const finalDirection = pathData.finalDirection as Direction;

                    if (finalPosition) {
                        this.dispatch(UpdateStateEvent.characterPosition, {
                            ...character,
                            position: finalPosition,
                            direction: finalDirection
                        });
                    }

                    // Deduct action points if this is the current player's character and not from network
                    if (character.player === this.state.game.turn && !pathData.fromNetwork) {
                        const moveCost = character.actions.general.move * pathData.path.length;
                        this.dispatch(UpdateStateEvent.deductActionPoints, {
                            characterName: character.name,
                            actionId: 'move',
                            cost: moveCost
                        });
                    }

                    this.completedMovements.delete(characterId);
                }
            }
        }
    }
    // Helpers
    private selectDestination(character: DeepReadonly<ICharacter>, _reachableCells: ICoord[], destination: ICoord) {
        const path = calculatePath(character.position, destination, this.state.map);

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

        const reachableCells = getReachableCells(freshCharacter.position, maxDistance, this.state.map);
        this.movingCharacter = freshCharacter;
        this.reachableCells = reachableCells;

        // Update UI state with highlighted cells
        this.dispatch(UpdateStateEvent.uiHighlights, {
            reachableCells: reachableCells
        });

        // Update interaction mode
        this.dispatch(UpdateStateEvent.uiInteractionMode, {
            type: 'moving',
            data: { characterId: character.name }
        });
    }
    private calculateDirection(from: ICoord, to: ICoord): Direction {
        const dx = to.x - from.x;
        const dy = to.y - from.y;

        // Calculate direction including diagonals
        if (dx > 0 && dy > 0) return 'down-right';
        else if (dx > 0 && dy < 0) return 'up-right';
        else if (dx < 0 && dy > 0) return 'down-left';
        else if (dx < 0 && dy < 0) return 'up-left';
        else if (dx > 0) return 'right';
        else if (dx < 0) return 'left';
        else if (dy > 0) return 'down';
        else if (dy < 0) return 'up';

        return 'down'; // Default direction
    }
};
