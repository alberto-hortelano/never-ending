import { Component } from "../Component";
import { GUIEvent } from "../../common/events";
import type { TooltipData } from "../../common/interfaces";

export default class Tooltip extends Component {
    protected override hasCss = true;
    protected override hasHtml = true;
    
    private tooltipElement?: HTMLElement;
    private hideTimeout?: number;
    private lastUpdateTime: number = 0;
    private debounceDelay: number = 50; // milliseconds
    
    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;
        
        this.tooltipElement = root.querySelector('.tooltip-content') as HTMLElement;
        
        // Listen for tooltip events
        this.listen(GUIEvent.tooltipShow, (data) => this.showTooltip(data));
        this.listen(GUIEvent.tooltipHide, () => this.hideTooltip());
        this.listen(GUIEvent.tooltipUpdate, (data) => this.updateTooltip(data));
        
        return root;
    }
    
    private showTooltip(data: TooltipData) {
        // Debounce rapid updates
        const now = Date.now();
        if (now - this.lastUpdateTime < this.debounceDelay) {
            return;
        }
        this.lastUpdateTime = now;
        
        if (!this.tooltipElement) return;
        
        // Clear any existing hide timeout
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = undefined;
        }
        
        // Update content
        this.updateContent(data);
        
        // Show with animation
        requestAnimationFrame(() => {
            if (this.tooltipElement) {
                this.tooltipElement.classList.add('visible');
                
                // Auto-hide on mobile after 2 seconds
                if (this.isMobileDevice() && data.autoHide !== false) {
                    this.hideTimeout = window.setTimeout(() => {
                        this.hideTooltip();
                    }, 2000);
                }
            }
        });
    }
    
    private updateTooltip(data: TooltipData) {
        if (!this.tooltipElement || !this.tooltipElement.classList.contains('visible')) {
            return;
        }
        
        this.updateContent(data);
    }
    
    private hideTooltip() {
        if (!this.tooltipElement) return;
        
        // Clear any pending hide timeout
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = undefined;
        }
        
        this.tooltipElement.classList.remove('visible');
    }
    
    private updateContent(data: TooltipData) {
        if (!this.tooltipElement) return;
        
        // Clear existing content
        this.tooltipElement.innerHTML = '';
        
        // Add type-specific styling
        this.tooltipElement.className = `tooltip-content ${data.type || 'default'}`;
        
        // Create main text
        const mainText = document.createElement('div');
        mainText.className = 'tooltip-main';
        mainText.textContent = data.text;
        this.tooltipElement.appendChild(mainText);
        
        // Add secondary info if provided
        if (data.subtext) {
            const subText = document.createElement('div');
            subText.className = 'tooltip-sub';
            subText.textContent = data.subtext;
            this.tooltipElement.appendChild(subText);
        }
        
        // Add additional details if provided
        if (data.details) {
            const detailsContainer = document.createElement('div');
            detailsContainer.className = 'tooltip-details';
            
            data.details.forEach(detail => {
                const detailElement = document.createElement('div');
                detailElement.className = 'tooltip-detail';
                
                if (detail.label) {
                    const label = document.createElement('span');
                    label.className = 'detail-label';
                    label.textContent = detail.label + ': ';
                    detailElement.appendChild(label);
                }
                
                const value = document.createElement('span');
                value.className = 'detail-value';
                value.textContent = detail.value;
                if (detail.color) {
                    value.style.color = detail.color;
                }
                detailElement.appendChild(value);
                
                detailsContainer.appendChild(detailElement);
            });
            
            this.tooltipElement.appendChild(detailsContainer);
        }
    }
    
    private isMobileDevice(): boolean {
        // Check for touch support
        return 'ontouchstart' in window || 
               navigator.maxTouchPoints > 0 || 
               window.matchMedia('(pointer: coarse)').matches;
    }
    
    disconnectedCallback() {
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
        }
        this.eventBus.remove(this);
    }
}

customElements.define('tooltip-display', Tooltip);