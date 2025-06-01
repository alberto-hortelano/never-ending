import { StateChangeEventsMap, StateChangeEvent, ControlsEvent, GUIEvent } from "../../common/events";
import { Component } from "../Component";
import type Movable from "../movable/Movable";
import "../movable/Movable";

export default class Character extends Component {
    protected override hasCss = true;
    protected override hasHtml = true;
    private movable?: HTMLElement;

    constructor() {
        super();
        this.listen(ControlsEvent.moveCharacter, caracter => this.onMoveCharacter(caracter));
    }

    override async connectedCallback() {
        const root = await super.connectedCallback();
        this.movable = root?.getElementById('movable') as Movable;
        this.movable.dataset.x = `${this.dataset.x}`;
        this.movable.dataset.y = `${this.dataset.y}`;
        this.movable.addEventListener("transitionend", () => this.dispatch(GUIEvent.movementEnd, this.id));
        this.addEventListener('click', () => {
            this.dispatch(ControlsEvent.showMovement, this.id)
        })
        return root;
    }

    private onMoveCharacter(character: StateChangeEventsMap[StateChangeEvent.player]) {
        if (!this.movable) {
            return;
        }
        this.movable.dataset.x = `${character.position.x}`;
        this.movable.dataset.y = `${character.position.y}`;
    }
}

customElements.define('character-component', Character);
