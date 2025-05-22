import { ControlsEvent } from "../../common/events";
import { Component } from "../Component";

export default class Cell extends Component {
    protected override hasCss = true;
    protected override hasHtml = false;
    static get observedAttributes() {
        return ['content'];
    }
    constructor() {
        super();
        this.addEventListener('click', () => this.onClick())
    }
    private onClick() {
        this.dispatch(ControlsEvent.cellClick, { x: 1, y: 2 })
    }
    attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null) {
        if (oldVal === newVal) return;
        switch (name) {
            case 'content':
                if (newVal === 'wall') {
                    this.innerText = '#';
                } else {
                    this.innerText = ' ';
                }
                break;
        }
    }
}

customElements.define('cell-component', Cell);
