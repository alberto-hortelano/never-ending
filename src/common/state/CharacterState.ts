import type { IState, ICharacter, IInventory, IWeapon, Race, Direction, Action } from "../interfaces";
import { EventBus, UpdateStateEventsMap, StateChangeEventsMap, UpdateStateEvent, StateChangeEvent } from "../events";
import { DeepReadonly } from "../helpers/types";

interface NetworkEventData {
    fromNetwork?: boolean;
}

export class CharacterState extends EventBus<UpdateStateEventsMap, StateChangeEventsMap> {
    #characters: IState['characters'] = [];
    private getCurrentTurn: () => string;
    private onSave?: () => void;
    private skipEvents = false;

    constructor(getCurrentTurn: () => string, onSave?: () => void, skipEvents = false) {
        super();
        this.getCurrentTurn = getCurrentTurn;
        this.onSave = onSave;
        this.skipEvents = skipEvents;
        
        // Don't listen to events if this is a preview state
        if (!skipEvents) {
            this.listen(UpdateStateEvent.characterPosition, (ch) => this.onCharacterPosition(ch));
            this.listen(UpdateStateEvent.characterPath, (ch) => this.onCharacterPath(ch));
            this.listen(UpdateStateEvent.characterDirection, (data) => this.onCharacterDirection(data));
            this.listen(UpdateStateEvent.updateInventory, (data) => this.onUpdateInventory(data));
            this.listen(UpdateStateEvent.equipWeapon, (data) => this.onEquipWeapon(data));
            this.listen(UpdateStateEvent.unequipWeapon, (data) => this.onUnequipWeapon(data));
            this.listen(UpdateStateEvent.deductActionPoints, (data) => this.onDeductActionPoints(data));
            this.listen(UpdateStateEvent.setPendingActionCost, (data) => this.onSetPendingActionCost(data));
            this.listen(UpdateStateEvent.resetActionPoints, (data) => this.onResetActionPoints(data));
            this.listen(UpdateStateEvent.damageCharacter, (data) => this.onDamageCharacter(data));
            this.listen(UpdateStateEvent.addCharacter, (data) => this.onAddCharacter(data));
            this.listen(UpdateStateEvent.removeCharacter, (data) => this.onRemoveCharacter(data));
        }
    }

    private isValidTurn(characterName: string, fromNetwork?: boolean): boolean {
        if (fromNetwork) return true;
        
        const character = this.findCharacter(characterName);
        if (!character) return false;
        
        return character.player === this.getCurrentTurn();
    }

    private onCharacterPosition(characterData: UpdateStateEventsMap[UpdateStateEvent.characterPosition]) {
        const character = this.#characters.find(c => c.name === characterData.name);
        if (!character) {
            throw new Error(`No character "${characterData.name}" found`);
        }

        const fromNetwork = (characterData as NetworkEventData).fromNetwork;
        if (!this.isValidTurn(characterData.name, fromNetwork)) {
            console.warn(`Invalid turn: ${character.player} tried to move during ${this.getCurrentTurn()}'s turn`);
            return;
        }

        character.position = characterData.position;
        character.direction = characterData.direction;

        const eventData = { ...structuredClone(character), fromNetwork };
        this.dispatch(StateChangeEvent.characterPosition, eventData);
        this.onSave?.();
    }

    private onCharacterPath(characterData: UpdateStateEventsMap[UpdateStateEvent.characterPath]) {
        const character = this.#characters.find(c => c.name === characterData.name);
        if (!character) {
            throw new Error(`No character "${characterData.name}" found`);
        }

        const fromNetwork = (characterData as NetworkEventData).fromNetwork;
        if (!this.isValidTurn(characterData.name, fromNetwork)) {
            console.warn(`Invalid turn: ${character.player} tried to set path during ${this.getCurrentTurn()}'s turn`);
            return;
        }

        character.path = [...characterData.path];
        const eventData = { ...structuredClone(character), fromNetwork };
        this.dispatch(StateChangeEvent.characterPath, eventData);
    }

