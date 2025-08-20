import type { ConversationUpdateData } from "../../common/events/ConversationEvents";

import { Component } from "../Component";
import { ConversationEvent, ConversationEventsMap, StateChangeEvent } from "../../common/events";
import { i18n } from "../../common/i18n/i18n";

interface ConversationTurn {
    data: ConversationUpdateData;
    selectedAnswer?: string;
}

export class Conversation extends Component {
    protected override hasCss = true;
    protected override hasHtml = true;

    private contentElement?: HTMLElement;
    private answersElement?: HTMLElement;
    private loadingElement?: HTMLElement;
    private freeTextInput?: HTMLInputElement;
    private freeTextSubmit?: HTMLButtonElement;
    
    // Conversation history tracking
    private conversationHistory: ConversationTurn[] = [];
    private currentHistoryIndex = -1;
    
    constructor() {
        super();
        // Listen for language changes
        this.listen(StateChangeEvent.language, () => {
            this.updateTranslations();
        });
    }

    override async connectedCallback() {
        console.log('[Conversation] connectedCallback called');
        const root = await super.connectedCallback();
        if (!root) {
            console.error('[Conversation] No shadow root returned from super.connectedCallback');
            return root;
        }
        console.log('[Conversation] Shadow root obtained');

        // Get references to shadow DOM elements
        this.contentElement = root.querySelector('.conversation-content') as HTMLElement;
        this.answersElement = root.querySelector('.conversation-answers') as HTMLElement;
        this.loadingElement = root.querySelector('.conversation-loading') as HTMLElement;
        this.freeTextInput = root.querySelector('.free-text-input') as HTMLInputElement;
        this.freeTextSubmit = root.querySelector('.free-text-submit') as HTMLButtonElement;

        console.log('[Conversation] DOM elements found:', {
            contentElement: !!this.contentElement,
            answersElement: !!this.answersElement,
            loadingElement: !!this.loadingElement,
            freeTextInput: !!this.freeTextInput,
            freeTextSubmit: !!this.freeTextSubmit
        });

        // Setup navigation buttons
        this.setupNavigationButtons(root);
        
        // Listen for conversation updates
        this.setupEventListeners();
        this.setupFreeTextHandlers();
        
        // Update translations
        this.updateTranslations();

        console.log('[Conversation] Component initialization complete');
        return root;
    }

    private setupNavigationButtons(root: ShadowRoot) {
        const prevButton = root.querySelector('.nav-previous') as HTMLButtonElement;
        const nextButton = root.querySelector('.nav-next') as HTMLButtonElement;
        
        if (prevButton) {
            prevButton.addEventListener('click', () => this.navigateToPrevious());
        }
        
        if (nextButton) {
            nextButton.addEventListener('click', () => this.navigateToNext());
        }
    }
    
    private setupEventListeners() {
        console.log('[Conversation] Setting up event listeners');
        
        this.listen(ConversationEvent.update, (data: ConversationEventsMap[ConversationEvent.update]) => {
            console.log('[Conversation] Received update event:', data);
            this.updateConversation(data);
        });

        this.listen(ConversationEvent.error, (error: ConversationEventsMap[ConversationEvent.error]) => {
            console.log('[Conversation] Received error event:', error);
            this.showError(error);
        });
        
        console.log('[Conversation] Event listeners setup complete');
    }

