import { ControlsEventsMap, EventBus } from "./events";


export class Controls extends EventBus<ControlsEventsMap, ControlsEventsMap> {
    constructor() {
        super();
    }
};
