import { animationService } from '../services/AnimationService';
import { superEventBus, StateChangeEvent, UpdateStateEvent } from "../events";
import type { ICharacterAnimation } from "../interfaces";

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn((cb) => setTimeout(cb, 16)) as any;
global.cancelAnimationFrame = jest.fn((id) => clearTimeout(id)) as any;

// Test event listener class
class TestEventListener {
    listen(
        event: Parameters<typeof superEventBus.listen>[0],
        callback: Parameters<typeof superEventBus.listen>[1]
    ) {
        superEventBus.listen.call(this, event, callback);
    }
}

describe('AnimationService', () => {
    let testListener: TestEventListener;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        testListener = new TestEventListener();
    });

    afterEach(() => {
        jest.useRealTimers();
        // Clean up any running animations
        animationService.destroy();
        // Clean up event listeners
        superEventBus.remove(animationService);
        superEventBus.remove(testListener);
    });

    describe('defeated character handling', () => {
        it('should stop animation when character is defeated', () => {
            const characterId = 'testChar';
            const animation: ICharacterAnimation = {
                type: 'walk',
                startTime: Date.now(),
                duration: 1000,
                from: { x: 0, y: 0 },
                to: { x: 2, y: 0 },
                path: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }]
            };

            const visualUpdateSpy = jest.fn();
            
            // Listen for visual updates
            testListener.listen(UpdateStateEvent.uiCharacterVisual, visualUpdateSpy);

            // Start the animation
            animationService.startAnimation(characterId, animation);

            // Clear initial calls
            visualUpdateSpy.mockClear();

            // Advance time to trigger animation updates
            // Need to advance enough to see step changes
            jest.advanceTimersByTime(600);

            // Should have visual updates
            const beforeDefeatCalls = visualUpdateSpy.mock.calls.length;
            expect(beforeDefeatCalls).toBeGreaterThan(0);
            
            // Clear the spy
            visualUpdateSpy.mockClear();

            // Simulate character being defeated by dispatching animations without this character
            superEventBus.dispatch(StateChangeEvent.uiAnimations, {
                characters: {}
            });

            // Advance time more - should NOT get any more visual updates
            jest.advanceTimersByTime(300);

            // No visual updates should occur after animation is removed
            expect(visualUpdateSpy).not.toHaveBeenCalled();
        });

        it('should not update position for defeated character animations', () => {
            const characterId = 'defeatedChar';
            const animation: ICharacterAnimation = {
                type: 'walk',
                startTime: Date.now(),
                duration: 1000,
                from: { x: 0, y: 0 },
                to: { x: 5, y: 0 },
                path: [
                    { x: 1, y: 0 },
                    { x: 2, y: 0 },
                    { x: 3, y: 0 },
                    { x: 4, y: 0 },
                    { x: 5, y: 0 }
                ]
            };

            const visualUpdateSpy = jest.fn();
            testListener.listen(UpdateStateEvent.uiCharacterVisual, visualUpdateSpy);

            // Start animation
            animationService.startAnimation(characterId, animation);

            // Trigger initial animation frame
            jest.advanceTimersByTime(16);
            
            // Advance time partway through animation
            jest.advanceTimersByTime(300);

            // Character should have visual updates
            expect(visualUpdateSpy).toHaveBeenCalled();
            visualUpdateSpy.mockClear();

            // Mark character as defeated by removing from animations
            superEventBus.dispatch(StateChangeEvent.uiAnimations, {
                characters: {}
            });

            // Advance time more
            jest.advanceTimersByTime(300);

            // No more visual updates should occur
            expect(visualUpdateSpy).not.toHaveBeenCalled();
        });

        it('should handle multiple characters with one being defeated', () => {
            const aliveCharId = 'aliveChar';
            const deadCharId = 'deadChar';
            
            const aliveAnimation: ICharacterAnimation = {
                type: 'walk',
                startTime: Date.now(),
                duration: 1000,
                from: { x: 0, y: 0 },
                to: { x: 2, y: 0 },
                path: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }]
            };

            const deadAnimation: ICharacterAnimation = {
                type: 'walk',
                startTime: Date.now(),
                duration: 1000,
                from: { x: 5, y: 5 },
                to: { x: 7, y: 5 },
                path: [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 }]
            };

            const visualUpdateSpy = jest.fn();
            testListener.listen(UpdateStateEvent.uiCharacterVisual, visualUpdateSpy);

            // Start animations for both characters
            animationService.startAnimation(aliveCharId, aliveAnimation);
            animationService.startAnimation(deadCharId, deadAnimation);

            // Clear initial calls
            visualUpdateSpy.mockClear();

            // Advance time to get some updates
            jest.advanceTimersByTime(600);

            // Both characters should be updating
            const aliveCharUpdates = visualUpdateSpy.mock.calls.filter(call => call[0].characterId === aliveCharId);
            const deadCharUpdates = visualUpdateSpy.mock.calls.filter(call => call[0].characterId === deadCharId);
            
            expect(aliveCharUpdates.length).toBeGreaterThan(0);
            expect(deadCharUpdates.length).toBeGreaterThan(0);
            
            visualUpdateSpy.mockClear();

            // Simulate only alive character having animation (dead one removed)
            superEventBus.dispatch(StateChangeEvent.uiAnimations, {
                characters: {
                    [aliveCharId]: aliveAnimation
                }
            });

            // Advance time more
            jest.advanceTimersByTime(200);

            // Only alive character should be updating now
            const afterDefeatAliveUpdates = visualUpdateSpy.mock.calls.filter(call => call[0].characterId === aliveCharId);
            const afterDefeatDeadUpdates = visualUpdateSpy.mock.calls.filter(call => call[0].characterId === deadCharId);
            
            expect(afterDefeatAliveUpdates.length).toBeGreaterThan(0);
            expect(afterDefeatDeadUpdates.length).toBe(0);
        });
    });
});