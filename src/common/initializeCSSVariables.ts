import { ANIMATION_DURATIONS } from './constants';

/**
 * Initialize CSS custom properties (variables) from JavaScript constants
 * This ensures we have a single source of truth for these values
 */
export function initializeCSSVariables(): void {
    const root = document.documentElement;
    
    // Set animation duration variables
    root.style.setProperty('--animation-duration-projectile', `${ANIMATION_DURATIONS.PROJECTILE}ms`);
}