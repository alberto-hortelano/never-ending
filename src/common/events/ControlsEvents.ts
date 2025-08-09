import type { ICoord, ICharacter, IWeapon, IItem, Direction } from "../interfaces";
import type { DeepReadonly } from "../helpers/types";
import type { MeleeAttackType } from "../services/MeleeCombatService";

/** Controls Events */
export enum ControlsEvent {
    showActions = 'ControlsEvent.showActions',
    showMovement = 'ControlsEvent.showMovement',
    showShooting = 'ControlsEvent.showShooting',
    showAiming = 'ControlsEvent.showAiming',
    showOverwatch = 'ControlsEvent.showOverwatch',
    talk = 'ControlsEvent.talk',
    use = 'ControlsEvent.use',
    cellClick = 'ControlsEvent.cellClick',
    cellMouseEnter = 'ControlsEvent.cellMouseEnter',
    cellMouseLeave = 'ControlsEvent.cellMouseLeave',
    moveCharacter = 'ControlsEvent.moveCharacter',
    showTalk = 'ControlsEvent.showTalk',
    inventory = 'ControlsEvent.inventory',
    showInventory = 'ControlsEvent.showInventory',
    equipWeapon = 'ControlsEvent.equipWeapon',
    characterClick = 'ControlsEvent.characterClick',
    createCharacter = 'ControlsEvent.createCharacter',
    closeCharacterCreator = 'ControlsEvent.closeCharacterCreator',
    openCharacterCreator = 'ControlsEvent.openCharacterCreator',
    mousePositionUpdate = 'ControlsEvent.mousePositionUpdate',
    'power-strike' = 'ControlsEvent.power-strike',
    'slash' = 'ControlsEvent.slash',
    'fast-attack' = 'ControlsEvent.fast-attack',
    'feint' = 'ControlsEvent.feint',
    'break-guard' = 'ControlsEvent.break-guard',
    'special' = 'ControlsEvent.special',
    meleeDefenseSelected = 'ControlsEvent.meleeDefenseSelected',
}

export interface ControlsEventsMap {
    [ControlsEvent.showActions]: ICharacter['name'];
    [ControlsEvent.showMovement]: ICharacter['name'];
    [ControlsEvent.showShooting]: ICharacter['name'];
    [ControlsEvent.showAiming]: ICharacter['name'];
    [ControlsEvent.showOverwatch]: ICharacter['name'];
    [ControlsEvent.talk]: ICharacter['name'];
    [ControlsEvent.use]: ICharacter['name'];
    [ControlsEvent.cellClick]: DeepReadonly<ICoord>;
    [ControlsEvent.cellMouseEnter]: DeepReadonly<ICoord>;
    [ControlsEvent.cellMouseLeave]: DeepReadonly<ICoord>;
    [ControlsEvent.moveCharacter]: DeepReadonly<ICharacter>;
    [ControlsEvent.showTalk]: {
        talkingCharacter: DeepReadonly<ICharacter>;
        availableCharacters: DeepReadonly<ICharacter[]>;
    };
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
        initialWeapons: Partial<IWeapon>[]; // Simplified for prototype
        initialItems: Partial<IItem>[]; // Simplified for prototype
        abilities: {
            move: number;
            shoot: number;
            reload: number;
            pickup: number;
        };
    };
    [ControlsEvent.closeCharacterCreator]: null;
    [ControlsEvent.openCharacterCreator]: null;
    [ControlsEvent.mousePositionUpdate]: {
        characterName: string;
        newDirection: Direction;
        mouseCoord: DeepReadonly<ICoord>;
    };
    'ControlsEvent.power-strike': ICharacter['name'];
    'ControlsEvent.slash': ICharacter['name'];
    'ControlsEvent.fast-attack': ICharacter['name'];
    'ControlsEvent.feint': ICharacter['name'];
    'ControlsEvent.break-guard': ICharacter['name'];
    'ControlsEvent.special': ICharacter['name'];
    [ControlsEvent.meleeDefenseSelected]: {
        defenseType: MeleeAttackType;
    };
}
