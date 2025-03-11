import type { IState } from "../../common/interfaces.js";
import { getDataDescription } from "./characters.js";
import { getInitialSetup } from "./initialSetup.js";
import { spaceShip } from "./spaceShip.js";

export const initialState = (name: string): IState => ({
    map: spaceShip,
    palette: {
        terrain: '',
    },
    characters: [
        {
            name,
            action: 'iddle',
            letter: 'P',
            race: 'human',
            description: 'Player character',
            speed: 'slow',
            direction: 'up',
            target: 'control room',
            palette: {
                skin: '',
                helmet: '',
                suit: '',
            }
        },
        {
            name: 'Data',
            action: 'iddle',
            letter: 'D',
            race: 'robot',
            description: getDataDescription(name),
            speed: 'slow',
            direction: 'down',
            target: 'spaceship',
            palette: {
                skin: 'transparent',
                helmet: '#fae45a',
                suit: '#fae45a',
            }
        },
    ],
    messages: [
        {
            role: 'user',
            content: getInitialSetup(),
        },
    ],
});
