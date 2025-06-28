export class Draggable {
    private isDragging = false;
    private startX = 0;
    private startY = 0;
    private elementStartX = 0;
    private elementStartY = 0;
    private dragHandle: HTMLElement;

    constructor(private element: HTMLElement, handle?: HTMLElement) {
        this.dragHandle = handle || element;
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onTouchStart = this.onTouchStart.bind(this);
        this.onTouchMove = this.onTouchMove.bind(this);
        this.onTouchEnd = this.onTouchEnd.bind(this);

        // Mouse events
        this.dragHandle.addEventListener('mousedown', this.onMouseDown);
        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('mouseup', this.onMouseUp);

        // Touch events
        this.dragHandle.addEventListener('touchstart', this.onTouchStart, { passive: false });
        document.addEventListener('touchmove', this.onTouchMove, { passive: false });
        document.addEventListener('touchend', this.onTouchEnd);

        // Set cursor style
        this.dragHandle.style.cursor = 'move';
        
        // Ensure element is positioned absolutely if not already
        if (getComputedStyle(this.element).position === 'static') {
            this.element.style.position = 'absolute';
        }
    }

    private onMouseDown(e: MouseEvent): void {
        e.preventDefault();
        this.startDrag(e.clientX, e.clientY);
    }

    private onTouchStart(e: TouchEvent): void {
        if (e.touches.length !== 1) return;
        e.preventDefault();
        const touch = e.touches[0];
        if (touch) {
            this.startDrag(touch.clientX, touch.clientY);
        }
    }

    private startDrag(clientX: number, clientY: number): void {
        this.isDragging = true;
        this.startX = clientX;
        this.startY = clientY;
        
        const rect = this.element.getBoundingClientRect();
        this.elementStartX = rect.left;
        this.elementStartY = rect.top;
        
        this.element.style.userSelect = 'none';
        this.dragHandle.style.cursor = 'grabbing';
    }

    private onMouseMove(e: MouseEvent): void {
        if (!this.isDragging) return;
        this.updatePosition(e.clientX, e.clientY);
    }

    private onTouchMove(e: TouchEvent): void {
        if (!this.isDragging || e.touches.length !== 1) return;
        e.preventDefault();
        const touch = e.touches[0];
        if (touch) {
            this.updatePosition(touch.clientX, touch.clientY);
        }
    }

    private updatePosition(clientX: number, clientY: number): void {
        const deltaX = clientX - this.startX;
        const deltaY = clientY - this.startY;
        
        const newX = this.elementStartX + deltaX;
        const newY = this.elementStartY + deltaY;
        
        // Get element dimensions
        const elementWidth = this.element.offsetWidth;
        const elementHeight = this.element.offsetHeight;
        
        // Keep element within viewport bounds
        const maxX = window.innerWidth - elementWidth;
        const maxY = window.innerHeight - elementHeight;
        
        const boundedX = Math.max(0, Math.min(newX, maxX));
        const boundedY = Math.max(0, Math.min(newY, maxY));
        
        this.element.style.left = `${boundedX}px`;
        this.element.style.top = `${boundedY}px`;
    }

    private onMouseUp(): void {
        this.endDrag();
    }

    private onTouchEnd(): void {
        this.endDrag();
    }

    private endDrag(): void {
        if (!this.isDragging) return;
        
        this.isDragging = false;
        this.element.style.userSelect = '';
        this.dragHandle.style.cursor = 'move';
    }

    public destroy(): void {
        this.dragHandle.removeEventListener('mousedown', this.onMouseDown);
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mouseup', this.onMouseUp);
        this.dragHandle.removeEventListener('touchstart', this.onTouchStart);
        document.removeEventListener('touchmove', this.onTouchMove);
        document.removeEventListener('touchend', this.onTouchEnd);
    }
}