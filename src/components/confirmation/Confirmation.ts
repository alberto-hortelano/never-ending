import { Component } from "../Component";

export interface ConfirmationOptions {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel?: () => void;
}

export class Confirmation extends Component {
    protected override hasCss = true;
    protected override hasHtml = false;
    private options?: ConfirmationOptions;

    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;

        // If options are already set, render them
        if (this.options) {
            this.renderConfirmation(root);
        }
        return root;
    }

    public setOptions(options: ConfirmationOptions) {
        this.options = {
            confirmText: 'Confirm',
            cancelText: 'Cancel',
            ...options
        };
        
        const root = this.shadowRoot;
        if (root) {
            root.innerHTML = '';
            this.renderConfirmation(root);
        }
    }

    private renderConfirmation(root: ShadowRoot | HTMLElement) {
        if (!this.options) return;

        const container = document.createElement('div');
        container.className = 'confirmation-container';

        // Title
        const title = document.createElement('h3');
        title.className = 'confirmation-title';
        title.textContent = this.options.title;
        container.appendChild(title);

        // Message
        const message = document.createElement('p');
        message.className = 'confirmation-message';
        message.textContent = this.options.message;
        container.appendChild(message);

        // Buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'confirmation-buttons';

        const confirmButton = document.createElement('button');
        confirmButton.className = 'confirm-button';
        confirmButton.textContent = this.options.confirmText || 'Confirm';
        confirmButton.addEventListener('click', () => {
            this.options?.onConfirm();
            this.dispatchEvent(new CustomEvent('confirmed', { bubbles: true }));
        });

        const cancelButton = document.createElement('button');
        cancelButton.className = 'cancel-button';
        cancelButton.textContent = this.options.cancelText || 'Cancel';
        cancelButton.addEventListener('click', () => {
            this.options?.onCancel?.();
            this.dispatchEvent(new CustomEvent('cancelled', { bubbles: true }));
        });

        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(confirmButton);
        container.appendChild(buttonContainer);

        root.appendChild(container);
    }

    // Custom element setup
    static {
        if (!customElements.get('confirmation-component')) {
            customElements.define('confirmation-component', Confirmation);
        }
    }
}