    private updateConversation(data: ConversationUpdateData, isHistorical = false) {
        console.log('[Conversation] updateConversation called with:', { data, isHistorical });
        
        if (!this.contentElement || !this.answersElement) {
            console.error('[Conversation] Missing content or answers element:', {
                contentElement: this.contentElement,
                answersElement: this.answersElement
            });
            return;
        }

        // Hide loading message
        if (this.loadingElement) {
            console.log('[Conversation] Hiding loading element');
            this.loadingElement.style.display = 'none';
        } else {
            console.warn('[Conversation] No loading element found');
        }

        // Add to history if this is a new conversation update
        if (!isHistorical) {
            const turn: ConversationTurn = { data };
            this.conversationHistory.push(turn);
            this.currentHistoryIndex = this.conversationHistory.length - 1;
            this.updateNavigationButtons();
            console.log('[Conversation] Added to history, current index:', this.currentHistoryIndex);
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

        // Add answer buttons or show selected answer for historical conversations
        const isCurrentConversation = this.currentHistoryIndex === this.conversationHistory.length - 1;
        const currentTurn = this.conversationHistory[this.currentHistoryIndex];
        
        if (isHistorical && currentTurn?.selectedAnswer) {
            // Show the selected answer for historical conversations
            const selectedAnswer = document.createElement('div');
            selectedAnswer.className = 'selected-answer';
            selectedAnswer.innerHTML = `
                <span class="selected-label">Your response:</span>
                <span class="selected-text">${currentTurn.selectedAnswer}</span>
            `;
            this.answersElement.appendChild(selectedAnswer);
        } else if (data.answers && data.answers.length > 0 && this.answersElement && isCurrentConversation) {
            // Show interactive answers for current conversation
            const answersElement = this.answersElement;
            data.answers.forEach(answer => {
                const button = document.createElement('button');
                button.className = 'answer-button';
                button.textContent = answer;
                button.addEventListener('click', () => this.handleAnswerClick(answer));
                answersElement.appendChild(button);
            });
            
            // Re-enable free text input for new conversation
            if (this.freeTextInput) {
                this.freeTextInput.disabled = false;
            }
            if (this.freeTextSubmit) {
                this.freeTextSubmit.disabled = false;
            }
        } else if (!data.answers || data.answers.length === 0) {
            // No answers means show close button
            if (this.answersElement && isCurrentConversation) {
                const closeButton = document.createElement('button');
                closeButton.className = 'answer-button close-button';
                closeButton.innerHTML = `✕ ${i18n.t('common.close')}`;
                closeButton.title = i18n.t('common.close');
                closeButton.addEventListener('click', () => {
                    // Dispatch event to close conversation immediately
                    this.dispatchEvent(new CustomEvent('conversation-ended', {
                        bubbles: true
                    }));
                });
                this.answersElement.appendChild(closeButton);
            }
        }

        // Dispatch event to notify parent that conversation has been updated
        this.dispatchEvent(new CustomEvent('conversation-updated', {
            detail: { data },
            bubbles: true
        }));
    }

    private handleAnswerClick(answer: string) {
        // Store the selected answer in the current turn
        if (this.currentHistoryIndex >= 0 && this.currentHistoryIndex < this.conversationHistory.length) {
            const currentTurn = this.conversationHistory[this.currentHistoryIndex];
            if (currentTurn) {
                currentTurn.selectedAnswer = answer;
            }
        }
        
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

    private setupFreeTextHandlers() {
        if (!this.freeTextInput || !this.freeTextSubmit) return;

        // Handle submit button click
        this.freeTextSubmit.addEventListener('click', () => {
            this.handleFreeTextSubmit();
        });

        // Handle Enter key press in input
        this.freeTextInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                this.handleFreeTextSubmit();
            }
        });
    }

    private handleFreeTextSubmit() {
        if (!this.freeTextInput) return;

        const text = this.freeTextInput.value.trim();
        if (!text) return;

        // Store the free text as the selected answer
        if (this.currentHistoryIndex >= 0 && this.currentHistoryIndex < this.conversationHistory.length) {
            const currentTurn = this.conversationHistory[this.currentHistoryIndex];
            if (currentTurn) {
                currentTurn.selectedAnswer = text;
            }
        }

        // Dispatch continue event with the free text
        this.dispatch(ConversationEvent.continue, text);

        // Clear the input
        this.freeTextInput.value = '';

        // Disable input and button to prevent multiple submissions
        this.freeTextInput.disabled = true;
        if (this.freeTextSubmit) {
            this.freeTextSubmit.disabled = true;
        }

        // Disable all answer buttons too
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
    
    private navigateToPrevious() {
        if (this.currentHistoryIndex > 0) {
            this.currentHistoryIndex--;
            const turn = this.conversationHistory[this.currentHistoryIndex];
            if (turn) {
                this.updateConversation(turn.data, true);
                this.updateNavigationButtons();
            }
        }
    }
    
    private navigateToNext() {
        if (this.currentHistoryIndex < this.conversationHistory.length - 1) {
            this.currentHistoryIndex++;
            const turn = this.conversationHistory[this.currentHistoryIndex];
            if (turn) {
                this.updateConversation(turn.data, true);
                this.updateNavigationButtons();
            }
        }
    }
    
    private updateNavigationButtons() {
        const root = this.shadowRoot;
        if (!root) return;
        
        const prevButton = root.querySelector('.nav-previous') as HTMLButtonElement;
        const nextButton = root.querySelector('.nav-next') as HTMLButtonElement;
        const currentIndexSpan = root.querySelector('.current-index') as HTMLElement;
        const totalCountSpan = root.querySelector('.total-count') as HTMLElement;
        
        if (prevButton) {
            prevButton.disabled = this.currentHistoryIndex <= 0;
        }
        
        if (nextButton) {
            nextButton.disabled = this.currentHistoryIndex >= this.conversationHistory.length - 1;
        }
        
        if (currentIndexSpan) {
            currentIndexSpan.textContent = (this.currentHistoryIndex + 1).toString();
        }
        
        if (totalCountSpan) {
            totalCountSpan.textContent = this.conversationHistory.length.toString();
        }
    }
    
    private updateTranslations() {
        const root = this.shadowRoot;
        if (!root) return;
        
        // Update loading text
        const loadingText = root.querySelector('.conversation-loading');
        if (loadingText) loadingText.textContent = i18n.t('conversation.loading');
        
        // Update placeholder text
        if (this.freeTextInput) {
            this.freeTextInput.placeholder = i18n.t('conversation.typeResponse');
        }
        
        // Update submit button
        if (this.freeTextSubmit) {
            this.freeTextSubmit.textContent = i18n.t('conversation.send');
        }
        
        // Update ended message if present
        const endedMessage = root.querySelector('.conversation-ended');
        if (endedMessage) {
            endedMessage.textContent = i18n.t('conversation.ended');
        }
    }

    // Custom element setup
    static {
        if (!customElements.get('conversation-ui')) {
            customElements.define('conversation-ui', Conversation);
        }
    }
}