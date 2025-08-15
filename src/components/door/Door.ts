import { Component } from "../Component";
import { IDoor } from "../../common/interfaces";
import { ControlsEvent, StateChangeEvent } from "../../common/events";
import { DeepReadonly } from "../../common/helpers/types";

export default class Door extends Component {
    protected override hasCss = true;
    protected override hasHtml = false;

    static get observedAttributes() {
        return ['door-id', 'door-type', 'door-side', 'is-open', 'is-locked'];
    }

    constructor() {
        super();
        this.addEventListener('click', this.onClick.bind(this));
    }

    override async connectedCallback(): Promise<ShadowRoot | undefined> {
        const root = await super.connectedCallback();
        if (!root) return root;

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
            this.title = 'Locked door';
        } else {
            this.title = door.isOpen ? 'Open door' : 'Closed door';
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
}

customElements.define('door-component', Door);