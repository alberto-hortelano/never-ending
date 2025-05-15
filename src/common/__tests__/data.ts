import { ICell, ICharacter } from "../interfaces";

const noWhere: ICell = {
    position: { x: -1, y: -1 },
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
    route: [],
    location: '',
    target: noWhere,
    cell: noWhere,
    blocker: true,
};

export const createCharacter = (character: Partial<ICharacter>) => ({ ...baseCharacter, ...character });

export const playerData = createCharacter({
    name: 'player',
    description: 'test player',
});
