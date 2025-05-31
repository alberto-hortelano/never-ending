import { StateChangeEvent, StateChangeEventsMap } from "../../common/events";
import { Component } from "../Component";

export default class Characters extends Component {
    protected override hasCss = true;
    protected override hasHtml = true;

    constructor() {
        super();
        this.listen(StateChangeEvent.characters, (characters) => this.printCharacters(characters));
    }
    private printCharacters(characters: StateChangeEventsMap[StateChangeEvent.characters]) {
        characters.forEach(characterData => {
            const characterElement = document.createElement('character-component');
            characterElement.dataset.x = characterData.position.x.toString();
            characterElement.dataset.y = characterData.position.y.toString();
            characterElement.id = characterData.name;
            this.appendChild(characterElement);
        });
    }
}

customElements.define('characters-component', Characters);
