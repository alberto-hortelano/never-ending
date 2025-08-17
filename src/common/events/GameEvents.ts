import type { IState } from '../interfaces';
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
}

export interface AIInitializationProgress {
    stepId: string;
    status: 'pending' | 'active' | 'completed' | 'error';
    message?: string;
    error?: string;
}

export interface AIInitializationError {
    message: string;
    retryCount: number;
    maxRetries: number;
    canRetry: boolean;
}

export interface GameEventsMap {
    [GameEvent.play]: boolean;
    [GameEvent.characters]: DeepReadonly<IState['characters']>;
    [GameEvent.changeTurn]: {
        turn: string;
        previousTurn?: string;
    };
    [GameEvent.aiInitializationStarted]: { origin: any };
    [GameEvent.aiInitializationProgress]: AIInitializationProgress;
    [GameEvent.aiInitializationComplete]: { state: IState };
    [GameEvent.aiInitializationFailed]: AIInitializationError;
}
