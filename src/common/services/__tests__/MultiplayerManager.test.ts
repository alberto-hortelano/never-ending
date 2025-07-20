import { MultiplayerManager } from '../MultiplayerManager';
import { NetworkService } from '../NetworkService';
import { EventBus } from '../../events/EventBus';
import { GameEvent } from '../../events';
import { IState } from '../../interfaces';

// Mock NetworkService
jest.mock('../NetworkService', () => ({
    NetworkService: {
        getInstance: jest.fn()
    }
}));

describe('MultiplayerManager', () => {
    let multiplayerManager: MultiplayerManager;
    let mockNetworkService: jest.Mocked<NetworkService>;
    
    // Helper to trigger network events
    const triggerNetworkEvent = (eventName: string, data: any) => {
        const listener = mockNetworkService.listen.mock.calls.find(
            call => call[0] === eventName
        )?.[1];
        
        if (listener) {
            listener(data);
        }
    };

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();
        
        // Reset EventBus listeners
        EventBus.reset();
        
        // Reset singleton instance
        (MultiplayerManager as any).instance = undefined;
        (NetworkService as any).instance = undefined;
        
        // Create mock network service instance with required methods
        const mockInstance = {
            listen: jest.fn(),
            dispatch: jest.fn(),
            connect: jest.fn().mockResolvedValue(undefined),
            createRoom: jest.fn(),
            joinRoom: jest.fn(),
            leaveRoom: jest.fn(),
            setReady: jest.fn(),
            send: jest.fn(),
            getRoomId: jest.fn().mockReturnValue('test-room'),
            getPlayerId: jest.fn().mockReturnValue('test-player'),
            isConnected: jest.fn().mockReturnValue(true),
            eventBus: new EventBus()
        };
        
        // Make NetworkService.getInstance return our mock
        (NetworkService.getInstance as jest.Mock).mockReturnValue(mockInstance);
        mockNetworkService = mockInstance as any;
        
        // Get MultiplayerManager instance (which will use our mock NetworkService)
        multiplayerManager = MultiplayerManager.getInstance();
    });

    afterEach(() => {
        // Clean up
        EventBus.reset();
        (MultiplayerManager as any).instance = undefined;
        (NetworkService as any).instance = undefined;
    });

    describe('Singleton Pattern', () => {
        it('should return the same instance', () => {
            // Don't reset instances for this test
            const instance1 = multiplayerManager;
            const instance2 = MultiplayerManager.getInstance();
            expect(instance1).toBe(instance2);
        });
    });

    describe('Mode Management', () => {
        it('should start in single player mode', () => {
            expect(multiplayerManager.isInMultiplayerMode()).toBe(false);
            expect(multiplayerManager.isGameHost()).toBe(false);
        });

        it('should be in multiplayer mode and host after creating room', () => {
            // Simulate room created event
            triggerNetworkEvent('roomCreated', { 
                roomId: 'test-room', 
                roomName: 'Test Room', 
                maxPlayers: 4 
            });
            
            expect(multiplayerManager.isInMultiplayerMode()).toBe(true);
            expect(multiplayerManager.isGameHost()).toBe(true);
        });

        it('should be in multiplayer mode but not host after joining room', () => {
            // Simulate room joined event
            triggerNetworkEvent('roomJoined', { roomId: 'test-room' });
            
            expect(multiplayerManager.isInMultiplayerMode()).toBe(true);
            expect(multiplayerManager.isGameHost()).toBe(false);
        });

        it('should switch back to single player mode', () => {
            // First join a room
            triggerNetworkEvent('roomJoined', { roomId: 'test-room' });
            
            // Then switch to single player
            multiplayerManager.switchToSinglePlayer();
            
            expect(multiplayerManager.isInMultiplayerMode()).toBe(false);
            expect(multiplayerManager.isGameHost()).toBe(false);
        });

        it('should create a base state when switching to single player', () => {
            multiplayerManager.switchToSinglePlayer();
            const state = multiplayerManager.getState();
            
            expect(state).toBeDefined();
            expect(state?.game).toBeDefined();
            expect(state?.characters).toBeDefined();
        });

        it('should exit multiplayer mode when leaving room', () => {
            // Join a room first
            triggerNetworkEvent('roomJoined', { roomId: 'test-room' });
            
            // Then simulate room left
            triggerNetworkEvent('roomLeft', { roomId: 'test-room' });
            
            expect(multiplayerManager.isInMultiplayerMode()).toBe(false);
            expect(multiplayerManager.isGameHost()).toBe(false);
        });
    });

    describe('Network Connection', () => {
        it('should connect to server with player name', async () => {
            const playerName = 'TestPlayer';
            const serverUrl = 'ws://localhost:3000';
            
            mockNetworkService.connect.mockResolvedValue(undefined);
            
            await multiplayerManager.connectToServer(playerName, serverUrl);
            
            expect(mockNetworkService.connect).toHaveBeenCalledWith(playerName, serverUrl);
        });

        it('should use default server URL if not provided', async () => {
            const playerName = 'TestPlayer';
            
            mockNetworkService.connect.mockResolvedValue(undefined);
            
            await multiplayerManager.connectToServer(playerName);
            
            expect(mockNetworkService.connect).toHaveBeenCalledWith(playerName, undefined);
        });
    });

    describe('Room Management', () => {
        it('should create a room', () => {
            const roomName = 'Test Room';
            const maxPlayers = 4;
            
            multiplayerManager.createRoom(roomName, maxPlayers);
            
            expect(mockNetworkService.createRoom).toHaveBeenCalledWith(roomName, maxPlayers);
        });

        it('should join a room', () => {
            const roomId = 'room-123';
            
            multiplayerManager.joinRoom(roomId);
            
            expect(mockNetworkService.joinRoom).toHaveBeenCalledWith(roomId);
        });

        it('should leave a room and switch to single player', () => {
            // Join room first
            triggerNetworkEvent('roomJoined', { roomId: 'test-room' });
            
            multiplayerManager.leaveRoom();
            
            expect(mockNetworkService.leaveRoom).toHaveBeenCalled();
            expect(multiplayerManager.isInMultiplayerMode()).toBe(false);
        });

        it('should set player ready status', () => {
            const ready = true;
            const character = { name: 'TestCharacter' };
            
            multiplayerManager.setReady(ready, character);
            
            expect(mockNetworkService.setReady).toHaveBeenCalledWith(ready, character);
        });
    });

    describe('State Synchronization', () => {
        it('should handle game start event', () => {
            const initialState: IState = {
                game: { turn: 'player2', players: ['player1', 'player2'] },
                characters: [],
                map: [],
                messages: []
            };
            
            const dispatchSpy = jest.spyOn(multiplayerManager, 'dispatch');
            
            // Simulate game start event through network service
            triggerNetworkEvent('gameStarted', { 
                roomId: 'test-room',
                initialState 
            });
            
            expect(dispatchSpy).toHaveBeenCalledWith('multiplayerGameStarted', { state: initialState });
            expect(multiplayerManager.getState()).toBeDefined();
        });

        it('should handle state sync for non-host players', () => {
            // Set as non-host by joining a room
            triggerNetworkEvent('roomJoined', { roomId: 'test-room' });
            
            // Create initial state
            const initialState: IState = {
                game: { turn: 'player1', players: ['player1', 'player2'] },
                characters: [],
                map: [],
                messages: []
            };
            
            // Start game first
            triggerNetworkEvent('gameStarted', { 
                roomId: 'test-room',
                initialState 
            });
            
            const syncedState: IState = {
                game: { turn: 'player3', players: ['player1', 'player2'] },
                characters: [],
                map: [],
                messages: []
            };
            
            const dispatchSpy = jest.spyOn(multiplayerManager, 'dispatch');
            
            // Simulate state sync
            triggerNetworkEvent('stateSync', { 
                roomId: 'test-room',
                state: syncedState,
                timestamp: Date.now()
            });
            
            expect(dispatchSpy).toHaveBeenCalledWith('stateSynced', { state: syncedState });
        });

        it('should not sync state for host players', () => {
            // Set as host by creating a room
            triggerNetworkEvent('roomCreated', { 
                roomId: 'test-room',
                roomName: 'Test Room',
                maxPlayers: 2
            });
            
            // Create initial state
            const initialState: IState = {
                game: { turn: 'player1', players: ['player1', 'player2'] },
                characters: [],
                map: [],
                messages: []
            };
            
            // Start game
            triggerNetworkEvent('gameStarted', { 
                roomId: 'test-room',
                initialState 
            });
            
            // Store original state reference (unused but shows state doesn't change)
            multiplayerManager.getState();
            
            const syncedState: IState = {
                game: { turn: 'player4', players: ['player1', 'player2'] },
                characters: [],
                map: [],
                messages: []
            };
            
            const dispatchSpy = jest.spyOn(multiplayerManager, 'dispatch');
            
            // Simulate state sync (should be ignored by host)
            triggerNetworkEvent('stateSync', { 
                roomId: 'test-room',
                state: syncedState,
                timestamp: Date.now()
            });
            
            // State should not be synced for host
            expect(dispatchSpy).not.toHaveBeenCalledWith('stateSynced', expect.anything());
        });

        it('should sync state to clients on turn change when host', () => {
            // Set as host
            triggerNetworkEvent('roomCreated', { 
                roomId: 'test-room',
                roomName: 'Test Room',
                maxPlayers: 2
            });
            
            // Start game
            const initialState: IState = {
                game: { turn: 'player1', players: ['player1', 'player2'] },
                characters: [],
                map: [],
                messages: []
            };
            triggerNetworkEvent('gameStarted', { 
                roomId: 'test-room',
                initialState 
            });
            
            // Spy on send method
            mockNetworkService.send = jest.fn();
            
            // Simulate turn change
            multiplayerManager.dispatch(GameEvent.changeTurn, { turn: 'player2', previousTurn: 'player1' });
            
            expect(mockNetworkService.send).toHaveBeenCalledWith('syncState', expect.objectContaining({
                roomId: 'test-room',
                state: expect.any(Object),
                timestamp: expect.any(Number)
            }));
        });
    });

    describe('Player Information', () => {
        it('should get current player ID', () => {
            mockNetworkService.getPlayerId.mockReturnValue('player-123');
            
            expect(multiplayerManager.getCurrentPlayerId()).toBe('player-123');
        });
    });

    describe('Events', () => {
        it('should dispatch switchedToSinglePlayer event when switching modes', () => {
            const dispatchSpy = jest.spyOn(multiplayerManager, 'dispatch');
            
            multiplayerManager.switchToSinglePlayer();
            
            expect(dispatchSpy).toHaveBeenCalledWith('switchedToSinglePlayer', expect.objectContaining({
                state: expect.any(Object)
            }));
        });

        it('should dispatch multiplayerGameStarted event when game starts', () => {
            const dispatchSpy = jest.spyOn(multiplayerManager, 'dispatch');
            
            const initialState: IState = {
                game: { turn: 'player1', players: ['player1', 'player2'] },
                characters: [],
                map: [],
                messages: []
            };
            
            triggerNetworkEvent('gameStarted', { 
                roomId: 'test-room',
                initialState 
            });
            
            expect(dispatchSpy).toHaveBeenCalledWith('multiplayerGameStarted', { state: initialState });
        });
    });

    describe('Error Handling', () => {
        it('should handle connection errors', async () => {
            const error = new Error('Connection failed');
            mockNetworkService.connect.mockRejectedValue(error);
            
            await expect(multiplayerManager.connectToServer('TestPlayer')).rejects.toThrow('Connection failed');
        });
    });
});