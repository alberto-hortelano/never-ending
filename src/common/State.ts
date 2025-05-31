import type { ICoord, ICell, ICharacter, IState } from "./interfaces";

import { UpdateStateEvent, EventBus, UpdateStateEventsMap, StateChangeEventsMap, StateChangeEvent } from "./events";
import { DeepReadonly } from "./helpers/types";

export class State extends EventBus<UpdateStateEventsMap, StateChangeEventsMap> {
    #map: IState['map'] = [];
    #characters: IState['characters'] = [];
    #player?: ICharacter;
    #messages: IState['messages'] = [];

    private cellMap = new Map<ICoord, ICell>();

    constructor(initialState: IState) {
        super();
        this.map = initialState.map;
        this.characters = initialState.characters;
        this.player = initialState.player;
        this.messages = initialState.messages;

        this.listen(UpdateStateEvent.characterPosition, (ch) => this.onCharacterPosition(ch));
        this.listen(UpdateStateEvent.characterPath, (ch) => this.onCharacterPath(ch));
    }
    // Listeners
    private onCharacterPosition(characterData: UpdateStateEventsMap[UpdateStateEvent.characterPosition]) {
        const character = this.#findCharacter(characterData.name);
        if (!character) {
            throw new Error(`No character "${characterData.name}" found`);
        }
        character.position = characterData.position;
        this.dispatch(StateChangeEvent.characterPosition, structuredClone(character));
    }
    private onCharacterPath(characterData: UpdateStateEventsMap[UpdateStateEvent.characterPosition]) {
        const character = this.#characters.find(character => character.name === characterData.name);
        if (!character) {
            throw new Error(`No character "${characterData.name}" found`);
        }
        character.path = [...characterData.path];
        this.dispatch(StateChangeEvent.characterPath, structuredClone(character));
    }
    // Setters
    private set map(map: IState['map']) {
        this.#map = map;
        this.#map.forEach(row => row.forEach(cell => this.cellMap.set(cell.position, cell)));
        this.dispatch(StateChangeEvent.map, structuredClone(this.#map));
    }
    private set characters(characters: IState['characters']) {
        this.#characters = characters;
        this.dispatch(StateChangeEvent.characters, structuredClone(this.#characters));
    }
    private set messages(messages: IState['messages']) {
        this.#messages = messages;
        console.log('>>> - State - setmessages - this.#messages:', this.#messages)
        // this.dispatch(StateChangeEvent.messages, structuredClone(this.#messages));
    }
    private set player(player: ICharacter | undefined) {
        this.#player = player;
        if (this.#player) {
            this.dispatch(StateChangeEvent.player, structuredClone(this.#player));
        }
    }
    // Getters
    get map(): DeepReadonly<IState['map']> {
        return this.#map;
    }
    get characters(): DeepReadonly<IState['characters']> {
        return this.#characters;
    }
    get messages(): DeepReadonly<IState['messages']> {
        return this.#messages;
    }
    get player(): DeepReadonly<IState['player']> {
        return this.#player;
    }
    // Helpers
    #findCharacter(name: ICharacter['name']) {
        return this.#characters.find(character => character.name === name);
    }
    #findCell(coord: ICell['position']) {
        return this.cellMap.get(coord);
    }
    // Public Helpers
    findCharacter(name: ICharacter['name']): DeepReadonly<ICharacter> | undefined {
        return this.#findCharacter(name);
    }
    findCell(coord: ICell['position']): DeepReadonly<ICell> | undefined {
        return this.#findCell(coord);
    }
};
