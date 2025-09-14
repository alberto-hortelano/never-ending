import { IState } from '../interfaces';

export interface ISaveMetadata {
    slotName: string;
    timestamp: number;
    turn: string;
    characterCount: number;
}

interface ISaveData {
    state: IState;
    metadata: ISaveMetadata;
}

/**
 * Service for managing game saves.
 * Stores saves in memory and persists to localStorage for persistence across page reloads.
 */
export class SaveGameService {
    private saves: Map<string, ISaveData> = new Map();
    private readonly STORAGE_KEY = 'neverending_saves';

    constructor() {
        this.loadFromLocalStorage();
    }

    /**
     * Save the game state to a named slot
     * @param slotName - The name of the save slot
     * @param state - The game state to save
     * @returns true if save was successful
     */
    save(slotName: string, state: IState): boolean {
        try {
            const metadata: ISaveMetadata = {
                slotName,
                timestamp: Date.now(),
                turn: state.game.turn,
                characterCount: state.characters.length
            };

            // Deep clone the state to prevent modifications
            const clonedState = structuredClone(state);

            this.saves.set(slotName, {
                state: clonedState,
                metadata
            });

            // Persist to localStorage
            this.saveToLocalStorage();

            return true;
        } catch (error) {
            // Save failures are critical - game data could be lost
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to save game to slot '${slotName}': ${errorMessage}`);
        }
    }

    /**
     * Load a game state from a named slot
     * @param slotName - The name of the save slot
     * @returns The saved game state or null if not found
     */
    load(slotName: string): IState | null {
        const saveData = this.saves.get(slotName);
        if (!saveData) {
            return null;
        }

        try {
            // Return a deep clone to prevent modifications to the saved state
            return structuredClone(saveData.state);
        } catch (error) {
            // Load failures are critical - corrupted save data
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to load game from slot '${slotName}': ${errorMessage}. Save data may be corrupted.`);
        }
    }

    /**
     * Delete a saved game
     * @param slotName - The name of the save slot to delete
     * @returns true if the save was deleted, false if it didn't exist
     */
    delete(slotName: string): boolean {
        const result = this.saves.delete(slotName);
        if (result) {
            this.saveToLocalStorage();
        }
        return result;
    }

    /**
     * List all saved games with their metadata
     * @returns Array of save metadata
     */
    listSaves(): ISaveMetadata[] {
        const saves: ISaveMetadata[] = [];
        this.saves.forEach((saveData) => {
            saves.push({ ...saveData.metadata });
        });
        return saves;
    }

    /**
     * Check if a save exists
     * @param slotName - The name of the save slot
     * @returns true if the save exists
     */
    exists(slotName: string): boolean {
        return this.saves.has(slotName);
    }

    /**
     * Clear all saves
     */
    clear(): void {
        this.saves.clear();
        this.saveToLocalStorage();
    }

    /**
     * Get metadata for a specific save
     * @param slotName - The name of the save slot
     * @returns The save metadata or null if not found
     */
    getMetadata(slotName: string): ISaveMetadata | null {
        const saveData = this.saves.get(slotName);
        if (!saveData) {
            return null;
        }
        return { ...saveData.metadata };
    }

    /**
     * Get the number of saved games
     * @returns The count of saved games
     */
    getSaveCount(): number {
        return this.saves.size;
    }

    /**
     * Save all saves to localStorage
     */
    private saveToLocalStorage(): void {
        if (typeof localStorage === 'undefined') {
            return; // Not in browser environment - not an error
        }

        try {
            const savesArray: Array<[string, ISaveData]> = Array.from(this.saves.entries());
            const serialized = JSON.stringify(savesArray);
            localStorage.setItem(this.STORAGE_KEY, serialized);
        } catch (error) {
            // LocalStorage failures are critical - user could lose progress
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to persist saves to localStorage: ${errorMessage}. Your progress may not be saved.`);
        }
    }

    /**
     * Load saves from localStorage
     */
    private loadFromLocalStorage(): void {
        if (typeof localStorage === 'undefined') {
            return; // Not in browser environment - not an error
        }

        const serialized = localStorage.getItem(this.STORAGE_KEY);
        if (!serialized) {
            return; // No saves to load - not an error
        }

        try {
            const savesArray: Array<[string, ISaveData]> = JSON.parse(serialized);
            this.saves.clear();

            for (const [slotName, saveData] of savesArray) {
                this.saves.set(slotName, saveData);
            }
        } catch (error) {
            // Corrupted save data - log warning but don't crash on startup
            // Clear the corrupted data to allow fresh start
            console.error('Warning: Failed to load saved games from localStorage. Saves may be corrupted and will be cleared:', error);
            localStorage.removeItem(this.STORAGE_KEY);
            this.saves.clear();
        }
    }
}

// Singleton instance for the application
let instance: SaveGameService | null = null;

export function getSaveGameService(): SaveGameService {
    if (!instance) {
        instance = new SaveGameService();
    }
    return instance;
}

// For testing purposes - reset the singleton
export function resetSaveGameService(): void {
    instance = null;
}