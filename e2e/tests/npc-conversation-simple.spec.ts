import { test, expect } from '@playwright/test';

test.describe('NPC Conversation Simple Test', () => {
    test('should not show loading when clicking Next in conversations', async ({ page }) => {
        // Set test mode flag
        await page.addInitScript(() => {
            (window as any).__PLAYWRIGHT_TEST__ = true;
        });

        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Start single player game
        await page.waitForSelector('main-menu', { state: 'visible' });

        await page.waitForFunction(() => {
            const menu = document.querySelector('main-menu');
            if (!menu || typeof (menu as any).getTestingShadowRoot !== 'function') return false;
            const shadowRoot = (menu as any).getTestingShadowRoot();
            return shadowRoot && shadowRoot.querySelector('#singlePlayerBtn');
        });

        await page.evaluate(() => {
            const menu = document.querySelector('main-menu');
            const shadowRoot = (menu as any).getTestingShadowRoot();
            const btn = shadowRoot?.querySelector('#singlePlayerBtn') as HTMLButtonElement;
            btn?.click();
        });

        // Wait for game to start
        await page.waitForSelector('main-menu', { state: 'hidden' });
        await page.waitForSelector('container-component', { state: 'visible' });
        await page.waitForTimeout(3000); // Give time for initial conversation

        // Simulate an NPC-to-NPC conversation by dispatching events directly
        await page.evaluate(() => {
            const container = document.querySelector('container-component');
            if (!container || typeof (container as any).getTestingShadowRoot !== 'function') return;
            const containerShadow = (container as any).getTestingShadowRoot();
            if (!containerShadow) return;

            const bottomBar = containerShadow.querySelector('bottom-bar');
            if (!bottomBar || typeof (bottomBar as any).getTestingShadowRoot !== 'function') return;
            const bottomBarShadow = (bottomBar as any).getTestingShadowRoot();
            if (!bottomBarShadow) return;

            const conversation = bottomBarShadow.querySelector('conversation-component');
            if (!conversation) return;

            // Manually set AI-to-AI mode and trigger the UI state
            (conversation as any).isAIToAIMode = true;

            // Dispatch a fake AI exchange update to simulate NPC conversation
            const event = new CustomEvent('ConversationEvent.aiExchange', {
                detail: {
                    speaker: 'NPC1',
                    listener: 'NPC2',
                    content: 'Test conversation',
                    exchangeNumber: 1,
                    maxExchanges: 3,
                    isLastExchange: false
                }
            });
            conversation.dispatchEvent(event);
        });

        await page.waitForTimeout(500);

        // Check initial state - no loading should be visible
        const initialState = await page.evaluate(() => {
            const container = document.querySelector('container-component');
            if (!container || typeof (container as any).getTestingShadowRoot !== 'function') return null;
            const containerShadow = (container as any).getTestingShadowRoot();

            const bottomBar = containerShadow?.querySelector('bottom-bar');
            if (!bottomBar || typeof (bottomBar as any).getTestingShadowRoot !== 'function') return null;
            const bottomBarShadow = (bottomBar as any).getTestingShadowRoot();

            const conversation = bottomBarShadow?.querySelector('conversation-component');
            if (!conversation || typeof (conversation as any).getTestingShadowRoot !== 'function') return null;
            const conversationShadow = (conversation as any).getTestingShadowRoot();

            const loadingElement = conversationShadow?.querySelector('.conversation-loading') as HTMLElement;
            const loadingIndicator = conversationShadow?.querySelector('.loading-indicator');
            const answerButtons = conversationShadow?.querySelectorAll('.answer-button');

            return {
                hasConversation: !!conversation,
                isAIToAIMode: (conversation as any).isAIToAIMode,
                loadingElementDisplay: loadingElement ? window.getComputedStyle(loadingElement).display : 'not-found',
                loadingElementOffsetParent: loadingElement ? loadingElement.offsetParent : 'not-found',
                hasLoadingIndicator: !!loadingIndicator,
                answerButtonCount: answerButtons?.length || 0
            };
        });

        console.log('Initial state:', initialState);

        // Check that loading element is hidden
        expect(initialState?.loadingElementDisplay).toBe('none');
        expect(initialState?.hasLoadingIndicator).toBe(false);

        // Find and click an answer button (Next/Continue/Skip)
        const clickResult = await page.evaluate(() => {
            const container = document.querySelector('container-component');
            if (!container || typeof (container as any).getTestingShadowRoot !== 'function') return { clicked: false };
            const containerShadow = (container as any).getTestingShadowRoot();

            const bottomBar = containerShadow?.querySelector('bottom-bar');
            if (!bottomBar || typeof (bottomBar as any).getTestingShadowRoot !== 'function') return { clicked: false };
            const bottomBarShadow = (bottomBar as any).getTestingShadowRoot();

            const conversation = bottomBarShadow?.querySelector('conversation-component');
            if (!conversation || typeof (conversation as any).getTestingShadowRoot !== 'function') return { clicked: false };
            const conversationShadow = (conversation as any).getTestingShadowRoot();

            const answerButtons = conversationShadow?.querySelectorAll('.answer-button') as NodeListOf<HTMLButtonElement>;

            // Try to click the first enabled button
            for (const button of answerButtons) {
                if (!button.disabled) {
                    const buttonText = button.textContent || '';
                    button.click();
                    return {
                        clicked: true,
                        buttonText,
                        wasDisabled: false
                    };
                }
            }

            return { clicked: false, noEnabledButtons: true };
        });

        console.log('Click result:', clickResult);

        // Wait a moment for any loading state changes
        await page.waitForTimeout(500);

        // Check state after clicking - loading should NOT appear or block
        const stateAfterClick = await page.evaluate(() => {
            const container = document.querySelector('container-component');
            if (!container || typeof (container as any).getTestingShadowRoot !== 'function') return null;
            const containerShadow = (container as any).getTestingShadowRoot();

            const bottomBar = containerShadow?.querySelector('bottom-bar');
            if (!bottomBar || typeof (bottomBar as any).getTestingShadowRoot !== 'function') return null;
            const bottomBarShadow = (bottomBar as any).getTestingShadowRoot();

            const conversation = bottomBarShadow?.querySelector('conversation-component');
            if (!conversation || typeof (conversation as any).getTestingShadowRoot !== 'function') return null;
            const conversationShadow = (conversation as any).getTestingShadowRoot();

            const loadingElement = conversationShadow?.querySelector('.conversation-loading') as HTMLElement;
            const loadingIndicator = conversationShadow?.querySelector('.loading-indicator') as HTMLElement;
            const answerButtons = conversationShadow?.querySelectorAll('.answer-button:not(:disabled)');
            const answersContainer = conversationShadow?.querySelector('.conversation-answers') as HTMLElement;

            // Check if loading is blocking the buttons
            let isLoadingBlockingButtons = false;
            if (loadingElement && window.getComputedStyle(loadingElement).display !== 'none') {
                const loadingRect = loadingElement.getBoundingClientRect();
                const firstButton = answerButtons?.[0] as HTMLElement;
                if (firstButton) {
                    const buttonRect = firstButton.getBoundingClientRect();
                    // Check if loading overlaps with button
                    isLoadingBlockingButtons = (
                        loadingRect.bottom > buttonRect.top &&
                        loadingRect.top < buttonRect.bottom
                    );
                }
            }

            return {
                loadingElementDisplay: loadingElement ? window.getComputedStyle(loadingElement).display : 'not-found',
                hasLoadingIndicator: !!loadingIndicator,
                loadingIndicatorDisplay: loadingIndicator ? window.getComputedStyle(loadingIndicator).display : 'not-found',
                enabledButtonCount: answerButtons?.length || 0,
                isLoadingBlockingButtons,
                answersContainerHTML: answersContainer?.innerHTML?.substring(0, 200) || ''
            };
        });

        console.log('State after click:', stateAfterClick);

        // Critical assertions
        expect(stateAfterClick?.loadingElementDisplay).toBe('none'); // Main loading should stay hidden
        expect(stateAfterClick?.isLoadingBlockingButtons).toBe(false); // Nothing should block buttons

        // For NPC conversations, there should be NO loading indicator at all
        if (initialState?.isAIToAIMode) {
            expect(stateAfterClick?.hasLoadingIndicator).toBe(false);
        }
    });
});