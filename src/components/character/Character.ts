import { ControlsEvent, GUIEvent, ControlsEventsMap } from "../../common/events";
import { Component } from "../Component";
import type Movable from "../movable/Movable";
import "../movable/Movable";

export default class Character extends Component {
    static readonly directions = ['rotate-0', 'rotate-90', 'rotate-180', 'rotate-270'];
    protected override hasCss = true;
    protected override hasHtml = true;
    private movable?: HTMLElement;
    private characterElement?: HTMLElement;

    constructor() {
        super();
        this.listen(ControlsEvent.moveCharacter, caracter => this.onMoveCharacter(caracter));
    }

    override async connectedCallback() {
        const root = await super.connectedCallback();
        this.movable = root?.getElementById('movable') as Movable;
        this.movable.dataset.x = `${this.dataset.x}`;
        this.movable.dataset.y = `${this.dataset.y}`;
        this.movable.addEventListener("transitionend", () => {
            this.characterElement?.classList.remove('walk');
            this.dispatch(GUIEvent.movementEnd, this.id);
        });
        this.addEventListener('click', () => {
            this.dispatch(ControlsEvent.showMovement, this.id)
        });
        this.characterElement = root?.getElementById('character') as HTMLElement;
        return root;
    }

    private onMoveCharacter(character: ControlsEventsMap[ControlsEvent.moveCharacter]) {
        if (!this.movable) {
            return;
        }

        const previousX = parseInt(this.movable.dataset.x || '0');
        const previousY = parseInt(this.movable.dataset.y || '0');
        const currentX = character.position.x;
        const currentY = character.position.y;

        const dx = currentX - previousX;
        const dy = currentY - previousY;

        let direction = '';
        if (dx > 0) direction = 'rotate-90';
        else if (dx < 0) direction = 'rotate-270';
        else if (dy > 0) direction = 'rotate-0';
        else if (dy < 0) direction = 'rotate-180';

        if (direction) {
            this.characterElement?.classList.remove(...Character.directions);
            this.characterElement?.classList.add(direction, 'walk');
        }

        this.movable.dataset.x = `${character.position.x}`;
        this.movable.dataset.y = `${character.position.y}`;
    }
}

customElements.define('character-component', Character);
