export interface IState {
    game: IGame;
    map: ICell[][];
    characters: ICharacter[];
    messages: IMessage[];
}
export interface IGame {
    turn: string;
    players: string[];
    playerInfo?: Record<string, { name: string; isAI?: boolean }>;
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
export type BasicDirection = 'down' | 'right' | 'up' | 'left';
export type Direction = BasicDirection | 'down-right' | 'up-right' | 'up-left' | 'down-left';
export interface IMovable extends IPositionable {
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

export interface ICharacterActions {
    pointsLeft: number;
    general: {
        move: number;
        talk: number;
        use: number;
        rotate: number;
        inventory: number;
    };
    rangedCombat: {
        shoot: number;
        aim: number;
        suppress: number;
        cover: number;
        throw: number;
    };
    closeCombat: {
        powerStrike: number;
        slash: number;
        fastAttack: number;
        feint: number;
        breakGuard: number;
    };
}

export interface ICharacter extends IMovable {
    name: string;
    race: Race;
    description: string;
    action: Action;
    player: string;
    palette: {
        skin: string;
        helmet: string;
        suit: string;
    };
    inventory: IInventory;
    actions: ICharacterActions;
    health: number;
    maxHealth: number;
}
export interface IMessage {
    role: 'user' | 'assistant';
    content: string;
}

