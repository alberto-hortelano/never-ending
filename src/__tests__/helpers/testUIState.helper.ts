import { IUIState } from '../../common/interfaces';

export function getDefaultUIState(): IUIState {
    return {
        animations: {
            characters: {}
        },
        visualStates: {
            characters: {},
            cells: {},
            board: {
                mapWidth: 50,
                mapHeight: 50,
                hasPopupActive: false
            }
        },
        transientUI: {
            popups: {},
            projectiles: [],
            highlights: {
                reachableCells: [],
                pathCells: [],
                targetableCells: []
            }
        },
        interactionMode: {
            type: 'normal'
        }
    };
}