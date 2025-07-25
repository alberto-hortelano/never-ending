import { IState } from "../interfaces";

// Custom events for UI components
export type CustomUIEventMap = {
    startSinglePlayer: {};
    startMultiplayer: {};
    lobbyGameStarted: {};
    lobbyClose: {};
};

// Custom events for multiplayer manager
export type MultiplayerEventMap = {
    multiplayerGameStarted: { state: IState };
    stateSynced: { state: IState };
    switchedToSinglePlayer: { state: IState };
    requestSyncTimer: { interval: number };
    cancelSyncTimer: {};
};