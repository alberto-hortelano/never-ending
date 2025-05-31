import { GUIEvent, ControlsEvent } from "../../common/events";
import { ICoord } from "../../common/interfaces";
import { Component } from "../Component";

export default class Cell extends Component {
    static get observedAttributes() {
        return ['content'];
    }
    static states = ['highlight'];
    protected override hasCss = true;
    protected override hasHtml = false;
    private coords: ICoord = { x: -1, y: -1 };

    constructor() {
        super();
        this.addEventListener('click', () => this.onClick());
    }

    override async connectedCallback(): Promise<ShadowRoot | undefined> {
        const root = await super.connectedCallback();
        this.coords = {
            x: parseInt(this.dataset.x!),
            y: parseInt(this.dataset.y!),
        };
        this.listen(GUIEvent.cellHighlight, () => this.onHighlight(), JSON.stringify(this.coords));
        this.listen(GUIEvent.cellReset, () => this.onReset(), JSON.stringify(this.coords));
        return root;
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
    private onClick() {
        this.dispatch(ControlsEvent.cellClick, this.coords);
    }
    private onHighlight() {
        this.classList.add('highlight');
    }
    private onReset() {
        this.classList.remove(...Cell.states);
    }
}

customElements.define('cell-component', Cell);