    private onCharacterDirection(data: UpdateStateEventsMap[UpdateStateEvent.characterDirection]) {
        const character = this.findCharacter(data.characterName);
        if (!character) {
            throw new Error(`No character "${data.characterName}" found`);
        }

        const fromNetwork = (data as NetworkEventData).fromNetwork;
        if (!this.isValidTurn(data.characterName, fromNetwork)) {
            console.warn(`Invalid turn: ${character.player} tried to rotate during ${this.getCurrentTurn()}'s turn`);
            return;
        }

        character.direction = data.direction;
        this.dispatch(StateChangeEvent.characterDirection, structuredClone(character), character.name);
        this.onSave?.();
    }

    private onUpdateInventory(data: UpdateStateEventsMap[UpdateStateEvent.updateInventory]) {
        const character = this.findCharacter(data.characterName);
        if (!character) {
            throw new Error(`No character "${data.characterName}" found`);
        }

        const fromNetwork = (data as NetworkEventData).fromNetwork;
        if (!this.isValidTurn(data.characterName, fromNetwork)) {
            console.warn(`Invalid turn: ${character.player} tried to update inventory during ${this.getCurrentTurn()}'s turn`);
            return;
        }

        character.inventory = structuredClone(data.inventory) as IInventory;
        this.dispatch(StateChangeEvent.characterInventory, structuredClone(character));
        this.onSave?.();
    }

    private onEquipWeapon(data: UpdateStateEventsMap[UpdateStateEvent.equipWeapon]) {
        const character = this.findCharacter(data.characterName);
        if (!character) {
            throw new Error(`No character "${data.characterName}" found`);
        }

        const inventory = { ...character.inventory };
        const equippedWeapons = { ...inventory.equippedWeapons };

        if (data.weaponId === null) {
            equippedWeapons[data.slot] = null;
        } else {
            const weapon = inventory.items.find(item =>
                item.id === data.weaponId && item.type === 'weapon'
            ) as IWeapon | undefined;

            if (!weapon) {
                console.error(`Weapon with id ${data.weaponId} not found in inventory`);
                return;
            }

            if (weapon.weaponType === 'twoHanded') {
                equippedWeapons.primary = weapon;
                equippedWeapons.secondary = null;
            } else {
                equippedWeapons[data.slot] = weapon;

                if (data.slot === 'primary' && equippedWeapons.primary?.weaponType === 'twoHanded') {
                    equippedWeapons.secondary = null;
                }
            }
        }

        inventory.equippedWeapons = equippedWeapons;
        character.inventory = inventory;

        this.dispatch(StateChangeEvent.characterInventory, structuredClone(character));
        this.onSave?.();
    }

    private onUnequipWeapon(data: UpdateStateEventsMap[UpdateStateEvent.unequipWeapon]) {
        this.onEquipWeapon({
            characterName: data.characterName,
            weaponId: null,
            slot: data.slot
        });
    }

    private onDeductActionPoints(data: UpdateStateEventsMap[UpdateStateEvent.deductActionPoints]) {
        const character = this.findCharacter(data.characterName);
        if (!character) {
            throw new Error(`No character "${data.characterName}" found`);
        }

        const fromNetwork = (data as NetworkEventData).fromNetwork;
        if (!this.isValidTurn(data.characterName, fromNetwork)) {
            console.warn(`Invalid turn: ${character.player} tried to use action points during ${this.getCurrentTurn()}'s turn`);
            return;
        }

        character.actions.pointsLeft = Math.max(0, character.actions.pointsLeft - data.cost);
        this.dispatch(StateChangeEvent.characterActions, structuredClone(character));
        this.onSave?.();
    }

    private onSetPendingActionCost(data: UpdateStateEventsMap[UpdateStateEvent.setPendingActionCost]) {
        const character = this.findCharacter(data.characterName);
        if (!character) {
            throw new Error(`No character "${data.characterName}" found`);
        }

        character.actions.pendingCost = data.cost;
        this.dispatch(StateChangeEvent.characterActions, structuredClone(character));
    }

