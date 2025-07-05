import type { DeepReadonly } from "../../common/helpers/types";
import type { ICharacter } from "../../common/interfaces";
import { Component } from "../Component";
import type Character from "../character/Character";
import { CharacterService } from "../../common/services/CharacterService";

export interface SelectCharacterOptions {
    characters: DeepReadonly<ICharacter[]>;
    excludeByName?: string;
    emptyMessage?: string;
    title?: string;
}

export class SelectCharacter extends Component {
    protected override hasCss = true;
    protected override hasHtml = false;
    private options: SelectCharacterOptions = {
        characters: [],
        emptyMessage: 'No characters available.',
        title: 'Select Character'
    };

    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;

        this.renderCharacterList(root);
        return root;
    }

    public setOptions(options: SelectCharacterOptions) {
        this.options = { ...this.options, ...options };
        
        const root = this.shadowRoot;
        if (root) {
            root.innerHTML = '';
            this.renderCharacterList(root);
        }
    }

    private getFilteredCharacters(): DeepReadonly<ICharacter[]> {
        return CharacterService.filterCharacters(this.options.characters, {
            excludeByName: this.options.excludeByName
        });
    }

    private renderCharacterList(root: ShadowRoot | HTMLElement) {
        const container = document.createElement('div');
        container.className = 'character-list-container';

        const filteredCharacters = this.getFilteredCharacters();

        if (filteredCharacters.length === 0) {
            const emptyMessage = document.createElement('p');
            emptyMessage.className = 'empty-message';
            emptyMessage.textContent = this.options.emptyMessage || 'No characters available.';
            container.appendChild(emptyMessage);
        } else {
            const list = document.createElement('div');
            list.className = 'character-list';

            filteredCharacters.forEach((character: DeepReadonly<ICharacter>) => {
                const item = document.createElement('div');
                item.className = 'character-item';
                
                // Create character icon
                const iconWrapper = document.createElement('div');
                iconWrapper.className = 'character-icon-wrapper';
                
                const characterIcon = document.createElement('character-component') as Character;
                characterIcon.classList.add('character-icon');
                characterIcon.setAttribute('data-name', character.name);
                characterIcon.setAttribute('data-race', character.race);
                characterIcon.setAttribute('data-palette', JSON.stringify(character.palette));
                // Set position to 0,0 for icon display
                characterIcon.setAttribute('data-x', '0');
                characterIcon.setAttribute('data-y', '0');
                characterIcon.id = `icon-${character.name}`;
                
                iconWrapper.appendChild(characterIcon);
                
                // Create character info
                const info = document.createElement('div');
                info.className = 'character-info';
                
                const nameElement = document.createElement('h4');
                nameElement.className = 'character-name';
                nameElement.textContent = character.name;
                
                const descElement = document.createElement('p');
                descElement.className = 'character-description';
                descElement.textContent = character.description || '';
                
                info.appendChild(nameElement);
                if (character.description) {
                    info.appendChild(descElement);
                }
                
                // Create button
                const button = document.createElement('button');
                button.className = 'character-button';
                button.addEventListener('click', () => this.handleCharacterSelect(character));
                
                button.appendChild(iconWrapper);
                button.appendChild(info);
                
                item.appendChild(button);
                list.appendChild(item);
            });

            container.appendChild(list);
        }

        root.appendChild(container);
    }

    private handleCharacterSelect(selectedCharacter: DeepReadonly<ICharacter>) {
        // Dispatch event to notify that a character was selected
        this.dispatchEvent(new CustomEvent('character-selected', {
            detail: { 
                selectedCharacter: selectedCharacter 
            },
            bubbles: true
        }));
    }

    // Custom element setup
    static {
        if (!customElements.get('select-character')) {
            customElements.define('select-character', SelectCharacter);
        }
    }
}