import type { DeepReadonly } from "../../common/helpers/types";
import type { ICharacter, Direction } from "../../common/interfaces";
import { Component } from "../Component";
import type Character from "../character/Character";
import { DirectionsService } from "../../common/services/DirectionsService";
import { createPreviewState } from "../../common/helpers/previewState";

export interface RotateSelectorOptions {
    character: DeepReadonly<ICharacter>;
}

export class RotateSelector extends Component {
    protected override hasCss = true;
    protected override hasHtml = false;
    private options?: RotateSelectorOptions;

    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;

        // If options are already set, render them
        if (this.options) {
            this.renderRotateControls(root);
        }
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

        const container = document.createElement('div');
        container.className = 'rotate-container';

        // Title
        const title = document.createElement('h3');
        title.className = 'rotate-title';
        title.textContent = `Rotate ${this.options.character.name}`;
        container.appendChild(title);

        // Create cross-shaped button layout
        const crossContainer = document.createElement('div');
        crossContainer.className = 'rotate-cross';

        // Character display in center
        const centerDisplay = document.createElement('div');
        centerDisplay.className = 'center-display';
        
        const characterIcon = document.createElement('character-component') as Character;
        characterIcon.classList.add('character-preview');
        characterIcon.id = `rotate-preview-${this.options.character.name}`;
        
        // Create a preview state with the character data
        const previewState = createPreviewState(this.options.character);
        characterIcon.setInstanceState(previewState);
        
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
        currentDirection.textContent = `Current direction: ${this.options.character.direction || 'down'}`;
        container.appendChild(currentDirection);

        root.appendChild(container);
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