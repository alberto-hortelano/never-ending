import { Component } from "../Component";

export default class Movable extends Component {
    protected override hasCss = true;
    protected override hasHtml = false;
    constructor() {
        super();
    }
    protected onClick() {
        console.log('Movable')
    }
}

customElements.define('movable-component', Movable);
