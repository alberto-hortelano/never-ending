/* eslint-disable @typescript-eslint/no-explicit-any */
import './components';
import { Movement } from "./common/Movement";
import { Talk } from "./common/Talk";
import { Shoot } from "./common/Shoot";
import { Rotate } from "./common/Rotate";
import { State } from "./common/State";
import { Conversation } from "./common/Conversation";
import { Action } from "./common/Action";
import { Inventory } from "./common/services/Inventory";
import { CharacterService } from "./common/services/CharacterService";
import { GameEvent, EventBus } from "./common/events";
import { initialState } from './data/state';

// Initialize global CSS variables
document.documentElement.style.setProperty('--cell-width', '4dvh');
document.documentElement.style.setProperty('--size', 'calc(var(--cell-width, 2dvh) * 0.007)');
document.documentElement.style.setProperty('--mobile-popup-height', '50vh');

const play = () => {
    const state = new State(initialState(50, 50));

    // Initialize singleton services
    CharacterService.initialize(state);

    new Movement(state);
    new Talk(state);
    new Shoot(state);
    new Rotate(state);
    new Inventory(state);
    new Conversation();
    new Action(state);
}
const eventBus = new EventBus<any, any>();
eventBus.listen(GameEvent.play, play);
