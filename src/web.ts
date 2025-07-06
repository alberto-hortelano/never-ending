/* eslint-disable @typescript-eslint/no-explicit-any */
import './components';
import { Movement } from "./common/Movement";
import { Talk } from "./common/Talk";
import { Shoot } from "./common/Shoot";
import { Rotate } from "./common/Rotate";
import { State } from "./common/State";
import { Conversation } from "./common/Conversation";
import { Inventory } from "./common/services/Inventory";
import { GameEvent, EventBus } from "./common/events";
import { initialState } from './data/state';

// Initialize global CSS variables
document.documentElement.style.setProperty('--cell-width', '4dvh');
document.documentElement.style.setProperty('--size', 'calc(var(--cell-width, 2dvh) * 0.007)');
document.documentElement.style.setProperty('--mobile-popup-height', '50vh');

const play = () => {
    const state = new State(initialState(50, 50));
    const movement = new Movement(state);
    const talk = new Talk(state);
    const shoot = new Shoot(state);
    const rotate = new Rotate(state);
    const inventory = new Inventory(state);
    const conversationService = new Conversation();
    // Only for debugging
    (window as any).game = {
        state,
        movement,
        talk,
        shoot,
        rotate,
        inventory,
        conversationService,
        eventBus,
    };
    // Only for debugging
    (window as any).di = (e: string, data: any) => eventBus.dispatch(e, data)
}
const eventBus = new EventBus<any, any>();
eventBus.listen(GameEvent.play, play);
