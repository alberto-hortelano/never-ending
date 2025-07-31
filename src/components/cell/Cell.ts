import { ControlsEvent, StateChangeEvent } from "../../common/events";
import { ICoord, ICellVisualState } from "../../common/interfaces";
import { Component } from "../Component";

export default class Cell extends Component {
    static get observedAttributes() {
        return ['content'];
    }
    static states = ['highlight', 'highlight-intensity', 'highlight-movement', 'highlight-path', 'highlight-attack', 'highlight-overwatch', 'path'];
    protected override hasCss = true;
    protected override hasHtml = false;
    private coords: ICoord = { x: -1, y: -1 };
    private cellKey: string = '';

    constructor() {
        super();
        this.addEventListener('click', () => this.onClick());
        this.addEventListener('mouseenter', () => this.onMouseEnter());
        this.addEventListener('mouseleave', () => this.onMouseLeave());
    }

    override async connectedCallback(): Promise<ShadowRoot | undefined> {
        const root = await super.connectedCallback();
        this.coords = {
            x: parseInt(this.dataset.x!),
            y: parseInt(this.dataset.y!),
        };
        this.cellKey = `${this.coords.x},${this.coords.y}`;

        // Listen for UI state changes
        this.listen(StateChangeEvent.uiVisualStates, (visualStates) => {
            const cellVisualState = visualStates.cells[this.cellKey];
            if (cellVisualState) {
                this.applyVisualState(cellVisualState as ICellVisualState);
            } else {
                // No visual state means cell should be reset
                this.resetVisualState();
            }
        });

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
    private onMouseEnter() {
        this.dispatch(ControlsEvent.cellMouseEnter, this.coords);
    }
    private onMouseLeave() {
        this.dispatch(ControlsEvent.cellMouseLeave, this.coords);
    }
    private applyVisualState(visualState: ICellVisualState) {
        // Use requestAnimationFrame to batch DOM updates
        requestAnimationFrame(() => {
            // Reset classes
            this.classList.remove(...Cell.states);

            // Apply new classes
            visualState.classList.forEach(cls => {
                this.classList.add(cls);
            });

            // Apply highlight
            if (visualState.isHighlighted) {
                this.classList.add('highlight');

                if (visualState.highlightType) {
                    this.classList.add(`highlight-${visualState.highlightType}`);
                }

                if (visualState.highlightIntensity !== undefined) {
                    this.classList.add('highlight-intensity');
                    this.style.setProperty('--highlight-intensity', visualState.highlightIntensity.toString());
                }
            }
        });
    }

    private resetVisualState() {
        requestAnimationFrame(() => {
            this.classList.remove(...Cell.states);
            this.style.removeProperty('--highlight-intensity');
        });
    }
}

customElements.define('cell-component', Cell);
