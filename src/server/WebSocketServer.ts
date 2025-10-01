import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { Server } from 'http';
import { NetworkEventMap, ConnectEvent, CreateRoomEvent, JoinRoomEvent, PlayerReadyEvent, PlayerActionEvent } from '../common/events/NetworkEvents';
import { IState, ICharacter } from '../common/interfaces';
import { randomUUID } from 'crypto';

interface WebSocketMessage {
    type: keyof NetworkEventMap;
    data: NetworkEventMap[keyof NetworkEventMap];
}

interface Room {
    id: string;
    name: string;
    maxPlayers: number;
    players: Map<string, Player>;
    state?: IState;
    status: 'waiting' | 'starting' | 'playing' | 'finished';
}

interface Player {
    id: string;
    name: string;
    ws: WebSocket;
    roomId?: string;
    ready: boolean;
    character?: Partial<ICharacter>;
}

export class WebSocketServer {
    private wss: WSServer;
    private players = new Map<string, Player>();
    private rooms = new Map<string, Room>();

    constructor(server: Server) {
        // DEBUG: console.log('Initializing WebSocketServer on server:', server.address());
        this.wss = new WSServer({ server });
        // DEBUG: console.log('WebSocket server created');
        this.setupWebSocketServer();
        // DEBUG: console.log('WebSocket server setup complete');
    }

