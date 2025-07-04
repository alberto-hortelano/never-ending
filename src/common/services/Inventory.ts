import type { DeepReadonly } from "../helpers/types";
import type { ICharacter, IWeapon } from "../interfaces";
import type { State } from "../State";

import {
    EventBus, ControlsEvent, GameEventsMap, ControlsEventsMap,
    UpdateStateEventsMap, StateChangeEventsMap,
} from "../events";

export class Inventory extends EventBus<
    GameEventsMap & ControlsEventsMap & StateChangeEventsMap,
    UpdateStateEventsMap & ControlsEventsMap
> {
    constructor(
        private state: State,
    ) {
        super();
        // Listen for inventory action and convert to showInventory with full character
        this.listen(ControlsEvent.inventory, characterName => this.onInventory(characterName));
    }

    private onInventory(characterName: ControlsEventsMap[ControlsEvent.inventory]) {
        const character = this.state.findCharacter(characterName);
        if (!character) return;

        // Dispatch event to show the inventory popup
        this.dispatch(ControlsEvent.showInventory, character);
    }


    public canEquipWeapon(character: DeepReadonly<ICharacter>, weapon: IWeapon): boolean {
        // Check weight limit
        const currentWeight = character.inventory.items.reduce((sum, item) => sum + item.weight, 0);
        if (currentWeight > character.inventory.maxWeight) {
            return false;
        }

        // Check if weapon exists in inventory
        return character.inventory.items.some(item => item.id === weapon.id);
    }

    public getEquippedWeaponStats(character: DeepReadonly<ICharacter>): {
        totalDamage: number;
        maxRange: number;
    } {
        const { primary, secondary } = character.inventory.equippedWeapons;
        let totalDamage = 0;
        let maxRange = 0;

        if (primary) {
            totalDamage += primary.damage;
            maxRange = Math.max(maxRange, primary.range);
        }

        if (secondary) {
            totalDamage += secondary.damage;
            maxRange = Math.max(maxRange, secondary.range);
        }

        return { totalDamage, maxRange };
    }
}