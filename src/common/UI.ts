// import { EventsMap, GameEvent, EventBus } from "./events";

// export interface IGraphics {
//     printMap(map: EventsMap[GameEvent.map]): void;
// }

// export class UI extends EventBus {
//     constructor(private graphics: IGraphics) {
//         super();
//         this.listen(GameEvent.map, map => this.printMap(map));
//     }
//     private printMap(map: EventsMap[GameEvent.map]) {
//         this.graphics.printMap(map);
//     }
// };
