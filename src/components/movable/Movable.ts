import { Component } from "../Component";

export default class Movable extends Component {
    protected override hasCss = true;
    protected override hasHtml = false;
    constructor() {
        super();
        console.log('>>> - Movable - constructor!!!!!!!:', this)
    }
    static get observedAttributes() {
        return ['x', 'y'];
    }
    attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null) {
        console.log('>>> - Movable - attributeChangedCallback - name:', name)
        if (oldVal === newVal) return;
        this.style.setProperty(`--${name}`, newVal);
        console.log('>>> - Movable - attributeChangedCallback - name:', name, newVal)
    }
}

customElements.define('movable-component', Movable);
