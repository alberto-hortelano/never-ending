import { test, expect } from '@playwright/test';

test.describe('Conversation Navigation', () => {
    test.beforeEach(async ({ page }) => {
        // Set test mode flag
        await page.addInitScript(() => {
            (window as any).__PLAYWRIGHT_TEST__ = true;
        });
        
        await page.goto('/');
        await page.waitForLoadState('networkidle');
    });

    test('should navigate between conversation turns', async ({ page }) => {
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
        
        // Wait for conversation to appear on the bottom bar
        const bottomBar = page.locator('bottom-bar');
        await expect(bottomBar).toBeVisible();
        
        // Wait for the first conversation to load
        await page.waitForTimeout(3000); // Give time for initial conversation
        
        // Get navigation elements from shadow DOM using test mode
        const navElements = await page.evaluate(() => {
            const bottomBar = document.querySelector('bottom-bar');
            if (!bottomBar || typeof (bottomBar as any).getTestingShadowRoot !== 'function') return null;
            const bottomBarShadow = (bottomBar as any).getTestingShadowRoot();
            if (!bottomBarShadow) return null;
            
            const conversation = bottomBarShadow.querySelector('conversation-component');
            if (!conversation || typeof (conversation as any).getTestingShadowRoot !== 'function') return null;
            const conversationShadow = (conversation as any).getTestingShadowRoot();
            if (!conversationShadow) return null;
            
            const prevButton = conversationShadow.querySelector('.nav-previous') as HTMLButtonElement;
            const nextButton = conversationShadow.querySelector('.nav-next') as HTMLButtonElement;
            const currentIndex = conversationShadow.querySelector('.current-index') as HTMLElement;
            const totalCount = conversationShadow.querySelector('.total-count') as HTMLElement;
            
            return {
                prevDisabled: prevButton?.disabled,
                nextDisabled: nextButton?.disabled,
                currentIndex: currentIndex?.textContent,
                totalCount: totalCount?.textContent
            };
        });
        
        // Initially, previous should be disabled, next should be disabled (only one conversation)
        expect(navElements?.prevDisabled).toBe(true);
        expect(navElements?.currentIndex).toBe('1');
        expect(navElements?.totalCount).toBe('1');
        
        // Trigger a conversation answer to create a second turn
        const answerButton = await page.evaluate(() => {
            const bottomBar = document.querySelector('bottom-bar');
            if (!bottomBar || typeof (bottomBar as any).getTestingShadowRoot !== 'function') return null;
            const bottomBarShadow = (bottomBar as any).getTestingShadowRoot();
            if (!bottomBarShadow) return null;
            
            const conversation = bottomBarShadow.querySelector('conversation-component');
            if (!conversation || typeof (conversation as any).getTestingShadowRoot !== 'function') return null;
            const conversationShadow = (conversation as any).getTestingShadowRoot();
            if (!conversationShadow) return null;
            
            const firstAnswer = conversationShadow.querySelector('.conversation-answer') as HTMLButtonElement;
            if (firstAnswer && !firstAnswer.disabled) {
                firstAnswer.click();
                return true;
            }
            return false;
        });
        
        if (answerButton) {
            // Wait for the new conversation turn to load
            await page.waitForTimeout(2000);
            
            // Check navigation state after second turn
            const navElementsAfter = await page.evaluate(() => {
                const bottomBar = document.querySelector('bottom-bar');
                if (!bottomBar || typeof (bottomBar as any).getTestingShadowRoot !== 'function') return null;
                const bottomBarShadow = (bottomBar as any).getTestingShadowRoot();
                if (!bottomBarShadow) return null;
                
                const conversation = bottomBarShadow.querySelector('conversation-component');
                if (!conversation || typeof (conversation as any).getTestingShadowRoot !== 'function') return null;
                const conversationShadow = (conversation as any).getTestingShadowRoot();
                if (!conversationShadow) return null;
                
                const prevButton = conversationShadow.querySelector('.nav-previous') as HTMLButtonElement;
                const nextButton = conversationShadow.querySelector('.nav-next') as HTMLButtonElement;
                const currentIndex = conversationShadow.querySelector('.current-index') as HTMLElement;
                const totalCount = conversationShadow.querySelector('.total-count') as HTMLElement;
                
                return {
                    prevDisabled: prevButton?.disabled,
                    nextDisabled: nextButton?.disabled,
                    currentIndex: currentIndex?.textContent,
                    totalCount: totalCount?.textContent
                };
            });
            
            // Now we should have 2 conversations, at index 2
            expect(navElementsAfter?.currentIndex).toBe('2');
            expect(navElementsAfter?.totalCount).toBe('2');
            expect(navElementsAfter?.prevDisabled).toBe(false); // Can go back
            expect(navElementsAfter?.nextDisabled).toBe(true); // Can't go forward (at latest)
            
            // Click previous button
            await page.evaluate(() => {
                const bottomBar = document.querySelector('bottom-bar');
                if (!bottomBar || typeof (bottomBar as any).getTestingShadowRoot !== 'function') return null;
                const bottomBarShadow = (bottomBar as any).getTestingShadowRoot();
                if (!bottomBarShadow) return null;
                
                const conversation = bottomBarShadow.querySelector('conversation-component');
                if (!conversation || typeof (conversation as any).getTestingShadowRoot !== 'function') return null;
                const conversationShadow = (conversation as any).getTestingShadowRoot();
                if (!conversationShadow) return null;
                
                const prevButton = conversationShadow.querySelector('.nav-previous') as HTMLButtonElement;
                prevButton?.click();
            });
            
            await page.waitForTimeout(500);
            
            // Check we're back at index 1
            const navElementsAfterPrev = await page.evaluate(() => {
                const bottomBar = document.querySelector('bottom-bar');
                if (!bottomBar || typeof (bottomBar as any).getTestingShadowRoot !== 'function') return null;
                const bottomBarShadow = (bottomBar as any).getTestingShadowRoot();
                if (!bottomBarShadow) return null;
                
                const conversation = bottomBarShadow.querySelector('conversation-component');
                if (!conversation || typeof (conversation as any).getTestingShadowRoot !== 'function') return null;
                const conversationShadow = (conversation as any).getTestingShadowRoot();
                if (!conversationShadow) return null;
                
                const prevButton = conversationShadow.querySelector('.nav-previous') as HTMLButtonElement;
                const nextButton = conversationShadow.querySelector('.nav-next') as HTMLButtonElement;
                const currentIndex = conversationShadow.querySelector('.current-index') as HTMLElement;
                const totalCount = conversationShadow.querySelector('.total-count') as HTMLElement;
                
                return {
                    prevDisabled: prevButton?.disabled,
                    nextDisabled: nextButton?.disabled,
                    currentIndex: currentIndex?.textContent,
                    totalCount: totalCount?.textContent
                };
            });
            
            expect(navElementsAfterPrev?.currentIndex).toBe('1');
            expect(navElementsAfterPrev?.totalCount).toBe('2');
            expect(navElementsAfterPrev?.prevDisabled).toBe(true); // Can't go back further
            expect(navElementsAfterPrev?.nextDisabled).toBe(false); // Can go forward
            
            // Click next button
            await page.evaluate(() => {
                const bottomBar = document.querySelector('bottom-bar');
                if (!bottomBar || typeof (bottomBar as any).getTestingShadowRoot !== 'function') return null;
                const bottomBarShadow = (bottomBar as any).getTestingShadowRoot();
                if (!bottomBarShadow) return null;
                
                const conversation = bottomBarShadow.querySelector('conversation-component');
                if (!conversation || typeof (conversation as any).getTestingShadowRoot !== 'function') return null;
                const conversationShadow = (conversation as any).getTestingShadowRoot();
                if (!conversationShadow) return null;
                
                const nextButton = conversationShadow.querySelector('.nav-next') as HTMLButtonElement;
                nextButton?.click();
            });
            
            await page.waitForTimeout(500);
            
            // Check we're back at index 2
            const navElementsAfterNext = await page.evaluate(() => {
                const bottomBar = document.querySelector('bottom-bar');
                if (!bottomBar || typeof (bottomBar as any).getTestingShadowRoot !== 'function') return null;
                const bottomBarShadow = (bottomBar as any).getTestingShadowRoot();
                if (!bottomBarShadow) return null;
                
                const conversation = bottomBarShadow.querySelector('conversation-component');
                if (!conversation || typeof (conversation as any).getTestingShadowRoot !== 'function') return null;
                const conversationShadow = (conversation as any).getTestingShadowRoot();
                if (!conversationShadow) return null;
                
                const prevButton = conversationShadow.querySelector('.nav-previous') as HTMLButtonElement;
                const nextButton = conversationShadow.querySelector('.nav-next') as HTMLButtonElement;
                const currentIndex = conversationShadow.querySelector('.current-index') as HTMLElement;
                const totalCount = conversationShadow.querySelector('.total-count') as HTMLElement;
                
                return {
                    prevDisabled: prevButton?.disabled,
                    nextDisabled: nextButton?.disabled,
                    currentIndex: currentIndex?.textContent,
                    totalCount: totalCount?.textContent
                };
            });
            
            expect(navElementsAfterNext?.currentIndex).toBe('2');
            expect(navElementsAfterNext?.totalCount).toBe('2');
            expect(navElementsAfterNext?.prevDisabled).toBe(false);
            expect(navElementsAfterNext?.nextDisabled).toBe(true);
        }
    });
});