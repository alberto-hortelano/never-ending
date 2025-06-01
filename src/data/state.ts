
import { addObstacles, fillMap, getBorders, setWalls } from "./helpers";
import { IPositionable, IState, ICharacter, IMessage } from "../common/interfaces";
import { IMovement } from "../common/Movement";

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
    const player = createCharacter(playerData);
    const map = fillMap(x, y);
    const characters: ICharacter[] = [playerData, ...charactersData].map(createCharacter);
    const messages: IMessage[] = [];
    const initialState: IState = {
        map,
        characters,
        player,
        messages,
    };
    const borders = getBorders(initialState.map);
    setWalls(initialState.map, borders.map(cell => cell.position));
    addObstacles(initialState.map, 40);
    return initialState;
}

