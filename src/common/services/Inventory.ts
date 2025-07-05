import type { DeepReadonly } from "../helpers/types";
import type { ICharacter, IWeapon, IItem } from "../interfaces";
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



    public static calculateTotalWeight(items: DeepReadonly<IItem[]>): number {
        return items.reduce((sum, item) => sum + item.weight, 0);
    }

    public static groupItemsByType(items: DeepReadonly<IItem[]>): {
        weapons: IWeapon[];
        otherItems: IItem[];
    } {
        const weapons = items.filter(item => item.type === 'weapon') as IWeapon[];
        const otherItems = items.filter(item => item.type !== 'weapon') as IItem[];
        return { weapons, otherItems };
    }

    public static determineWeaponSlot(weapon: IWeapon, equippedWeapons: DeepReadonly<ICharacter['inventory']['equippedWeapons']>): 'primary' | 'secondary' {
        // Two-handed weapons always go in primary and clear secondary
        if (weapon.weaponType === 'twoHanded') {
            return 'primary';
        }
        
        // One-handed weapons: use primary if empty, otherwise secondary
        if (!equippedWeapons.primary) {
            return 'primary';
        } else if (!equippedWeapons.secondary) {
            return 'secondary';
        } else {
            // Both slots full, replace primary
            return 'primary';
        }
    }

}