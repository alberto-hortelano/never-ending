import type { ICharacterAnimation, ICoord, Direction } from '../interfaces';
import { EventBus, UpdateStateEvent, UpdateStateEventsMap, StateChangeEvent, StateChangeEventsMap } from '../events';
import { DirectionsService } from './DirectionsService';

export interface AnimationUpdate {
    characterId: string;
    progress: number;
    currentPosition: ICoord;
    currentDirection: Direction;
}

/**
 * Service responsible for managing and updating animations in the UI state.
 * This service tracks animation progress and dispatches updates to the state.
 */
export class AnimationService extends EventBus<StateChangeEventsMap, UpdateStateEventsMap> {
    private animationFrame?: number;
    private activeAnimations = new Map<string, ICharacterAnimation>();
    
    constructor() {
        super();
        
        // Listen for animation state changes
        this.listen(StateChangeEvent.uiAnimations, (animations) => {
            this.syncAnimations(animations.characters as Record<string, ICharacterAnimation | undefined>);
        });
    }
    
    /**
     * Start tracking an animation
     */
    public startAnimation(characterId: string, animation: ICharacterAnimation) {
        // Dispatch to state
        this.dispatch(UpdateStateEvent.uiCharacterAnimation, {
            characterId,
            animation
        });
        
        // Add 'walk' class for walk animations
        if (animation.type === 'walk') {
            this.dispatch(UpdateStateEvent.uiCharacterVisual, {
                characterId,
                visualState: {
                    classList: ['walk']
                }
            });
        }
        
        // Start animation loop if not already running
        if (!this.animationFrame) {
            this.tick();
        }
    }
    
    /**
     * Stop tracking an animation
     */
    public stopAnimation(characterId: string) {
        this.dispatch(UpdateStateEvent.uiCharacterAnimation, {
            characterId,
            animation: null
        });
    }
    
    /**
     * Create a movement animation from a path
     */
    public createMovementAnimation(_characterId: string, path: ICoord[], fromDirection: Direction, speed: number = 300): ICharacterAnimation {
        // Path now includes starting position
        // Duration is based on number of movements (path.length - 1)
        const movements = Math.max(1, path.length - 1);
        
        return {
            type: 'walk',
            startTime: Date.now(),
            duration: movements * speed,
            path: [...path],
            currentStep: 0,
            fromDirection,
            toDirection: fromDirection, // Will be updated as character moves
            progress: 0
        };
    }
    
    /**
     * Create a rotation animation
     */
    public createRotationAnimation(_characterId: string, fromDirection: Direction, toDirection: Direction): ICharacterAnimation {
        return {
            type: 'rotate',
            startTime: Date.now(),
            duration: 200, // 200ms for rotation
            fromDirection,
            toDirection,
            progress: 0
        };
    }
    
    /**
     * Sync local animation tracking with state
     */
    private syncAnimations(stateAnimations: Record<string, ICharacterAnimation | undefined>) {
        // Clear animations that are no longer in state
        for (const [id] of this.activeAnimations) {
            if (!stateAnimations[id]) {
                this.activeAnimations.delete(id);
            }
        }
        
        // Add or update animations from state
        for (const [id, animation] of Object.entries(stateAnimations)) {
            if (animation) {
                this.activeAnimations.set(id, animation);
            }
        }
        
        // Start or stop animation loop as needed
        if (this.activeAnimations.size > 0 && !this.animationFrame) {
            this.tick();
        } else if (this.activeAnimations.size === 0 && this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = undefined;
        }
    }
    
