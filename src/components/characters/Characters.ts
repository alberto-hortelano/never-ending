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
        // Clear existing characters first
        this.innerHTML = '';
        
        characters.forEach(characterData => {
            const characterElement = document.createElement('character-component');
            characterElement.dataset.x = characterData.position.x.toString();
            characterElement.dataset.y = characterData.position.y.toString();
            characterElement.id = characterData.name;
            characterElement.dataset.palette = JSON.stringify(characterData.palette);
            characterElement.dataset.race = characterData.race;
            characterElement.dataset.direction = characterData.direction;
            characterElement.dataset.player = characterData.player;
            characterElement.dataset.health = characterData.health.toString();
            characterElement.dataset.maxHealth = characterData.maxHealth.toString();
            this.appendChild(characterElement);
        });
    }
}

customElements.define('characters-component', Characters);
