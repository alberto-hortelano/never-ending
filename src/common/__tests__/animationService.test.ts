import { AnimationService } from '../services/AnimationService';
import { EventBus, StateChangeEvent, UpdateStateEvent } from "../events";
import type { ICharacterAnimation } from "../interfaces";

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn((cb) => setTimeout(cb, 16)) as any;
global.cancelAnimationFrame = jest.fn((id) => clearTimeout(id)) as any;


describe('AnimationService', () => {
    let animationService: AnimationService;
    let eventBus: EventBus<any, any>;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        EventBus.reset();
        eventBus = new EventBus();
        // Create a fresh instance for each test
        animationService = new AnimationService();
    });

    afterEach(() => {
        jest.useRealTimers();
        // Clean up any running animations
        animationService.destroy();
        // Clean up event listeners
        eventBus.remove(animationService);
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
                path: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
                currentStep: 0,
                fromDirection: 'right',
                toDirection: 'right'
            };

            const visualUpdateSpy = jest.fn();
            
            // Listen for visual updates
            eventBus.listen(UpdateStateEvent.uiCharacterVisual, visualUpdateSpy);

            // Start the animation
            animationService.startAnimation(characterId, animation);

            // Sync animations to activate them
            eventBus.dispatch(StateChangeEvent.uiAnimations, {
                characters: {
                    [characterId]: animation
                }
            });

            // Clear initial calls from startAnimation
            visualUpdateSpy.mockClear();

            // Advance time to trigger animation frames and cell transitions
            // The animation duration is 1000ms for 2 cells (3 path points), so ~500ms per cell
            jest.advanceTimersByTime(16); // First frame
            jest.advanceTimersByTime(500); // Should transition to second cell

            // Should have visual updates from cell transitions
            const beforeDefeatCalls = visualUpdateSpy.mock.calls.length;
            expect(beforeDefeatCalls).toBeGreaterThan(0);
            
            // Clear the spy
            visualUpdateSpy.mockClear();

            // Simulate character being defeated by dispatching animations without this character
            eventBus.dispatch(StateChangeEvent.uiAnimations, {
                characters: {}
            });

            // Advance time more - should NOT get any more visual updates
            jest.advanceTimersByTime(500);

            // No visual updates should occur after animation is removed
            expect(visualUpdateSpy).not.toHaveBeenCalled();
        });

        it('should update visual state as character moves', () => {
            const characterId = 'movingChar';
            const animation: ICharacterAnimation = {
                type: 'walk',
                startTime: Date.now(),
                duration: 500, // 500ms for 2 cells
                path: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
                currentStep: 0,
                fromDirection: 'right',
                toDirection: 'right'
            };

            const visualUpdateSpy = jest.fn();
            eventBus.listen(UpdateStateEvent.uiCharacterVisual, visualUpdateSpy);

            // Start animation
            animationService.startAnimation(characterId, animation);

            // Sync animations
            eventBus.dispatch(StateChangeEvent.uiAnimations, {
                characters: {
                    [characterId]: animation
                }
            });

            // Clear initial calls
            visualUpdateSpy.mockClear();
            
            // Advance through the animation to see multiple cell transitions
            jest.advanceTimersByTime(16); // First frame
            jest.advanceTimersByTime(300); // Past first cell transition

            // Should have visual updates
            expect(visualUpdateSpy).toHaveBeenCalled();
            
            // Check that we got position updates
            const positionUpdate = visualUpdateSpy.mock.calls.find(call => 
                call[0].visualState.styles && call[0].visualState.styles['--x']
            );
            expect(positionUpdate).toBeDefined();
        });

        it('should handle multiple characters independently', () => {
            const char1Id = 'char1';
            const char2Id = 'char2';
            
            const animation1: ICharacterAnimation = {
                type: 'walk',
                startTime: Date.now(),
                duration: 400, // 200ms per cell
                path: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
                currentStep: 0,
                fromDirection: 'right',
                toDirection: 'right'
            };

            const animation2: ICharacterAnimation = {
                type: 'walk',
                startTime: Date.now(),
                duration: 400,
                path: [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 }],
                currentStep: 0,
                fromDirection: 'right',
                toDirection: 'right'
            };

            const visualUpdateSpy = jest.fn();
            eventBus.listen(UpdateStateEvent.uiCharacterVisual, visualUpdateSpy);

            // Start animations for both characters
            animationService.startAnimation(char1Id, animation1);
            animationService.startAnimation(char2Id, animation2);

            // Sync both animations
            eventBus.dispatch(StateChangeEvent.uiAnimations, {
                characters: {
                    [char1Id]: animation1,
                    [char2Id]: animation2
                }
            });

            // Clear initial calls
            visualUpdateSpy.mockClear();

            // Advance time to trigger cell transitions
            jest.advanceTimersByTime(16); // First frame
            jest.advanceTimersByTime(250); // Past first cell transition

            // Both characters should have updates
            const char1Updates = visualUpdateSpy.mock.calls.filter(call => call[0].characterId === char1Id);
            const char2Updates = visualUpdateSpy.mock.calls.filter(call => call[0].characterId === char2Id);
            
            expect(char1Updates.length).toBeGreaterThan(0);
            expect(char2Updates.length).toBeGreaterThan(0);
            
            visualUpdateSpy.mockClear();

            // Remove one character's animation
            eventBus.dispatch(StateChangeEvent.uiAnimations, {
                characters: {
                    [char1Id]: animation1
                    // char2 removed
                }
            });

            // Advance time more
            jest.advanceTimersByTime(200);

            // Only char1 should be updating now
            const afterRemovalChar1Updates = visualUpdateSpy.mock.calls.filter(call => call[0].characterId === char1Id);
            const afterRemovalChar2Updates = visualUpdateSpy.mock.calls.filter(call => call[0].characterId === char2Id);
            
            expect(afterRemovalChar1Updates.length).toBeGreaterThan(0);
            expect(afterRemovalChar2Updates.length).toBe(0);
        });
    });
});