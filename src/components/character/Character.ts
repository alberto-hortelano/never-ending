import { ControlsEvent, GUIEvent, ControlsEventsMap } from "../../common/events";
import { ICharacter, Direction } from "../../common/interfaces";
import { Component } from "../Component";
import type Movable from "../movable/Movable";
import "../movable/Movable";
import { CharacterService, CharacterPalette } from "../../common/services/CharacterService";

export default class Character extends Component {
    protected override hasCss = true;
    protected override hasHtml = true;
    private movable?: HTMLElement;
    private characterElement?: HTMLElement;
    private race: ICharacter['race'] = 'human';
    private palette: CharacterPalette = {
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
        this.palette = CharacterService.parseCharacterPalette(this.dataset.palette);

        // Set initial direction
        if (this.dataset.direction && this.characterElement) {
            const directionClass = CharacterService.getDirectionClass(this.dataset.direction as Direction);
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


    private onMoveCharacter(character: ControlsEventsMap[ControlsEvent.moveCharacter]) {
        if (!this.movable) {
            return;
        }

        const currentX = parseInt(this.movable.dataset.x || '0');
        const currentY = parseInt(this.movable.dataset.y || '0');
        
        const movementData = CharacterService.calculateMovementData(
            { x: currentX, y: currentY },
            character.position,
            character.direction
        );
        
        if (movementData.directionClass) {
            this.characterElement?.classList.remove(...CharacterService.getDirectionClasses());
            this.characterElement?.classList.add(movementData.directionClass);
            // Only add 'walk' class if actually moving
            if (movementData.isMoving) {
                this.characterElement?.classList.add('walk');
            }
        }

        this.movable.dataset.x = `${movementData.position.x}`;
        this.movable.dataset.y = `${movementData.position.y}`;
    }

}

customElements.define('character-component', Character);
