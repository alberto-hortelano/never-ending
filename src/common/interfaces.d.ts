export interface IState {
    game: IGame;
    map: ICell[][];
    characters: ICharacter[];
    player?: ICharacter;
    messages: IMessage[];
}
export interface IGame {
    turn: ICharacter['name'];
}
export interface ICoord {
    x: number;
    y: number;
}
export interface ICell {
    position: ICoord;
    locations: string[];
    elements: IPositionable[];
    content: IPositionable | null;
}
export interface IPositionable {
    position: ICoord;
    location: string;
    blocker: boolean;
}
export interface IRoom {
    size: number;
    name: string;
    center?: ICoord;
}
export type Speed = 'verySlow' | 'slow' | 'medium' | 'fast' | 'veryFast';
export type BasicDirection = 'down' | 'right' | 'up' | 'left';
export type Direction = BasicDirection | 'down-right' | 'up-right' | 'up-left' | 'down-left';
export interface IMovable extends IPositionable {
    speed: Speed;
    direction: Direction;
    path: ICoord[];
}
export type Race = 'human' | 'alien' | 'robot';
export type Action = 'walk' | 'iddle';
export type ItemType = 'consumable' | 'weapon' | 'armor' | 'misc';
export type WeaponType = 'oneHanded' | 'twoHanded';
export type WeaponCategory = 'melee' | 'ranged';

export interface IItem {
    id: string;
    name: string;
    description: string;
    weight: number;
    icon: string;
    type: ItemType;
}

export interface IWeapon extends IItem {
    type: 'weapon';
    weaponType: WeaponType;
    category: WeaponCategory;
    damage: number;
    range: number;
}

export interface IInventory {
    items: IItem[];
    maxWeight: number;
    equippedWeapons: {
        primary: IWeapon | null;
        secondary: IWeapon | null;
    };
}

export interface ICharacter extends IMovable {
    name: string;
    race: Race;
    description: string;
    action: Action
    palette: {
        skin: string;
        helmet: string;
        suit: string;
    };
    inventory: IInventory;
}
export interface IMessage {
    role: 'user' | 'assistant';
    content: string;
}

