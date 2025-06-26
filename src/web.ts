/* eslint-disable @typescript-eslint/no-explicit-any */
import './components';
import { Movement } from "./common/Movement";
import { Talk } from "./common/Talk";
import { State } from "./common/State";
import { ConversationService } from "./common/ConversationService";
import { GameEvent, EventBus } from "./common/events";
import { initialState } from './data/state';

// Initialize global CSS variables
document.documentElement.style.setProperty('--cell-width', '4dvh');
document.documentElement.style.setProperty('--size', 'calc(var(--cell-width, 2dvh) * 0.007)');

const play = () => {
    const state = new State(initialState(50, 50));
    const movement = new Movement(state);
    const talk = new Talk(state);
    const conversationService = new ConversationService();
    // Only for debugging
    (window as any).game = {
        state,
        movement,
        talk,
        conversationService,
        eventBus,
    };
    // Only for debugging
    (window as any).di = (e: string, data: any) => eventBus.dispatch(e, data)
}
const eventBus = new EventBus<any, any>();
eventBus.listen(GameEvent.play, play);
