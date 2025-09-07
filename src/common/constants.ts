/**
 * Game Constants
 * Central location for all game constants to avoid hardcoding
 */

// Character Names
export const MAIN_CHARACTER_NAME = 'Jim';
export const COMPANION_DROID_NAME = 'Data';

// Team Names
export const PLAYER_TEAM = 'player';
export const ENEMY_TEAM = 'enemy';
export const NEUTRAL_TEAM = 'neutral';

// Player Types
export const HUMAN_PLAYER = 'human';
export const AI_PLAYER = 'ai';

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