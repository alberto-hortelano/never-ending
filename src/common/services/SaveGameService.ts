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
            console.error('Failed to save game:', error);
            return false;
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

        // Return a deep clone to prevent modifications to the saved state
        return structuredClone(saveData.state);
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
        try {
            if (typeof localStorage === 'undefined') {
                return; // Not in browser environment
            }

            const savesArray: Array<[string, ISaveData]> = Array.from(this.saves.entries());
            const serialized = JSON.stringify(savesArray);
            localStorage.setItem(this.STORAGE_KEY, serialized);
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
        }
    }

    /**
     * Load saves from localStorage
     */
    private loadFromLocalStorage(): void {
        try {
            if (typeof localStorage === 'undefined') {
                return; // Not in browser environment
            }

            const serialized = localStorage.getItem(this.STORAGE_KEY);
            if (!serialized) {
                return;
            }

            const savesArray: Array<[string, ISaveData]> = JSON.parse(serialized);
            this.saves.clear();
            
            for (const [slotName, saveData] of savesArray) {
                this.saves.set(slotName, saveData);
            }
        } catch (error) {
            console.error('Failed to load from localStorage:', error);
            // Clear corrupted data
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem(this.STORAGE_KEY);
            }
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