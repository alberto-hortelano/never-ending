import { ICell, ICharacter } from "../interfaces";

const cell: ICell = {
    position: { x: 4, y: 4 },
    locations: [],
    elements: [],
    content: null,
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
    target: cell,
    cell: cell,
    blocker: true,
};

export const createCharacter = (character: Partial<ICharacter>) => ({ ...baseCharacter, ...character });

export const playerData = createCharacter({
    name: 'player',
    description: 'test player',
});
