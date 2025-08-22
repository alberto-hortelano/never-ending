import { test, expect } from '@playwright/test';

test.describe('Conversation Navigation Simple Test', () => {
    test('should allow navigating between conversations', async ({ page }) => {
        // Set test mode flag
        await page.addInitScript(() => {
            (window as any).__PLAYWRIGHT_TEST__ = true;
        });
        
        await page.goto('/');
        
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
        await page.waitForTimeout(3000);
        
        // Check container and its components
        const containerState = await page.evaluate(() => {
            const container = document.querySelector('container-component');
            if (!container || typeof (container as any).getTestingShadowRoot !== 'function') {
                return { error: 'container not found or no shadow root' };
            }
            
            const containerShadow = (container as any).getTestingShadowRoot();
            const bottomBar = containerShadow?.querySelector('bottom-bar');
            
            return {
                hasContainer: !!container,
                hasContainerShadow: !!containerShadow,
                hasBottomBar: !!bottomBar,
                bottomBarVisible: bottomBar ? (bottomBar as HTMLElement).style.display !== 'none' : false
            };
        });
        
        console.log('Container state:', containerState);
        
        // Check if conversation component exists and log its state
        const conversationState = await page.evaluate(() => {
            const container = document.querySelector('container-component');
            if (!container || typeof (container as any).getTestingShadowRoot !== 'function') {
                return { error: 'container not found or no shadow root' };
            }
            
            const containerShadow = (container as any).getTestingShadowRoot();
            const bottomBar = containerShadow?.querySelector('bottom-bar');
            if (!bottomBar || typeof (bottomBar as any).getTestingShadowRoot !== 'function') {
                return { error: 'bottom-bar not found or no shadow root' };
            }
            
            const bottomBarShadow = (bottomBar as any).getTestingShadowRoot();
            const conversation = bottomBarShadow?.querySelector('conversation-component');
            
            if (!conversation || typeof (conversation as any).getTestingShadowRoot !== 'function') {
                return { error: 'conversation-component not found or no shadow root' };
            }
            
            const conversationShadow = (conversation as any).getTestingShadowRoot();
            
            // Get navigation button states
            const prevButton = conversationShadow?.querySelector('.nav-previous') as HTMLButtonElement;
            const nextButton = conversationShadow?.querySelector('.nav-next') as HTMLButtonElement;
            const currentIndex = conversationShadow?.querySelector('.current-index') as HTMLElement;
            const totalCount = conversationShadow?.querySelector('.total-count') as HTMLElement;
            
            // Get answer buttons
            const answerButtons = conversationShadow?.querySelectorAll('.answer-button');
            
            return {
                hasPrevButton: !!prevButton,
                hasNextButton: !!nextButton,
                prevDisabled: prevButton?.disabled,
                nextDisabled: nextButton?.disabled,
                currentIndex: currentIndex?.textContent,
                totalCount: totalCount?.textContent,
                answerButtonCount: answerButtons?.length || 0
            };
        });
        
        console.log('Initial conversation state:', conversationState);
        
        // Verify initial state
        expect(conversationState.hasPrevButton).toBe(true);
        expect(conversationState.hasNextButton).toBe(true);
        expect(conversationState.prevDisabled).toBe(true); // Can't go back from first
        expect(conversationState.currentIndex).toBe('1');
        expect(conversationState.totalCount).toBe('1');
        
        // If there are answer buttons, click one to generate a new conversation
        if (conversationState.answerButtonCount > 0) {
            await page.evaluate(() => {
                const container = document.querySelector('container-component');
                const containerShadow = (container as any).getTestingShadowRoot();
                const bottomBar = containerShadow?.querySelector('bottom-bar');
                const bottomBarShadow = (bottomBar as any).getTestingShadowRoot();
                const conversation = bottomBarShadow?.querySelector('conversation-component');
                const conversationShadow = (conversation as any).getTestingShadowRoot();
                const firstAnswer = conversationShadow?.querySelector('.answer-button') as HTMLButtonElement;
                firstAnswer?.click();
            });
            
            // Wait for new conversation to load
            await page.waitForTimeout(3000);
            
            // Check state after answering
            const stateAfterAnswer = await page.evaluate(() => {
                const container = document.querySelector('container-component');
                const containerShadow = (container as any).getTestingShadowRoot();
                const bottomBar = containerShadow?.querySelector('bottom-bar');
                const bottomBarShadow = (bottomBar as any).getTestingShadowRoot();
                const conversation = bottomBarShadow?.querySelector('conversation-component');
                const conversationShadow = (conversation as any).getTestingShadowRoot();
                
                const prevButton = conversationShadow?.querySelector('.nav-previous') as HTMLButtonElement;
                const nextButton = conversationShadow?.querySelector('.nav-next') as HTMLButtonElement;
                const currentIndex = conversationShadow?.querySelector('.current-index') as HTMLElement;
                const totalCount = conversationShadow?.querySelector('.total-count') as HTMLElement;
                
                return {
                    prevDisabled: prevButton?.disabled,
                    nextDisabled: nextButton?.disabled,
                    currentIndex: currentIndex?.textContent,
                    totalCount: totalCount?.textContent
                };
            });
            
            console.log('State after answer:', stateAfterAnswer);
            
            // Should now have 2 conversations
            expect(stateAfterAnswer.totalCount).toBe('2');
            expect(stateAfterAnswer.currentIndex).toBe('2');
            expect(stateAfterAnswer.prevDisabled).toBe(false); // Can go back now
            expect(stateAfterAnswer.nextDisabled).toBe(true); // Can't go forward (at latest)
            
            // Click previous button
            await page.evaluate(() => {
                const container = document.querySelector('container-component');
                const containerShadow = (container as any).getTestingShadowRoot();
                const bottomBar = containerShadow?.querySelector('bottom-bar');
                const bottomBarShadow = (bottomBar as any).getTestingShadowRoot();
                const conversation = bottomBarShadow?.querySelector('conversation-component');
                const conversationShadow = (conversation as any).getTestingShadowRoot();
                const prevButton = conversationShadow?.querySelector('.nav-previous') as HTMLButtonElement;
                console.log('[Test] Clicking previous button');
                prevButton?.click();
            });
            
            await page.waitForTimeout(500);
            
            // Check state after going back
            const stateAfterPrev = await page.evaluate(() => {
                const container = document.querySelector('container-component');
                const containerShadow = (container as any).getTestingShadowRoot();
                const bottomBar = containerShadow?.querySelector('bottom-bar');
                const bottomBarShadow = (bottomBar as any).getTestingShadowRoot();
                const conversation = bottomBarShadow?.querySelector('conversation-component');
                const conversationShadow = (conversation as any).getTestingShadowRoot();
                
                const prevButton = conversationShadow?.querySelector('.nav-previous') as HTMLButtonElement;
                const nextButton = conversationShadow?.querySelector('.nav-next') as HTMLButtonElement;
                const currentIndex = conversationShadow?.querySelector('.current-index') as HTMLElement;
                const totalCount = conversationShadow?.querySelector('.total-count') as HTMLElement;
                
                // Check if there's a selected answer shown
                const selectedAnswer = conversationShadow?.querySelector('.selected-answer');
                
                return {
                    prevDisabled: prevButton?.disabled,
                    nextDisabled: nextButton?.disabled,
                    currentIndex: currentIndex?.textContent,
                    totalCount: totalCount?.textContent,
                    hasSelectedAnswer: !!selectedAnswer
                };
            });
            
            console.log('State after clicking previous:', stateAfterPrev);
            
            expect(stateAfterPrev.currentIndex).toBe('1');
            expect(stateAfterPrev.totalCount).toBe('2');
            expect(stateAfterPrev.prevDisabled).toBe(true);
            expect(stateAfterPrev.nextDisabled).toBe(false);
            expect(stateAfterPrev.hasSelectedAnswer).toBe(true); // Should show selected answer
            
            // Click next button to go forward again
            await page.evaluate(() => {
                const container = document.querySelector('container-component');
                const containerShadow = (container as any).getTestingShadowRoot();
                const bottomBar = containerShadow?.querySelector('bottom-bar');
                const bottomBarShadow = (bottomBar as any).getTestingShadowRoot();
                const conversation = bottomBarShadow?.querySelector('conversation-component');
                const conversationShadow = (conversation as any).getTestingShadowRoot();
                const nextButton = conversationShadow?.querySelector('.nav-next') as HTMLButtonElement;
                console.log('[Test] Clicking next button');
                nextButton?.click();
            });
            
            await page.waitForTimeout(500);
            
            // Check final state
            const finalState = await page.evaluate(() => {
                const container = document.querySelector('container-component');
                const containerShadow = (container as any).getTestingShadowRoot();
                const bottomBar = containerShadow?.querySelector('bottom-bar');
                const bottomBarShadow = (bottomBar as any).getTestingShadowRoot();
                const conversation = bottomBarShadow?.querySelector('conversation-component');
                const conversationShadow = (conversation as any).getTestingShadowRoot();
                
                const prevButton = conversationShadow?.querySelector('.nav-previous') as HTMLButtonElement;
                const nextButton = conversationShadow?.querySelector('.nav-next') as HTMLButtonElement;
                const currentIndex = conversationShadow?.querySelector('.current-index') as HTMLElement;
                const totalCount = conversationShadow?.querySelector('.total-count') as HTMLElement;
                
                return {
                    prevDisabled: prevButton?.disabled,
                    nextDisabled: nextButton?.disabled,
                    currentIndex: currentIndex?.textContent,
                    totalCount: totalCount?.textContent
                };
            });
            
            console.log('Final state:', finalState);
            
            expect(finalState.currentIndex).toBe('2');
            expect(finalState.totalCount).toBe('2');
            expect(finalState.prevDisabled).toBe(false);
            expect(finalState.nextDisabled).toBe(true);
        }
    });
});