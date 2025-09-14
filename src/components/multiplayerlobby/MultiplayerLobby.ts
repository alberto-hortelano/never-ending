import { Component } from '../Component';
import { MultiplayerManager } from '../../common/services/MultiplayerManager';
import { NetworkService } from '../../common/services/NetworkService';
import { ClientNetworkEventMap } from '../../common/events/NetworkEvents';
import { i18n } from '../../common/i18n/i18n';

interface Room {
    id: string;
    name: string;
    players: Array<{ id: string; name: string; ready: boolean }>;
    maxPlayers: number;
    status: string;
}

export class MultiplayerLobby extends Component {
    private multiplayerManager: MultiplayerManager;
    private networkService: NetworkService;
    private currentRoom: Room | null = null;
    private playerName = '';
    private _root: ShadowRoot | null = null;
    private availableRooms: Array<{
        id: string;
        name: string;
        players: number;
        maxPlayers: number;
        status: string;
    }> = [];
    private syncTimerId: number | null = null;

    private generateRandomName(): string {
        const adjectives = ['Swift', 'Brave', 'Clever', 'Mighty', 'Silent', 'Noble', 'Fierce', 'Wise'];
        const nouns = ['Warrior', 'Knight', 'Archer', 'Mage', 'Rogue', 'Paladin', 'Hunter', 'Sage'];
        const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
        const randomNum = Math.floor(Math.random() * 100);
        return `${randomAdj}${randomNoun}${randomNum}`;
    }

    private generateRandomRoomName(): string {
        const adjectives = ['Epic', 'Legendary', 'Ancient', 'Mystic', 'Hidden', 'Eternal', 'Sacred', 'Lost'];
        const nouns = ['Arena', 'Battlefield', 'Citadel', 'Fortress', 'Realm', 'Sanctum', 'Temple', 'Colosseum'];
        const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
        const randomNum = Math.floor(Math.random() * 1000);
        return `${randomAdj} ${randomNoun} ${randomNum}`;
    }

    constructor() {
        super();
        this.hasCss = true;
        this.hasHtml = true;
        this.multiplayerManager = MultiplayerManager.getInstance();
        this.networkService = NetworkService.getInstance();
        this.playerName = this.generateRandomName();
    }

    override async connectedCallback() {
        const root = await super.connectedCallback();
        if (!root) return root;

        this._root = root; // Store the root
        this.setupEventListeners();
        this.render(root);
        return root;
    }
    
    disconnectedCallback() {
        // Clean up timer when component is removed
        if (this.syncTimerId !== null) {
            window.clearInterval(this.syncTimerId);
            this.syncTimerId = null;
        }
        // Clean up event listeners when component is removed
        this.eventBus.remove(this);
    }

