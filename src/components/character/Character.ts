import { StateChangeEventsMap, StateChangeEvent } from "../../common/events";
// import { ICharacter } from "../../common/interfaces";
import { Component } from "../Component";
import type Movable from "../movable/Movable";
import "../movable/Movable";

export default class Character extends Component {
    protected override hasCss = true;
    protected override hasHtml = true;
    private movable?: HTMLElement;

    constructor() {
        super();
    }

    override async connectedCallback() {
        const root = await super.connectedCallback();
        this.movable = root?.getElementById('movable') as Movable;
        this.movable?.setAttribute('x', `${this.dataset.x}`);
        this.movable?.setAttribute('y', `${this.dataset.y}`);
        return root;
    }

    private onPosition(character: StateChangeEventsMap[StateChangeEvent.player]) {
        console.log('>>> - Character - onPosition - character:', this.movable, character.cell.position);
        this.movable?.setAttribute('x', `${character.cell.position.x}`);
        this.movable?.setAttribute('y', `${character.cell.position.y}`);
    }
}

customElements.define('character-component', Character);
