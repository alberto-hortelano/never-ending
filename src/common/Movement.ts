import type { DeepReadonly } from "./helpers/types";
import type { ICharacter, ICoord, Speed } from "./interfaces";
import type { State } from "./State";

import { getReachableCells, calculatePath } from "./helpers/map";
import {
    EventBus, UpdateStateEvent, ControlsEvent, GameEventsMap, ControlsEventsMap,
    UpdateStateEventsMap, GUIEvent, GUIEventsMap, StateChangeEvent, StateChangeEventsMap,
} from "./events";


export class Movement extends EventBus<
    GameEventsMap & GUIEventsMap & ControlsEventsMap & StateChangeEventsMap,
    UpdateStateEventsMap & GUIEventsMap & ControlsEventsMap
> {
    static readonly speed: Record<Speed, number> = {
        'verySlow': 2,
        'slow': 3,
        'medium': 14,
        'fast': 5,
        'veryFast': 6,
    };

    private movingCharacter?: DeepReadonly<ICharacter>;
    private reachableCells?: ICoord[];

    constructor(
        private state: State,
    ) {
        super();
        this.listen(ControlsEvent.cellClick, position => this.onCellClick(position));
        this.listen(ControlsEvent.showMovement, character => this.onShowMovement(character));
        this.listen(GUIEvent.movementEnd, characterName => this.onMovementEnd(characterName));
        this.listen(StateChangeEvent.characterPath, character => this.onCharacterPath(character));
    }
    // Listeners
    private onCellClick(position: ControlsEventsMap[ControlsEvent.cellClick]) {
        if (this.movingCharacter && this.reachableCells?.find(c => c.x === position.x && c.y === position.y)) {
            this.selectDestination(this.movingCharacter, this.reachableCells, position);
        }
    }
    private onCharacterPath(character: StateChangeEventsMap[StateChangeEvent.characterPath]) {
        const path = [...character.path];
        const position = path.shift();
        if (position) {
            // Get the latest character from state to ensure we have the current position
            const currentCharacter = this.state.findCharacter(character.name) || character;
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
        if (character) {
            this.showMovement(character);
        }
    }
    private onMovementEnd(characterName: GUIEventsMap[GUIEvent.movementEnd]) {
        const character = this.state.findCharacter(characterName);
        if (character) {
            this.moveCharacter(character);
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
        const speedValue = Movement.speed[character.speed];
        const reachableCells = getReachableCells(character.position, speedValue, this.state.map);
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
