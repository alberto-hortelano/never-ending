import type { IState, IOriginStory } from '../interfaces';
import type { DeepReadonly } from "../helpers/types";

export enum GameEvent {
    /** Start the game */
    play = 'GameEvent.play',
    /** A new set of characters has arrived from the server */
    characters = 'GameEvent.characters',
    /** Change turn between players */
    changeTurn = 'GameEvent.changeTurn',
    /** AI story initialization has started */
    aiInitializationStarted = 'GameEvent.aiInitializationStarted',
    /** AI story initialization progress update */
    aiInitializationProgress = 'GameEvent.aiInitializationProgress',
    /** AI story initialization completed successfully */
    aiInitializationComplete = 'GameEvent.aiInitializationComplete',
    /** AI story initialization failed */
    aiInitializationFailed = 'GameEvent.aiInitializationFailed',
    /** Combat event occurred that should be tracked in AI context */
    combatEvent = 'GameEvent.combatEvent',
}

interface AIInitializationProgress {
    stepId: string;
    status: 'pending' | 'active' | 'completed' | 'error';
    message?: string;
    error?: string;
}

interface AIInitializationError {
    message: string;
    retryCount: number;
    maxRetries: number;
    canRetry: boolean;
}

export interface CombatEventData {
    type: 'combat';
    actor: string;
    target?: string;
    description: string;
    turn: string | number;
}

export interface GameEventsMap {
    [GameEvent.play]: boolean;
    [GameEvent.characters]: DeepReadonly<IState['characters']>;
    [GameEvent.changeTurn]: {
        turn: string;
        previousTurn?: string;
    };
    [GameEvent.aiInitializationStarted]: { origin: IOriginStory | null };
    [GameEvent.aiInitializationProgress]: AIInitializationProgress;
    [GameEvent.aiInitializationComplete]: { state: IState };
    [GameEvent.aiInitializationFailed]: AIInitializationError;
    [GameEvent.combatEvent]: CombatEventData;
}
