import { GameEventsMap, GameEvent } from "../../common/events";
import { Component } from "../Component";

export default class Characters extends Component {
    protected override hasCss = true;
    protected override hasHtml = true;

    constructor() {
        super();
        this.listen(GameEvent.characters, (characters) => this.printCharacters(characters));
    }
    private printCharacters(characters: GameEventsMap[GameEvent.characters]) {
        characters.forEach(characterData => {
            const characterElement = document.createElement('character-component');
            characterElement.dataset.x = characterData.cell.position.x.toString();
            characterElement.dataset.y = characterData.cell.position.y.toString();
            this.appendChild(characterElement);
        })
    }
}

customElements.define('characters-component', Characters);
