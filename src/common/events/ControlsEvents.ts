import type { ICoord, ICharacter } from "../interfaces";
import type { DeepReadonly } from "../helpers/types";

/** Controls Events */
export enum ControlsEvent {
    showActions = 'ControlsEvent.showActions',
    showMovement = 'ControlsEvent.showMovement',
    showShooting = 'ControlsEvent.showShooting',
    talk = 'ControlsEvent.talk',
    use = 'ControlsEvent.use',
    cellClick = 'ControlsEvent.cellClick',
    moveCharacter = 'ControlsEvent.moveCharacter',
    showTalk = 'ControlsEvent.showTalk',
    rotate = 'ControlsEvent.rotate',
    showRotate = 'ControlsEvent.showRotate',
    inventory = 'ControlsEvent.inventory',
    showInventory = 'ControlsEvent.showInventory',
    equipWeapon = 'ControlsEvent.equipWeapon',
    characterClick = 'ControlsEvent.characterClick',
    createCharacter = 'ControlsEvent.createCharacter',
    closeCharacterCreator = 'ControlsEvent.closeCharacterCreator',
    openCharacterCreator = 'ControlsEvent.openCharacterCreator',
}

export interface ControlsEventsMap {
    [ControlsEvent.showActions]: ICharacter['name'];
    [ControlsEvent.showMovement]: ICharacter['name'];
    [ControlsEvent.showShooting]: ICharacter['name'];
    [ControlsEvent.talk]: ICharacter['name'];
    [ControlsEvent.use]: ICharacter['name'];
    [ControlsEvent.cellClick]: DeepReadonly<ICoord>;
    [ControlsEvent.moveCharacter]: DeepReadonly<ICharacter>;
    [ControlsEvent.showTalk]: {
        talkingCharacter: DeepReadonly<ICharacter>;
        availableCharacters: DeepReadonly<ICharacter[]>;
    };
    [ControlsEvent.rotate]: ICharacter['name'];
    [ControlsEvent.showRotate]: DeepReadonly<ICharacter>;
    [ControlsEvent.inventory]: ICharacter['name'];
    [ControlsEvent.showInventory]: ICharacter['name'];
    [ControlsEvent.equipWeapon]: {
        characterName: string;
        weaponId: string;
        slot: 'primary' | 'secondary';
    };
    [ControlsEvent.characterClick]: {
        characterName: string;
        position: DeepReadonly<ICoord>;
    };
    [ControlsEvent.createCharacter]: {
        name: string;
        race: 'human' | 'alien' | 'robot';
        description: string;
        palette: {
            skin: string;
            helmet: string;
            suit: string;
        };
        initialWeapons: any[]; // Simplified for prototype
        initialItems: any[]; // Simplified for prototype
        abilities: {
            move: number;
            shoot: number;
            reload: number;
            pickup: number;
        };
    };
    [ControlsEvent.closeCharacterCreator]: null;
    [ControlsEvent.openCharacterCreator]: null;
}