    private setupEventListeners() {
        // Use this component's eventBus to listen to network events
        // This way, listeners are automatically cleaned up when the component is removed
        this.listen('networkConnected', () => {
            if (this._root) this.render(this._root);
        });

        this.listen('roomCreated', (data: ClientNetworkEventMap['roomCreated']) => {
            this.currentRoom = {
                id: data.roomId,
                name: data.roomName,
                players: [],
                maxPlayers: data.maxPlayers,
                status: 'waiting'
            };
            if (this._root) this.render(this._root);
        });

        this.listen('roomJoined', (_data: ClientNetworkEventMap['roomJoined']) => {
            // When we join a room, we need to wait for the roomStateUpdate
            // to get the full room details
            if (this._root) this.render(this._root);
        });

        this.listen('roomStateUpdate', (data: ClientNetworkEventMap['roomStateUpdate']) => {
            // If we don't have a current room but received a room state update,
            // it means we just joined this room
            if (!this.currentRoom && data.roomId) {
                this.currentRoom = {
                    id: data.roomId,
                    name: data.roomName || `Room ${data.roomId}`,
                    players: data.players,
                    maxPlayers: data.maxPlayers || 4,
                    status: data.status
                };
            } else if (this.currentRoom) {
                this.currentRoom.players = data.players;
                this.currentRoom.status = data.status;
            }
            if (this._root) this.render(this._root);
        });

        this.listen('gameStarted', () => {
            // Hide lobby when game starts
            this.style.display = 'none';
            this.dispatch('lobbyGameStarted', {});
        });
        
        this.listen('roomListUpdate', (data: ClientNetworkEventMap['roomListUpdate']) => {
            this.availableRooms = data.rooms;
            if (this._root && !this.currentRoom) {
                this.render(this._root);
            }
        });
        
        this.listen('networkError', (data: ClientNetworkEventMap['networkError']) => {
            // Could show error message in UI if needed
            if (data.code === 'ROOM_FULL') {
                alert(i18n.t('multiplayer.roomFull'));
            } else if (data.code === 'ROOM_NOT_FOUND') {
                alert(i18n.t('multiplayer.roomNotFound'));
            }
        });
        
        // Handle sync timer requests from MultiplayerManager
        this.listen('requestSyncTimer', (data: { interval: number }) => {
            if (this.syncTimerId !== null) {
                window.clearInterval(this.syncTimerId);
            }
            // Call the sync method directly on MultiplayerManager
            this.syncTimerId = window.setInterval(() => {
                this.multiplayerManager.executeSyncCallback();
            }, data.interval);
        });
        
        this.listen('cancelSyncTimer', () => {
            if (this.syncTimerId !== null) {
                window.clearInterval(this.syncTimerId);
                this.syncTimerId = null;
            }
        });
    }

    private render(root: ShadowRoot) {
        const isConnected = this.networkService.isConnected();
        const inRoom = this.currentRoom !== null;

        if (!isConnected) {
            this.renderConnectionForm(root);
        } else if (!inRoom) {
            this.renderRoomSelection(root);
        } else {
            this.renderRoom(root);
        }
    }

    private renderConnectionForm(root: ShadowRoot) {
        root.innerHTML = `
            <div class="lobby-container">
                <h2>Connect to Multiplayer</h2>
                <div class="connection-form">
                    <input type="text" 
                           id="playerName" 
                           placeholder="${i18n.t('multiplayer.enterName')}" 
                           value="${this.playerName}"
                           maxlength="20">
                    <button id="connectBtn">Connect</button>
                </div>
            </div>
        `;

        const playerNameInput = root.getElementById('playerName') as HTMLInputElement;
        const connectBtn = root.getElementById('connectBtn') as HTMLButtonElement;

        playerNameInput.addEventListener('input', (e) => {
            this.playerName = (e.target as HTMLInputElement).value;
        });

        connectBtn.addEventListener('click', async () => {
            if (this.playerName.trim()) {
                try {
                    // Build WebSocket URL from browser location
                    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                    const host = window.location.host;
                    const serverUrl = `${protocol}//${host}`;

                    await this.multiplayerManager.connectToServer(this.playerName, serverUrl);
                } catch (error) {
                    // Network failures for multiplayer are critical - show detailed error
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    console.error('Failed to connect to multiplayer server:', error);

                    // Show localized error with details
                    const baseMessage = i18n.t('multiplayer.connectionFailed');
                    alert(`${baseMessage}\n\nDetails: ${errorMessage}`);

                    // Re-throw to prevent further actions
                    throw new Error(`Multiplayer connection failed: ${errorMessage}`);
                }
            }
        });
    }

