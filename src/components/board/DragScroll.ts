export class DragScroll {
    private prevX = 0;
    private prevY = 0;
    private isDragging = false;

    constructor(private el: HTMLElement) {
        this.onTouchStart = this.onTouchStart.bind(this);
        this.onTouchMove = this.onTouchMove.bind(this);
        this.onTouchEnd = this.onTouchEnd.bind(this);

        this.el.addEventListener("touchstart", this.onTouchStart, { passive: true });
        this.el.addEventListener("touchmove", this.onTouchMove, { passive: false });
        this.el.addEventListener("touchend", this.onTouchEnd, { passive: true });
        this.el.addEventListener("touchcancel", this.onTouchEnd, { passive: true });
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
}
