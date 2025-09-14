import type { EventBus } from '../common/events/EventBus';
import type { Component } from '../components/Component';
import type { IState } from '../common/interfaces';
import type { SaveMetadata } from '../common/interfaces/ISaveLoad';

/**
 * Centralized interface for all window properties used in the application.
 * This includes both application-specific properties and test utilities.
 */
declare global {
    interface Window {
        // ============================================
        // Save/Load System Functions
        // ============================================

        /**
         * Save the current game state to a named slot
         * @param slotName - Optional name for the save slot (prompted if not provided)
         */
        saveGame: (slotName?: string) => void;

        /**
         * Load a game state from a named slot
         * @param slotName - Optional name for the save slot (prompted if not provided)
         */
        loadGame: (slotName?: string) => void;

        /**
         * List all available save games
         * @returns Promise resolving to array of save metadata
         */
        listSaves: () => Promise<SaveMetadata[]>;

        /**
         * Quick save the current game state
         */
        quickSave: () => void;

        /**
         * Quick load the most recent quick save
         */
        quickLoad: () => void;

        /**
         * Delete a saved game
         * @param slotName - Optional name for the save slot (prompted if not provided)
         */
        deleteSave: (slotName?: string) => void;

        /**
         * Inspect a saved game's data
         * @param slotName - Name of the save slot to inspect
         * @returns Promise resolving to the saved state or error message
         */
        inspectSave: (slotName: string) => Promise<IState | { error: string }>;

        // ============================================
        // Game State Management
        // ============================================

        /**
         * Get the current game state
         * @returns The current game state or undefined if not in game
         */
        getCurrentGameState: () => IState | undefined;

        /**
         * Start the game with a specific state (for testing/loading)
         * @param state - Optional state to load into the game
         */
        playWithState: (state?: IState) => void;

        /**
         * Load a saved game and immediately start playing it
         * @param slotName - Name of the save slot to load and play
         * @returns Promise resolving to success status and loaded state
         */
        loadAndPlayGame: (slotName: string) => Promise<{
            success: boolean;
            state?: IState;
            error?: string;
        }>;

        // ============================================
        // Framework/Library Exports
        // ============================================

        /**
         * EventBus class for global event communication
         */
        EventBus: typeof EventBus;

        /**
         * Component base class
         */
        Component: typeof Component;

        // ============================================
        // Test Environment
        // ============================================

        /**
         * Flag indicating Playwright test environment
         * When true, components use open shadow DOM for testing
         */
        __PLAYWRIGHT_TEST__?: boolean;

        /**
         * Temporary storage for prompt responses in tests
         */
        __promptResponse?: string;

        // ============================================
        // Debugging Utilities
        // ============================================

        /**
         * Debug mode flag for enhanced logging
         */
        DEBUG_MODE?: boolean;

        /**
         * Performance monitoring utilities
         */
        performance: Performance;

        // ============================================
        // Browser APIs (for clarity)
        // ============================================

        /**
         * Local storage API
         */
        localStorage: Storage;

        /**
         * Session storage API
         */
        sessionStorage: Storage;

        /**
         * IndexedDB API
         */
        indexedDB: IDBFactory;
    }
}

export {};