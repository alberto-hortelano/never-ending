import { ICharacter, IState, ICoord, Direction } from "../interfaces";

export type NetworkEvent = 
    | ConnectEvent
    | DisconnectEvent
    | JoinRoomEvent
    | LeaveRoomEvent
    | CreateRoomEvent
    | RoomStateEvent
    | PlayerActionEvent
    | SyncStateEvent
    | PlayerReadyEvent
    | StartGameEvent
    | ErrorEvent;

export interface ConnectEvent {
    playerId: string;
    playerName: string;
}

export interface DisconnectEvent {
    playerId: string;
    reason?: string;
}

export interface JoinRoomEvent {
    roomId: string;
    playerId: string;
    playerName: string;
}

export interface LeaveRoomEvent {
    roomId: string;
    playerId: string;
}

export interface CreateRoomEvent {
    roomName: string;
    maxPlayers: number;
    creatorId: string;
}

export interface RoomStateEvent {
    roomId: string;
    roomName: string;
    maxPlayers: number;
    players: Array<{
        id: string;
        name: string;
        ready: boolean;
        character?: Partial<ICharacter>;
    }>;
    status: 'waiting' | 'starting' | 'playing' | 'finished';
}

export interface PlayerActionEvent {
    playerId: string;
    roomId: string;
    action: PlayerAction;
    timestamp: number;
}

export type PlayerAction = 
    | { type: 'move'; data: { characterId: string; position: ICoord; } }
    | { type: 'shoot'; data: { characterId: string; targetPosition: ICoord; weaponId: string; } }
    | { type: 'rotate'; data: { characterId: string; direction: Direction; } }
    | { type: 'endTurn'; data: { playerId: string; } }
    | { type: 'useItem'; data: { characterId: string; itemId: string; } }
    | { type: 'updateCharacter'; data: { characterId: string; updates: Partial<ICharacter>; } };

export interface SyncStateEvent {
    roomId: string;
    state: IState;
    timestamp: number;
}

export interface PlayerReadyEvent {
    playerId: string;
    roomId: string;
    ready: boolean;
    character?: Partial<ICharacter>;
}

export interface StartGameEvent {
    roomId: string;
    initialState: IState;
}

export interface ErrorEvent {
    playerId?: string;
    roomId?: string;
    error: string;
    code: 'ROOM_FULL' | 'ROOM_NOT_FOUND' | 'INVALID_ACTION' | 'NOT_YOUR_TURN' | 'DISCONNECTED';
}

export interface RoomListEvent {
    rooms: Array<{
        id: string;
        name: string;
        players: number;
        maxPlayers: number;
        status: 'waiting' | 'starting' | 'playing' | 'finished';
    }>;
}

export interface RequestRoomListEvent {
    // Empty - just a request to get the room list
}

export type NetworkEventMap = {
    connect: ConnectEvent;
    disconnect: DisconnectEvent;
    joinRoom: JoinRoomEvent;
    leaveRoom: LeaveRoomEvent;
    createRoom: CreateRoomEvent;
    roomState: RoomStateEvent;
    playerAction: PlayerActionEvent;
    syncState: SyncStateEvent;
    playerReady: PlayerReadyEvent;
    startGame: StartGameEvent;
    error: ErrorEvent;
    roomList: RoomListEvent;
    requestRoomList: RequestRoomListEvent;
};

// Client-side network events
export type ClientNetworkEventMap = {
    networkConnected: { playerId: string; playerName: string };
    networkDisconnected: { reason: string };
    roomCreated: { roomId: string; roomName: string; maxPlayers: number };
    roomJoined: { roomId: string };
    roomLeft: { roomId: string };
    roomStateUpdate: RoomStateEvent;
    stateSync: SyncStateEvent;
    gameStarted: StartGameEvent;
    networkError: ErrorEvent;
    roomListUpdate: RoomListEvent;
};