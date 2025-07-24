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
        
        // Listen for highlight changes
        // NOTE: We no longer dispatch individual updates here because highlights
        // are now handled in batch by the State when it receives UpdateStateEvent.uiHighlights
        this.listen(StateChangeEvent.uiTransient, () => {
            // This event is still fired but cells will be updated via uiVisualStates
            // which is more efficient than having each cell dispatch individual updates
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
