import type { DeepReadonly } from "./helpers/types";
import type { ICharacter, ICoord } from "./interfaces";
import type { State } from "./State";

import { getReachableCells, calculatePath } from "./helpers/map";
import {
    EventBus, UpdateStateEvent, ControlsEvent, GameEventsMap, ControlsEventsMap,
    UpdateStateEventsMap, GUIEvent, GUIEventsMap, StateChangeEvent, StateChangeEventsMap,
} from "./events";

// Type for character path event with network flag
interface NetworkCharacterPath extends StateChangeEventsMap[StateChangeEvent.characterPath] {
    fromNetwork?: boolean;
}


export class Movement extends EventBus<
    GameEventsMap & GUIEventsMap & ControlsEventsMap & StateChangeEventsMap,
    UpdateStateEventsMap & GUIEventsMap & ControlsEventsMap
> {

    private movingCharacter?: DeepReadonly<ICharacter>;
    private reachableCells?: ICoord[];
    private listeners: Array<{ event: string; handler: Function }> = [];

    constructor(
        private state: State,
    ) {
        super();
        // Store references to listeners for cleanup
        this.addListener(ControlsEvent.cellClick, position => this.onCellClick(position));
        this.addListener(ControlsEvent.showMovement, character => this.onShowMovement(character));
        this.addListener(GUIEvent.movementEnd, characterName => this.onMovementEnd(characterName));
        this.addListener(StateChangeEvent.characterPath, character => this.onCharacterPath(character));
    }
    
    private addListener<K extends keyof (GameEventsMap & GUIEventsMap & ControlsEventsMap & StateChangeEventsMap)>(
        event: K,
        handler: (data: (GameEventsMap & GUIEventsMap & ControlsEventsMap & StateChangeEventsMap)[K]) => void
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
        const networkCharacter = character as NetworkCharacterPath;
        const isNetworkUpdate = networkCharacter.fromNetwork;
        
        // For all path updates, we need to animate the movement
        const path = [...character.path];
        const position = path.shift();
        if (position) {
            // Get the latest character from state to ensure we have the current position
            const currentCharacter = this.state.findCharacter(character.name) || character;
            
            // Check if we need to move or if we're already at the target
            if (currentCharacter.position.x === position.x && currentCharacter.position.y === position.y) {
                // Already at this position, continue with next position in path
                if (path.length > 0) {
                    this.dispatch(UpdateStateEvent.characterPath, { ...character, path });
                }
                return;
            }
            
            const dx = position.x - currentCharacter.position.x;
            const dy = position.y - currentCharacter.position.y;
            let direction = currentCharacter.direction;

            // Calculate direction including diagonals
            if (dx > 0 && dy > 0) direction = 'down-right';
            else if (dx > 0 && dy < 0) direction = 'up-right';
            else if (dx < 0 && dy > 0) direction = 'down-left';
            else if (dx < 0 && dy < 0) direction = 'up-left';
            else if (dx > 0) direction = 'right';
            else if (dx < 0) direction = 'left';
            else if (dy > 0) direction = 'down';
            else if (dy < 0) direction = 'up';
            this.dispatch(ControlsEvent.moveCharacter, { ...character, path, position, direction }, character.name);
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
    private onMovementEnd(characterName: GUIEventsMap[GUIEvent.movementEnd]) {
        const character = this.state.findCharacter(characterName);
        if (character) {
            this.moveCharacter(character);
            
            // Only deduct action points if this is the current player's character
            // Network movements already had action points deducted on the originating client
            const currentTurn = this.state.game.turn;
            if (character.player === currentTurn) {
                const moveCost = character.actions.general.move;
                this.dispatch(UpdateStateEvent.deductActionPoints, {
                    characterName: character.name,
                    actionId: 'move',
                    cost: moveCost
                });
            }
        }
    }
    // Helpers
    private selectDestination(character: DeepReadonly<ICharacter>, reachableCells: ICoord[], destination: ICoord) {
        const path = calculatePath(character.position, destination, this.state.map);
        this.reachableCells = reachableCells.filter(c => !path.find(({ x, y }) => c.x === x && c.y === y));
        this.reachableCells?.forEach(c => this.dispatch(GUIEvent.cellReset, c, JSON.stringify(c)));
        delete this.reachableCells;
        this.dispatch(UpdateStateEvent.characterPath, { ...character, path });
    }
    private showMovement(character: DeepReadonly<ICharacter>) {
        // Calculate maximum movement distance based on action points and move cost
        const moveCost = character.actions.general.move;
        const pointsLeft = character.actions.pointsLeft;
        const maxDistance = Math.floor(pointsLeft / moveCost);
        
        const reachableCells = getReachableCells(character.position, maxDistance, this.state.map);
        this.movingCharacter = character;
        this.reachableCells = reachableCells;
        reachableCells.forEach(c => this.dispatch(GUIEvent.cellHighlight, c, JSON.stringify(c)));
    }
    private moveCharacter(character: DeepReadonly<ICharacter>) {
        if (character.path.length > 0) {
            const path = [...character.path];
            const position = path.shift();

            if (position) {
                // Calculate direction based on current position to new position
                const dx = position.x - character.position.x;
                const dy = position.y - character.position.y;
                let direction = character.direction;

                // Calculate direction including diagonals
                if (dx > 0 && dy > 0) direction = 'down-right';
                else if (dx > 0 && dy < 0) direction = 'up-right';
                else if (dx < 0 && dy > 0) direction = 'down-left';
                else if (dx < 0 && dy < 0) direction = 'up-left';
                else if (dx > 0) direction = 'right';
                else if (dx < 0) direction = 'left';
                else if (dy > 0) direction = 'down';
                else if (dy < 0) direction = 'up';

                // Update position first, then path
                this.dispatch(UpdateStateEvent.characterPosition, { ...character, position, direction });
                // Update character object with new position for the path update
                const updatedCharacter = { ...character, position, direction };
                this.dispatch(UpdateStateEvent.characterPath, { ...updatedCharacter, path });
                this.dispatch(GUIEvent.cellReset, position, JSON.stringify(position))
            } else {
                // No position to move to, just update the path
                this.dispatch(UpdateStateEvent.characterPath, { ...character, path });
            }
        }
    }
};
