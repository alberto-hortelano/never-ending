import { ControlsEvent, GUIEvent, ControlsEventsMap, StateChangeEvent } from "../../common/events";
import { Component } from "../Component";
import type Movable from "../movable/Movable";
import "../movable/Movable";
import { CharacterService } from "../../common/services/CharacterService";

export default class Character extends Component {
    protected override hasCss = true;
    protected override hasHtml = true;
    private movable?: HTMLElement;
    private characterElement?: HTMLElement;
    private player: string = '';
    private currentTurn: string = '';

    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;
        
        // Initialize from dataset
        const { race, player, palette, direction, position } = CharacterService.initializeFromDataset(this.dataset);
        this.player = player;
        
        // Set up DOM elements
        this.listen(ControlsEvent.moveCharacter, caracter => this.onMoveCharacter(caracter), this.id);
        this.characterElement = root.getElementById('character') as HTMLElement;
        this.movable = root.getElementById('movable') as Movable;
        
        // Apply character race
        if (this.characterElement) {
            this.characterElement.classList.add(race);
            
            // Set initial direction
            if (direction) {
                const directionClass = CharacterService.getDirectionClass(direction);
                this.characterElement.classList.add(directionClass);
            }
        }
        
        // Set position
        if (this.movable) {
            this.movable.dataset.x = `${position.x}`;
            this.movable.dataset.y = `${position.y}`;
        }
        
        // Apply palette styles
        CharacterService.applyPaletteStyles(this, palette);
        this.movable.addEventListener("transitionend", () => {
            this.characterElement?.classList.remove('walk');
            this.dispatch(GUIEvent.movementEnd, this.id);
        });
        this.addEventListener('click', () => {
            if (CharacterService.canControlCharacter(this.player, this.currentTurn)) {
                this.dispatch(ControlsEvent.showActions, this.id);
            }
        });
        
        // Get the current turn from state
        const currentTurn = CharacterService.getCurrentTurnFromState();
        if (currentTurn) {
            this.currentTurn = currentTurn;
            this.updateTurnIndicator();
        }
        
        // Listen for turn changes
        this.listen(StateChangeEvent.game, (game) => {
            this.currentTurn = game.turn;
            requestAnimationFrame(() => this.updateTurnIndicator());
        });
        return root;
    }


    private onMoveCharacter(character: ControlsEventsMap[ControlsEvent.moveCharacter]) {
        if (!this.movable || !this.characterElement) return;

        const currentPosition = CharacterService.getPositionFromDataset(this.movable.dataset);
        const movementData = CharacterService.calculateMovementData(
            currentPosition,
            character.position,
            character.direction
        );
        
        // Update direction
        this.characterElement.classList.remove(...CharacterService.getDirectionClasses());
        this.characterElement.classList.add(movementData.directionClass);
        
        // Add walk animation if moving
        if (movementData.isMoving) {
            this.characterElement.classList.add('walk');
        }

        // Update position
        this.movable.dataset.x = `${movementData.position.x}`;
        this.movable.dataset.y = `${movementData.position.y}`;
    }

    private updateTurnIndicator() {
        const shouldShowIndicator = CharacterService.shouldShowTurnIndicator(this.player, this.currentTurn);
        this.characterElement?.classList.toggle('current-player', shouldShowIndicator);
    }

}

customElements.define('character-component', Character);
