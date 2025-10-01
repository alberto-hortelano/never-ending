import { test, expect } from '@playwright/test';

test.describe('NPC Conversation Flow', () => {
    test.beforeEach(async ({ page }) => {
        // Set test mode flag
        await page.addInitScript(() => {
            (window as any).__PLAYWRIGHT_TEST__ = true;
        });

        await page.goto('/');
        await page.waitForLoadState('networkidle');
    });

    test('should handle NPC-to-NPC conversations without blocking', async ({ page }) => {
        // Wait for main menu to load
        await page.waitForSelector('main-menu', { state: 'visible' });

        // Wait for shadow DOM to initialize
        await page.waitForFunction(() => {
            const menu = document.querySelector('main-menu');
            if (!menu || typeof (menu as any).getTestingShadowRoot !== 'function') return false;
            const shadowRoot = (menu as any).getTestingShadowRoot();
            return shadowRoot && shadowRoot.querySelector('#singlePlayerBtn');
        });

        // Click single player button to start the game
        await page.evaluate(() => {
            const menu = document.querySelector('main-menu');
            const shadowRoot = (menu as any).getTestingShadowRoot();
            const btn = shadowRoot?.querySelector('#singlePlayerBtn') as HTMLButtonElement;
            btn?.click();
        });

        // Wait for menu to hide and game to start
        await page.waitForSelector('main-menu', { state: 'hidden' });
        await page.waitForTimeout(2000); // Give game time to initialize

        // Simulate an AI-to-AI conversation with multiple exchanges
        await page.evaluate(() => {
            // Import event system
            const { ConversationEvent } = (window as any).EventBus || {};
            if (!ConversationEvent) {
                console.error('ConversationEvent not available');
                return;
            }

            // Create mock AI exchange data
            const mockExchanges = [
                {
                    type: 'speech',
                    source: 'Rival Captain',
                    content: '¿Cuánto tiempo llevan esos malditos carroñeros en el sector?',
                    answers: []
                },
                {
                    type: 'speech',
                    source: 'Salvager Grunt',
                    content: 'Tres días, capitán. Han saqueado dos naves de carga.',
                    answers: []
                },
                {
                    type: 'speech',
                    source: 'Rival Captain',
                    content: 'El Carroñero... He oído ese nombre en los canales piratas.',
                    answers: []
                }
            ];

            // Dispatch AI exchange event to simulate NPC conversation
            const eventBus = (window as any).globalEventBus;
            if (eventBus) {
                // First, dispatch the AI exchange indicator
                eventBus.dispatch(ConversationEvent.aiExchange, {
                    speaker: 'Rival Captain',
                    listener: 'Salvager Grunt',
                    content: mockExchanges[0].content,
                    exchangeNumber: 1,
                    maxExchanges: 3,
                    isLastExchange: false
                });

                // Then dispatch the first exchange
                eventBus.dispatch(ConversationEvent.update, {
                    ...mockExchanges[0],
                    answers: ['Next', 'Skip']
                });
            }
        });

        // Wait for conversation to appear
        await page.waitForTimeout(1000);

        // Check that conversation is visible and no loading element is blocking
        const conversationState = await page.evaluate(() => {
            const container = document.querySelector('container-component');
            if (!container || typeof (container as any).getTestingShadowRoot !== 'function') return null;
            const containerShadow = (container as any).getTestingShadowRoot();
            if (!containerShadow) return null;

            const bottomBar = containerShadow.querySelector('bottom-bar');
            if (!bottomBar || typeof (bottomBar as any).getTestingShadowRoot !== 'function') return null;
            const bottomBarShadow = (bottomBar as any).getTestingShadowRoot();
            if (!bottomBarShadow) return null;

            // First try conversation-component (normal conversation)
            let conversation = bottomBarShadow.querySelector('conversation-component');
            let conversationShadow = null;

            if (conversation && typeof (conversation as any).getTestingShadowRoot === 'function') {
                conversationShadow = (conversation as any).getTestingShadowRoot();
            }

            // If not found, try popup-component -> conversation-ui (popup conversation)
            if (!conversationShadow) {
                const popup = bottomBarShadow.querySelector('popup-component');
                if (popup && typeof (popup as any).getTestingShadowRoot === 'function') {
                    const popupShadow = (popup as any).getTestingShadowRoot();
                    conversation = popupShadow?.querySelector('conversation-ui');
                    if (conversation && typeof (conversation as any).getTestingShadowRoot === 'function') {
                        conversationShadow = (conversation as any).getTestingShadowRoot();
                    }
                }
            }

            if (!conversationShadow) return null;

            // Check loading element state
            const loadingElement = conversationShadow.querySelector('.conversation-loading') as HTMLElement;
            const loadingIndicator = conversationShadow.querySelector('.loading-indicator') as HTMLElement;

            // Check answer buttons
            const answerButtons = conversationShadow.querySelectorAll('.answer-button:not(:disabled)');

            // Check AI exchange indicator
            const aiIndicator = conversationShadow.querySelector('.ai-exchange-indicator');

            return {
                hasConversation: !!conversation,
                loadingElementDisplay: loadingElement ? window.getComputedStyle(loadingElement).display : 'not-found',
                hasLoadingIndicator: !!loadingIndicator,
                answerButtonCount: answerButtons.length,
                hasAIIndicator: !!aiIndicator,
                firstButtonText: answerButtons[0]?.textContent || '',
                secondButtonText: answerButtons[1]?.textContent || ''
            };
        });

        // Verify initial state
        expect(conversationState?.hasConversation).toBe(true);
        expect(conversationState?.loadingElementDisplay).toBe('none'); // Should be hidden
        expect(conversationState?.hasLoadingIndicator).toBe(false); // No loading indicator
        expect(conversationState?.answerButtonCount).toBeGreaterThan(0); // Should have answer buttons
        expect(conversationState?.hasAIIndicator).toBe(true); // Should show AI indicator

        // Click "Next" button
        const clickResult = await page.evaluate(() => {
            const bottomBar = document.querySelector('bottom-bar');
            if (!bottomBar || typeof (bottomBar as any).getTestingShadowRoot !== 'function') return { clicked: false };
            const bottomBarShadow = (bottomBar as any).getTestingShadowRoot();
            if (!bottomBarShadow) return { clicked: false };

            const popup = bottomBarShadow.querySelector('popup-component');
            if (!popup || typeof (popup as any).getTestingShadowRoot !== 'function') return { clicked: false };
            const popupShadow = (popup as any).getTestingShadowRoot();
            if (!popupShadow) return { clicked: false };

            const conversation = popupShadow.querySelector('conversation-ui');
            if (!conversation || typeof (conversation as any).getTestingShadowRoot !== 'function') return { clicked: false };
            const conversationShadow = (conversation as any).getTestingShadowRoot();
            if (!conversationShadow) return { clicked: false };

            // Find and click the "Next" button
            const answerButtons = conversationShadow.querySelectorAll('.answer-button') as NodeListOf<HTMLButtonElement>;
            for (const button of answerButtons) {
                if (button.textContent?.includes('Next') || button.textContent?.includes('Continue')) {
                    button.click();
                    return {
                        clicked: true,
                        buttonText: button.textContent,
                        wasDisabled: button.disabled
                    };
                }
            }
            return { clicked: false };
        });

        expect(clickResult.clicked).toBe(true);
        expect(clickResult.wasDisabled).toBe(false);

        // Wait a moment for any potential loading state
        await page.waitForTimeout(500);

        // Check state after clicking Next - should NOT show loading
        const stateAfterNext = await page.evaluate(() => {
            const bottomBar = document.querySelector('bottom-bar');
            if (!bottomBar || typeof (bottomBar as any).getTestingShadowRoot !== 'function') return null;
            const bottomBarShadow = (bottomBar as any).getTestingShadowRoot();
            if (!bottomBarShadow) return null;

            const popup = bottomBarShadow.querySelector('popup-component');
            if (!popup || typeof (popup as any).getTestingShadowRoot !== 'function') return null;
            const popupShadow = (popup as any).getTestingShadowRoot();
            if (!popupShadow) return null;

            const conversation = popupShadow.querySelector('conversation-ui');
            if (!conversation || typeof (conversation as any).getTestingShadowRoot !== 'function') return null;
            const conversationShadow = (conversation as any).getTestingShadowRoot();
            if (!conversationShadow) return null;

            const loadingElement = conversationShadow.querySelector('.conversation-loading') as HTMLElement;
            const loadingIndicator = conversationShadow.querySelector('.loading-indicator') as HTMLElement;
            const answerButtons = conversationShadow.querySelectorAll('.answer-button:not(:disabled)');
            const allButtons = conversationShadow.querySelectorAll('.answer-button');

            return {
                loadingElementDisplay: loadingElement ? window.getComputedStyle(loadingElement).display : 'not-found',
                loadingElementVisible: loadingElement ? loadingElement.offsetParent !== null : false,
                hasLoadingIndicator: !!loadingIndicator,
                loadingIndicatorVisible: loadingIndicator ? loadingIndicator.offsetParent !== null : false,
                enabledButtonCount: answerButtons.length,
                totalButtonCount: allButtons.length,
                answersAreaContent: conversationShadow.querySelector('.conversation-answers')?.innerHTML || ''
            };
        });

        // Critical assertions - no loading should block the UI
        expect(stateAfterNext?.loadingElementDisplay).toBe('none');
        expect(stateAfterNext?.loadingElementVisible).toBe(false);
        expect(stateAfterNext?.hasLoadingIndicator).toBe(false); // Should not create loading indicator for NPC conversations

        // Try clicking Next again to ensure it's not blocked
        const secondClickResult = await page.evaluate(() => {
            const bottomBar = document.querySelector('bottom-bar');
            if (!bottomBar || typeof (bottomBar as any).getTestingShadowRoot !== 'function') return { clicked: false };
            const bottomBarShadow = (bottomBar as any).getTestingShadowRoot();
            if (!bottomBarShadow) return { clicked: false };

            const popup = bottomBarShadow.querySelector('popup-component');
            if (!popup || typeof (popup as any).getTestingShadowRoot !== 'function') return { clicked: false };
            const popupShadow = (popup as any).getTestingShadowRoot();
            if (!popupShadow) return { clicked: false };

            const conversation = popupShadow.querySelector('conversation-ui');
            if (!conversation || typeof (conversation as any).getTestingShadowRoot !== 'function') return { clicked: false };
            const conversationShadow = (conversation as any).getTestingShadowRoot();
            if (!conversationShadow) return { clicked: false };

            // Try to click any enabled button
            const answerButtons = conversationShadow.querySelectorAll('.answer-button') as NodeListOf<HTMLButtonElement>;
            for (const button of answerButtons) {
                if (!button.disabled) {
                    // Check if button is actually clickable (not covered by loading element)
                    const rect = button.getBoundingClientRect();
                    const elementAtPoint = document.elementFromPoint(rect.left + rect.width/2, rect.top + rect.height/2);
                    const isClickable = button.contains(elementAtPoint) || elementAtPoint === button;

                    if (isClickable) {
                        button.click();
                        return {
                            clicked: true,
                            buttonText: button.textContent,
                            wasDisabled: button.disabled,
                            wasBlocked: false
                        };
                    } else {
                        return {
                            clicked: false,
                            wasBlocked: true,
                            blockingElement: elementAtPoint?.className || 'unknown'
                        };
                    }
                }
            }
            return { clicked: false, noEnabledButtons: true };
        });

        // The second click should work - buttons should not be blocked
        expect(secondClickResult.wasBlocked).not.toBe(true);

        console.log('NPC Conversation test results:', {
            initialState: conversationState,
            firstClick: clickResult,
            stateAfterNext,
            secondClick: secondClickResult
        });
    });
});