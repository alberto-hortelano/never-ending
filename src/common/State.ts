import type { 
    ICoord, ICell, ICharacter, IState, IInventory, IWeapon, IUIState,
    ICharacterAnimation, ICharacterVisualState, ICellVisualState, IHighlightStates, IPopupState
} from "./interfaces";

import { UpdateStateEvent, EventBus, UpdateStateEventsMap, StateChangeEventsMap, StateChangeEvent, ControlsEventsMap, GameEvent, GameEventsMap } from "./events";
import { DeepReadonly } from "./helpers/types";
import { getBaseState } from '../data/state';

// Type for network event data
interface NetworkEventData {
    fromNetwork?: boolean;
}

export class State extends EventBus<UpdateStateEventsMap & GameEventsMap, StateChangeEventsMap & ControlsEventsMap> {
    #game: IState['game'] = { turn: '', players: [] };
    #map: IState['map'] = [];
    #characters: IState['characters'] = [];
    #messages: IState['messages'] = [];
    #ui: IState['ui'] = this.getInitialUIState();

    private readonly storageName = 'state'; // could be random to hide from others
    private cellMap = new Map<ICoord, ICell>();
    
    private getInitialUIState(): IUIState {
        return {
            animations: {
                characters: {}
            },
            visualStates: {
                characters: {},
                cells: {},
                board: {
                    mapWidth: 0,
                    mapHeight: 0,
                    hasPopupActive: false
                }
            },
            transientUI: {
                popups: {},
                projectiles: [],
                highlights: {
                    reachableCells: [],
                    pathCells: [],
                    targetableCells: []
                }
            },
            interactionMode: {
                type: 'normal'
            }
        };
    }

    constructor(initialState?: IState) {
        super();
        this.load(initialState);
        this.listen(UpdateStateEvent.characterPosition, (ch) => this.onCharacterPosition(ch));
        this.listen(UpdateStateEvent.characterPath, (ch) => this.onCharacterPath(ch));
        this.listen(UpdateStateEvent.characterDirection, (data) => this.onCharacterDirection(data));
        this.listen(UpdateStateEvent.updateMessages, (messages) => this.onUpdateMessages(messages));
        this.listen(UpdateStateEvent.updateInventory, (data) => this.onUpdateInventory(data));
        this.listen(UpdateStateEvent.equipWeapon, (data) => this.onEquipWeapon(data));
        this.listen(UpdateStateEvent.unequipWeapon, (data) => this.onUnequipWeapon(data));
        this.listen(UpdateStateEvent.deductActionPoints, (data) => this.onDeductActionPoints(data));
        this.listen(UpdateStateEvent.resetActionPoints, (data) => this.onResetActionPoints(data));
        this.listen(UpdateStateEvent.damageCharacter, (data) => this.onDamageCharacter(data));
        this.listen(GameEvent.changeTurn, (data) => this.onChangeTurn(data));
        
        // UI State listeners
        this.listen(UpdateStateEvent.uiCharacterAnimation, (data) => this.onUICharacterAnimation(data));
        this.listen(UpdateStateEvent.uiCharacterVisual, (data) => this.onUICharacterVisual(data));
        this.listen(UpdateStateEvent.uiCellVisual, (data) => this.onUICellVisual(data));
        this.listen(UpdateStateEvent.uiCellVisualBatch, (data) => this.onUICellVisualBatch(data));
        this.listen(UpdateStateEvent.uiBoardVisual, (data) => this.onUIBoardVisual(data));
        this.listen(UpdateStateEvent.uiPopup, (data) => this.onUIPopup(data));
        this.listen(UpdateStateEvent.uiAddProjectile, (data) => this.onUIAddProjectile(data));
        this.listen(UpdateStateEvent.uiRemoveProjectile, (data) => this.onUIRemoveProjectile(data));
        this.listen(UpdateStateEvent.uiHighlights, (data) => this.onUIHighlights(data));
        this.listen(UpdateStateEvent.uiInteractionMode, (data) => this.onUIInteractionMode(data));
    }
    
