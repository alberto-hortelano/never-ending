import { BaseEvent, EventsMap } from "../../common/events";
import { Component } from "../Component";

export default class Characters extends Component {
    protected override hasCss = true;
    protected override hasHtml = true;

    constructor() {
        super();
        this.listen(BaseEvent.characters, (characters) => this.printCharacters(characters));
        console.log('>>> - Characters - constructor - this:', this)
    }
    private printCharacters(characters: EventsMap[BaseEvent.characters]) {
        characters.forEach(characterData => {
            const characterElement = document.createElement('character-component');
            characterElement.dataset.x = characterData.cell.position.x.toString();
            characterElement.dataset.y = characterData.cell.position.y.toString();
            this.appendChild(characterElement);
            console.log('>>> - Characters - printCharacters - characterData:', characterData)
        })
    }
}

customElements.define('characters-component', Characters);
