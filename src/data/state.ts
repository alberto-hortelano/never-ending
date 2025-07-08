import { IState, ICharacter, IMessage, IItem, IWeapon, IInventory, IGame } from "../common/interfaces";
import { MapGenerator } from "../common/helpers/MapGenerator";
import { positionCharacters } from "../common/helpers/map";

// Example weapons
export const weapons: IWeapon[] = [
    {
        id: 'pistol-01',
        name: 'Energy Pistol',
        description: 'A compact energy weapon for close encounters',
        weight: 1.2,
        icon: '🔫',
        type: 'weapon',
        weaponType: 'oneHanded',
        category: 'ranged',
        damage: 15,
        range: 10
    },
    {
        id: 'sword-01',
        name: 'Plasma Sword',
        description: 'An elegant weapon for a more civilized age',
        weight: 2.5,
        icon: '⚔️',
        type: 'weapon',
        weaponType: 'oneHanded',
        category: 'melee',
        damage: 20,
        range: 2
    },
    {
        id: 'knife-01',
        name: 'Combat Knife',
        description: 'A sharp blade for quick strikes',
        weight: 0.5,
        icon: '🔪',
        type: 'weapon',
        weaponType: 'oneHanded',
        category: 'melee',
        damage: 10,
        range: 1
    },
    {
        id: 'rifle-01',
        name: 'Pulse Rifle',
        description: 'Standard issue military rifle with high accuracy',
        weight: 4.5,
        icon: '🔫',
        type: 'weapon',
        weaponType: 'twoHanded',
        category: 'ranged',
        damage: 30,
        range: 20
    },
    {
        id: 'spear-01',
        name: 'Energy Spear',
        description: 'Long reach weapon with energy tip',
        weight: 3.0,
        icon: '🔱',
        type: 'weapon',
        weaponType: 'twoHanded',
        category: 'melee',
        damage: 25,
        range: 3
    },
    {
        id: 'hammer-01',
        name: 'Heavy Hammer',
        description: 'Devastating two-handed weapon',
        weight: 6.0,
        icon: '🔨',
        type: 'weapon',
        weaponType: 'twoHanded',
        category: 'melee',
        damage: 35,
        range: 2
    }
];

// Example items
export const items: IItem[] = [
    {
        id: 'medkit-01',
        name: 'Medkit',
        description: 'Restores health when used',
        weight: 0.8,
        icon: '🏥',
        type: 'consumable'
    },
    {
        id: 'ammo-01',
        name: 'Energy Cell',
        description: 'Ammunition for energy weapons',
        weight: 0.2,
        icon: '🔋',
        type: 'consumable'
    },
    {
        id: 'ration-01',
        name: 'Food Ration',
        description: 'Standard military food ration',
        weight: 0.5,
        icon: '🍱',
        type: 'consumable'
    },
    {
        id: 'keycard-01',
        name: 'Security Keycard',
        description: 'Opens locked doors',
        weight: 0.1,
        icon: '🗝️',
        type: 'misc'
    }
];

// Default inventory for new characters
const defaultInventory: IInventory = {
    items: [],
    maxWeight: 50,
    equippedWeapons: {
        primary: null,
        secondary: null
    }
};

export const baseCharacter: ICharacter = {
    name: 'test',
    race: 'human',
    description: 'test character',
    action: 'iddle',
    player: '',
    palette: {
        skin: 'green',
        helmet: 'red',
        suit: 'blue'
    },
    speed: 'medium',
    direction: 'down',
    path: [],
    location: '',
    position: { x: 1, y: 1 },
    blocker: true,
    inventory: { ...defaultInventory }
};

const createCharacter = (character?: Partial<ICharacter>) => ({ ...baseCharacter, ...character });

const data: Partial<ICharacter> = {
    name: 'data',
    race: 'robot',
    player: 'ai',
    location: 'room4',
    position: { x: 25, y: 25 },
    palette: {
        skin: 'yellow',
        helmet: 'gold',
        suit: 'gold',
    },
    inventory: {
        items: [...weapons.slice(3, 4), ...items.slice(1, 2), ...items.slice(1, 2)], // Rifle and 2 energy cells
        maxWeight: 50,
        equippedWeapons: {
            primary: weapons[3] ?? null, // Rifle equipped
            secondary: null
        }
    }
};
const player: Partial<ICharacter> = {
    name: 'player',
    race: 'human',
    player: 'human',
    location: 'room2',
    position: { x: 24, y: 25 },
    palette: {
        skin: '#d7a55f',
        helmet: 'white',
        suit: 'white',
    },
    inventory: {
        items: [...weapons.slice(0, 2), ...items.slice(0, 1), ...items.slice(2, 3)], // Pistol, sword, medkit, ration
        maxWeight: 50,
        equippedWeapons: {
            primary: weapons[0] ?? null, // Pistol
            secondary: weapons[1] ?? null  // Sword
        }
    }
};
const enemy: Partial<ICharacter> = {
    name: 'enemy',
    race: 'robot',
    player: 'ai',
    location: 'room3',
    position: { x: 23, y: 25 },
    palette: {
        skin: 'yellow',
        helmet: 'red',
        suit: 'red',
    },
    inventory: {
        items: [...weapons.slice(2, 3), ...weapons.slice(4, 5), ...items.slice(3, 4)], // Knife, spear, keycard
        maxWeight: 50,
        equippedWeapons: {
            primary: weapons[4] ?? null, // Spear (two-handed)
            secondary: null
        }
    }
};
export const initialState = (x: number, y: number, playerData: Partial<ICharacter> = player, charactersData: Partial<ICharacter>[] = [data, enemy]): IState => {
    // State
    const game: IGame = {
        turn: 'human',
        players: ['human', 'ai']
    }
    const mapGenerator = new MapGenerator(x, y);
    const player = createCharacter(playerData);
    mapGenerator.generateMap([
        { size: 7, name: 'room1' },
        { size: 5, name: 'room2' },
        { size: 7, name: 'room3' },
        { size: 3, name: 'room4' },
        { size: 7, name: 'room5' },
        { size: 3, name: 'room6' },
        { size: 5, name: 'room7' },
        { size: 3, name: 'room8' },
        // { size: 5, name: 'room9' },
        // { size: 7, name: 'room10' },
        // { size: 5, name: 'room11' },
        // { size: 7, name: 'room12' },
        // { size: 3, name: 'room13' },
        // { size: 7, name: 'room14' },
        // { size: 3, name: 'room15' },
        // { size: 5, name: 'room16' },
        // { size: 3, name: 'room17' },
        // { size: 5, name: 'room18' },
    ], player.position)
    const map = mapGenerator.getCells();
    const characters: ICharacter[] = [playerData, ...charactersData].map(createCharacter);
    const messages: IMessage[] = [];
    const initialState: IState = {
        game,
        map,
        characters: positionCharacters(characters, map),
        messages,
    };
    return initialState;
}

export const getBaseState = () => initialState(40, 50, player, [data]);