    // Helper method to check if action is from current player's turn
    private isValidTurn(characterName: string, fromNetwork?: boolean): boolean {
        // If it's from network, skip validation (already validated on sender's side)
        if (fromNetwork) return true;
        
        const character = this.#findCharacter(characterName);
        if (!character) return false;
        
        // Check if it's the character's player's turn
        return character.player === this.#game.turn;
    }
    
    // Listeners
    private onCharacterPosition(characterData: UpdateStateEventsMap[UpdateStateEvent.characterPosition]) {
        const character = this.#findCharacter(characterData.name);
        if (!character) {
            throw new Error(`No character "${characterData.name}" found`);
        }
        
        // Validate turn for non-network actions
        const fromNetwork = (characterData as NetworkEventData).fromNetwork;
        
        if (!this.isValidTurn(characterData.name, fromNetwork)) {
            console.warn(`Invalid turn: ${character.player} tried to move during ${this.#game.turn}'s turn`);
            return;
        }
        
        character.position = characterData.position;
        character.direction = characterData.direction;
        
        // Dispatch the position change so UI components can update
        // Include the fromNetwork flag so components know if this is a network update
        const eventData = { ...structuredClone(character), fromNetwork };
        this.dispatch(StateChangeEvent.characterPosition, eventData);
        this.save();
    }
    private onCharacterPath(characterData: UpdateStateEventsMap[UpdateStateEvent.characterPosition]) {
        const character = this.#characters.find(character => character.name === characterData.name);
        if (!character) {
            throw new Error(`No character "${characterData.name}" found`);
        }
        
        // Validate turn for non-network actions
        const fromNetwork = (characterData as NetworkEventData).fromNetwork;
        if (!this.isValidTurn(characterData.name, fromNetwork)) {
            console.warn(`Invalid turn: ${character.player} tried to set path during ${this.#game.turn}'s turn`);
            return;
        }
        
        character.path = [...characterData.path];
        // Include the fromNetwork flag so components know if this is a network update
        const eventData = { ...structuredClone(character), fromNetwork };
        this.dispatch(StateChangeEvent.characterPath, eventData);
    }
    private onCharacterDirection(data: UpdateStateEventsMap[UpdateStateEvent.characterDirection]) {
        const character = this.#findCharacter(data.characterName);
        if (!character) {
            throw new Error(`No character "${data.characterName}" found`);
        }
        
        // Validate turn for non-network actions
        const fromNetwork = (data as NetworkEventData).fromNetwork;
        if (!this.isValidTurn(data.characterName, fromNetwork)) {
            console.warn(`Invalid turn: ${character.player} tried to rotate during ${this.#game.turn}'s turn`);
            return;
        }
        
        character.direction = data.direction;
        // Dispatch state change event so character components update their visual direction
        this.dispatch(StateChangeEvent.characterDirection, structuredClone(character), character.name);
        
        // Rotation costs 0 action points, so no deduction needed
        
        this.save();
    }
    private onUpdateMessages(messages: UpdateStateEventsMap[UpdateStateEvent.updateMessages]) {
        this.#messages = [...messages];
        this.dispatch(StateChangeEvent.messages, structuredClone(this.#messages));
        this.save();
    }
    private onUpdateInventory(data: UpdateStateEventsMap[UpdateStateEvent.updateInventory]) {
        const character = this.#findCharacter(data.characterName);
        if (!character) {
            throw new Error(`No character "${data.characterName}" found`);
        }
        
        // Validate turn for non-network actions
        const fromNetwork = (data as NetworkEventData).fromNetwork;
        if (!this.isValidTurn(data.characterName, fromNetwork)) {
            console.warn(`Invalid turn: ${character.player} tried to update inventory during ${this.#game.turn}'s turn`);
            return;
        }
        
        character.inventory = structuredClone(data.inventory) as IInventory;
        this.dispatch(StateChangeEvent.characterInventory, structuredClone(character));
        this.save();
    }
    private onEquipWeapon(data: UpdateStateEventsMap[UpdateStateEvent.equipWeapon]) {
        const character = this.#findCharacter(data.characterName);
        if (!character) {
            throw new Error(`No character "${data.characterName}" found`);
        }

        const inventory = { ...character.inventory };
        const equippedWeapons = { ...inventory.equippedWeapons };

        if (data.weaponId === null) {
            // Unequip weapon
            equippedWeapons[data.slot] = null;
        } else {
            // Find the weapon in inventory
            const weapon = inventory.items.find(item =>
                item.id === data.weaponId && item.type === 'weapon'
            ) as IWeapon | undefined;

            if (!weapon) {
                console.error(`Weapon with id ${data.weaponId} not found in inventory`);
                return;
            }

            // Handle two-handed weapons
            if (weapon.weaponType === 'twoHanded') {
                // Two-handed weapons take both slots
                equippedWeapons.primary = weapon;
                equippedWeapons.secondary = null;
            } else {
                // One-handed weapon
                equippedWeapons[data.slot] = weapon;

                // If equipping in primary and there's a two-handed weapon, clear secondary
                if (data.slot === 'primary' && equippedWeapons.primary?.weaponType === 'twoHanded') {
                    equippedWeapons.secondary = null;
                }
            }
        }

        // Update inventory
        inventory.equippedWeapons = equippedWeapons;
        character.inventory = inventory;

        // Dispatch change event
        this.dispatch(StateChangeEvent.characterInventory, structuredClone(character));
        this.save();
    }
    private onUnequipWeapon(data: UpdateStateEventsMap[UpdateStateEvent.unequipWeapon]) {
        // Call onEquipWeapon with null weaponId to unequip
        this.onEquipWeapon({
            characterName: data.characterName,
            weaponId: null,
            slot: data.slot
        });
    }
    private onChangeTurn(data: GameEventsMap[GameEvent.changeTurn]) {
        this.#game = { ...this.#game, ...data };
        this.dispatch(StateChangeEvent.game, structuredClone(this.#game));
        
        // Clear all highlights when turn changes
        this.#ui.transientUI.highlights = {
            reachableCells: [],
            pathCells: [],
            targetableCells: []
        };
        
        // Reset interaction mode to normal
        this.#ui.interactionMode = {
            type: 'normal'
        };
        
        // Clear all highlighted cells in visual states
        const cellUpdates: Array<{ cellKey: string; visualState: Partial<ICellVisualState> | null }> = [];
        Object.keys(this.#ui.visualStates.cells).forEach(cellKey => {
            const cell = this.#ui.visualStates.cells[cellKey];
            if (cell?.isHighlighted) {
                cellUpdates.push({ cellKey, visualState: null });
            }
        });
        
        // Apply cell updates if any
        if (cellUpdates.length > 0) {
            this.onUICellVisualBatch({ updates: cellUpdates });
        }
        
        // Dispatch UI state changes
        this.dispatch(StateChangeEvent.uiTransient, structuredClone(this.#ui.transientUI));
        this.dispatch(StateChangeEvent.uiInteractionMode, structuredClone(this.#ui.interactionMode));
        
        // Reset action points for the new player's characters
        this.#characters.forEach(character => {
            if (character.player === data.turn) {
                character.actions.pointsLeft = 100;
                this.dispatch(StateChangeEvent.characterActions, structuredClone(character));
            }
        });
        
        this.save();
    }
    private onDeductActionPoints(data: UpdateStateEventsMap[UpdateStateEvent.deductActionPoints]) {
        const character = this.#findCharacter(data.characterName);
        if (!character) {
            throw new Error(`No character "${data.characterName}" found`);
        }
        
        // Validate turn for non-network actions
        const fromNetwork = (data as NetworkEventData).fromNetwork;
        if (!this.isValidTurn(data.characterName, fromNetwork)) {
            console.warn(`Invalid turn: ${character.player} tried to use action points during ${this.#game.turn}'s turn`);
            return;
        }
        
        // Deduct the action points
        character.actions.pointsLeft = Math.max(0, character.actions.pointsLeft - data.cost);
        
        // Dispatch change event
        this.dispatch(StateChangeEvent.characterActions, structuredClone(character));
        this.save();
    }
    private onResetActionPoints(data: UpdateStateEventsMap[UpdateStateEvent.resetActionPoints]) {
        // Reset action points for all characters belonging to the specified player
        this.#characters.forEach(character => {
            if (character.player === data.player) {
                character.actions.pointsLeft = 100;
                this.dispatch(StateChangeEvent.characterActions, structuredClone(character));
            }
        });
        this.save();
    }
    private onDamageCharacter(data: UpdateStateEventsMap[UpdateStateEvent.damageCharacter]) {
        const character = this.#findCharacter(data.targetName);
        if (!character) {
            throw new Error(`No character "${data.targetName}" found`);
        }
        
        // Apply damage
        const previousHealth = character.health;
        character.health = Math.max(0, character.health - data.damage);
        
        // Dispatch health change event
        this.dispatch(StateChangeEvent.characterHealth, structuredClone(character));
        
        // Check if character is defeated
        if (character.health === 0 && previousHealth > 0) {
            // Update visual state to mark character as defeated
            const visualState = this.#ui.visualStates.characters[character.name] || {
                direction: 'down',
                classList: [],
                temporaryClasses: [],
                weaponClass: undefined,
                styles: {},
                healthBarPercentage: 0,
                healthBarColor: '#f44336',
                isDefeated: false,
                isCurrentTurn: false
            };
            visualState.isDefeated = true;
            this.#ui.visualStates.characters[character.name] = visualState;
            this.dispatch(StateChangeEvent.uiVisualStates, structuredClone(this.#ui.visualStates));
            
            // Then dispatch the defeat event
            this.dispatch(StateChangeEvent.characterDefeated, structuredClone(character));
        }
        
        this.save();
    }
    
    // UI State Handlers
    private onUICharacterAnimation(data: UpdateStateEventsMap[UpdateStateEvent.uiCharacterAnimation]) {
        if (data.animation) {
            this.#ui.animations.characters[data.characterId] = structuredClone(data.animation) as ICharacterAnimation;
        } else {
            delete this.#ui.animations.characters[data.characterId];
        }
        this.dispatch(StateChangeEvent.uiAnimations, structuredClone(this.#ui.animations));
    }
    
    private onUICharacterVisual(data: UpdateStateEventsMap[UpdateStateEvent.uiCharacterVisual]) {
        const currentVisual = this.#ui.visualStates.characters[data.characterId] || {
            direction: 'down',
            classList: [],
            temporaryClasses: [],
            weaponClass: undefined,
            styles: {},
            healthBarPercentage: 100,
            healthBarColor: '#4ade80',
            isDefeated: false,
            isCurrentTurn: false
        };
        
        console.log('[State] onUICharacterVisual - Before update:', data.characterId, {
            currentTemporaryClasses: currentVisual.temporaryClasses,
            currentWeaponClass: currentVisual.weaponClass,
            newData: data.visualState
        });
        
        // Merge the visual state updates properly
        const updatedVisual = {
            ...currentVisual,
            ...data.visualState
        };
        
        // Special handling for arrays to merge properly
        if (data.visualState.temporaryClasses !== undefined) {
            updatedVisual.temporaryClasses = data.visualState.temporaryClasses;
        }
        if (data.visualState.classList !== undefined) {
            updatedVisual.classList = data.visualState.classList;
        }
        
        console.log('[State] onUICharacterVisual - After update:', data.characterId, {
            temporaryClasses: updatedVisual.temporaryClasses,
            weaponClass: updatedVisual.weaponClass
        });
        
        this.#ui.visualStates.characters[data.characterId] = updatedVisual as ICharacterVisualState;
        
        this.dispatch(StateChangeEvent.uiVisualStates, structuredClone(this.#ui.visualStates));
    }
    
    private onUICellVisual(data: UpdateStateEventsMap[UpdateStateEvent.uiCellVisual]) {
        if (data.visualState) {
            const currentVisual = this.#ui.visualStates.cells[data.cellKey] || {
                isHighlighted: false,
                classList: []
            };
            
            this.#ui.visualStates.cells[data.cellKey] = {
                ...currentVisual,
                ...data.visualState
            } as ICellVisualState;
        } else {
            delete this.#ui.visualStates.cells[data.cellKey];
        }
        
        this.dispatch(StateChangeEvent.uiVisualStates, structuredClone(this.#ui.visualStates));
    }
    
    private onUICellVisualBatch(data: UpdateStateEventsMap[UpdateStateEvent.uiCellVisualBatch]) {
        // Process all updates in batch
        data.updates.forEach(update => {
            if (update.visualState) {
                const currentVisual = this.#ui.visualStates.cells[update.cellKey] || {
                    isHighlighted: false,
                    classList: []
                };
                
                this.#ui.visualStates.cells[update.cellKey] = {
                    ...currentVisual,
                    ...update.visualState
                } as ICellVisualState;
            } else {
                delete this.#ui.visualStates.cells[update.cellKey];
            }
        });
        
        // Dispatch only once after all updates
        this.dispatch(StateChangeEvent.uiVisualStates, structuredClone(this.#ui.visualStates));
    }
    
    private onUIBoardVisual(data: UpdateStateEventsMap[UpdateStateEvent.uiBoardVisual]) {
        this.#ui.visualStates.board = {
            ...this.#ui.visualStates.board,
            ...data.updates
        };
        
        this.dispatch(StateChangeEvent.uiVisualStates, structuredClone(this.#ui.visualStates));
    }
    
    private onUIPopup(data: UpdateStateEventsMap[UpdateStateEvent.uiPopup]) {
        if (data.popupState) {
            this.#ui.transientUI.popups[data.popupId] = structuredClone(data.popupState) as IPopupState;
        } else {
            delete this.#ui.transientUI.popups[data.popupId];
        }
        
        this.dispatch(StateChangeEvent.uiTransient, structuredClone(this.#ui.transientUI));
    }
    
    private onUIAddProjectile(data: UpdateStateEventsMap[UpdateStateEvent.uiAddProjectile]) {
        this.#ui.transientUI.projectiles.push(structuredClone(data));
        this.dispatch(StateChangeEvent.uiTransient, structuredClone(this.#ui.transientUI));
    }
    
    private onUIRemoveProjectile(data: UpdateStateEventsMap[UpdateStateEvent.uiRemoveProjectile]) {
        this.#ui.transientUI.projectiles = this.#ui.transientUI.projectiles.filter(
            p => p.id !== data.projectileId
        );
        this.dispatch(StateChangeEvent.uiTransient, structuredClone(this.#ui.transientUI));
    }
    
    private onUIHighlights(data: UpdateStateEventsMap[UpdateStateEvent.uiHighlights]) {
        // First, clear previously highlighted cells
        const previouslyHighlighted = new Set<string>();
        Object.keys(this.#ui.visualStates.cells).forEach(cellKey => {
            const cell = this.#ui.visualStates.cells[cellKey];
            if (cell?.isHighlighted) {
                previouslyHighlighted.add(cellKey);
            }
        });
        
        // Update highlights
        this.#ui.transientUI.highlights = {
            ...this.#ui.transientUI.highlights,
            ...data
        } as IHighlightStates;
        
        // Batch update all cell visual states
        const cellUpdates: Array<{ cellKey: string; visualState: Partial<ICellVisualState> | null }> = [];
        
        // Clear previously highlighted cells
        previouslyHighlighted.forEach(cellKey => {
            cellUpdates.push({ cellKey, visualState: null });
        });
        
        // Add new highlights
        data.reachableCells?.forEach(coord => {
            const cellKey = `${coord.x},${coord.y}`;
            cellUpdates.push({
                cellKey,
                visualState: {
                    isHighlighted: true,
                    highlightType: 'movement',
                    classList: ['highlight']
                }
            });
        });
        
        data.pathCells?.forEach(coord => {
            const cellKey = `${coord.x},${coord.y}`;
            cellUpdates.push({
                cellKey,
                visualState: {
                    isHighlighted: true,
                    highlightType: 'path',
                    classList: ['highlight']
                }
            });
        });
        
        data.targetableCells?.forEach(coord => {
            const cellKey = `${coord.x},${coord.y}`;
            cellUpdates.push({
                cellKey,
                visualState: {
                    isHighlighted: true,
                    highlightType: 'attack',
                    classList: ['highlight']
                }
            });
        });
        
        // Apply all updates in batch
        if (cellUpdates.length > 0) {
            this.onUICellVisualBatch({ updates: cellUpdates });
        }
        
        this.dispatch(StateChangeEvent.uiTransient, structuredClone(this.#ui.transientUI));
    }
    
    private onUIInteractionMode(data: UpdateStateEventsMap[UpdateStateEvent.uiInteractionMode]) {
        this.#ui.interactionMode = structuredClone(data);
        this.dispatch(StateChangeEvent.uiInteractionMode, structuredClone(this.#ui.interactionMode));
    }
    
    // Setters
    private set game(game: IState['game']) {
        this.#game = game;
        this.dispatch(StateChangeEvent.game, structuredClone(this.#game));
        this.save();
    }
    private set map(map: IState['map']) {
        this.#map = map;
        this.#map.forEach(row => row.forEach(cell => this.cellMap.set(cell.position, cell)));
        this.dispatch(StateChangeEvent.map, structuredClone(this.#map));
        this.save();
    }
    private set characters(characters: IState['characters']) {
        this.#characters = characters;
        this.dispatch(StateChangeEvent.characters, structuredClone(this.#characters));
        this.save();
    }
    private set messages(messages: IState['messages']) {
        this.#messages = messages;
        this.save();
    }
    private set ui(ui: IState['ui']) {
        this.#ui = ui;
        // Dispatch individual UI state change events
        this.dispatch(StateChangeEvent.uiAnimations, structuredClone(this.#ui.animations));
        this.dispatch(StateChangeEvent.uiVisualStates, structuredClone(this.#ui.visualStates));
        this.dispatch(StateChangeEvent.uiTransient, structuredClone(this.#ui.transientUI));
        this.dispatch(StateChangeEvent.uiInteractionMode, structuredClone(this.#ui.interactionMode));
    }
    // Getters
    get game(): DeepReadonly<IState['game']> {
        return this.#game;
    }
    get map(): DeepReadonly<IState['map']> {
        return this.#map;
    }
    get characters(): DeepReadonly<IState['characters']> {
        return this.#characters;
    }
    get messages(): DeepReadonly<IState['messages']> {
        return this.#messages;
    }
    get ui(): DeepReadonly<IState['ui']> {
        return this.#ui;
    }
    // Helpers
    #findCharacter(name: ICharacter['name']) {
        return this.#characters.find(character => character.name === name);
    }
    #findCell(coord: ICell['position']) {
        return this.cellMap.get(coord);
    }
    // Storage
    private save() {
        // const state: IState = {
        //     map: this.#map,
        //     characters: this.#characters,
        //     player: this.#player,
        //     messages: this.#messages,
        // }
        // localStorage.setItem(this.storageName, JSON.stringify(state));
    }
    private load(initialState?: IState) {
        let state = initialState;
        if (!state) {
            try {
                const raw = localStorage.getItem(this.storageName);
                state ||= raw && JSON.parse(raw);
            } catch (error) {
                console.error('Game#constructor - localStorage parse error:', error);
            }
        }
        state ||= getBaseState();
        this.game = state.game;
        this.map = state.map;
        this.characters = state.characters;
        this.messages = state.messages;
        this.ui = state.ui || this.getInitialUIState();
    }
    // Public Helpers
    findCharacter(name: ICharacter['name']): DeepReadonly<ICharacter> | undefined {
        return this.#findCharacter(name);
    }
    findCell(coord: ICell['position']): DeepReadonly<ICell> | undefined {
        return this.#findCell(coord);
    }
};
