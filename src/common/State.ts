import type { ICell, ICharacter, IState } from "./interfaces";

import { fillMap, getBorders, setWalls } from "./helpers/map";
import { StateEvent, EventBus, StateEventsMap } from "./events";

export class State extends EventBus<StateEventsMap> implements IState {
    #map: IState['map'];
    #characters: IState['characters'];
    #player: ICharacter;
    #messages: IState['messages'];

    constructor(initialState: IState) {
        super();
        this.#map = initialState.map;
        this.#characters = initialState.characters;
        this.#messages = initialState.messages;

        const player = this.findCharacter('player');
        if (!player) {
            throw new Error("No player set");
        }
        this.#player = player;

        this.listen(StateEvent.characterPosition, (c) => this.onCharacterPosition(c));
        this.listen(StateEvent.playerDirection, (d) => this.onPlayerDirection(d));
    }
    // Static
    static fillMap(width: number, height: number): IState['map'] {
        return fillMap(width, height);
    }
    // Private
    private findCharacter(name: ICharacter['name']) {
        return this.#characters.find(c => c.name === name);
    }
    private onCharacterPosition(c: StateEventsMap[StateEvent.characterPosition]) {
        const character = this.findCharacter(c.name);
        if (!character) {
            throw new Error(`No character "${c.name}" found`);
        }
        const cell = this.#map[c.cell.position.y]?.[c.cell.position.x];
        if (!cell) {
            throw new Error(`No cell "${c.cell.position}" found`);
        }
        character.cell = cell;
    }
    private onPlayerDirection(d: StateEventsMap[StateEvent.playerDirection]) {
        this.#player.direction = d;
    }
    // Public
    public setWalls(walls: ICell['position'][]) {
        setWalls(this.#map, walls);
    }
    public getBorders() {
        return getBorders(this.#map);
    }
    get player() {
        return structuredClone(this.#player);
    }
    get map() {
        return structuredClone(this.#map);
    }
    get characters() {
        return structuredClone(this.#characters);
    }
    get messages() {
        return structuredClone(this.#messages);
    }
};
