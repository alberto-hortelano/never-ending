import type { IInteractionMode } from "./interfaces";
import { EventBus, UpdateStateEvent, UpdateStateEventsMap, StateChangeEventsMap } from "./events";

/**
 * Centralized manager for interaction mode transitions.
 * Ensures proper cleanup when switching between modes.
 */
export class InteractionModeManager extends EventBus<StateChangeEventsMap, UpdateStateEventsMap> {
    private static instance: InteractionModeManager | null = null;
    private currentMode: IInteractionMode = { type: 'normal' };
    private cleanupHandlers = new Map<IInteractionMode['type'], () => void>();

    static getInstance(): InteractionModeManager {
        if (!InteractionModeManager.instance) {
            InteractionModeManager.instance = new InteractionModeManager();
        }
        return InteractionModeManager.instance;
    }

    /**
     * Reset the singleton instance - for testing only
     */
    static resetInstance(): void {
        if (InteractionModeManager.instance) {
            // Clean up any existing listeners
            InteractionModeManager.instance.cleanupCurrentMode();
            InteractionModeManager.instance = null;
        }
    }

    /**
     * Register a cleanup handler for a specific mode
     */
    registerCleanupHandler(mode: IInteractionMode['type'], cleanup: () => void): void {
        this.cleanupHandlers.set(mode, cleanup);
    }

    /**
     * Request a mode change - this will handle cleanup automatically
     */
    requestModeChange(newMode: IInteractionMode): void {
        // If we're already in this mode, do nothing
        if (this.currentMode.type === newMode.type) {
            return;
        }

        // Perform cleanup for the current mode
        this.cleanupCurrentMode();

        // Update current mode before dispatching (so subsequent calls see the correct mode)
        this.currentMode = newMode;

        // Dispatch the mode change
        this.dispatch(UpdateStateEvent.uiInteractionMode, newMode);
    }

    private cleanupCurrentMode(): void {
        const currentModeType = this.currentMode.type;

        // Always clear all highlights when changing modes
        this.clearAllHighlights();

        // Run mode-specific cleanup if registered
        const cleanupHandler = this.cleanupHandlers.get(currentModeType);
        if (cleanupHandler) {
            cleanupHandler();
        }
    }

    private clearAllHighlights(): void {
        this.dispatch(UpdateStateEvent.uiHighlights, {
            reachableCells: [],
            pathCells: [],
            targetableCells: []
        });
    }

    /**
     * Get the current interaction mode
     */
    getCurrentMode(): IInteractionMode {
        return this.currentMode;
    }
}