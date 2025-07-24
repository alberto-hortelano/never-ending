/* eslint-disable @typescript-eslint/no-explicit-any */
import { MultiplayerManager } from '../MultiplayerManager';
import { NetworkService } from '../NetworkService';
import { EventBus } from '../../events/EventBus';
import { GameEvent } from '../../events';
import { IState } from '../../interfaces';
import { getDefaultUIState } from '../../../__tests__/helpers/testUIState.helper';

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
        // Mock window object for timer functions
        global.window = {
            setInterval: jest.fn(),
            clearInterval: jest.fn()
        } as unknown as typeof window;
        // Clear all mocks
        jest.clearAllMocks();

        // Reset EventBus listeners
        EventBus.reset();

        // Reset singleton instance
        (MultiplayerManager as unknown as { instance: MultiplayerManager | undefined }).instance = undefined;
        (NetworkService as unknown as { instance: NetworkService | undefined }).instance = undefined;

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
            const dispatchSpy = jest.spyOn(multiplayerManager, 'dispatch');

            multiplayerManager.switchToSinglePlayer();

            expect(dispatchSpy).toHaveBeenCalledWith('switchedToSinglePlayer', expect.objectContaining({
                state: expect.objectContaining({
                    game: expect.any(Object),
                    characters: expect.any(Array),
                    map: expect.any(Array),
                    messages: expect.any(Array),
                    ui: expect.any(Object)
                })
            }));
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
                messages: [],
                ui: getDefaultUIState()
            };

            const dispatchSpy = jest.spyOn(multiplayerManager, 'dispatch');

            // Simulate game start event through network service
            triggerNetworkEvent('gameStarted', {
                roomId: 'test-room',
                initialState
            });

            expect(dispatchSpy).toHaveBeenCalledWith('multiplayerGameStarted', { state: initialState });
            // Note: MultiplayerManager doesn't create state - that's handled by web.ts
            expect(multiplayerManager.getState()).toBeNull();
        });

        it('should handle state sync for non-host players', () => {
            // Set as non-host by joining a room
            triggerNetworkEvent('roomJoined', { roomId: 'test-room' });

            // Create initial state
            const initialState: IState = {
                game: { turn: 'player1', players: ['player1', 'player2'] },
                characters: [],
                map: [],
                messages: [],
                ui: getDefaultUIState()
            };

            // Mock a state object (MultiplayerManager needs a state to sync)
            const mockState = {} as any;
            multiplayerManager.setGameState(mockState);

            // Start game first
            triggerNetworkEvent('gameStarted', {
                roomId: 'test-room',
                initialState
            });

            const syncedState: IState = {
                game: { turn: 'player3', players: ['player1', 'player2'] },
                characters: [],
                map: [],
                messages: [],
                ui: getDefaultUIState()
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
                messages: [],
                ui: getDefaultUIState()
            };

            // Set a mock state (needed for sync logic)
            const mockState = {} as any;
            multiplayerManager.setGameState(mockState);

            // Start game
            triggerNetworkEvent('gameStarted', {
                roomId: 'test-room',
                initialState
            });

            const syncedState: IState = {
                game: { turn: 'player4', players: ['player1', 'player2'] },
                characters: [],
                map: [],
                messages: [],
                ui: getDefaultUIState()
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

        it('should broadcast turn change when host', () => {
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
                messages: [],
                ui: getDefaultUIState()
            };

            // Set a mock state (needed for broadcast logic)
            const mockState = {} as any;
            multiplayerManager.setGameState(mockState);

            triggerNetworkEvent('gameStarted', {
                roomId: 'test-room',
                initialState
            });

            // Spy on broadcastAction method
            const broadcastSpy = jest.spyOn(multiplayerManager as any, 'broadcastAction');

            // Simulate turn change (not from network)
            multiplayerManager.dispatch(GameEvent.changeTurn, { turn: 'player2', previousTurn: 'player1' });

            expect(broadcastSpy).toHaveBeenCalledWith(GameEvent.changeTurn, expect.objectContaining({
                turn: 'player2',
                previousTurn: 'player1'
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
                messages: [],
                ui: getDefaultUIState()
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