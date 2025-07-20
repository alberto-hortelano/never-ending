import { EventBus, EventsMap } from '../events/EventBus';
import { NetworkService } from './NetworkService';
import { State } from '../State';
import { IState } from '../interfaces';
import { GameEvent, UpdateStateEvent } from '../events';
import { getBaseState } from '../../data/state';

// Type for network event data
interface NetworkEventData {
    fromNetwork?: boolean;
    [key: string]: unknown;
}

export class MultiplayerManager extends EventBus<EventsMap, EventsMap> {
    private static instance: MultiplayerManager;
    private networkService: NetworkService;
    private state: State | null = null;
    private isHost = false;
    private isMultiplayer = false;

    private constructor() {
        super();
        this.networkService = NetworkService.getInstance();
        this.setupEventListeners();
    }

    static getInstance(): MultiplayerManager {
        if (!MultiplayerManager.instance) {
            MultiplayerManager.instance = new MultiplayerManager();
        }
        return MultiplayerManager.instance;
    }

    private setupEventListeners() {
        // Listen for network events
        this.networkService.listen('gameStarted', (data) => {
            this.handleGameStart(data.initialState);
        });

        this.networkService.listen('stateSync', (data) => {
            this.handleStateSync(data.state);
        });

        this.networkService.listen('roomCreated', () => {
            this.isHost = true;
            this.isMultiplayer = true;
        });

        this.networkService.listen('roomJoined', () => {
            this.isHost = false;
            this.isMultiplayer = true;
        });

        this.networkService.listen('roomLeft', () => {
            this.isMultiplayer = false;
            this.isHost = false;
        });

        // Listen for turn changes to broadcast to other players
        this.listen(GameEvent.changeTurn, (data) => {
            if (this.isMultiplayer && this.state) {
                // Only broadcast if this didn't come from network (to avoid loops)
                if (!(data as NetworkEventData).fromNetwork) {
                    this.broadcastAction(GameEvent.changeTurn, data);
                }
                
                // Host also syncs the full state
                if (this.isHost) {
                    this.syncStateToClients();
                }
            }
        });

        // Listen for state update events and broadcast them in multiplayer
        this.setupStateUpdateListeners();
    }

    async connectToServer(playerName: string, serverUrl?: string): Promise<void> {
        await this.networkService.connect(playerName, serverUrl);
    }

    createRoom(roomName: string, maxPlayers: number = 2): void {
        this.networkService.createRoom(roomName, maxPlayers);
    }

    joinRoom(roomId: string): void {
        this.networkService.joinRoom(roomId);
    }

    leaveRoom(): void {
        this.networkService.leaveRoom();
        this.switchToSinglePlayer();
    }

    setReady(ready: boolean, character?: any): void {
        this.networkService.setReady(ready, character);
    }

    private handleGameStart(initialState: IState) {
        // Just dispatch the event with the initial state data
        this.dispatch('multiplayerGameStarted', { state: initialState });
    }
    
    setGameState(state: State) {
        // Allow web.ts to set the state instance after creating it
        this.state = state;
    }

    private handleStateSync(syncedState: IState) {
        if (!this.isHost && this.state) {
            // Don't create a new state - just dispatch the sync event
            // The existing state will be updated through individual events
            this.dispatch('stateSynced', { state: syncedState });
        }
    }

    private syncStateToClients() {
        if (!this.isHost || !this.state) return;

        const currentState: IState = {
            game: structuredClone(this.state.game) as IState['game'],
            map: structuredClone(this.state.map) as IState['map'],
            characters: structuredClone(this.state.characters) as IState['characters'],
            messages: structuredClone(this.state.messages) as IState['messages']
        };

        // Send sync state through WebSocket
        this.networkService.send('syncState', {
            roomId: this.networkService.getRoomId(),
            state: currentState,
            timestamp: Date.now()
        });
    }

    switchToSinglePlayer() {
        this.isMultiplayer = false;
        this.isHost = false;

        // Get the base state data for single player
        const singlePlayerState = getBaseState();
        
        // Don't create state here - let web.ts handle it
        this.state = null;

        this.dispatch('switchedToSinglePlayer', { state: singlePlayerState });
    }

    isInMultiplayerMode(): boolean {
        return this.isMultiplayer;
    }

    isGameHost(): boolean {
        return this.isHost;
    }

    getCurrentPlayerId(): string | null {
        return this.networkService.getPlayerId();
    }

    getState(): State | null {
        return this.state;
    }

    private setupStateUpdateListeners() {
        // Listen for character movement
        this.listen(UpdateStateEvent.characterPosition, (data) => {
            
            if (this.isMultiplayer && this.state) {
                // Don't broadcast if this came from network (to avoid loops)
                if (!(data as NetworkEventData).fromNetwork) {
                    this.broadcastAction(UpdateStateEvent.characterPosition, data);
                }
            }
        });

        // Listen for character path updates
        this.listen(UpdateStateEvent.characterPath, (data) => {
            if (this.isMultiplayer && this.state) {
                // Only broadcast if this didn't come from network (to avoid loops)
                if (!(data as NetworkEventData).fromNetwork) {
                    // Include current position in the broadcast for synchronization
                    this.broadcastAction(UpdateStateEvent.characterPath, {
                        ...data,
                        position: data.position // Ensure position is included
                    });
                }
            }
        });

        // Listen for other important state updates
        this.listen(UpdateStateEvent.deductActionPoints, (data) => {
            if (this.isMultiplayer && this.state) {
                if (!(data as NetworkEventData).fromNetwork) {
                    this.broadcastAction(UpdateStateEvent.deductActionPoints, data);
                }
            }
        });

        this.listen(UpdateStateEvent.damageCharacter, (data) => {
            if (this.isMultiplayer && this.state) {
                if (!(data as NetworkEventData).fromNetwork) {
                    this.broadcastAction(UpdateStateEvent.damageCharacter, data);
                }
            }
        });
    }

    private broadcastAction(type: string, data: any) {
        this.networkService.send('playerAction', {
            action: {
                type,
                data: {
                    ...data,
                    senderId: this.getCurrentPlayerId() // Add sender ID to track origin
                }
            }
        });
    }
}