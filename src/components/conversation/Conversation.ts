import type { ConversationUpdateData, AIExchangeData } from "../../common/events/ConversationEvents";

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
    private shadowRootRef: ShadowRoot | null = null;

    private contentElement?: HTMLElement;
    private answersElement?: HTMLElement;
    private loadingElement?: HTMLElement;
    private freeTextInput?: HTMLInputElement;
    private freeTextSubmit?: HTMLButtonElement;

    // Conversation history tracking
    private conversationHistory: ConversationTurn[] = [];
    private currentHistoryIndex = -1;
    private isAIToAIMode = false;
    private aiExchangeIndicator?: HTMLElement;

    constructor() {
        super();
        // Listen for language changes
        this.listen(StateChangeEvent.language, () => {
            this.updateTranslations();
        });
    }

    override async connectedCallback() {
        // DEBUG: Component initialization
        // console.log('[Conversation] connectedCallback called');
        const root = await super.connectedCallback();
        if (!root) {
            console.error('[Conversation] No shadow root returned from super.connectedCallback');
            return root;
        }

        // Store the root reference
        this.shadowRootRef = root;

        // Get references to shadow DOM elements
        this.contentElement = root.querySelector('.conversation-content') as HTMLElement;
        this.answersElement = root.querySelector('.conversation-answers') as HTMLElement;
        this.loadingElement = root.querySelector('.conversation-loading') as HTMLElement;
        this.freeTextInput = root.querySelector('.free-text-input') as HTMLInputElement;
        this.freeTextSubmit = root.querySelector('.free-text-submit') as HTMLButtonElement;

        // DEBUG: DOM element validation
        // console.log('[Conversation] DOM elements found:', {
        //     contentElement: !!this.contentElement,
        //     answersElement: !!this.answersElement,
        //     loadingElement: !!this.loadingElement,
        //     freeTextInput: !!this.freeTextInput,
        //     freeTextSubmit: !!this.freeTextSubmit
        // });

        // Setup navigation buttons
        this.setupNavigationButtons(root);

        // Listen for conversation updates
        this.setupEventListeners();
        this.setupFreeTextHandlers();

        // Update translations immediately and after a frame to ensure DOM is ready
        this.updateTranslations();
        requestAnimationFrame(() => {
            this.updateTranslations();
        });

        // DEBUG: Component initialization complete
        // console.log('[Conversation] Component initialization complete');
        return root;
    }

    private setupNavigationButtons(root: ShadowRoot) {
        const prevButton = root.querySelector('.nav-previous') as HTMLButtonElement;
        const nextButton = root.querySelector('.nav-next') as HTMLButtonElement;

        // DEBUG: Navigation button setup
        // console.log('[Conversation] Setting up navigation buttons:', { prevButton: !!prevButton, nextButton: !!nextButton });

        if (prevButton) {
            prevButton.addEventListener('click', () => {
                // DEBUG: Previous button navigation
                // console.log('[Conversation] Previous button clicked');
                this.navigateToPrevious();
            });
        }

        if (nextButton) {
            nextButton.addEventListener('click', () => {
                // DEBUG: Next button navigation
                // console.log('[Conversation] Next button clicked');
                this.navigateToNext();
            });
        }
    }

    private setupEventListeners() {
        // DEBUG: Event listener setup
        // console.log('[Conversation] Setting up event listeners');

        this.listen(ConversationEvent.update, (data: ConversationEventsMap[ConversationEvent.update]) => {
            // DEBUG: Conversation update received
            // console.log('[Conversation] Received update event:', data);
            this.updateConversation(data);
        });

        this.listen(ConversationEvent.error, (error: ConversationEventsMap[ConversationEvent.error]) => {
            // DEBUG: Conversation error received
            // console.log('[Conversation] Received error event:', error);
            this.showError(error);
        });

        // Listen for AI-to-AI exchanges
        this.listen(ConversationEvent.aiExchange, (data: AIExchangeData) => {
            // DEBUG: AI exchange received
            // console.log('[Conversation] Received AI exchange:', data);
            this.handleAIExchange(data);
        });

        // DEBUG: Event listeners setup complete
        // console.log('[Conversation] Event listeners setup complete');
    }

    private updateConversation(data: ConversationUpdateData, isHistorical = false) {
        // DEBUG: Updating conversation display
        // console.log('[Conversation] updateConversation called with:', { data, isHistorical });

        if (!this.contentElement || !this.answersElement) {
            console.error('[Conversation] Missing content or answers element:', {
                contentElement: this.contentElement,
                answersElement: this.answersElement
            });
            return;
        }

        // Hide loading message
        if (this.loadingElement) {
            this.loadingElement.style.display = 'none';
        } else {
            // DEBUG: Missing loading element
            // console.warn('[Conversation] No loading element found');
        }

        // Add to history if this is a new conversation update
        if (!isHistorical) {
            const turn: ConversationTurn = { data };
            this.conversationHistory.push(turn);
            this.currentHistoryIndex = this.conversationHistory.length - 1;
            this.updateNavigationButtons();
            // DEBUG: Added to conversation history
            // console.log('[Conversation] Added to history, current index:', this.currentHistoryIndex);
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

        // Add action indicator if present
        if (data.action) {
            const actionInfo = document.createElement('div');
            actionInfo.className = 'conversation-action-info';
            actionInfo.textContent = `[${i18n.t('conversation.actionRequired')}: ${data.action}]`;
            bubble.appendChild(actionInfo);
        }

        this.contentElement.appendChild(bubble);

        // Add answer buttons or show selected answer for historical conversations
        const isCurrentConversation = this.currentHistoryIndex === this.conversationHistory.length - 1;
        const currentTurn = this.conversationHistory[this.currentHistoryIndex];

        if (isHistorical && currentTurn?.selectedAnswer) {
            // Show the selected answer for historical conversations
            const selectedAnswer = document.createElement('div');
            selectedAnswer.className = 'selected-answer';
            selectedAnswer.innerHTML = `
                <span class="selected-label">${i18n.t('conversation.yourResponse')}</span>
                <span class="selected-text">${currentTurn.selectedAnswer}</span>
            `;
            this.answersElement.appendChild(selectedAnswer);
        } else if (data.answers && data.answers.length > 0 && this.answersElement && !currentTurn?.selectedAnswer) {
            // Show interactive answers if no answer has been selected yet
            const answersElement = this.answersElement;

            // If there's an action, handle answer buttons specially
            if (data.action) {
                data.answers.forEach((answer) => {
                    const button = document.createElement('button');
                    button.className = 'answer-button';
                    button.textContent = answer;

                    // Check if this is an accept/decline button for an action
                    const acceptWords = [i18n.t('common.accept').toLowerCase(), i18n.t('common.continue').toLowerCase(), i18n.t('common.yes').toLowerCase()];
                    const rejectWords = [i18n.t('common.reject').toLowerCase(), i18n.t('common.no').toLowerCase(), i18n.t('common.cancel').toLowerCase()];

                    const isAccept = acceptWords.some(word => answer.toLowerCase().includes(word));
                    const isDecline = rejectWords.some(word => answer.toLowerCase().includes(word));

                    if (isAccept) {
                        button.classList.add('action-accept');
                        button.addEventListener('click', () => this.handleActionAnswer(answer, data.action, true));
                    } else if (isDecline) {
                        button.classList.add('action-decline');
                        button.addEventListener('click', () => this.handleActionAnswer(answer, data.action, false));
                    } else {
                        button.addEventListener('click', () => this.handleAnswerClick(answer));
                    }

                    answersElement.appendChild(button);
                });
            } else {
                // Normal conversation answers
                data.answers.forEach(answer => {
                    const button = document.createElement('button');
                    button.className = 'answer-button';
                    button.textContent = answer;
                    button.addEventListener('click', () => this.handleAnswerClick(answer));
                    answersElement.appendChild(button);
                });
            }

            // Re-enable free text input for new conversation
            if (this.freeTextInput) {
                this.freeTextInput.disabled = false;
            }
            if (this.freeTextSubmit) {
                this.freeTextSubmit.disabled = false;
            }
        } else if (!data.answers || data.answers.length === 0) {
            // No answers means show close button
            if (this.answersElement && isCurrentConversation && !currentTurn?.selectedAnswer) {
                const closeButton = document.createElement('button');
                closeButton.className = 'answer-button close-button';
                closeButton.innerHTML = `✕ ${i18n.t('common.close')}`;
                closeButton.title = i18n.t('common.close');
                closeButton.addEventListener('click', () => {
                    // If there's a pending action, execute it before closing
                    if (data.action) {
                        // DEBUG: Executing action on conversation close
                        // console.log('[Conversation] Executing action on close:', data.action);
                        this.dispatchEvent(new CustomEvent('speech-action', {
                            detail: { action: data.action, accepted: true },
                            bubbles: true
                        }));
                    }

                    // Dispatch event to close conversation
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
        // Check for special AI-to-AI control answers
        if (this.isAIToAIMode) {
            if (answer === i18n.t('common.continue') || answer === i18n.t('conversation.continueListen') ||
                answer === i18n.t('conversation.next')) {
                // Continue to next exchange in the AI-to-AI conversation
                this.dispatch(ConversationEvent.continue, answer);
                // No loading needed - all exchanges are already loaded
                return;
            } else if (answer === i18n.t('conversation.interrupt')) {
                // Player interrupts the conversation
                this.isAIToAIMode = false;
                this.dispatch(ConversationEvent.playerInterrupt, undefined);
                this.hideAIExchangeIndicator();
                return;
            } else if (answer === i18n.t('common.skip') || answer === i18n.t('conversation.skip')) {
                // Skip the rest of the conversation
                this.isAIToAIMode = false;
                this.dispatch(ConversationEvent.skipConversation, undefined);
                this.hideAIExchangeIndicator();
                return;
            }
        }

        // Store the selected answer in the current turn
        if (this.currentHistoryIndex >= 0 && this.currentHistoryIndex < this.conversationHistory.length) {
            const currentTurn = this.conversationHistory[this.currentHistoryIndex];
            if (currentTurn) {
                currentTurn.selectedAnswer = answer;
            }
        }

        // Dispatch continue event with the selected answer
        this.dispatch(ConversationEvent.continue, answer);

        // Only disable buttons and show loading for regular player conversations
        // AI-to-AI conversations have all data pre-loaded, so keep buttons enabled for quick navigation
        if (!this.isAIToAIMode) {
            // Disable all answer buttons to prevent multiple clicks while waiting for API response
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
    }

    private handleActionAnswer(answer: string, action: string | undefined, accepted: boolean) {
        // DEBUG: Action answer handling
        // console.log('[Conversation] handleActionAnswer:', { answer, action, accepted });

        // Store the selected answer in the current turn
        if (this.currentHistoryIndex >= 0 && this.currentHistoryIndex < this.conversationHistory.length) {
            const currentTurn = this.conversationHistory[this.currentHistoryIndex];
            if (currentTurn) {
                currentTurn.selectedAnswer = answer;
            }
        }

        // Only disable buttons for regular player conversations
        // AI-to-AI conversations keep buttons enabled for quick navigation
        if (!this.isAIToAIMode) {
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
        }

        // If action was accepted, dispatch event to execute it
        if (accepted && action) {
            // DEBUG: User accepted action
            // console.log('[Conversation] User accepted action:', action);

            // Get the current conversation data to include actionData
            const currentData = this.conversationHistory[this.currentHistoryIndex]?.data;
            const actionData = currentData?.actionData;

            // Dispatch speech-action event to parent components
            this.dispatchEvent(new CustomEvent('speech-action', {
                detail: { action, actionData, accepted: true },
                bubbles: true
            }));

            // Close the conversation after accepting action
            setTimeout(() => {
                this.dispatchEvent(new CustomEvent('conversation-ended', {
                    bubbles: true
                }));
            }, 500);
        } else {
            // DEBUG: User declined action
            // console.log('[Conversation] User declined action:', action);
            // Continue conversation without executing action
            this.dispatch(ConversationEvent.continue, answer);
            // Only show loading for regular conversations
            if (!this.isAIToAIMode) {
                this.showLoading();
            }
        }
    }

    private showLoading() {
        if (!this.answersElement) return;

        // Remove any existing loading indicators first
        const existingLoading = this.answersElement.querySelector('.loading-indicator');
        if (existingLoading) {
            existingLoading.remove();
        }

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

        // Only disable inputs and show loading for regular player conversations
        // AI-to-AI conversations keep inputs enabled for quick interaction
        if (!this.isAIToAIMode) {
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
    }

    private navigateToPrevious() {
        // DEBUG: Navigate to previous conversation
        // console.log('[Conversation] navigateToPrevious called, currentIndex:', this.currentHistoryIndex, 'historyLength:', this.conversationHistory.length);
        if (this.currentHistoryIndex > 0) {
            this.currentHistoryIndex--;
            const turn = this.conversationHistory[this.currentHistoryIndex];
            // DEBUG: Moving to previous conversation turn
            // console.log('[Conversation] Moving to index:', this.currentHistoryIndex, 'turn:', turn);
            if (turn) {
                // Pass false for isHistorical when navigating to the most recent conversation
                const isHistorical = this.currentHistoryIndex < this.conversationHistory.length - 1;
                this.updateConversation(turn.data, isHistorical);
                this.updateNavigationButtons();
            }
        }
    }

    private navigateToNext() {
        // DEBUG: Navigate to next conversation
        // console.log('[Conversation] navigateToNext called, currentIndex:', this.currentHistoryIndex, 'historyLength:', this.conversationHistory.length);
        if (this.currentHistoryIndex < this.conversationHistory.length - 1) {
            this.currentHistoryIndex++;
            const turn = this.conversationHistory[this.currentHistoryIndex];
            // DEBUG: Moving to next conversation turn
            // console.log('[Conversation] Moving to index:', this.currentHistoryIndex, 'turn:', turn);
            if (turn) {
                // Pass false for isHistorical when navigating to the most recent conversation
                const isHistorical = this.currentHistoryIndex < this.conversationHistory.length - 1;
                this.updateConversation(turn.data, isHistorical);
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
        const root = this.shadowRootRef;
        if (!root) return;

        // Update loading text
        const loadingText = root.querySelector('.loading-text');
        if (loadingText) loadingText.textContent = i18n.t('conversation.loading');

        // Update navigation buttons
        const prevText = root.querySelector('.nav-previous .nav-text');
        if (prevText) prevText.textContent = i18n.t('conversation.previous');

        const nextText = root.querySelector('.nav-next .nav-text');
        if (nextText) nextText.textContent = i18n.t('conversation.next');

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

    private handleAIExchange(data: AIExchangeData) {
        // DEBUG: Handling AI exchange
        // console.log('[Conversation] Handling AI exchange:', data);

        // Set AI-to-AI mode
        this.isAIToAIMode = true;

        // Show AI exchange indicator
        this.showAIExchangeIndicator(data);

        // The actual conversation update will come through the regular update event
        // This event just provides additional context about the AI exchange
    }

    private showAIExchangeIndicator(data: AIExchangeData) {
        if (!this.contentElement) return;

        // Remove existing indicator if any
        this.hideAIExchangeIndicator();

        // Create new indicator
        this.aiExchangeIndicator = document.createElement('div');
        this.aiExchangeIndicator.className = 'ai-exchange-indicator';
        this.aiExchangeIndicator.innerHTML = `
            <span class="ai-icon">🤖🔄🤖</span>
            <span class="ai-text">${i18n.t('conversation.aiExchange')} ${data.exchangeNumber}/${data.maxExchanges}</span>
            <span class="eavesdrop-text">(${i18n.t('conversation.observing')})</span>
        `;

        // Insert at the top of content
        this.contentElement.insertBefore(this.aiExchangeIndicator, this.contentElement.firstChild);
    }

    private hideAIExchangeIndicator() {
        if (this.aiExchangeIndicator && this.aiExchangeIndicator.parentNode) {
            this.aiExchangeIndicator.parentNode.removeChild(this.aiExchangeIndicator);
            this.aiExchangeIndicator = undefined;
        }
    }

    // Custom element setup
    static {
        if (!customElements.get('conversation-ui')) {
            customElements.define('conversation-ui', Conversation);
        }
    }
}