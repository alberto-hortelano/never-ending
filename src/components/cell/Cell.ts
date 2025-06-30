import { GUIEvent, ControlsEvent } from "../../common/events";
import { ICoord } from "../../common/interfaces";
import { Component } from "../Component";

export default class Cell extends Component {
    static get observedAttributes() {
        return ['content'];
    }
    static states = ['highlight', 'highlight-intensity'];
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
        this.listen(GUIEvent.cellHighlightIntensity, (data) => this.onHighlightIntensity(data.intensity), JSON.stringify(this.coords));
        this.listen(GUIEvent.cellReset, () => this.onReset(), JSON.stringify(this.coords));
        return root;
    }
    attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null) {
        if (oldVal === newVal) return;
        switch (name) {
            case 'content':
                if (newVal === 'wall') {
                    this.classList.add('wall');
                } else {
                    this.innerText = ' ';
                }
                break;
        }
    }
    private onClick() {
        // this.classList.toggle('wall');
        this.dispatch(ControlsEvent.cellClick, this.coords);
    }
    private onHighlight() {
        this.classList.add('highlight');
    }
    private onHighlightIntensity(intensity: number) {
        // Remove existing highlight classes
        this.classList.remove('highlight', 'highlight-intensity');
        
        // Add intensity-based highlight
        this.classList.add('highlight-intensity');
        
        // Set CSS variable for intensity
        this.style.setProperty('--highlight-intensity', intensity.toString());
    }
    private onReset() {
        this.classList.remove(...Cell.states);
        this.style.removeProperty('--highlight-intensity');
    }
}

customElements.define('cell-component', Cell);
