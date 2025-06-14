import { IPositionable, IState, ICharacter, IMessage } from "../common/interfaces";
import { IMovement } from "../common/Movement";
import { MapGenerator2 } from "../common/helpers/MapGenerator2";

// Mocks
const locate = (positionable: IPositionable) => {
    return positionable;
}
export const mockHelpers: {
    movement: IMovement,
} = {
    movement: {
        locate,
    }
}
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
    position: { x: 23, y: 25 },
    palette: {
        skin: 'yellow',
        helmet: 'red',
        suit: 'red',
    }
};
export const initialState = (x: number, y: number, playerData: Partial<ICharacter> = player, charactersData: Partial<ICharacter>[] = [data, enemy]): IState => {
    // State
    const mapGenerator = new MapGenerator2(x, y);
    const player = createCharacter(playerData);
    mapGenerator.generateMap([
        { size: 7 },
        { size: 5 },
        { size: 7 },
        { size: 3 },
        { size: 7 },
        { size: 3 },
        { size: 5 },
        { size: 3 },
        { size: 5 },
        { size: 7 },
        { size: 5 },
        { size: 7 },
        { size: 3 },
        { size: 7 },
        { size: 3 },
        { size: 5 },
        { size: 3 },
        { size: 5 },
    ], player.position)
    const map = mapGenerator.getCells();
    const characters: ICharacter[] = [playerData, ...charactersData].map(createCharacter);
    const messages: IMessage[] = [];
    const initialState: IState = {
        map,
        characters,
        player,
        messages,
    };
    return initialState;
}

export const baseState = initialState(40, 50, player, [data]);
