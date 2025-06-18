import type { ICoord, ICell, ICharacter, IState } from "./interfaces";

import { UpdateStateEvent, EventBus, UpdateStateEventsMap, StateChangeEventsMap, StateChangeEvent } from "./events";
import { DeepReadonly } from "./helpers/types";
import { getBaseState } from '../data/state';

export class State extends EventBus<UpdateStateEventsMap, StateChangeEventsMap> {
    #map: IState['map'] = [];
    #characters: IState['characters'] = [];
    #player?: ICharacter;
    #messages: IState['messages'] = [];

    private readonly storageName = 'state'; // could be random to hide from others
    private cellMap = new Map<ICoord, ICell>();

    constructor(initialState?: IState) {
        super();
        this.load(initialState);
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
        // No one is listening
        // this.dispatch(StateChangeEvent.characterPosition, structuredClone(character));
        this.save();
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
        this.save();
    }
    private set characters(characters: IState['characters']) {
        this.#characters = characters;
        this.dispatch(StateChangeEvent.characters, structuredClone(this.#characters));
        this.save();
    }
    private set messages(messages: IState['messages']) {
        this.#messages = messages;
        this.save();
    }
    private set player(player: ICharacter | undefined) {
        this.#player = player;
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
    // Storage
    private save() {
        // const state: IState = {
        //     map: this.#map,
        //     characters: this.#characters,
        //     player: this.#player,
        //     messages: this.#messages,
        // }
        // localStorage.setItem(this.storageName, JSON.stringify(state));
    }
    private load(initialState?: IState) {
        let state = initialState;
        if (!state) {
            try {
                const raw = localStorage.getItem(this.storageName);
                state ||= raw && JSON.parse(raw);
            } catch (error) {
                console.error('Game#constructor - localStorage parse error:', error);
            }
        }
        state ||= getBaseState();
        this.map = state.map;
        this.characters = state.characters;
        this.player = state.player;
        this.messages = state.messages;
    }
    private clear() {
        localStorage.removeItem(this.storageName);
    }
    // Public Helpers
    findCharacter(name: ICharacter['name']): DeepReadonly<ICharacter> | undefined {
        return this.#findCharacter(name);
    }
    findCell(coord: ICell['position']): DeepReadonly<ICell> | undefined {
        return this.#findCell(coord);
    }
};
