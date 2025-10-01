/**
 * Game Constants
 * Central location for all game constants to avoid hardcoding
 */

// Character Names
export const MAIN_CHARACTER_NAME = 'Jim';
export const COMPANION_DROID_NAME = 'Data';

/**
 * Get the main character name based on origin or custom settings
 * @param originId - The selected origin story ID
 * @returns The character name to use
 */
export function getMainCharacterName(_originId?: string): string {
    // Future: This will check for custom names based on origin
    // For now, return the default
    return MAIN_CHARACTER_NAME;
}

// Faction Names (character allegiance)
export const PLAYER_FACTION = 'player';
export const ENEMY_FACTION = 'enemy';
export const NEUTRAL_FACTION = 'neutral';

// Controller Types (who controls the character)
export const HUMAN_CONTROLLER = 'human';
export const AI_CONTROLLER = 'ai';

// Legacy aliases for backward compatibility (to be removed later)
export const HUMAN_PLAYER = HUMAN_CONTROLLER;
export const AI_PLAYER = AI_CONTROLLER;

// Animation durations in milliseconds
export const ANIMATION_DURATIONS = {
    PROJECTILE: 200, // Duration for projectile flight animation
} as const;

// Language Settings
export const LANGUAGE_NAMES = {
    en: 'English',
    es: 'Español'
} as const;

export const LANGUAGE_INSTRUCTIONS = {
    en: 'All player-facing text MUST be in **English**',
    es: 'All player-facing text MUST be in **Español**'
} as const;

export type LanguageCode = keyof typeof LANGUAGE_NAMES;