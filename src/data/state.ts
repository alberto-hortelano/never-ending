import { IState, ICharacter, IMessage } from "../common/interfaces";
import { MapGenerator } from "../common/helpers/MapGenerator";
import { positionCharacters } from "../common/helpers/map";

const baseCharacter: ICharacter = {
    name: 'test',
    race: 'human',
    description: 'test character',
    action: 'iddle',
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
};

const createCharacter = (character?: Partial<ICharacter>) => ({ ...baseCharacter, ...character });

const data: Partial<ICharacter> = {
    name: 'data',
    race: 'robot',
    location: 'room4',
    position: { x: 25, y: 25 },
    palette: {
        skin: 'yellow',
        helmet: 'gold',
        suit: 'gold',
    }
};
const player: Partial<ICharacter> = {
    name: 'player',
    race: 'human',
    location: 'room2',
    position: { x: 24, y: 25 },
    palette: {
        skin: '#d7a55f',
        helmet: 'white',
        suit: 'white',
    }
};
const enemy: Partial<ICharacter> = {
    name: 'enemy',
    race: 'robot',
    location: 'room3',
    position: { x: 23, y: 25 },
    palette: {
        skin: 'yellow',
        helmet: 'red',
        suit: 'red',
    }
};
export const initialState = (x: number, y: number, playerData: Partial<ICharacter> = player, charactersData: Partial<ICharacter>[] = [data, enemy]): IState => {
    // State
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
        map,
        characters: positionCharacters(characters, map),
        player,
        messages,
    };
    return initialState;
}

export const getBaseState = () => initialState(40, 50, player, [data]);
