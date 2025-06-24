import type { ICoord } from "../interfaces";

export class DragScroll {
    private prevX = 0;
    private prevY = 0;
    private isDragging = false;
    private scrollSpeed = 20;
    private activeKeys = new Set<string>();
    private animationId: number | null = null;

    constructor(private el: HTMLElement) {
        this.onTouchStart = this.onTouchStart.bind(this);
        this.onTouchMove = this.onTouchMove.bind(this);
        this.onTouchEnd = this.onTouchEnd.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
        this.animate = this.animate.bind(this);

        this.el.addEventListener("touchstart", this.onTouchStart, { passive: true });
        this.el.addEventListener("touchmove", this.onTouchMove, { passive: false });
        this.el.addEventListener("touchend", this.onTouchEnd, { passive: true });
        this.el.addEventListener("touchcancel", this.onTouchEnd, { passive: true });
        this.el.addEventListener("keydown", this.onKeyDown);
        this.el.addEventListener("keyup", this.onKeyUp);

        // Make element focusable for keyboard events
        if (!this.el.hasAttribute('tabindex')) {
            this.el.setAttribute('tabindex', '0');
        }
    }

    public scrollTo(position: ICoord, retries = 10) {
        const attemptScroll = () => {
            this.el.scroll(position.x, position.y);
            // Check if scroll was successful after a short delay
            requestAnimationFrame(() => {
                const scrolled = this.el.scrollTop > 0 || this.el.scrollLeft > 0;
                const targetIsZero = position.x === 0 && position.y === 0;

                if (!scrolled && !targetIsZero && retries > 0) {
                    this.scrollTo(position, retries - 1);
                }
            });
        };

        // Initial attempt with small delay
        requestAnimationFrame(attemptScroll);
    }

    private onTouchStart(e: TouchEvent): void {
        const t = e.touches[0];
        if (e.touches.length !== 1 || !t) return; // single-finger only
        this.prevX = t.clientX;
        this.prevY = t.clientY;
        this.isDragging = true;
    }

    private onTouchMove(e: TouchEvent): void {
        const t = e.touches[0];
        if (!this.isDragging || e.touches.length !== 1 || !t) return;
        e.preventDefault(); // block native scroll

        const dx = t.clientX - this.prevX;
        const dy = t.clientY - this.prevY;

        // Apply exactly the same delta on both axes
        this.el.scrollLeft -= dx;
        this.el.scrollTop -= dy;

        // Update for next move
        this.prevX = t.clientX;
        this.prevY = t.clientY;
    }

    private onTouchEnd(): void {
        this.isDragging = false;
    }

    private onKeyDown(e: KeyboardEvent): void {
        const key = e.key.toLowerCase();
        const validKeys = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'];

        if (!validKeys.includes(key)) return;

        e.preventDefault();

        if (!this.activeKeys.has(key)) {
            this.activeKeys.add(key);
            if (this.activeKeys.size === 1) {
                this.startAnimation();
            }
        }
    }

    private onKeyUp(e: KeyboardEvent): void {
        const key = e.key.toLowerCase();

        if (this.activeKeys.has(key)) {
            this.activeKeys.delete(key);
            if (this.activeKeys.size === 0) {
                this.stopAnimation();
            }
        }
    }

    private startAnimation(): void {
        if (this.animationId === null) {
            this.animate();
        }
    }

    private stopAnimation(): void {
        if (this.animationId !== null) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    private animate(): void {
        console.log('>>> - DragScroll - animate - animate:')
        if (this.activeKeys.size === 0) {
            this.stopAnimation();
            return;
        }

        let scrollX = 0;
        let scrollY = 0;

        // Calculate movement based on active keys
        if (this.activeKeys.has('arrowup') || this.activeKeys.has('w')) {
            scrollY -= this.scrollSpeed;
        }
        if (this.activeKeys.has('arrowdown') || this.activeKeys.has('s')) {
            scrollY += this.scrollSpeed;
        }
        if (this.activeKeys.has('arrowleft') || this.activeKeys.has('a')) {
            scrollX -= this.scrollSpeed;
        }
        if (this.activeKeys.has('arrowright') || this.activeKeys.has('d')) {
            scrollX += this.scrollSpeed;
        }

        // Apply diagonal movement normalization
        if (scrollX !== 0 && scrollY !== 0) {
            const factor = Math.sqrt(2) / 2; // ~0.707 to maintain consistent speed
            scrollX *= factor;
            scrollY *= factor;
        }

        this.el.scrollLeft += scrollX;
        this.el.scrollTop += scrollY;

        this.animationId = requestAnimationFrame(this.animate);
    }
}
