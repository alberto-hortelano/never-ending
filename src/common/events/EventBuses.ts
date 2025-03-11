import { MovementEventBus } from "./MovementEventBus.js";
import { ServerEventBus } from "./ServerEventBus.js";
import { UiEventBus } from "./UiEventBus.js";

export interface EventBuses {
    server: ServerEventBus,
    ui: UiEventBus,
    movement: MovementEventBus,
}
