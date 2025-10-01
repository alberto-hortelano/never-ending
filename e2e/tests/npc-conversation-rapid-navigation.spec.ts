import { test, expect } from '@playwright/test';

test.describe('NPC Conversation Rapid Navigation', () => {
    test('should allow rapid clicking through NPC conversations without blocking', async ({ page }) => {
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
        await page.waitForSelector('container-component', { state: 'visible', timeout: 60000 });
        await page.waitForTimeout(3000);

        // Simulate an NPC-to-NPC conversation with multiple exchanges
        await page.evaluate(() => {
            const container = document.querySelector('container-component');
            if (!container || typeof (container as any).getTestingShadowRoot !== 'function') return;
            const containerShadow = (container as any).getTestingShadowRoot();
            if (!containerShadow) return;

            const bottomBar = containerShadow.querySelector('bottom-bar');
            if (!bottomBar || typeof (bottomBar as any).getTestingShadowRoot !== 'function') return;
            const bottomBarShadow = (bottomBar as any).getTestingShadowRoot();
            if (!bottomBarShadow) return;

            // Create or get conversation component
            let conversation = bottomBarShadow.querySelector('conversation-ui');
            if (!conversation) {
                conversation = document.createElement('conversation-ui');
                const conversationSection = bottomBarShadow.querySelector('.conversation-section');
                if (conversationSection) {
                    conversationSection.appendChild(conversation);
                    (conversationSection as HTMLElement).style.display = 'block';
                }
            }

            // Manually set AI-to-AI mode
            (conversation as any).isAIToAIMode = true;

            // Dispatch first AI exchange
            const event1 = new CustomEvent('ConversationEvent.update', {
                detail: {
                    type: 'speech',
                    source: 'NPC Alpha',
                    content: 'First message in the conversation',
                    answers: ['Continue', 'Skip']
                }
            });
            conversation.dispatchEvent(event1);
        });

        await page.waitForTimeout(500);

        // Verify initial state - conversation visible, buttons enabled
        const initialState = await page.evaluate(() => {
            const container = document.querySelector('container-component');
            if (!container || typeof (container as any).getTestingShadowRoot !== 'function') return null;
            const containerShadow = (container as any).getTestingShadowRoot();

            const bottomBar = containerShadow?.querySelector('bottom-bar');
            if (!bottomBar || typeof (bottomBar as any).getTestingShadowRoot !== 'function') return null;
            const bottomBarShadow = (bottomBar as any).getTestingShadowRoot();

            const conversation = bottomBarShadow?.querySelector('conversation-ui');
            if (!conversation || typeof (conversation as any).getTestingShadowRoot !== 'function') return null;
            const conversationShadow = (conversation as any).getTestingShadowRoot();

            const answerButtons = conversationShadow?.querySelectorAll('.answer-button') as NodeListOf<HTMLButtonElement>;
            const loadingIndicator = conversationShadow?.querySelector('.loading-indicator');

            return {
                hasConversation: !!conversation,
                buttonCount: answerButtons?.length || 0,
                buttonsEnabled: Array.from(answerButtons || []).every(btn => !btn.disabled),
                hasLoadingIndicator: !!loadingIndicator
            };
        });

        expect(initialState?.hasConversation).toBe(true);
        expect(initialState?.buttonCount).toBeGreaterThan(0);
        expect(initialState?.buttonsEnabled).toBe(true);
        expect(initialState?.hasLoadingIndicator).toBe(false);

        // Click first button rapidly
        const firstClick = await page.evaluate(() => {
            const container = document.querySelector('container-component');
            if (!container || typeof (container as any).getTestingShadowRoot !== 'function') return { clicked: false };
            const containerShadow = (container as any).getTestingShadowRoot();

            const bottomBar = containerShadow?.querySelector('bottom-bar');
            if (!bottomBar || typeof (bottomBar as any).getTestingShadowRoot !== 'function') return { clicked: false };
            const bottomBarShadow = (bottomBar as any).getTestingShadowRoot();

            const conversation = bottomBarShadow?.querySelector('conversation-ui');
            if (!conversation || typeof (conversation as any).getTestingShadowRoot !== 'function') return { clicked: false };
            const conversationShadow = (conversation as any).getTestingShadowRoot();

            const firstButton = conversationShadow?.querySelector('.answer-button') as HTMLButtonElement;
            if (firstButton && !firstButton.disabled) {
                firstButton.click();
                return {
                    clicked: true,
                    buttonText: firstButton.textContent || ''
                };
            }
            return { clicked: false };
        });

        expect(firstClick.clicked).toBe(true);

        // Immediately dispatch second message (simulating rapid AI response)
        await page.evaluate(() => {
            const container = document.querySelector('container-component');
            const containerShadow = (container as any).getTestingShadowRoot();
            const bottomBar = containerShadow?.querySelector('bottom-bar');
            const bottomBarShadow = (bottomBar as any).getTestingShadowRoot();
            const conversation = bottomBarShadow?.querySelector('conversation-ui');

            const event2 = new CustomEvent('ConversationEvent.update', {
                detail: {
                    type: 'speech',
                    source: 'NPC Beta',
                    content: 'Second message - rapid response',
                    answers: ['Next', 'Interrupt']
                }
            });
            conversation?.dispatchEvent(event2);
        });

        await page.waitForTimeout(100);

        // Verify buttons are still enabled after rapid message
        const afterFirstClick = await page.evaluate(() => {
            const container = document.querySelector('container-component');
            const containerShadow = (container as any).getTestingShadowRoot();
            const bottomBar = containerShadow?.querySelector('bottom-bar');
            const bottomBarShadow = (bottomBar as any).getTestingShadowRoot();
            const conversation = bottomBarShadow?.querySelector('conversation-ui');
            const conversationShadow = (conversation as any).getTestingShadowRoot();

            const answerButtons = conversationShadow?.querySelectorAll('.answer-button') as NodeListOf<HTMLButtonElement>;
            const loadingIndicator = conversationShadow?.querySelector('.loading-indicator');

            return {
                buttonCount: answerButtons?.length || 0,
                buttonsEnabled: Array.from(answerButtons || []).every(btn => !btn.disabled),
                hasLoadingIndicator: !!loadingIndicator
            };
        });

        expect(afterFirstClick.buttonCount).toBeGreaterThan(0);
        expect(afterFirstClick.buttonsEnabled).toBe(true);
        expect(afterFirstClick.hasLoadingIndicator).toBe(false);

        // Click second button immediately
        const secondClick = await page.evaluate(() => {
            const container = document.querySelector('container-component');
            const containerShadow = (container as any).getTestingShadowRoot();
            const bottomBar = containerShadow?.querySelector('bottom-bar');
            const bottomBarShadow = (bottomBar as any).getTestingShadowRoot();
            const conversation = bottomBarShadow?.querySelector('conversation-ui');
            const conversationShadow = (conversation as any).getTestingShadowRoot();

            const firstButton = conversationShadow?.querySelector('.answer-button') as HTMLButtonElement;
            if (firstButton && !firstButton.disabled) {
                firstButton.click();
                return { clicked: true };
            }
            return { clicked: false };
        });

        expect(secondClick.clicked).toBe(true);

        // Dispatch third message
        await page.evaluate(() => {
            const container = document.querySelector('container-component');
            const containerShadow = (container as any).getTestingShadowRoot();
            const bottomBar = containerShadow?.querySelector('bottom-bar');
            const bottomBarShadow = (bottomBar as any).getTestingShadowRoot();
            const conversation = bottomBarShadow?.querySelector('conversation-ui');

            const event3 = new CustomEvent('ConversationEvent.update', {
                detail: {
                    type: 'speech',
                    source: 'NPC Alpha',
                    content: 'Third message - still going strong',
                    answers: ['Continue', 'Skip']
                }
            });
            conversation?.dispatchEvent(event3);
        });

        await page.waitForTimeout(100);

        // Final state check
        const finalState = await page.evaluate(() => {
            const container = document.querySelector('container-component');
            const containerShadow = (container as any).getTestingShadowRoot();
            const bottomBar = containerShadow?.querySelector('bottom-bar');
            const bottomBarShadow = (bottomBar as any).getTestingShadowRoot();
            const conversation = bottomBarShadow?.querySelector('conversation-ui');
            const conversationShadow = (conversation as any).getTestingShadowRoot();

            const answerButtons = conversationShadow?.querySelectorAll('.answer-button') as NodeListOf<HTMLButtonElement>;
            const loadingIndicator = conversationShadow?.querySelector('.loading-indicator');
            const currentIndex = conversationShadow?.querySelector('.current-index')?.textContent;
            const totalCount = conversationShadow?.querySelector('.total-count')?.textContent;
            const prevButton = conversationShadow?.querySelector('.nav-previous') as HTMLButtonElement;
            const nextButton = conversationShadow?.querySelector('.nav-next') as HTMLButtonElement;

            return {
                buttonCount: answerButtons?.length || 0,
                buttonsEnabled: Array.from(answerButtons || []).every(btn => !btn.disabled),
                hasLoadingIndicator: !!loadingIndicator,
                currentIndex,
                totalCount,
                canGoBack: prevButton && !prevButton.disabled,
                canGoForward: nextButton && !nextButton.disabled
            };
        });

        // All buttons should still be enabled
        expect(finalState.buttonsEnabled).toBe(true);
        expect(finalState.hasLoadingIndicator).toBe(false);

        // Should have 3 messages in history
        expect(finalState.totalCount).toBe('3');
        expect(finalState.currentIndex).toBe('3');

        // Should be able to go back but not forward
        expect(finalState.canGoBack).toBe(true);
        expect(finalState.canGoForward).toBe(false);

        // Test navigation - go back to previous message
        await page.evaluate(() => {
            const container = document.querySelector('container-component');
            const containerShadow = (container as any).getTestingShadowRoot();
            const bottomBar = containerShadow?.querySelector('bottom-bar');
            const bottomBarShadow = (bottomBar as any).getTestingShadowRoot();
            const conversation = bottomBarShadow?.querySelector('conversation-ui');
            const conversationShadow = (conversation as any).getTestingShadowRoot();

            const prevButton = conversationShadow?.querySelector('.nav-previous') as HTMLButtonElement;
            prevButton?.click();
        });

        await page.waitForTimeout(200);

        // Verify navigation worked
        const afterNavBack = await page.evaluate(() => {
            const container = document.querySelector('container-component');
            const containerShadow = (container as any).getTestingShadowRoot();
            const bottomBar = containerShadow?.querySelector('bottom-bar');
            const bottomBarShadow = (bottomBar as any).getTestingShadowRoot();
            const conversation = bottomBarShadow?.querySelector('conversation-ui');
            const conversationShadow = (conversation as any).getTestingShadowRoot();

            const currentIndex = conversationShadow?.querySelector('.current-index')?.textContent;
            const selectedAnswer = conversationShadow?.querySelector('.selected-answer');

            return {
                currentIndex,
                hasSelectedAnswer: !!selectedAnswer
            };
        });

        expect(afterNavBack.currentIndex).toBe('2');
        expect(afterNavBack.hasSelectedAnswer).toBe(true); // Should show the answer that was selected

        // Go back to first message
        await page.evaluate(() => {
            const container = document.querySelector('container-component');
            const containerShadow = (container as any).getTestingShadowRoot();
            const bottomBar = containerShadow?.querySelector('bottom-bar');
            const bottomBarShadow = (bottomBar as any).getTestingShadowRoot();
            const conversation = bottomBarShadow?.querySelector('conversation-ui');
            const conversationShadow = (conversation as any).getTestingShadowRoot();

            const prevButton = conversationShadow?.querySelector('.nav-previous') as HTMLButtonElement;
            prevButton?.click();
        });

        await page.waitForTimeout(200);

        const atFirstMessage = await page.evaluate(() => {
            const container = document.querySelector('container-component');
            const containerShadow = (container as any).getTestingShadowRoot();
            const bottomBar = containerShadow?.querySelector('bottom-bar');
            const bottomBarShadow = (bottomBar as any).getTestingShadowRoot();
            const conversation = bottomBarShadow?.querySelector('conversation-ui');
            const conversationShadow = (conversation as any).getTestingShadowRoot();

            const currentIndex = conversationShadow?.querySelector('.current-index')?.textContent;
            const prevButton = conversationShadow?.querySelector('.nav-previous') as HTMLButtonElement;
            const nextButton = conversationShadow?.querySelector('.nav-next') as HTMLButtonElement;

            return {
                currentIndex,
                canGoBack: prevButton && !prevButton.disabled,
                canGoForward: nextButton && !nextButton.disabled
            };
        });

        expect(atFirstMessage.currentIndex).toBe('1');
        expect(atFirstMessage.canGoBack).toBe(false); // Can't go back from first
        expect(atFirstMessage.canGoForward).toBe(true); // Can go forward

        console.log('✅ Rapid navigation test passed - buttons stay enabled throughout NPC conversation');
    });
});
