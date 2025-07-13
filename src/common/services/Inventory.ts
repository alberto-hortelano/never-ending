import type { DeepReadonly } from "../helpers/types";
import type { ICharacter, IWeapon, IItem } from "../interfaces";
import type { State } from "../State";

import {
    EventBus, GameEventsMap, ControlsEventsMap,
    UpdateStateEventsMap, StateChangeEventsMap, UpdateStateEvent,
    StateChangeEvent, InventoryEvent, InventoryEventsMap, InventoryUpdateData
} from "../events";

export class Inventory extends EventBus<
    GameEventsMap & ControlsEventsMap & StateChangeEventsMap & InventoryEventsMap,
    UpdateStateEventsMap & ControlsEventsMap & InventoryEventsMap
> {
    private inventoryCache = new Map<string, InventoryUpdateData>();

    constructor(
        private state: State,
    ) {
        super();
        
        // Listen for inventory events
        this.listen(InventoryEvent.request, characterName => this.onInventoryRequest(characterName));
        this.listen(InventoryEvent.equipWeapon, data => this.onEquipWeapon(data));
        this.listen(InventoryEvent.unequipWeapon, data => this.onUnequipWeapon(data));
        
        // Listen for state changes to update cache
        this.listen(StateChangeEvent.characterInventory, () => this.updateCache());
    }


    private onInventoryRequest(characterName: string) {
        const character = this.state.findCharacter(characterName);
        if (!character) {
            this.dispatch(InventoryEvent.error, `Character ${characterName} not found`);
            return;
        }

        // Get data from cache or calculate it
        let inventoryData = this.inventoryCache.get(characterName);
        if (!inventoryData) {
            inventoryData = this.calculateInventoryData(character);
            this.inventoryCache.set(characterName, inventoryData);
        }

        this.dispatch(InventoryEvent.update, inventoryData);
    }

    private onEquipWeapon(data: { characterName: string; weaponId: string }) {
        const character = this.state.findCharacter(data.characterName);
        if (!character) {
            this.dispatch(InventoryEvent.error, `Character ${data.characterName} not found`);
            return;
        }

        const weapon = character.inventory.items.find(item => 
            item.type === 'weapon' && item.id === data.weaponId
        ) as IWeapon | undefined;

        if (!weapon) {
            this.dispatch(InventoryEvent.error, `Weapon ${data.weaponId} not found`);
            return;
        }

        const slot = Inventory.determineWeaponSlot(weapon, character.inventory.equippedWeapons);
        this.dispatch(UpdateStateEvent.equipWeapon, {
            characterName: data.characterName,
            weaponId: data.weaponId,
            slot
        });
    }

    private onUnequipWeapon(data: { characterName: string; slot: 'primary' | 'secondary' }) {
        this.dispatch(UpdateStateEvent.unequipWeapon, {
            characterName: data.characterName,
            slot: data.slot
        });
    }

    private calculateInventoryData(character: DeepReadonly<ICharacter>): InventoryUpdateData {
        const totalWeight = Inventory.calculateTotalWeight(character.inventory.items);
        const groupedItems = Inventory.groupItemsByType(character.inventory.items);
        
        return {
            character,
            totalWeight,
            groupedItems
        };
    }

    private updateCache() {
        // Update all cached inventory data
        for (const characterName of this.inventoryCache.keys()) {
            const character = this.state.findCharacter(characterName);
            if (character) {
                const inventoryData = this.calculateInventoryData(character);
                this.inventoryCache.set(characterName, inventoryData);
                this.dispatch(InventoryEvent.update, inventoryData);
            }
        }
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