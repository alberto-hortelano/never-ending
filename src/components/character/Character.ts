import { ControlsEvent, GUIEvent, ControlsEventsMap } from "../../common/events";
import { ICharacter } from "../../common/interfaces";
import { Component } from "../Component";
import type Movable from "../movable/Movable";
import "../movable/Movable";

export default class Character extends Component {
    static readonly directions = ['rotate-0', 'rotate-90', 'rotate-180', 'rotate-270'];
    protected override hasCss = true;
    protected override hasHtml = true;
    private movable?: HTMLElement;
    private characterElement?: HTMLElement;
    private race: ICharacter['race'] = 'human';
    private palette = {
        skin: 'black',
        helmet: 'black',
        suit: 'black',
    }

    constructor() {
        super();
    }

    override async connectedCallback() {
        const root = await super.connectedCallback();
        this.listen(ControlsEvent.moveCharacter, caracter => this.onMoveCharacter(caracter), this.id);
        this.characterElement = root?.getElementById('character') as HTMLElement;
        if (this.dataset.race) {
            this.race = this.dataset.race as ICharacter['race'];
            this.characterElement.classList.add(this.race);
        }
        this.movable = root?.getElementById('movable') as Movable;
        this.movable.dataset.x = `${this.dataset.x}`;
        this.movable.dataset.y = `${this.dataset.y}`;
        this.palette = this.setPalette();
        this.movable.addEventListener("transitionend", () => {
            this.characterElement?.classList.remove('walk');
            this.dispatch(GUIEvent.movementEnd, this.id);
        });
        this.addEventListener('click', () => {
            this.dispatch(ControlsEvent.showActions, this.id)
        });
        this.style.setProperty('--skin', this.palette.skin);
        this.style.setProperty('--helmet', this.palette.helmet);
        this.style.setProperty('--suit', this.palette.suit);
        this.style.backgroundColor = this.palette.helmet;
        return root;
    }

    private setPalette() {
        try {
            const palette = JSON.parse(this.dataset.palette || '{}');
            return {
                ...this.palette,
                ...palette
            };
        } catch (error) {
            console.error('>>> - Character - getPalette - error:', error);
            return this.palette;
        }
    }

    private onMoveCharacter(character: ControlsEventsMap[ControlsEvent.moveCharacter]) {
        if (!this.movable) {
            return;
        }
        let direction = '';
        if (character.direction === 'right') direction = 'rotate-90';
        else if (character.direction === 'left') direction = 'rotate-270';
        else if (character.direction === 'down') direction = 'rotate-0';
        else if (character.direction === 'up') direction = 'rotate-180';
        console.log('>>> - Character - onMoveCharacter - character.direction:', character.direction, direction)

        if (direction) {
            this.characterElement?.classList.remove(...Character.directions);
            this.characterElement?.classList.add(direction, 'walk');
        }

        this.movable.dataset.x = `${character.position.x}`;
        this.movable.dataset.y = `${character.position.y}`;
    }
}

customElements.define('character-component', Character);
