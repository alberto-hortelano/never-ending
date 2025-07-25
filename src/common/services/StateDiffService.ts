import { IState, IUIState, IProjectileState, ICharacterAnimation, ICharacterVisualState, ICellVisualState } from '../interfaces';

export interface StatePatch {
    path: string[];
    op: 'set' | 'delete' | 'add' | 'remove';
    value?: unknown;
    timestamp?: number;
}

export interface StateDiff {
    patches: StatePatch[];
    timestamp: number;
}

/**
 * Service for creating diffs between states and applying patches.
 * This enables efficient state synchronization for multiplayer.
 */
export class StateDiffService {
    /**
     * Create a diff between two states
     */
    static createDiff(oldState: IState, newState: IState): StateDiff {
        const patches: StatePatch[] = [];
        const timestamp = Date.now();
        
        // Compare game state
        this.compareObjects(oldState.game, newState.game, ['game'], patches);
        
        // Compare characters
        this.compareArrays(oldState.characters, newState.characters, ['characters'], patches, 'name');
        
        // Compare messages
        this.compareArrays(oldState.messages, newState.messages, ['messages'], patches);
        
        // Compare UI state
        this.compareUIState(oldState.ui, newState.ui, ['ui'], patches);
        
        // Note: We don't sync map as it's static after initialization
        
        return { patches, timestamp };
    }
    
    /**
     * Apply a diff to a state, returning a new state
     */
    static applyDiff(state: IState, diff: StateDiff): IState {
        // Clone the state to avoid mutations
        const newState = structuredClone(state);
        
        // Apply each patch
        for (const patch of diff.patches) {
this.applyPatch(newState, patch);
        }
        
        return newState;
    }
    
    /**
     * Filter UI state patches for multiplayer sync
     * Some UI state is local-only (e.g., popup positions, local highlights)
     */
    static filterUIPatches(patches: StatePatch[]): StatePatch[] {
        const filtered = patches.filter(patch => {
            const path = patch.path.join('.');
            
            // Filter out local-only UI state
            const localOnlyPaths = [
                'ui.transientUI.popups', // Popups are local
                'ui.transientUI.highlights.reachableCells', // Movement highlights are local
                'ui.visualStates.board.hasPopupActive', // Popup state is local
                'ui.interactionMode', // Interaction mode is local
            ];
            
            const isLocalOnly = localOnlyPaths.some(localPath => path.startsWith(localPath));
            
            return !isLocalOnly;
        });
        
        return filtered;
    }
    
    private static compareObjects(oldObj: unknown, newObj: unknown, path: string[], patches: StatePatch[]) {
        // Handle null/undefined cases
        if (oldObj === newObj) return;
        if (oldObj == null || newObj == null) {
            patches.push({ path: [...path], op: 'set', value: newObj });
            return;
        }
        
        // Type guard to ensure we're working with objects
        if (typeof oldObj !== 'object' || typeof newObj !== 'object') {
            patches.push({ path: [...path], op: 'set', value: newObj });
            return;
        }
        
        const oldRecord = oldObj as Record<string, unknown>;
        const newRecord = newObj as Record<string, unknown>;
        
        // Get all keys from both objects
        const allKeys = new Set([...Object.keys(oldRecord), ...Object.keys(newRecord)]);
        
        for (const key of allKeys) {
            const oldValue = oldRecord[key];
            const newValue = newRecord[key];
            const currentPath = [...path, key];
            
            if (!(key in newObj)) {
                // Key was deleted
                patches.push({ path: currentPath, op: 'delete' });
            } else if (!(key in oldRecord)) {
                // Key was added
                patches.push({ path: currentPath, op: 'set', value: newValue });
            } else if (oldValue !== newValue) {
                // Value changed
                if (typeof oldValue === 'object' && typeof newValue === 'object' && 
                    oldValue !== null && newValue !== null && 
                    !Array.isArray(oldValue) && !Array.isArray(newValue)) {
                    // Recursively compare objects
                    this.compareObjects(oldValue, newValue, currentPath, patches);
                } else {
                    // Primitive value or array changed
                    patches.push({ path: currentPath, op: 'set', value: newValue });
                }
            }
        }
    }
    
    private static compareArrays(oldArr: unknown[], newArr: unknown[], path: string[], patches: StatePatch[], idKey?: string) {
        if (idKey) {
            // Compare arrays of objects with unique IDs
            const oldMap = new Map(oldArr.map(item => {
                const obj = item as Record<string, unknown>;
                return [obj[idKey], obj];
            }));
            const newMap = new Map(newArr.map(item => {
                const obj = item as Record<string, unknown>;
                return [obj[idKey], obj];
            }));
            
            // Check for removed items
            for (const [id] of oldMap) {
                if (!newMap.has(id)) {
                    patches.push({ 
                        path: [...path], 
                        op: 'remove', 
                        value: { [idKey]: id } 
                    });
                }
            }
            
            // Check for added or modified items
            for (const [id, newItem] of newMap) {
                const oldItem = oldMap.get(id);
                if (!oldItem) {
                    patches.push({ 
                        path: [...path], 
                        op: 'add', 
                        value: newItem 
                    });
                } else {
                    // Compare the objects
                    const itemIndex = newArr.findIndex(item => (item as Record<string, unknown>)[idKey] === id);
                    this.compareObjects(oldItem, newItem, [...path, itemIndex.toString()], patches);
                }
            }
        } else {
            // Simple array comparison (for messages)
            if (JSON.stringify(oldArr) !== JSON.stringify(newArr)) {
                patches.push({ path: [...path], op: 'set', value: newArr });
            }
        }
    }
    
