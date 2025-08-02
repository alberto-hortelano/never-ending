import { IState } from '../../common/interfaces';
import { getDefaultUIState } from './testUIState.helper';

export function getDefaultTestState(): IState {
    return {
        game: {
            turn: '',
            players: []
        },
        map: [],
        characters: [],
        messages: [],
        ui: getDefaultUIState(),
        overwatchData: {}
    };
}

export function createTestState(overrides: Partial<IState> = {}): IState {
    const defaultState = getDefaultTestState();
    return {
        ...defaultState,
        ...overrides,
        // Ensure nested objects are properly merged
        game: {
            ...defaultState.game,
            ...(overrides.game || {})
        },
        ui: overrides.ui || defaultState.ui
    };
}