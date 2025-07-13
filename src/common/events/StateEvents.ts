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
    /** Equip weapon */
    equipWeapon = 'UpdateStateEvent.equipWeapon',
    /** Unequip weapon */
    unequipWeapon = 'UpdateStateEvent.unequipWeapon',
    /** Deduct action points from character */
    deductActionPoints = 'UpdateStateEvent.deductActionPoints',
    /** Reset action points for all characters of a player */
    resetActionPoints = 'UpdateStateEvent.resetActionPoints',
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
        weaponId: string;
        slot: 'primary' | 'secondary';
    };
    [UpdateStateEvent.unequipWeapon]: {
        characterName: string;
        slot: 'primary' | 'secondary';
    };
    [UpdateStateEvent.deductActionPoints]: {
        characterName: string;
        actionId: string;
        cost: number;
    };
    [UpdateStateEvent.resetActionPoints]: {
        player: string;
    };
}

/** Events when the state has changed. All can listen. Only State can dispatch */
export enum StateChangeEvent {
    /** Game state changed (turn, players, etc) */
    game = 'StateChangeEvent.game',
    /** Update character position */
    map = 'StateChangeEvent.map',
    characters = 'StateChangeEvent.characters',
    characterPosition = 'StateChangeEvent.characterPosition',
    characterPath = 'StateChangeEvent.characterPath',
    characterDirection = 'StateChangeEvent.characterDirection',
    messages = 'StateChangeEvent.messages',
    characterInventory = 'StateChangeEvent.characterInventory',
    characterActions = 'StateChangeEvent.characterActions',
}

export interface StateChangeEventsMap {
    [StateChangeEvent.game]: DeepReadonly<IState['game']>;
    [StateChangeEvent.map]: DeepReadonly<IState['map']>;
    [StateChangeEvent.characters]: DeepReadonly<IState['characters']>;
    [StateChangeEvent.characterPosition]: DeepReadonly<ICharacter>;
    [StateChangeEvent.characterPath]: DeepReadonly<ICharacter>;
    [StateChangeEvent.characterDirection]: DeepReadonly<ICharacter>;
    [StateChangeEvent.messages]: DeepReadonly<IState['messages']>;
    [StateChangeEvent.characterInventory]: DeepReadonly<ICharacter>;
    [StateChangeEvent.characterActions]: DeepReadonly<ICharacter>;
}
