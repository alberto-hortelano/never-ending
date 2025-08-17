import { Component } from '../Component';

export interface LoadingStep {
    id: string;
    label: string;
    status: 'pending' | 'active' | 'completed' | 'error';
    error?: string;
}

export class LoadingScreen extends Component {
    protected override hasHtml = true;
    protected override hasCss = true;
    
    private steps: LoadingStep[] = [];
    private originStory: any = null;
    private onFallback?: () => void;
    private onRetry?: () => void;
    
    constructor() {
        super();
    }
    
    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;
        
        this.renderContent(root);
        this.setupEventListeners(root);
        
        return root;
    }
    
    public setOriginStory(origin: any) {
        this.originStory = origin;
        const root = this.shadowRoot;
        if (root) {
            this.renderContent(root);
        }
    }
    
    public setSteps(steps: LoadingStep[]) {
        this.steps = steps;
        const root = this.shadowRoot;
        if (root) {
            this.renderContent(root);
        }
    }
    
    public updateStep(stepId: string, status: LoadingStep['status'], error?: string) {
        const step = this.steps.find(s => s.id === stepId);
        if (step) {
            step.status = status;
            if (error) {
                step.error = error;
            }
            const root = this.shadowRoot;
            if (root) {
                this.renderContent(root);
            }
        }
    }
    
    public setCallbacks(onFallback?: () => void, onRetry?: () => void) {
        this.onFallback = onFallback;
        this.onRetry = onRetry;
    }
    
    public showError(message: string) {
        const root = this.shadowRoot;
        if (root) {
            const errorContainer = root.querySelector('.error-message');
            if (errorContainer) {
                errorContainer.textContent = message;
                errorContainer.classList.add('visible');
            }
            
            // Show action buttons
            const actions = root.querySelector('.loading-actions');
            if (actions) {
                actions.classList.add('visible');
            }
        }
    }
    
    private renderContent(root: ShadowRoot) {
        const container = root.querySelector('.loading-container');
        if (!container) return;
        
        // Render origin story info if available
        let originHtml = '';
        if (this.originStory) {
            originHtml = `
                <div class="origin-info">
                    <h2>${this.originStory.nameES || this.originStory.name}</h2>
                    <p class="origin-description">${this.originStory.descriptionES || this.originStory.description}</p>
                </div>
            `;
        }
        
        // Render steps
        const stepsHtml = this.steps.map(step => {
            let statusClass = step.status;
            let statusIcon = '';
            
            switch(step.status) {
                case 'completed':
                    statusIcon = '✓';
                    break;
                case 'active':
                    statusIcon = '<span class="spinner"></span>';
                    break;
                case 'error':
                    statusIcon = '✗';
                    break;
                default:
                    statusIcon = '○';
            }
            
            return `
                <div class="loading-step ${statusClass}">
                    <span class="step-icon">${statusIcon}</span>
                    <span class="step-label">${step.label}</span>
                    ${step.error ? `<div class="step-error">${step.error}</div>` : ''}
                </div>
            `;
        }).join('');
        
        container.innerHTML = `
            ${originHtml}
            <div class="loading-title">
                <h3>Inicializando Historia...</h3>
            </div>
            <div class="loading-steps">
                ${stepsHtml}
            </div>
            <div class="error-message"></div>
            <div class="loading-actions">
                <button id="retryBtn" class="action-btn retry-btn">Reintentar</button>
                <button id="fallbackBtn" class="action-btn fallback-btn">Usar Estado Por Defecto</button>
            </div>
        `;
    }
    
    private setupEventListeners(root: ShadowRoot) {
        const retryBtn = root.getElementById('retryBtn');
        const fallbackBtn = root.getElementById('fallbackBtn');
        
        if (retryBtn && this.onRetry) {
            retryBtn.addEventListener('click', () => {
                // Hide error and actions
                const errorMsg = root.querySelector('.error-message');
                const actions = root.querySelector('.loading-actions');
                if (errorMsg) errorMsg.classList.remove('visible');
                if (actions) actions.classList.remove('visible');
                
                // Reset steps to pending
                this.steps.forEach(step => {
                    if (step.status === 'error') {
                        step.status = 'pending';
                        step.error = undefined;
                    }
                });
                this.renderContent(root);
                
                if (this.onRetry) {
                    this.onRetry();
                }
            });
        }
        
        if (fallbackBtn && this.onFallback) {
            fallbackBtn.addEventListener('click', () => {
                if (this.onFallback) {
                    this.onFallback();
                }
            });
        }
    }
    
    public show() {
        this.style.display = 'flex';
    }
    
    public hide() {
        this.style.display = 'none';
    }
}

customElements.define('loading-screen', LoadingScreen);