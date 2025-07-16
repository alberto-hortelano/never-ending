import type { ICoord, ICell, ICharacter, IState, IInventory, IWeapon } from "./interfaces";

import { UpdateStateEvent, EventBus, UpdateStateEventsMap, StateChangeEventsMap, StateChangeEvent, ControlsEvent, ControlsEventsMap, GameEvent, GameEventsMap } from "./events";
import { DeepReadonly } from "./helpers/types";
import { getBaseState } from '../data/state';

export class State extends EventBus<UpdateStateEventsMap & GameEventsMap, StateChangeEventsMap & ControlsEventsMap> {
    #game: IState['game'] = { turn: '', players: [] };
    #map: IState['map'] = [];
    #characters: IState['characters'] = [];
    #messages: IState['messages'] = [];

    private readonly storageName = 'state'; // could be random to hide from others
    private cellMap = new Map<ICoord, ICell>();

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
    }
    // Listeners
    private onCharacterPosition(characterData: UpdateStateEventsMap[UpdateStateEvent.characterPosition]) {
        const character = this.#findCharacter(characterData.name);
        if (!character) {
            throw new Error(`No character "${characterData.name}" found`);
        }
        character.position = characterData.position;
        character.direction = characterData.direction;
        // No one is listening
        // this.dispatch(StateChangeEvent.characterPosition, structuredClone(character));
        this.save();
    }
    private onCharacterPath(characterData: UpdateStateEventsMap[UpdateStateEvent.characterPosition]) {
        const character = this.#characters.find(character => character.name === characterData.name);
        if (!character) {
            throw new Error(`No character "${characterData.name}" found`);
        }
        character.path = [...characterData.path];
        this.dispatch(StateChangeEvent.characterPath, structuredClone(character));
    }
    private onCharacterDirection(data: UpdateStateEventsMap[UpdateStateEvent.characterDirection]) {
        const character = this.#findCharacter(data.characterName);
        if (!character) {
            throw new Error(`No character "${data.characterName}" found`);
        }
        character.direction = data.direction;
        // No one is listening
        // this.dispatch(StateChangeEvent.characterDirection, structuredClone(character));
        this.dispatch(ControlsEvent.moveCharacter, structuredClone(character), character.name);
        
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
            console.log(`${character.name} has been defeated!`);
            this.dispatch(StateChangeEvent.characterDefeated, structuredClone(character));
        }
        
        this.save();
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
    }
    // Public Helpers
    findCharacter(name: ICharacter['name']): DeepReadonly<ICharacter> | undefined {
        return this.#findCharacter(name);
    }
    findCell(coord: ICell['position']): DeepReadonly<ICell> | undefined {
        return this.#findCell(coord);
    }
};
