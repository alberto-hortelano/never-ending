import { StateChangeEvent, StateChangeEventsMap } from "../../common/events";
import { Component } from "../Component";

export default class Characters extends Component {
    protected override hasCss = true;
    protected override hasHtml = true;

    constructor() {
        super();
        this.listen(StateChangeEvent.characters, (characters) => this.printCharacters(characters));
    }
    
    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;
        
        // Initialize characters from state if available
        const state = this.getState();
        if (state && state.characters.length > 0) {
            this.printCharacters(state.characters);
        }
        
        return root;
    }
    private printCharacters(characters: StateChangeEventsMap[StateChangeEvent.characters]) {
        // Clear existing characters first
        this.innerHTML = '';
        
        characters.forEach(characterData => {
            const characterElement = document.createElement('character-component');
            characterElement.id = characterData.name;
            // Character will get its data from the global state
            this.appendChild(characterElement);
        });
    }
}

customElements.define('characters-component', Characters);
