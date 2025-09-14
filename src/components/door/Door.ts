import { Component } from "../Component";
import { IDoor, TooltipData } from "../../common/interfaces";
import { ControlsEvent, StateChangeEvent, GUIEvent } from "../../common/events";
import { DeepReadonly } from "../../common/helpers/types";
import { i18n } from "../../common/i18n/i18n";

export default class Door extends Component {
    protected override hasCss = true;
    protected override hasHtml = false;

    static get observedAttributes() {
        return ['door-id', 'door-type', 'door-side', 'is-open', 'is-locked'];
    }

    constructor() {
        super();
        this.addEventListener('click', this.onClick.bind(this));
        this.addEventListener('mouseenter', this.onMouseEnter.bind(this));
        this.addEventListener('mouseleave', this.onMouseLeave.bind(this));
        this.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: true });
    }

    override async connectedCallback(): Promise<ShadowRoot | null> {
        const root = await super.connectedCallback();
        if (!root) return null;

        // Listen for door state changes
        this.listen(StateChangeEvent.doors, (doors) => {
            const doorId = this.getAttribute('door-id');
            if (doorId && doors[doorId]) {
                this.updateDoor(doors[doorId]);
            }
        });

        return root;
    }

    attributeChangedCallback(name: string, oldVal: string | null, newVal: string | null) {
        if (oldVal === newVal) return;

        switch (name) {
            case 'door-type':
                this.classList.remove('regular', 'locked', 'transition');
                if (newVal) this.classList.add(newVal);
                break;

            case 'door-side':
                this.classList.remove('north', 'south', 'east', 'west', 'between');
                if (newVal) this.classList.add(newVal);
                break;

            case 'is-open':
                if (newVal === 'true') {
                    this.classList.add('open');
                } else {
                    this.classList.remove('open');
                }
                break;

            case 'is-locked':
                if (newVal === 'true') {
                    this.classList.add('locked');
                } else {
                    this.classList.remove('locked');
                }
                break;
        }
    }

    private updateDoor(door: DeepReadonly<IDoor>) {
        this.setAttribute('door-type', door.type);
        this.setAttribute('door-side', door.side);
        this.setAttribute('is-open', door.isOpen.toString());
        this.setAttribute('is-locked', door.isLocked.toString());

        // Update tooltip/title
        if (door.type === 'transition' && door.transition) {
            this.title = door.transition.description;
        } else if (door.isLocked) {
            this.title = i18n.t('ui.lockedDoor');
        } else {
            this.title = door.isOpen ? i18n.t('ui.openDoor') : i18n.t('ui.closedDoor');
        }
    }

    private onClick(event: Event) {
        event.stopPropagation();

        const doorId = this.getAttribute('door-id');
        if (!doorId) return;

        // Dispatch door interaction event
        this.dispatch(ControlsEvent.doorClick, { doorId });

        // Handle door interaction
        const state = this.getState();
        if (state?.doors && state.doors[doorId]) {
            const door = state.doors[doorId];

            if (door.type === 'transition' && door.transition) {
                // Show transition description
                console.log('Transition door:', door.transition.description);
                // This would trigger a storyline event or map transition
            } else if (door.isLocked) {
                // Show locked message
                console.log('Door is locked. Requires:', door.keyRequired);
            } else {
                // Toggle regular door
                console.log('Toggling door:', doorId);
            }
        }
    }
    
    private onMouseEnter() {
        const doorType = this.getAttribute('door-type') || 'regular';
        const isOpen = this.getAttribute('is-open') === 'true';
        const isLocked = this.getAttribute('is-locked') === 'true';
        
        const tooltipData: TooltipData = {
            text: this.getDoorTypeLabel(doorType),
            type: 'door',
            details: []
        };
        
        // Add state info
        if (doorType === 'transition') {
            const title = this.title;
            if (title && title !== 'Transition door') {
                tooltipData.subtext = title;
            }
        } else {
            let state = isOpen ? i18n.t('ui.openState') : i18n.t('ui.closedState');
            if (isLocked) state = i18n.t('ui.lockedState');
            tooltipData.details?.push({
                label: i18n.t('ui.doorStateLabel'),
                value: state,
                color: isLocked ? '#ff6464' : (isOpen ? '#64ff64' : '#ffaa64')
            });
        }
        
        this.dispatch(GUIEvent.tooltipShow, tooltipData);
    }
    
    private onMouseLeave() {
        this.dispatch(GUIEvent.tooltipHide, undefined);
    }
    
    private onTouchStart() {
        const doorType = this.getAttribute('door-type') || 'regular';
        const isOpen = this.getAttribute('is-open') === 'true';
        const isLocked = this.getAttribute('is-locked') === 'true';
        
        const tooltipData: TooltipData = {
            text: this.getDoorTypeLabel(doorType),
            type: 'door',
            autoHide: true
        };
        
        if (doorType === 'transition') {
            const title = this.title;
            if (title && title !== 'Transition door') {
                tooltipData.subtext = title;
            }
        } else {
            let state = isLocked ? '🔒' : (isOpen ? '📂' : '📁');
            tooltipData.subtext = state;
        }
        
        this.dispatch(GUIEvent.tooltipShow, tooltipData);
    }
    
    private getDoorTypeLabel(type: string): string {
        switch (type) {
            case 'transition':
                return i18n.t('ui.exitDoor');
            case 'locked':
                return i18n.t('ui.lockedDoor');
            default:
                return i18n.t('ui.door');
        }
    }
}

customElements.define('door-component', Door);