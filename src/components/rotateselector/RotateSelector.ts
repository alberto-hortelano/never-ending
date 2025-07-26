import type { DeepReadonly } from "../../common/helpers/types";
import type { ICharacter, Direction } from "../../common/interfaces";
import { Component } from "../Component";
import type Character from "../character/Character";
import { DirectionsService } from "../../common/services/DirectionsService";
import { StateChangeEvent, ControlsEvent } from "../../common/events";

export interface RotateSelectorOptions {
    character: DeepReadonly<ICharacter>;
}

export class RotateSelector extends Component {
    protected override hasCss = true;
    protected override hasHtml = false;
    private options?: RotateSelectorOptions;
    private selectedCharacter: DeepReadonly<ICharacter> | null = null;
    private isMinimized = false;

    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;

        // Listen for selected character changes
        this.listen(StateChangeEvent.selectedCharacter, (character) => {
            this.selectedCharacter = character;
            if (character) {
                this.options = { character };
                this.renderRotateControls(root);
            } else {
                root.innerHTML = '';
            }
        });

        // Listen for character updates (direction changes)
        this.listen(StateChangeEvent.characterDirection, (character) => {
            if (this.selectedCharacter && character.name === this.selectedCharacter.name) {
                this.selectedCharacter = character;
                this.options = { character };
                this.updateCurrentDirection();
            }
        });

        return root;
    }

    public setOptions(options: RotateSelectorOptions) {
        this.options = options;
        
        const root = this.shadowRoot;
        if (root) {
            root.innerHTML = '';
            this.renderRotateControls(root);
        }
    }

    private renderRotateControls(root: ShadowRoot | HTMLElement) {
        if (!this.options) return;

        root.innerHTML = '';

        const container = document.createElement('div');
        container.className = `rotate-container ${this.isMinimized ? 'minimized' : ''}`;

        // Header with minimize button
        const header = document.createElement('div');
        header.className = 'rotate-header';
        
        const title = document.createElement('h3');
        title.className = 'rotate-title';
        title.textContent = this.isMinimized ? '↻' : 'Rotate';
        
        const minimizeBtn = document.createElement('button');
        minimizeBtn.className = 'minimize-btn';
        minimizeBtn.textContent = this.isMinimized ? '◀' : '▶';
        minimizeBtn.addEventListener('click', () => this.toggleMinimize(root));
        
        header.appendChild(title);
        header.appendChild(minimizeBtn);
        container.appendChild(header);

        if (!this.isMinimized) {

        // Create cross-shaped button layout
        const crossContainer = document.createElement('div');
        crossContainer.className = 'rotate-cross';

        // Character display in center
        const centerDisplay = document.createElement('div');
        centerDisplay.className = 'center-display';
        
        const characterIcon = document.createElement('character-component') as Character;
        characterIcon.classList.add('character-preview');
        characterIcon.setAttribute('data-name', this.options.character.name);
        characterIcon.setAttribute('data-race', this.options.character.race);
        characterIcon.setAttribute('data-palette', JSON.stringify(this.options.character.palette));
        characterIcon.setAttribute('data-x', '0');
        characterIcon.setAttribute('data-y', '0');
        characterIcon.setAttribute('data-direction', this.options.character.direction || 'down');
        characterIcon.setAttribute('data-is-preview', 'true');
        characterIcon.id = `rotate-preview-${this.options.character.name}`;
        
        centerDisplay.appendChild(characterIcon);

        // Direction buttons - 8 directions
        const directions = DirectionsService.getAllDirections();

        directions.forEach((dirData) => {
            const button = document.createElement('button');
            button.className = `direction-button direction-${dirData.position}`;
            button.setAttribute('data-direction', dirData.direction);
            button.textContent = dirData.label;
            button.addEventListener('click', () => this.handleDirectionSelect(dirData.direction));
            crossContainer.appendChild(button);
        });

        crossContainer.appendChild(centerDisplay);
        container.appendChild(crossContainer);

        // Current direction indicator
        const currentDirection = document.createElement('p');
        currentDirection.className = 'current-direction';
        currentDirection.textContent = `Current: ${this.options.character.direction || 'down'}`;
        container.appendChild(currentDirection);
        }

        root.appendChild(container);
    }

    private toggleMinimize(root: ShadowRoot | HTMLElement): void {
        this.isMinimized = !this.isMinimized;
        this.renderRotateControls(root);
    }

    private updateCurrentDirection(): void {
        if (!this.options) return;
        
        const currentDirElement = this.shadowRoot?.querySelector('.current-direction');
        if (currentDirElement) {
            currentDirElement.textContent = `Current: ${this.options.character.direction || 'down'}`;
        }

        // Update preview character direction
        const previewCharacter = this.shadowRoot?.querySelector(`#rotate-preview-${this.options.character.name}`) as Character;
        if (previewCharacter && previewCharacter.updateAppearance) {
            previewCharacter.updateAppearance(
                this.options.character.race,
                this.options.character.palette,
                this.options.character.direction || 'down'
            );
        }
    }

    private handleDirectionSelect(direction: Direction) {
        if (!this.options) return;

        // Update the preview character's direction
        const previewCharacter = this.shadowRoot?.querySelector(`#rotate-preview-${this.options.character.name}`) as Character;
        if (previewCharacter && previewCharacter.updateAppearance) {
            previewCharacter.updateAppearance(
                this.options.character.race,
                this.options.character.palette,
                direction
            );
        }

        // Dispatch rotate event
        this.dispatch(ControlsEvent.rotate, this.options.character.name);
        
        // Dispatch event to notify that a direction was selected
        this.dispatchEvent(new CustomEvent('direction-selected', {
            detail: { 
                character: this.options.character,
                direction: direction
            },
            bubbles: true
        }));
    }

    // Custom element setup
    static {
        if (!customElements.get('rotate-selector')) {
            customElements.define('rotate-selector', RotateSelector);
        }
    }
}