    private setupWebSocketServer() {
        this.wss.on('error', (error) => {
            console.error('WebSocket server error:', error);
        });

        this.wss.on('listening', () => {
            // DEBUG: console.log('WebSocket server is listening');
        });

        this.wss.on('connection', (ws: WebSocket) => {
            const playerId = randomUUID();
            // DEBUG: console.log(`New WebSocket connection: ${playerId}`);

            ws.on('message', (data: Buffer) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleMessage(playerId, ws, message);
                } catch (error) {
                    console.error('Invalid message format:', error);
                    this.sendError(ws, 'Invalid message format');
                }
            });

            ws.on('close', () => {
                // DEBUG: console.log(`WebSocket disconnected: ${playerId}`);
                this.handleDisconnect(playerId);
            });

            ws.on('error', (error) => {
                console.error(`WebSocket error for player ${playerId}:`, error);
            });
        });
    }

    private handleMessage(playerId: string, ws: WebSocket, message: WebSocketMessage) {
        const { type, data } = message;

        switch (type) {
            case 'connect':
                this.handleConnect(playerId, ws, data as ConnectEvent);
                break;
            case 'createRoom':
                this.handleCreateRoom(playerId, data as CreateRoomEvent);
                break;
            case 'joinRoom':
                this.handleJoinRoom(playerId, data as JoinRoomEvent);
                break;
            case 'leaveRoom':
                this.handleLeaveRoom(playerId);
                break;
            case 'playerReady':
                this.handlePlayerReady(playerId, data as PlayerReadyEvent);
                break;
            case 'requestRoomList':
                this.handleRequestRoomList(playerId);
                break;
            case 'playerAction':
                this.handlePlayerAction(playerId, data as PlayerActionEvent);
                break;
            default:
                this.sendError(ws, `Unknown message type: ${type}`);
        }
    }

    private handleConnect(playerId: string, ws: WebSocket, data: ConnectEvent) {
        const player: Player = {
            id: playerId,
            name: data.playerName,
            ws,
            ready: false
        };
        this.players.set(playerId, player);

        this.sendToPlayer(playerId, 'connect', { playerId, playerName: data.playerName });
        // DEBUG: console.log(`Player connected: ${playerId} (${data.playerName})`);
    }

    private handleCreateRoom(playerId: string, data: CreateRoomEvent) {
        const player = this.players.get(playerId);
        if (!player) return;

        const roomId = randomUUID();
        const room: Room = {
            id: roomId,
            name: data.roomName,
            maxPlayers: data.maxPlayers,
            players: new Map([[playerId, player]]),
            status: 'waiting'
        };

        this.rooms.set(roomId, room);
        player.roomId = roomId;

        this.sendToPlayer(playerId, 'createRoom', { 
            roomId, 
            roomName: data.roomName, 
            maxPlayers: data.maxPlayers,
            creatorId: playerId 
        });
        this.broadcastRoomState(roomId);
        // DEBUG: console.log(`Room created: ${roomId} by player ${playerId}`);
    }

    private handleJoinRoom(playerId: string, data: JoinRoomEvent) {
        const player = this.players.get(playerId);
        const room = this.rooms.get(data.roomId);

        if (!player || !room) {
            this.sendError(player?.ws, 'Room not found', 'ROOM_NOT_FOUND');
            return;
        }

        if (room.players.size >= room.maxPlayers) {
            this.sendError(player.ws, 'Room is full', 'ROOM_FULL');
            return;
        }

        if (player.roomId) {
            this.handleLeaveRoom(playerId);
        }

        room.players.set(playerId, player);
        player.roomId = data.roomId;

        this.sendToPlayer(playerId, 'joinRoom', { 
            roomId: data.roomId,
            playerId: playerId,
            playerName: player.name
        });
        this.broadcastRoomState(data.roomId);

        if (room.state) {
            this.sendToPlayer(playerId, 'syncState', {
                roomId: data.roomId,
                state: room.state,
                timestamp: Date.now()
            });
        }

        // DEBUG: console.log(`Player ${playerId} joined room ${data.roomId}`);
    }

    private handleLeaveRoom(playerId: string) {
        const player = this.players.get(playerId);
        if (!player || !player.roomId) return;

        const room = this.rooms.get(player.roomId);
        if (!room) return;

        room.players.delete(playerId);
        const roomId = player.roomId;
        player.roomId = undefined;
        player.ready = false;

        this.sendToPlayer(playerId, 'leaveRoom', { roomId, playerId });

        if (room.players.size === 0) {
            this.rooms.delete(roomId);
            this.broadcastRoomList(); // Update room list for all players
            // DEBUG: console.log(`Room ${roomId} deleted (empty)`);
        } else {
            this.broadcastRoomState(roomId);
            this.broadcastRoomList(); // Update room list for all players
        }

        // DEBUG: console.log(`Player ${playerId} left room ${roomId}`);
    }

    private handlePlayerReady(playerId: string, data: PlayerReadyEvent) {
        const player = this.players.get(playerId);
        const room = player?.roomId ? this.rooms.get(player.roomId) : null;

        // DEBUG: console.log(`Player ${playerId} ready status: ${data.ready}, room: ${player?.roomId}`);

        if (!player || !room) {
            // DEBUG: console.log(`Player or room not found for ready: player=${!!player}, room=${!!room}`);
            return;
        }

        player.ready = data.ready;
        player.character = data.character;

        this.broadcastRoomState(room.id);

        const allReady = Array.from(room.players.values()).every(p => p.ready);
        // DEBUG: console.log(`Room ${room.id}: All ready? ${allReady}, player count: ${room.players.size}`);
        if (allReady && room.players.size >= 2 && room.status === 'waiting') {
            this.startGame(room);
        }
    }

    private handlePlayerAction(playerId: string, data: PlayerActionEvent) {
        const player = this.players.get(playerId);
        const room = player?.roomId ? this.rooms.get(player.roomId) : null;

        if (!player || !room || room.status !== 'playing') {
            this.sendError(player?.ws, 'Invalid game state', 'INVALID_ACTION');
            return;
        }

        this.broadcastToRoom(room.id, 'playerAction', {
            playerId,
            roomId: room.id,
            action: data.action,
            timestamp: Date.now()
        }, playerId);
    }

    private startGame(room: Room) {
        room.status = 'starting';
        
        // Define available spawn rooms for multiplayer
        const spawnRooms = ['room2', 'room3', 'room4', 'room5', 'room6', 'room7'];
        
        // Import baseCharacter for default values
        import('../data/state.js').then(async ({ baseCharacter }) => {
            const playerCharacters = Array.from(room.players.values()).map((player, index) => ({
                // Start with base character to ensure all required properties
                ...baseCharacter,
                // Override with any custom character data from player
                ...player.character,
                // Set multiplayer-specific properties
                controller: player.id,
                name: player.name,
                // Assign different rooms to each player to avoid crowding
                location: spawnRooms[index % spawnRooms.length],
                // Initialize with temporary position - positionCharacters MUST handle actual placement
                // Using invalid position to ensure it gets properly positioned
                position: { x: -1, y: -1 },
                // Ensure other required properties are set
                direction: 'down' as const,
                path: [],
                blocker: true
            }));

            const { initialState } = await import('../data/state.js');
            const state = initialState(40, 50, playerCharacters[0], playerCharacters.slice(1));
            
            state.game.players = Array.from(room.players.keys());
            state.game.turn = state.game.players[0] || '';
            
            // Add player info with names
            state.game.playerInfo = {};
            room.players.forEach((player, playerId) => {
                if (state.game.playerInfo) {
                    state.game.playerInfo[playerId] = {
                        name: player.name,
                        isAI: false
                    };
                }
            });
            
            room.state = state;
            room.status = 'playing';

            this.broadcastToRoom(room.id, 'startGame', {
                roomId: room.id,
                initialState: state
            });
        });
    }

    private handleDisconnect(playerId: string) {
        const player = this.players.get(playerId);
        if (!player) return;

        if (player.roomId) {
            this.handleLeaveRoom(playerId);
        }

        this.players.delete(playerId);
        // DEBUG: console.log(`Player ${playerId} disconnected`);
    }

    private sendToPlayer(playerId: string, type: keyof NetworkEventMap, data: NetworkEventMap[keyof NetworkEventMap]) {
        const player = this.players.get(playerId);
        if (!player || player.ws.readyState !== WebSocket.OPEN) return;

        player.ws.send(JSON.stringify({ type, data }));
    }

    private broadcastToRoom(roomId: string, type: keyof NetworkEventMap, data: NetworkEventMap[keyof NetworkEventMap], excludePlayerId?: string) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        room.players.forEach((player, playerId) => {
            if (playerId !== excludePlayerId && player.ws.readyState === WebSocket.OPEN) {
                player.ws.send(JSON.stringify({ type, data }));
            }
        });
    }

    private broadcastRoomState(roomId: string) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        const roomState = {
            roomId: room.id,
            roomName: room.name,
            maxPlayers: room.maxPlayers,
            players: Array.from(room.players.values()).map(p => ({
                id: p.id,
                name: p.name,
                ready: p.ready,
                character: p.character
            })),
            status: room.status
        };

        this.broadcastToRoom(roomId, 'roomState', roomState);
    }

    private sendError(ws: WebSocket | undefined, error: string, code?: NetworkEventMap['error']['code']) {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;

        const errorEvent: NetworkEventMap['error'] = {
            error,
            code: code || 'INVALID_ACTION'
        };

        ws.send(JSON.stringify({ type: 'error', data: errorEvent }));
    }

    private handleRequestRoomList(playerId: string) {
        this.sendRoomList(playerId);
    }

    private sendRoomList(playerId: string) {
        const player = this.players.get(playerId);
        if (!player) return;

        const roomList: NetworkEventMap['roomList'] = {
            rooms: Array.from(this.rooms.values())
                .filter(room => room.status === 'waiting') // Only show rooms that are waiting for players
                .map(room => ({
                    id: room.id,
                    name: room.name,
                    players: room.players.size,
                    maxPlayers: room.maxPlayers,
                    status: room.status
                }))
        };

        this.sendToPlayer(playerId, 'roomList', roomList);
    }

    private broadcastRoomList() {
        const roomList: NetworkEventMap['roomList'] = {
            rooms: Array.from(this.rooms.values())
                .filter(room => room.status === 'waiting') // Only show rooms that are waiting for players
                .map(room => ({
                    id: room.id,
                    name: room.name,
                    players: room.players.size,
                    maxPlayers: room.maxPlayers,
                    status: room.status
                }))
        };

        // Send to all connected players who are not in a room
        this.players.forEach((player, playerId) => {
            if (!player.roomId) {
                this.sendToPlayer(playerId, 'roomList', roomList);
            }
        });
    }
}