import type { DeepReadonly } from "../../common/helpers/types";
import type { ICharacter } from "../../common/interfaces";
import { Component } from "../Component";

export class TalkCharacterList extends Component {
    protected override hasCss = true;
    protected override hasHtml = false;
    private talkingCharacter?: DeepReadonly<ICharacter>;
    private availableCharacters: DeepReadonly<ICharacter[]> = [];

    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;

        this.renderCharacterList(root);
        return root;
    }

    public setCharacters(talkingCharacter: DeepReadonly<ICharacter>, availableCharacters: DeepReadonly<ICharacter[]>) {
        this.talkingCharacter = talkingCharacter;
        this.availableCharacters = availableCharacters;
        
        const root = this.shadowRoot;
        if (root) {
            root.innerHTML = '';
            this.renderCharacterList(root);
        }
    }

    private renderCharacterList(root: ShadowRoot | HTMLElement) {
        const container = document.createElement('div');
        container.className = 'character-list-container';

        if (this.availableCharacters.length === 0) {
            const emptyMessage = document.createElement('p');
            emptyMessage.className = 'empty-message';
            emptyMessage.textContent = 'No one else is around to talk to.';
            container.appendChild(emptyMessage);
        } else {
            const list = document.createElement('div');
            list.className = 'character-list';

            this.availableCharacters.forEach((character: DeepReadonly<ICharacter>) => {
                const button = document.createElement('button');
                button.className = 'character-button';
                button.textContent = character.name;
                button.addEventListener('click', () => this.handleCharacterSelect(character));
                list.appendChild(button);
            });

            container.appendChild(list);
        }

        root.appendChild(container);
    }

    private handleCharacterSelect(selectedCharacter: DeepReadonly<ICharacter>) {
        if (this.talkingCharacter) {
            console.log(`${this.talkingCharacter.name} talks to ${selectedCharacter.name}`);
        }

        // Dispatch event to notify that a character was selected
        this.dispatchEvent(new CustomEvent('character-selected', {
            detail: { 
                talkingCharacter: this.talkingCharacter,
                selectedCharacter: selectedCharacter 
            },
            bubbles: true
        }));
    }

    // Custom element setup
    static {
        if (!customElements.get('talk-character-list')) {
            customElements.define('talk-character-list', TalkCharacterList);
        }
    }
}