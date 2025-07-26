import { ControlsEvent, StateChangeEvent } from "../../common/events";
import { ICoord, ICellVisualState } from "../../common/interfaces";
import { Component } from "../Component";

export default class Cell extends Component {
    static get observedAttributes() {
        return ['content'];
    }
    static states = ['highlight', 'highlight-intensity'];
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
        this.dispatch(ControlsEvent.cellHover, this.coords);
    }
    
    private onMouseLeave() {
        this.dispatch(ControlsEvent.cellHoverEnd, null);
    }
    private applyVisualState(visualState: ICellVisualState) {
        // Use requestAnimationFrame to batch DOM updates
        requestAnimationFrame(() => {
            // Reset ALL highlight-related classes first
            this.classList.remove('highlight', 'highlight-movement', 'highlight-path', 'highlight-attack', 'highlight-intensity');
            this.style.removeProperty('--highlight-intensity');

            // Apply new classes from visual state
            visualState.classList.forEach(cls => {
                this.classList.add(cls);
            });

            // Apply highlight type if specified
            if (visualState.isHighlighted && visualState.highlightType) {
                this.classList.add(`highlight-${visualState.highlightType}`);
            }

            // Apply highlight intensity if specified
            if (visualState.highlightIntensity !== undefined) {
                this.classList.add('highlight-intensity');
                this.style.setProperty('--highlight-intensity', visualState.highlightIntensity.toString());
            }
        });
    }

    private resetVisualState() {
        requestAnimationFrame(() => {
            this.classList.remove('highlight', 'highlight-movement', 'highlight-path', 'highlight-attack', 'highlight-intensity');
            this.style.removeProperty('--highlight-intensity');
        });
    }
}

customElements.define('cell-component', Cell);
