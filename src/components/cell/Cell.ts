import { ControlsEvent, StateChangeEvent } from "../../common/events";
import { ICoord, ICellVisualState, IDoor } from "../../common/interfaces";
import { Component } from "../Component";
import "../door/Door";

declare global {
    interface Window {
        cellEventStats?: {
            count: number;
            totalTime: number;
            updateCount: number;
        };
    }
}

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
        
        // Parse coordinates from ID (format: "cell-x-y")
        const idParts = this.id.split('-');
        if (idParts.length === 3 && idParts[0] === 'cell' && idParts[1] && idParts[2]) {
            this.coords = {
                x: parseInt(idParts[1], 10),
                y: parseInt(idParts[2], 10),
            };
        } else {
            console.error('[Cell] Invalid cell ID format:', this.id);
            this.coords = { x: -1, y: -1 };
        }
        this.cellKey = `${this.coords.x},${this.coords.y}`;

        // Check for initial visual state from state
        const state = this.getState();
        if (state?.ui.visualStates.cells[this.cellKey]) {
            this.applyVisualState(state.ui.visualStates.cells[this.cellKey] as ICellVisualState);
        }
        
        // Check for doors at this position
        if (state?.doors) {
            this.renderDoors(state.doors as any);
        }

        // Listen for targeted cell updates (only for this specific cell)
        this.listen(StateChangeEvent.uiCellUpdate, (cellUpdate) => {
            if (cellUpdate.visualState) {
                this.applyVisualState(cellUpdate.visualState as ICellVisualState);
            } else {
                // No visual state means cell should be reset
                this.resetVisualState();
            }
        }, this.cellKey); // Use cellKey as filter to only receive updates for this cell
        
        // Listen for door state changes
        this.listen(StateChangeEvent.doors, (doors) => {
            this.renderDoors(doors as any);
        });

        // Add touch event listener for mobile
        this.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });

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
    private onTouchStart(e: TouchEvent) {
        // Prevent default to avoid scrolling
        e.preventDefault();
        
        // Dispatch touch enter event for path preview
        this.dispatch(ControlsEvent.cellMouseEnter, this.coords);
        
        // Dispatch click for all interaction modes on mobile
        // This enables: movement (tap to preview, tap to confirm), 
        // overwatch (tap to set direction, tap to activate)
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

                // Handle multiple highlight types (new)
                if (visualState.highlightTypes && visualState.highlightTypes.length > 0) {
                    visualState.highlightTypes.forEach(type => {
                        this.classList.add(`highlight-${type}`);
                    });
                } else if (visualState.highlightType) {
                    // Fallback to single highlight type (backward compatibility)
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
    
    private renderDoors(doors: Record<string, IDoor>) {
        // Remove existing door elements
        const existingDoors = this.querySelectorAll('door-component');
        existingDoors.forEach(door => door.remove());
        
        // Find doors at this position
        Object.entries(doors).forEach(([doorId, door]) => {
            if (door.position.x === this.coords.x && door.position.y === this.coords.y) {
                const doorElement = document.createElement('door-component');
                doorElement.setAttribute('door-id', doorId);
                doorElement.setAttribute('door-type', door.type);
                doorElement.setAttribute('door-side', door.side);
                doorElement.setAttribute('is-open', door.isOpen.toString());
                doorElement.setAttribute('is-locked', door.isLocked.toString());
                
                this.appendChild(doorElement);
            }
        });
    }
}

customElements.define('cell-component', Cell);
