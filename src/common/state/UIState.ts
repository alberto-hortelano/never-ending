import type { IState, IUIState } from "../interfaces";
import { DeepReadonly } from "../helpers/types";

export class UIState {
    #ui: IState['ui'];

    constructor() {
        this.#ui = this.getInitialUIState();
    }

    private getInitialUIState(): IUIState {
        return {
            animations: {
                characters: {}
            },
            visualStates: {
                characters: {},
                cells: {},
                board: {
                    mapWidth: 0,
                    mapHeight: 0,
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
            },
            selectedCharacter: undefined
        };
    }

    set ui(ui: IState['ui']) {
        this.#ui = ui;
    }

    get ui(): DeepReadonly<IState['ui']> {
        return this.#ui;
    }
}