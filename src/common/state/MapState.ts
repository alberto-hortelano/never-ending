import type { IState, ICell, ICoord } from "../interfaces";
import { EventBus, UpdateStateEventsMap, StateChangeEventsMap, StateChangeEvent } from "../events";
import { DeepReadonly } from "../helpers/types";

export class MapState extends EventBus<UpdateStateEventsMap, StateChangeEventsMap> {
    #map: IState['map'] = [];
    private cellMap = new Map<ICoord, ICell>();
    private onSave?: () => void;

    constructor(onSave?: () => void) {
        super();
        this.onSave = onSave;
    }

    set map(map: IState['map']) {
        this.#map = map;
        this.cellMap.clear();
        this.#map.forEach(row => row.forEach(cell => this.cellMap.set(cell.position, cell)));
        this.dispatch(StateChangeEvent.map, structuredClone(this.#map));
        this.onSave?.();
    }

    get map(): DeepReadonly<IState['map']> {
        return this.#map;
    }

    findCell(coord: ICell['position']): DeepReadonly<ICell> | undefined {
        return this.cellMap.get(coord);
    }

    getCellMap(): Map<ICoord, ICell> {
        return this.cellMap;
    }
}