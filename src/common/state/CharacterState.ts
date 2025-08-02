import type { IState, ICharacter, IInventory, IWeapon } from "../interfaces";
import { EventBus, UpdateStateEventsMap, StateChangeEventsMap, UpdateStateEvent, StateChangeEvent } from "../events";
import { DeepReadonly } from "../helpers/types";

interface NetworkEventData {
    fromNetwork?: boolean;
}

export class CharacterState extends EventBus<UpdateStateEventsMap, StateChangeEventsMap> {
    #characters: IState['characters'] = [];
    private getCurrentTurn: () => string;
    private onSave?: () => void;

    constructor(getCurrentTurn: () => string, onSave?: () => void) {
        super();
        this.getCurrentTurn = getCurrentTurn;
        this.onSave = onSave;
        
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

    set characters(characters: IState['characters']) {
        this.#characters = characters;
        this.dispatch(StateChangeEvent.characters, structuredClone(this.#characters));
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