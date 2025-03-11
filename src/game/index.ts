import type { IState } from "../common/interfaces.js";
import type { EventBuses } from "../common/events/index.js";
import { Game } from "./Game.js"
import { Movement } from "./Movement.js";
import { initialState } from './state/initialState.js';
import { CharacterFactory } from "./characters/CharacterFactory.js";

export const play = (eventBuses: EventBuses, state: IState = initialState('Jimy')) => {
    // Initialize all the required game systems
    new CharacterFactory(eventBuses); // Character factory
    new Movement(eventBuses);         // Movement system
    const game = new Game(eventBuses, state);
    return game;
}