    private renderRoomSelection(root: ShadowRoot) {
        root.innerHTML = `
            <div class="lobby-container">
                <h2>Multiplayer Lobby</h2>
                <p>Connected as: ${this.playerName}</p>
                
                <div class="room-actions">
                    <div class="create-room">
                        <h3>Create New Room</h3>
                        <input type="text" 
                               id="roomName" 
                               placeholder="${i18n.t('multiplayer.roomName')}"
                               value="${this.generateRandomRoomName()}"
                               maxlength="30">
                        <select id="maxPlayers">
                            <option value="2">2 Players</option>
                            <option value="3">3 Players</option>
                            <option value="4">4 Players</option>
                        </select>
                        <button id="createRoomBtn">Create Room</button>
                    </div>
                    
                    <div class="available-rooms">
                        <h3>Available Rooms</h3>
                        <div class="rooms-list">
                            ${this.availableRooms.length === 0 
                                ? '<p class="no-rooms">No rooms available</p>'
                                : this.availableRooms.map(room => `
                                    <div class="room-item" data-room-id="${room.id}">
                                        <div class="room-info">
                                            <span class="room-name">${room.name}</span>
                                            <span class="room-players">${room.players}/${room.maxPlayers} players</span>
                                        </div>
                                        <button class="join-btn" data-room-id="${room.id}">Join</button>
                                    </div>
                                `).join('')
                            }
                        </div>
                        <button id="refreshRoomsBtn" class="refresh-btn">Refresh</button>
                    </div>
                </div>
                
                <button id="backBtn" class="back-button">Back to Game</button>
            </div>
        `;

        // Create room
        const roomNameInput = root.getElementById('roomName') as HTMLInputElement;
        const maxPlayersSelect = root.getElementById('maxPlayers') as HTMLSelectElement;
        const createRoomBtn = root.getElementById('createRoomBtn') as HTMLButtonElement;

        createRoomBtn.addEventListener('click', () => {
            const roomName = roomNameInput.value.trim();
            if (roomName) {
                const maxPlayers = parseInt(maxPlayersSelect.value);
                this.multiplayerManager.createRoom(roomName, maxPlayers);
            }
        });

        // Join room buttons
        const joinButtons = root.querySelectorAll('.join-btn') as NodeListOf<HTMLButtonElement>;
        joinButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const roomId = (e.target as HTMLButtonElement).getAttribute('data-room-id');
                if (roomId) {
                    this.multiplayerManager.joinRoom(roomId);
                }
            });
        });
        
        // Refresh rooms button
        const refreshBtn = root.getElementById('refreshRoomsBtn') as HTMLButtonElement;
        refreshBtn.addEventListener('click', () => {
            this.networkService.requestRoomList();
        });

        // Back button
        const backBtn = root.getElementById('backBtn') as HTMLButtonElement;
        backBtn.addEventListener('click', () => {
            this.networkService.disconnect();
            this.style.display = 'none';
            this.dispatch('lobbyClose', {});
        });
    }

    private renderRoom(root: ShadowRoot) {
        if (!this.currentRoom) return;

        const isReady = this.currentRoom.players.find(p => 
            p.id === this.networkService.getPlayerId()
        )?.ready || false;

        root.innerHTML = `
            <div class="lobby-container">
                <h2>${this.currentRoom.name}</h2>
                <p class="room-id">Room ID: ${this.currentRoom.id}</p>
                
                <div class="players-list">
                    <h3>Players (${this.currentRoom.players.length}/${this.currentRoom.maxPlayers})</h3>
                    <ul>
                        ${this.currentRoom.players.map(player => `
                            <li class="${player.ready ? 'ready' : ''}">
                                ${player.name} 
                                ${player.ready ? '✓' : '○'}
                            </li>
                        `).join('')}
                    </ul>
                </div>
                
                <div class="room-controls">
                    <button id="readyBtn" class="${isReady ? 'ready' : ''}">
                        ${isReady ? 'Not Ready' : 'Ready'}
                    </button>
                    <button id="leaveBtn">Leave Room</button>
                </div>
                
                ${this.currentRoom.status === 'starting' ? 
                    '<p class="starting-message">Game is starting...</p>' : ''}
            </div>
        `;

        // Ready button
        const readyBtn = root.getElementById('readyBtn') as HTMLButtonElement;
        readyBtn.addEventListener('click', () => {
            this.multiplayerManager.setReady(!isReady);
        });

        // Leave button
        const leaveBtn = root.getElementById('leaveBtn') as HTMLButtonElement;
        leaveBtn.addEventListener('click', () => {
            this.multiplayerManager.leaveRoom();
            this.currentRoom = null;
            this.render(root);
        });
    }

    show() {
        this.style.display = 'block';
    }

    hide() {
        this.style.display = 'none';
    }
}

customElements.define('multiplayer-lobby', MultiplayerLobby);