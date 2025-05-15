import { EventsMap, BaseEvent, EventBus } from "./events";

export interface IGraphics {
    printMap(map: EventsMap[BaseEvent.map]): void;
}

export class UI extends EventBus { 
    constructor(private graphics: IGraphics) { 
      super();
        this.listen(BaseEvent.map, map => this.printMap(map));
    }
    private printMap(map: EventsMap[BaseEvent.map]) {
        this.graphics.printMap(map);
    }
};
