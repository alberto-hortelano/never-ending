import type { DeepReadonly } from '../helpers/types';
import type { ICharacter, IItem, IWeapon } from '../interfaces';

export enum InventoryEvent {
    request = 'InventoryEvent.request',
    update = 'InventoryEvent.update',
    equipWeapon = 'InventoryEvent.equipWeapon',
    unequipWeapon = 'InventoryEvent.unequipWeapon',
    error = 'InventoryEvent.error'
}

export interface InventoryUpdateData {
    character: DeepReadonly<ICharacter>;
    totalWeight: number;
    groupedItems: {
        weapons: IWeapon[];
        otherItems: IItem[];
    };
}

export interface InventoryEventsMap {
    [InventoryEvent.request]: string; // character name
    [InventoryEvent.update]: InventoryUpdateData;
    [InventoryEvent.equipWeapon]: { characterName: string; weaponId: string };
    [InventoryEvent.unequipWeapon]: { characterName: string; slot: 'primary' | 'secondary' };
    [InventoryEvent.error]: string;
}