    private onResetActionPoints(data: UpdateStateEventsMap[UpdateStateEvent.resetActionPoints]) {
        this.#characters.forEach(character => {
            if (character.player === data.player) {
                character.actions.pointsLeft = 100;
                character.actions.pendingCost = 0;
                this.dispatch(StateChangeEvent.characterActions, structuredClone(character));
            }
        });
        this.onSave?.();
    }

    private onDamageCharacter(data: UpdateStateEventsMap[UpdateStateEvent.damageCharacter]) {
        const character = this.findCharacter(data.targetName);
        if (!character) {
            throw new Error(`No character "${data.targetName}" found`);
        }

        const previousHealth = character.health;
        character.health = Math.max(0, character.health - data.damage);

        this.dispatch(StateChangeEvent.characterHealth, structuredClone(character));

        if (character.health === 0 && previousHealth > 0) {
            this.dispatch(StateChangeEvent.characterDefeated, structuredClone(character));
        }
        
        this.onSave?.();
    }

    resetActionPointsForTurn(turn: string) {
        this.#characters.forEach(character => {
            if (character.player === turn) {
                character.actions.pointsLeft = 100;
                character.actions.pendingCost = 0;
                this.dispatch(StateChangeEvent.characterActions, structuredClone(character));
            }
        });
    }

    private onAddCharacter(data: UpdateStateEventsMap[UpdateStateEvent.addCharacter]) {
        // Check if character already exists
        if (this.#characters.find(c => c.name === data.name)) {
            console.warn(`Character ${data.name} already exists`);
            return;
        }

        // Create full character object with defaults
        const newCharacter: ICharacter = {
            name: data.name,
            race: (data.race || 'human') as Race,
            description: data.description || '',
            position: data.position,
            location: '',  // Required by IPositionable
            blocker: true,  // Characters are blockers
            direction: (data.direction || 'bottom') as Direction,
            player: data.player || this.getCurrentTurn(),
            action: (data.action || 'idle') as Action,
            path: [],
            health: data.health || 100,
            maxHealth: data.maxHealth || 100,
            palette: data.palette || {
                skin: '#d7a55f',
                helmet: '#808080',
                suit: '#404040'
            },
            inventory: data.inventory || {
                maxWeight: 20,
                items: [],
                equippedWeapons: {
                    primary: null,
                    secondary: null
                }
            },
            actions: data.actions || {
                pointsLeft: 100,
                general: { move: 5, talk: 10, use: 10, inventory: 5 },
                rangedCombat: { shoot: 20, aim: 10, overwatch: 30, cover: 10, throw: 15 },
                closeCombat: { powerStrike: 25, slash: 20, fastAttack: 15, feint: 10, breakGuard: 20 }
            }
        };

        this.#characters.push(newCharacter);
        this.dispatch(StateChangeEvent.characters, structuredClone(this.#characters));
        this.dispatch(StateChangeEvent.characterAdded, structuredClone(newCharacter));
        this.onSave?.();
    }

    private onRemoveCharacter(data: UpdateStateEventsMap[UpdateStateEvent.removeCharacter]) {
        const index = this.#characters.findIndex(c => c.name === data.characterName);
        if (index === -1) {
            console.warn(`Character ${data.characterName} not found`);
            return;
        }

        const removedCharacter = this.#characters[index];
        this.#characters.splice(index, 1);
        this.dispatch(StateChangeEvent.characters, structuredClone(this.#characters));
        this.dispatch(StateChangeEvent.characterRemoved, structuredClone(removedCharacter!));
        this.onSave?.();
    }

    set characters(characters: IState['characters']) {
        this.#characters = characters;
        if (!this.skipEvents) {
            this.dispatch(StateChangeEvent.characters, structuredClone(this.#characters));
        }
        this.onSave?.();
    }

    get characters(): DeepReadonly<IState['characters']> {
        return this.#characters;
    }

    findCharacter(name: ICharacter['name']): ICharacter | undefined {
        return this.#characters.find(character => character.name === name);
    }

    getCharacter(name: ICharacter['name']): DeepReadonly<ICharacter> | undefined {
        return this.findCharacter(name);
    }
}