    private static compareUIState(oldUI: IUIState, newUI: IUIState, path: string[], patches: StatePatch[]) {
        // Compare animations
        this.compareObjects(oldUI.animations.characters, newUI.animations.characters, [...path, 'animations', 'characters'], patches);
        
        // Compare visual states
        this.compareObjects(oldUI.visualStates.characters, newUI.visualStates.characters, [...path, 'visualStates', 'characters'], patches);
        this.compareObjects(oldUI.visualStates.cells, newUI.visualStates.cells, [...path, 'visualStates', 'cells'], patches);
        this.compareObjects(oldUI.visualStates.board, newUI.visualStates.board, [...path, 'visualStates', 'board'], patches);
        
        // Compare transient UI
        this.compareObjects(oldUI.transientUI.popups, newUI.transientUI.popups, [...path, 'transientUI', 'popups'], patches);
        this.compareProjectiles(oldUI.transientUI.projectiles, newUI.transientUI.projectiles, [...path, 'transientUI', 'projectiles'], patches);
        this.compareObjects(oldUI.transientUI.highlights, newUI.transientUI.highlights, [...path, 'transientUI', 'highlights'], patches);
        
        // Compare interaction mode
        if (JSON.stringify(oldUI.interactionMode) !== JSON.stringify(newUI.interactionMode)) {
            patches.push({ 
                path: [...path, 'interactionMode'], 
                op: 'set', 
                value: newUI.interactionMode 
            });
        }
    }
    
    private static compareProjectiles(oldProjectiles: IProjectileState[], newProjectiles: IProjectileState[], path: string[], patches: StatePatch[]) {
        // Use ID-based comparison for projectiles
        this.compareArrays(oldProjectiles, newProjectiles, path, patches, 'id');
    }
    
    private static applyPatch(state: unknown, patch: StatePatch) {
        // Navigate to the parent object
        let current: unknown = state;
        const parentPath = patch.path.slice(0, -1);
        const lastKey = patch.path[patch.path.length - 1];
        
        for (const key of parentPath) {
            if (typeof current !== 'object' || current === null) {
                console.error(`Cannot navigate path ${patch.path.join('.')}: current is not an object`);
                return;
            }
            const currentObj = current as Record<string, unknown>;
            if (!currentObj[key]) {
                currentObj[key] = {};
            }
            current = currentObj[key];
        }
        
        // Apply the operation
        switch (patch.op) {
            case 'set':
                if (lastKey !== undefined && lastKey !== null && typeof current === 'object' && current !== null) {
                    (current as Record<string, unknown>)[lastKey] = patch.value;
                }
                break;
                
            case 'delete':
                if (lastKey !== undefined && lastKey !== null && typeof current === 'object' && current !== null) {
                    delete (current as Record<string, unknown>)[lastKey];
                }
                break;
                
            case 'add':
                if (Array.isArray(current)) {
                    current.push(patch.value);
                }
                break;
                
            case 'remove':
                if (Array.isArray(current) && patch.value) {
                    const idKey = Object.keys(patch.value)[0];
                    if (idKey) {
                        const patchValue = patch.value as Record<string, unknown>;
                        const idValue = patchValue[idKey];
                        const index = current.findIndex((item) => (item as Record<string, unknown>)[idKey] === idValue);
                        if (index !== -1) {
                            current.splice(index, 1);
                        }
                    }
                }
                break;
        }
    }
    
    /**
     * Create a minimal diff for animation updates
     * This is optimized for frequent animation state changes
     */
    static createAnimationDiff(characterId: string, animation: ICharacterAnimation): StateDiff {
        return {
            patches: [{
                path: ['ui', 'animations', 'characters', characterId],
                op: animation ? 'set' : 'delete',
                value: animation
            }],
            timestamp: Date.now()
        };
    }
    
    /**
     * Create a minimal diff for visual state updates
     */
    static createVisualStateDiff(type: 'character' | 'cell', id: string, visualState: ICharacterVisualState | ICellVisualState): StateDiff {
        return {
            patches: [{
                path: ['ui', 'visualStates', `${type}s`, id],
                op: visualState ? 'set' : 'delete',
                value: visualState
            }],
            timestamp: Date.now()
        };
    }
}