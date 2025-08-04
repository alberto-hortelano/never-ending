import { Component } from "../Component";

export default class Movable extends Component {
    protected override hasCss = true;
    protected override hasHtml = true;
    
    constructor() {
        super();
    }
}

customElements.define('movable-component', Movable);
