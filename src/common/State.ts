import type { ICharacter, IState } from "./interfaces";

import { UpdateStateEvent, EventBus, UpdateStateEventsMap, StateChangeEventsMap, StateChangeEvent } from "./events";

export class State extends EventBus<UpdateStateEventsMap, StateChangeEventsMap> {
    #map: IState['map'] = [];
    #characters: IState['characters'] = [];
    #player?: ICharacter;
    #messages: IState['messages'] = [];

    constructor(initialState: IState) {
        super();
        this.map = initialState.map;
        this.characters = initialState.characters;
        this.messages = initialState.messages;

        this.listen(UpdateStateEvent.characterPosition, (c) => this.onCharacterPosition(c));
    }

    private findCharacter(name: ICharacter['name']) {
        return this.#characters.find(c => c.name === name);
    }
    private onCharacterPosition(c: UpdateStateEventsMap[UpdateStateEvent.characterPosition]) {
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
    private set map(map: IState['map']) {
        this.#map = map;
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
};
