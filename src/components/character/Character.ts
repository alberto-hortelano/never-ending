import { ControlsEvent, GUIEvent, ControlsEventsMap } from "../../common/events";
import { ICharacter, Direction } from "../../common/interfaces";
import { Component } from "../Component";
import type Movable from "../movable/Movable";
import "../movable/Movable";

export default class Character extends Component {
    static readonly directions = ['rotate-0', 'rotate-45', 'rotate-90', 'rotate-135', 'rotate-180', 'rotate-225', 'rotate-270', 'rotate-315'];
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

        // Set initial direction
        if (this.dataset.direction && this.characterElement) {
            const directionClass = this.getDirectionClass(this.dataset.direction as Direction);
            if (directionClass) {
                this.characterElement.classList.add(directionClass);
            }
        }
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

        // Check if position changed (character is moving) or just rotating
        const currentX = parseInt(this.movable.dataset.x || '0');
        const currentY = parseInt(this.movable.dataset.y || '0');
        const isMoving = currentX !== character.position.x || currentY !== character.position.y;

        const directionClass = this.getDirectionClass(character.direction);
        
        if (directionClass) {
            this.characterElement?.classList.remove(...Character.directions);
            this.characterElement?.classList.add(directionClass);
            // Only add 'walk' class if actually moving
            if (isMoving) {
                this.characterElement?.classList.add('walk');
            }
        }

        this.movable.dataset.x = `${character.position.x}`;
        this.movable.dataset.y = `${character.position.y}`;
    }

    private getDirectionClass(direction: Direction): string {
        const directionMap: Record<Direction, string> = {
            'down': 'rotate-0',
            'down-right': 'rotate-45',
            'right': 'rotate-90',
            'up-right': 'rotate-135',
            'up': 'rotate-180',
            'up-left': 'rotate-225',
            'left': 'rotate-270',
            'down-left': 'rotate-315'
        };
        return directionMap[direction] || 'rotate-0';
    }
}

customElements.define('character-component', Character);
