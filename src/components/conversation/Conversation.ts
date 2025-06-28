import type { ConversationUpdateData } from "../../common/events/ConversationEvents";

import { Component } from "../Component";
import { ConversationEvent, ConversationEventsMap } from "../../common/events";

export class Conversation extends Component {
    protected override hasCss = true;
    protected override hasHtml = true;

    private contentElement?: HTMLElement;
    private answersElement?: HTMLElement;
    private loadingElement?: HTMLElement;
    private currentData?: ConversationUpdateData;

    override async connectedCallback() {
        const root = await super.connectedCallback();
        console.log('>>> - Conversation - overrideconnectedCallback - root:', root)
        if (!root) return root;

        // Get references to shadow DOM elements
        this.contentElement = root.querySelector('.conversation-content') as HTMLElement;
        this.answersElement = root.querySelector('.conversation-answers') as HTMLElement;
        this.loadingElement = root.querySelector('.conversation-loading') as HTMLElement;

        // Listen for conversation updates
        this.setupEventListeners();

        return root;
    }

    private setupEventListeners() {
        console.log('>>> - Conversation - setupEventListeners - setupEventListeners:', ConversationEvent.update)
        this.listen(ConversationEvent.update, (data: ConversationEventsMap[ConversationEvent.update]) => {
            this.updateConversation(data);
        });

        this.listen(ConversationEvent.error, (error: ConversationEventsMap[ConversationEvent.error]) => {
            this.showError(error);
        });
    }

    private updateConversation(data: ConversationUpdateData) {
        console.log('>>> - Conversation - updateConversation - data:', data)
        this.currentData = data;

        console.log('>>> - Conversation - updateConversation - this.contentElement:', this.contentElement, this.answersElement)
        if (!this.contentElement || !this.answersElement) return;

        // Hide loading message
        if (this.loadingElement) {
            this.loadingElement.style.display = 'none';
        }

        // Clear previous content
        this.contentElement.innerHTML = '';
        this.answersElement.innerHTML = '';

        // Create conversation bubble
        const bubble = document.createElement('div');
        bubble.className = `conversation-bubble ${data.type}`;

        // Add source/speaker
        if (data.source) {
            const source = document.createElement('div');
            source.className = 'conversation-source';
            source.textContent = data.source;
            bubble.appendChild(source);
        }

        // Add content
        const content = document.createElement('div');
        content.className = 'conversation-text';
        content.textContent = data.content;
        bubble.appendChild(content);

        this.contentElement.appendChild(bubble);

        // Add answer buttons
        if (data.answers && data.answers.length > 0 && this.answersElement) {
            const answersElement = this.answersElement; // Create local reference for TypeScript
            data.answers.forEach(answer => {
                const button = document.createElement('button');
                button.className = 'answer-button';
                button.textContent = answer;
                button.addEventListener('click', () => this.handleAnswerClick(answer));
                answersElement.appendChild(button);
            });
        }

        // Dispatch event to notify parent that conversation has been updated
        this.dispatchEvent(new CustomEvent('conversation-updated', {
            detail: { data },
            bubbles: true
        }));
    }

    private handleAnswerClick(answer: string) {
        // Dispatch continue event with the selected answer
        this.dispatch(ConversationEvent.continue, answer);

        // Disable all answer buttons to prevent multiple clicks
        if (this.answersElement) {
            const buttons = this.answersElement.querySelectorAll('button');
            buttons.forEach(button => {
                if (button instanceof HTMLButtonElement) {
                    button.disabled = true;
                    button.classList.add('disabled');
                }
            });
        }

        // Show loading state
        this.showLoading();
    }

    private showLoading() {
        if (!this.answersElement) return;

        const loadingElement = document.createElement('div');
        loadingElement.className = 'loading-indicator';
        loadingElement.innerHTML = '<span>•</span><span>•</span><span>•</span>';
        this.answersElement.appendChild(loadingElement);
    }

    private showError(error: string) {
        if (!this.contentElement) return;

        this.contentElement.innerHTML = '';

        const errorElement = document.createElement('div');
        errorElement.className = 'conversation-error';
        errorElement.textContent = error;

        this.contentElement.appendChild(errorElement);
    }

    // Custom element setup
    static {
        if (!customElements.get('conversation-ui')) {
            customElements.define('conversation-ui', Conversation);
        }
    }
}