    /**
     * Animation tick - updates all active animations
     */
    private tick = () => {
        const now = Date.now();
        const updates: AnimationUpdate[] = [];
        const completedAnimations: string[] = [];
        
        // Update each active animation
        for (const [characterId, animation] of this.activeAnimations) {
            const elapsed = now - animation.startTime;
            const progress = Math.min(elapsed / animation.duration, 1);
            
            // Calculate current state based on animation type
            if (animation.type === 'walk' && animation.path) {
                const update = this.updateMovementAnimation(characterId, animation, progress);
                if (update) {
                    updates.push(update);
                }
            } else if (animation.type === 'rotate') {
                const update = this.updateRotationAnimation(characterId, animation, progress);
                if (update) {
                    updates.push(update);
                }
            }
            
            // Mark completed animations
            if (progress >= 1) {
                completedAnimations.push(characterId);
            }
        }
        
        // Update visual state only when stepping to a new cell
        for (const update of updates) {
            // Check if this animation has a stored state
            const animState = this.activeAnimations.get(update.characterId);
            if (animState && animState.type === 'walk' && animState.path) {
                const currentStepIndex = Math.floor(update.progress * animState.path.length);
                
                // Only update if we've moved to a new cell
                if (currentStepIndex !== animState.currentStep) {
                    animState.currentStep = currentStepIndex;
                    
                    // Update visual state with new cell position
                    this.dispatch(UpdateStateEvent.uiCharacterVisual, {
                        characterId: update.characterId,
                        visualState: {
                            direction: update.currentDirection,
                            styles: {
                                '--x': `${update.currentPosition.x}`,
                                '--y': `${update.currentPosition.y}`
                            }
                        }
                    });
                }
            }
        }
        
        // Remove completed animations
        for (const characterId of completedAnimations) {
            this.completeAnimation(characterId);
        }
        
        // Continue animation loop if there are active animations
        if (this.activeAnimations.size > 0) {
            this.animationFrame = requestAnimationFrame(this.tick);
        } else {
            this.animationFrame = undefined;
        }
    };
    
    /**
     * Update movement animation and return current interpolated state
     */
    private updateMovementAnimation(characterId: string, animation: ICharacterAnimation, progress: number): AnimationUpdate | null {
        if (!animation.path || animation.path.length === 0) return null;
        
        // Calculate which segment of the path we're on
        const totalSteps = animation.path.length - 1; // -1 because we move between positions
        const currentStepFloat = progress * totalSteps;
        const currentStepIndex = Math.floor(currentStepFloat);
        const stepProgress = currentStepFloat - currentStepIndex;
        
        // Get current and next positions
        const fromIndex = Math.min(currentStepIndex, animation.path.length - 1);
        const toIndex = Math.min(currentStepIndex + 1, animation.path.length - 1);
        const fromPos = animation.path[fromIndex];
        const toPos = animation.path[toIndex];
        
        if (!fromPos || !toPos) return null;
        
        // Interpolate position
        const currentPosition: ICoord = {
            x: fromPos.x + (toPos.x - fromPos.x) * stepProgress,
            y: fromPos.y + (toPos.y - fromPos.y) * stepProgress
        };
        
        // Calculate direction based on movement
        let currentDirection = animation.fromDirection || 'down';
        
        // Only calculate direction when we're actually moving between different cells
        if (fromIndex < toIndex && fromPos && toPos) {
            currentDirection = DirectionsService.calculateDirection(fromPos, toPos);
        }
        
        return {
            characterId,
            progress,
            currentPosition,
            currentDirection
        };
    }
    
    /**
     * Update rotation animation and return current interpolated state
     */
    private updateRotationAnimation(characterId: string, animation: ICharacterAnimation, progress: number): AnimationUpdate | null {
        // For rotation, we'll just snap to the target direction when complete
        const currentDirection = progress >= 1 ? 
            (animation.toDirection || animation.fromDirection || 'down') : 
            (animation.fromDirection || 'down');
        
        return {
            characterId,
            progress,
            currentPosition: animation.from || { x: 0, y: 0 },
            currentDirection
        };
    }
    
    /**
     * Calculate direction from one position to another
     */
        
    /**
     * Complete an animation and clean up
     */
    private completeAnimation(characterId: string) {
        const animation = this.activeAnimations.get(characterId);
        if (!animation) return;
        
        // For movement animations, ensure we end at the final position
        if (animation.type === 'walk' && animation.path && animation.path.length > 0) {
            const finalPosition = animation.path[animation.path.length - 1];
            const secondLastPos = animation.path.length > 1 ? animation.path[animation.path.length - 2] : null;
            const finalDirection = (animation.path.length > 1 && secondLastPos && finalPosition) ? 
                DirectionsService.calculateDirection(secondLastPos, finalPosition) :
                (animation.toDirection || animation.fromDirection || 'down');
            
            // Set final position and remove 'walk' class
            this.dispatch(UpdateStateEvent.uiCharacterVisual, {
                characterId,
                visualState: {
                    direction: finalDirection,
                    styles: {
                        '--x': `${finalPosition?.x || 0}`,
                        '--y': `${finalPosition?.y || 0}`
                    },
                    classList: [] // Remove walk class by setting empty array
                }
            });
        }
        
        // Remove animation from state
        this.stopAnimation(characterId);
    }
    
    /**
     * Clean up resources
     */
    public destroy() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = undefined;
        }
        this.activeAnimations.clear();
        this.remove(this);
    }
}

// Export singleton instance
export const animationService = new AnimationService();