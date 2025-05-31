import type { DeepReadonly } from "./helpers/types";
import type { ICoord, IPositionable, Speed } from "./interfaces";
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
        'verySlow': 1,
        'slow': 2,
        'medium': 3,
        'fast': 4,
        'veryFast': 5,
    };

    private movingCharacter?: ControlsEventsMap[ControlsEvent.showMovement];
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
        console.log('>>> - onCharacterPath - character:', character)
        const path = [...character.path];
        const position = path.shift();
        if (position) {
            this.dispatch(ControlsEvent.moveCharacter, { ...character, path, position })
        }
    }
    private onShowMovement(character: ControlsEventsMap[ControlsEvent.showMovement]) {
        this.showMovement(character);
    }
    private onMovementEnd(characterName: GUIEventsMap[GUIEvent.movementEnd]) {
        console.log('>>> - onMoveCharacter - characterName:', characterName);
        const character = this.state.findCharacter(characterName);
        if (character) {
            this.moveCharacter(character);
        }
    }
    // Helpers
    private selectDestination(character: ControlsEventsMap[ControlsEvent.showMovement], reachableCells: ICoord[], destination: ICoord) {
        const path = calculatePath(character.position, destination, this.state.map);
        this.reachableCells = reachableCells.filter(c => !path.find(({ x, y }) => c.x === x && c.y === y));
        this.reachableCells?.forEach(c => this.dispatch(GUIEvent.cellReset, c, JSON.stringify(c)));
        delete this.reachableCells;
        this.dispatch(UpdateStateEvent.characterPath, { ...character, path });
    }
    private showMovement(character: ControlsEventsMap[ControlsEvent.showMovement]) {
        const speedValue = Movement.speed[character.speed];
        const reachableCells = getReachableCells(character.position, speedValue, this.state.map);
        this.movingCharacter = character;
        this.reachableCells = reachableCells;
        reachableCells.forEach(c => this.dispatch(GUIEvent.cellHighlight, c, JSON.stringify(c)));
    }
    private moveCharacter(character: ControlsEventsMap[ControlsEvent.showMovement]) {
        if (character.path.length > 0) {
            const path = [...character.path];
            const position = path.shift();
            this.dispatch(UpdateStateEvent.characterPath, { ...character, path });
            if (position) {
                this.dispatch(UpdateStateEvent.characterPosition, { ...character, position });
            }
        }
    }
};
