import { ServerEventBus, UiEventBus, MovementEventBus } from './src/common/events';
import { play } from './src/game';
import { Renderer, Controls } from './src/terminal';

(() => {
    const eventBuses = {
        server: new ServerEventBus(),
        ui: new UiEventBus(),
        movement: new MovementEventBus(),
    };
    const renderer = new Renderer(eventBuses);
    const controls = new Controls(eventBuses);
    play(eventBuses);
})();
