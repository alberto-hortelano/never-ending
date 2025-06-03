import { IPositionable, IState, ICharacter, IMessage } from "../common/interfaces";
import { IMovement } from "../common/Movement";
import { MapGenerator } from "../common/helpers/MapGenerator";

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

export const initialState = (x: number, y: number, playerData: Partial<ICharacter> = {}, charactersData: Partial<ICharacter>[] = []): IState => {
    // State
    const mapGenerator = new MapGenerator(x, y, playerData.position);
    const player = createCharacter(playerData);
    mapGenerator.generateMap([
        { size: 3 },
        { size: 5 },
        { size: 7 },
        { size: 3 },
        { size: 9 },
        { size: 7 },
        { size: 3 },
        { size: 5 },
        { size: 7 },
    ])
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

