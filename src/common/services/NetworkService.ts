import { EventBus, EventsMap } from '../events/EventBus';
import { ICharacter, IState } from '../interfaces';

export class NetworkService extends EventBus<EventsMap, EventsMap> {
    private static instance: NetworkService;
    private ws: WebSocket | null = null;
    private connected = false;
    private playerId: string | null = null;
    private playerName: string | null = null;
    private roomId: string | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 1000;
    private messageQueue: Array<{ type: string; data: unknown }> = [];
    private lastServerUrl: string | null = null;

    private constructor() {
        super();
        this.setupEventListeners();
    }

    static getInstance(): NetworkService {
        if (!NetworkService.instance) {
            NetworkService.instance = new NetworkService();
        }
        return NetworkService.instance;
    }

    private setupEventListeners() {
        // For now, we'll handle state synchronization at a higher level
        // The MultiplayerManager will handle listening to specific state events
    }

    connect(playerName: string, serverUrl: string): Promise<void> {
        this.lastServerUrl = serverUrl;
        return new Promise((resolve, reject) => {
            if (this.ws?.readyState === WebSocket.OPEN) {
                resolve();
                return;
            }

            this.playerName = playerName;

            try {
                this.ws = new WebSocket(serverUrl);

                this.ws.onopen = () => {
                    this.connected = true;
                    this.reconnectAttempts = 0;

                    // Send connect message
                    this.send('connect', { playerName });

                    // Process queued messages
                    this.processMessageQueue();

                    resolve();
                };

                this.ws.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        this.handleServerMessage(message);
                    } catch (error) {
                        console.error('Failed to parse server message:', error);
                    }
                };

                this.ws.onclose = () => {
                    this.connected = false;
                    this.handleDisconnect();
                };

                this.ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    reject(error);
                };
            } catch (error) {
                reject(error);
            }
        });
    }

    private handleServerMessage(message: { type: string; data: unknown }) {
        const { type, data } = message;

        switch (type) {
            case 'connect': {
                const connectData = data as { playerId: string };
                this.playerId = connectData.playerId;
                this.dispatch('networkConnected', { playerId: this.playerId || '', playerName: this.playerName || '' });
                break;
            }

            case 'createRoom': {
                const roomData = data as { roomId: string; roomName: string; maxPlayers: number };
                this.roomId = roomData.roomId;
                this.dispatch('roomCreated', roomData);
                break;
            }

            case 'joinRoom': {
                const joinData = data as { roomId: string };
                this.roomId = joinData.roomId;
                this.dispatch('roomJoined', joinData);
                break;
            }

            case 'leaveRoom': {
                const leaveData = data as { roomId: string };
                this.roomId = null;
                this.dispatch('roomLeft', leaveData);
                break;
            }

            case 'roomState': {
                const roomStateData = data as { roomId: string; roomName: string; maxPlayers: number; players: Array<{ id: string; name: string; ready: boolean; character?: Partial<ICharacter> }>; status: 'waiting' | 'starting' | 'playing' | 'finished' };
                this.dispatch('roomStateUpdate', roomStateData);
                break;
            }

            case 'playerAction': {
                const actionData = data as { playerId: string; action: { type: string; data: Record<string, unknown> } };
                // Filter out actions from the current player to prevent double processing
                if (actionData.playerId === this.playerId) {
                    break;
                }

                // Handle special action types
                if (actionData.action.type === 'stateSync') {
                    // This is a custom multiplayer sync event that can contain either full state or diff
                    this.dispatch('stateSync', actionData.action.data as never);
                } else if (actionData.action.type === 'stateDiff') {
                    // stateDiff is handled as stateSync with a diff property
                    this.dispatch('stateSync', actionData.action.data as never);
                } else {
                    // Mark the action as from network to prevent rebroadcasting
                    if (actionData.action.data) {
                        actionData.action.data.fromNetwork = true;
                        actionData.action.data.playerId = actionData.playerId;
                    }
                    // Dispatch the update state event locally with the data
                    this.dispatch(actionData.action.type as keyof EventsMap, actionData.action.data as never);
                }
                break;
            }

            case 'syncState': {
                const syncData = data as { roomId: string; state: IState; timestamp: number };
                this.dispatch('stateSync', syncData);
                break;
            }

            case 'startGame': {
                const gameData = data as { roomId: string; initialState: IState };
                this.dispatch('gameStarted', gameData);
                break;
            }

            case 'roomList': {
                const listData = data as { rooms: Array<{ id: string; name: string; players: number; maxPlayers: number; status: 'waiting' | 'starting' | 'playing' | 'finished' }> };
                this.dispatch('roomListUpdate', listData);
                break;
            }

            case 'error': {
                const errorData = data as { playerId?: string; roomId?: string; error: string; code: 'ROOM_FULL' | 'ROOM_NOT_FOUND' | 'INVALID_ACTION' | 'NOT_YOUR_TURN' | 'DISCONNECTED' };
                this.dispatch('networkError', errorData);
                break;
            }

            default:
                console.warn('Unknown message type from server:', type);
        }
    }

    createRoom(roomName: string, maxPlayers: number = 2): void {
        this.send('createRoom', { roomName, maxPlayers, creatorId: this.playerId });
    }

    joinRoom(roomId: string): void {
        this.send('joinRoom', { roomId, playerId: this.playerId, playerName: this.playerName });
    }

    leaveRoom(): void {
        if (this.roomId) {
            this.send('leaveRoom', { roomId: this.roomId, playerId: this.playerId });
        }
    }

    setReady(ready: boolean, character?: ICharacter): void {
        if (this.roomId) {
            this.send('playerReady', {
                playerId: this.playerId,
                roomId: this.roomId,
                ready,
                character
            });
        } else {
            console.warn('Cannot set ready: not in a room');
        }
    }


    send(type: string, data: unknown): void {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, data }));
        } else {
            // Queue message if not connected
            this.messageQueue.push({ type, data });
        }
    }

    private processMessageQueue(): void {
        while (this.messageQueue.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
            const message = this.messageQueue.shift();
            if (message) {
                this.send(message.type, message.data);
            }
        }
    }

    private handleDisconnect(): void {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;

            setTimeout(() => {
                if (this.playerName && this.lastServerUrl) {
                    this.connect(this.playerName, this.lastServerUrl).catch(console.error);
                }
            }, this.reconnectDelay * this.reconnectAttempts);
        } else {
            this.dispatch('networkDisconnected', {
                reason: 'Max reconnection attempts reached'
            });
        }
    }

    requestRoomList(): void {
        this.send('requestRoomList', undefined);
    }

    disconnect(): void {
        if (this.ws) {
            this.connected = false;
            this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect
            this.ws.close();
            this.ws = null;
        }
    }

    isConnected(): boolean {
        return this.connected;
    }

    getPlayerId(): string | null {
        return this.playerId;
    }

    getRoomId(): string | null {
        return this.roomId;
    }
}