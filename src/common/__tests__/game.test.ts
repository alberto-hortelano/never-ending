/* eslint-disable @typescript-eslint/no-unused-vars */

import type { ICharacter, IMessage, IPositionable, IState } from '../interfaces';

import { playerData } from './data';
import { BaseEvent, ControlsEvent, EventsMap } from '../events';
import { State } from '../State';
import { Game } from '../Game';
import { IGraphics, UI } from '../UI';
import { IMovement, Movement } from '../Movement';
import { Controls } from '../Controls';

const initState = (): IState => {
    // State
    const map = State.fillMap(4, 4);
    const characters: ICharacter[] = [playerData];
    const messages: IMessage[] = [];
    const initialState: IState = {
        map,
        characters,
        messages,
    };
    return initialState;
}

describe('game', () => {
    // Test data
    const playerPosition = { x: 1, y: 2 };
    // Mocks
    const printMap = jest.fn<void, [EventsMap[BaseEvent.map]], void>();
    printMap.mockImplementation(map => {
        console.log(map.map(row => row.map(cell => cell.content ? '#' : ' ').join('')).join('\n'));
    });
    const locate = jest.fn<IPositionable, [IPositionable], void>();
    locate.mockImplementation(positionable => {
        positionable.cell = state.map[playerPosition.y]![playerPosition.x]!;
        return positionable;
    })
    const mockHelpers: {
        graphics: IGraphics,
        movement: IMovement,
    } = {
        graphics: {
            printMap,
        },
        movement: {
            locate,
        }
    }
    // init
    const initialState = initState();
    const state = new State(initialState);
    const borders = state.getBorders();
    state.setWalls(borders.map(cell => cell.position));
    const movement = new Movement(mockHelpers.movement);
    const controls = new Controls();
    const ui = new UI(mockHelpers.graphics);
    const game = new Game(state);
    // Characters move to targets
    // Player moves
    // Characters talk
    // Doors opens
    describe('load', () => {
        test('should print the map', () => {
            expect(printMap).toHaveBeenCalledWith(state.map);
        });
        test('should position player', () => {
            expect(state.player?.cell.position).toEqual(playerPosition);
        });
    });

    describe('movement', () => {
        describe('when the player uses the controls', () => {
            controls.dispatch(ControlsEvent.direction, 'up');
            test('should move characters', () => {
                expect(state.player.direction).toBe('up');
            });
        });
        describe('when a character gets a target', () => {
            test('should set the path from current location to target location', () => {
            });
        });
        describe('when a character has a path and is walking', () => {
            test('should move the character through the path', () => {
            });
        });
    });
});
