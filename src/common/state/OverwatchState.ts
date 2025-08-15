import type { IState, IOverwatchData } from "../interfaces";
import { EventBus, UpdateStateEventsMap, StateChangeEventsMap, UpdateStateEvent, StateChangeEvent } from "../events";
import { DeepReadonly } from "../helpers/types";

export class OverwatchState extends EventBus<UpdateStateEventsMap, StateChangeEventsMap> {
    #overwatchData: IState['overwatchData'] = {};
    private onSave?: () => void;

    constructor(onSave?: () => void) {
        super();
        this.onSave = onSave;
        this.listen(UpdateStateEvent.setOverwatchData, (data) => this.onSetOverwatchData(data));
    }

    private onSetOverwatchData(data: UpdateStateEventsMap[UpdateStateEvent.setOverwatchData]) {
        const existingData = this.#overwatchData[data.characterName];

        if (!data.active) {
            delete this.#overwatchData[data.characterName];
        } else {
            let shotCells: string[];
            if (data.shotCells !== undefined) {
                shotCells = data.shotCells;
            } else if (existingData?.shotCells) {
                shotCells = existingData.shotCells;
            } else {
                shotCells = [];
            }

            const newData: IOverwatchData = {
                active: data.active,
                direction: data.direction || existingData?.direction || 'down',
                position: data.position || existingData?.position || { x: 0, y: 0 },
                range: data.range || existingData?.range || 10,
                shotsRemaining: data.shotsRemaining !== undefined ? data.shotsRemaining : existingData?.shotsRemaining || 0,
                watchedCells: data.watchedCells || existingData?.watchedCells,
                shotCells: shotCells
            };
            this.#overwatchData[data.characterName] = newData;
        }

        this.dispatch(StateChangeEvent.overwatchData, { ...this.#overwatchData });
        this.onSave?.();
    }

    set overwatchData(overwatchData: IState['overwatchData']) {
        this.#overwatchData = overwatchData;
        this.onSave?.();
    }

    get overwatchData(): DeepReadonly<IState['overwatchData']> {
        return this.#overwatchData;
    }

    // Internal getter for mutable access
    getInternalOverwatchData(): IState['overwatchData'] {
        return this.#overwatchData;
    }

    getCharacterOverwatchData(characterName: string): DeepReadonly<IOverwatchData> | undefined {
        return this.#overwatchData[characterName];
    }
}