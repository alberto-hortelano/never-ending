import type { DeepReadonly } from "./helpers/types";
import type { ICharacter, ICoord, IPositionable, Speed } from "./interfaces";
import type { State } from "./State";

import { getReachableCells, calculatePath } from "./helpers/map";
import {
    GameEvent, EventBus, UpdateStateEvent, ControlsEvent, GameEventsMap, ControlsEventsMap,
    UpdateStateEventsMap, GUIEvent, GUIEventsMap, StateChangeEvent, StateChangeEventsMap,
} from "./events";

export interface IMovement {
    locate(positionable: DeepReadonly<IPositionable>): IPositionable;
}

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
        private movement: IMovement,
        private state: State,
    ) {
        super();
        this.listen(GameEvent.characters, characters => this.onCharacters(characters));
        this.listen(ControlsEvent.cellClick, position => this.onCellClick(position));
        this.listen(ControlsEvent.showMovement, character => this.onShowMovement(character));
        this.listen(GUIEvent.movementEnd, characterName => this.onMovementEnd(characterName));
        this.listen(StateChangeEvent.characterPath, character => this.onCharacterPath(character));
    }
    // Listeners
    private onCharacters(characters: GameEventsMap[GameEvent.characters]) {
        characters.forEach(character => {
            const position = this.movement.locate(character);
            const positionedCharacter = { ...character, ...position };
            this.dispatch(UpdateStateEvent.characterPosition, positionedCharacter);
        });
    }
    private onCellClick(position: ControlsEventsMap[ControlsEvent.cellClick]) {
        if (this.movingCharacter && this.reachableCells?.find(c => c.x === position.x && c.y === position.y)) {
            this.selectDestination(this.movingCharacter, this.reachableCells, position);
        }
    }
    private onCharacterPath(character: StateChangeEventsMap[StateChangeEvent.characterPath]) {
        const path = [...character.path];
        const position = path.shift();
        if (position) {
            this.dispatch(ControlsEvent.moveCharacter, { ...character, path, position }, character.name);
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
            this.dispatch(UpdateStateEvent.characterPath, { ...character, path });
            if (position) {
                this.dispatch(UpdateStateEvent.characterPosition, { ...character, position });
                this.dispatch(GUIEvent.cellReset, position, JSON.stringify(position))
            }
        }
    }
};
