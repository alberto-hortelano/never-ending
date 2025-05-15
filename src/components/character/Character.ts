import Movable from "../movable/Movable";

export default class Character extends Movable {
    protected override hasCss = true;
    protected override hasHtml = true;
}

customElements.define('character-component', Character);
