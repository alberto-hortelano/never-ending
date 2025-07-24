import { Component } from "../Component";
import { UpdateStateEvent } from "../../common/events";
import { ANIMATION_DURATIONS } from "../../common/constants";

export default class Projectile extends Component {
    protected override hasCss = true;
    protected override hasHtml = true;

    private fromX = 0;
    private fromY = 0;
    private toX = 0;
    private toY = 0;
    private type: 'bullet' | 'laser' = 'bullet';

    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;

        // Get projectile data from dataset
        this.fromX = parseFloat(this.dataset.fromX || '0');
        this.fromY = parseFloat(this.dataset.fromY || '0');
        this.toX = parseFloat(this.dataset.toX || '0');
        this.toY = parseFloat(this.dataset.toY || '0');
        this.type = (this.dataset.type as 'bullet' | 'laser') || 'bullet';

        // Calculate angle
        const dx = this.toX - this.fromX;
        const dy = this.toY - this.fromY;
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;

        // Set initial position
        this.style.setProperty('--from-x', `${this.fromX}`);
        this.style.setProperty('--from-y', `${this.fromY}`);
        this.style.setProperty('--to-x', `${this.toX}`);
        this.style.setProperty('--to-y', `${this.toY}`);
        this.style.setProperty('--rotation', `${angle}deg`);

        // Add projectile type class
        const projectileElement = root.querySelector('.projectile');
        projectileElement?.classList.add(this.type);

        // Schedule removal through state after animation duration
        setTimeout(() => {
            // Dispatch event to remove this projectile from state
            if (this.id) {
                this.dispatch(UpdateStateEvent.uiRemoveProjectile, {
                    projectileId: this.id
                });
            }
        }, ANIMATION_DURATIONS.PROJECTILE);

        return root;
    }
}

customElements.define('projectile-component', Projectile);