import { Component } from "../Component";

export default class Movable extends Component {
    protected override hasCss = true;
    protected override hasHtml = true;
    constructor() {
        super();
    }
    static get observedAttributes() {
        return ['data-x', 'data-y'];
    }
    attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null) {
        if (oldVal === newVal) return;
        if (name === 'data-x') this.style.setProperty('--x', newVal);
        if (name === 'data-y') this.style.setProperty('--y', newVal);
    }
}

customElements.define('movable-component', Movable);
