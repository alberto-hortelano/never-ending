import { Component } from "../Component";

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

        console.log('Projectile created:', {
            from: { x: this.fromX, y: this.fromY },
            to: { x: this.toX, y: this.toY },
            type: this.type
        });
        console.log('PROJECTILE COMPONENT INSTANCE:', this);
        console.log('PROJECTILE SHADOW ROOT:', root);

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

        // Remove after animation (60 seconds)
        setTimeout(() => {
            this.remove();
        }, 400); // Match animation duration

        return root;
    }
}

customElements.define('projectile-component', Projectile);