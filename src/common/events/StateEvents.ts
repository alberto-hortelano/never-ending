import type { ICharacter, IState, IMessage, Direction, IInventory } from '../interfaces';
import type { DeepReadonly } from "../helpers/types";

/** Events to update state. Only State can listen. All can dispatch */
export enum UpdateStateEvent {
    /** Update character position */
    characterPosition = 'UpdateStateEvent.characterPosition',
    characterPath = 'UpdateStateEvent.characterPath',
    /** Update character direction */
    characterDirection = 'UpdateStateEvent.characterDirection',
    /** Update messages history */
    updateMessages = 'UpdateStateEvent.updateMessages',
    /** Update character inventory */
    updateInventory = 'UpdateStateEvent.updateInventory',
    /** Equip/unequip weapon */
    equipWeapon = 'UpdateStateEvent.equipWeapon',
}

export interface UpdateStateEventsMap {
    [UpdateStateEvent.characterPosition]: DeepReadonly<ICharacter>;
    [UpdateStateEvent.characterPath]: DeepReadonly<ICharacter>;
    [UpdateStateEvent.characterDirection]: { characterName: string; direction: Direction };
    [UpdateStateEvent.updateMessages]: DeepReadonly<IMessage[]>;
    [UpdateStateEvent.updateInventory]: { 
        characterName: string; 
        inventory: DeepReadonly<IInventory>;
    };
    [UpdateStateEvent.equipWeapon]: {
        characterName: string;
        weaponId: string | null;
        slot: 'primary' | 'secondary';
    };
}

/** Events when the state has changed. All can listen. Only State can dispatch */
export enum StateChangeEvent {
    /** Update character position */
    map = 'StateChangeEvent.map',
    characters = 'StateChangeEvent.characters',
    characterPosition = 'StateChangeEvent.characterPosition',
    characterPath = 'StateChangeEvent.characterPath',
    characterDirection = 'StateChangeEvent.characterDirection',
    messages = 'StateChangeEvent.messages',
    characterInventory = 'StateChangeEvent.characterInventory',
}

export interface StateChangeEventsMap {
    [StateChangeEvent.map]: DeepReadonly<IState['map']>;
    [StateChangeEvent.characters]: DeepReadonly<IState['characters']>;
    [StateChangeEvent.characterPosition]: DeepReadonly<ICharacter>;
    [StateChangeEvent.characterPath]: DeepReadonly<ICharacter>;
    [StateChangeEvent.characterDirection]: DeepReadonly<ICharacter>;
    [StateChangeEvent.messages]: DeepReadonly<IState['messages']>;
    [StateChangeEvent.characterInventory]: DeepReadonly<ICharacter>;
}
