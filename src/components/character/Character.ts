import { ComponentEvent, ComponentEventsMap } from "../../common/events";
import Movable from "../movable/Movable";

export default class Character extends Movable {
    protected override hasCss = true;
    protected override hasHtml = true;

    constructor() {
        super();

        this.listen(ComponentEvent.characterPosition, (character) => this.setPosition(character));
    }

    private setPosition(character: ComponentEventsMap[ComponentEvent.characterPosition]) {
        console.log('>>> - Character - setPosition - character:', character)

    }
}

customElements.define('character-component', Character);
