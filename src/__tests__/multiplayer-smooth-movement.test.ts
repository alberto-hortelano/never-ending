 
import { State } from '../common/State';
import { Movement } from '../common/Movement';
import { MultiplayerManager } from '../common/services/MultiplayerManager';
import { NetworkService } from '../common/services/NetworkService';
import { EventBus, UpdateStateEvent, ControlsEvent, StateChangeEvent } from '../common/events';
import { ICharacter, ICoord } from '../common/interfaces';
import { getBaseState } from '../data/state';

// Mock WebSocket
class MockWebSocket {
    static OPEN = 1;
    static CLOSED = 3;
    readyState = MockWebSocket.OPEN;
    onopen: ((event: Event) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onclose: ((event: CloseEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;

    send = jest.fn();
    close = jest.fn();

    simulateMessage(data: { type: string; data: unknown }) {
        console.log('MockWebSocket simulateMessage:', data);
        if (this.onmessage) {
            console.log('Calling onmessage');
            this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
        } else {
            console.log('No onmessage handler');
        }
    }
}

// Store original WebSocket
const originalWebSocket = global.WebSocket;

// Mock window object with complete Location interface
(global as any).window = {
    location: {
        protocol: 'http:',
        host: 'localhost:3000',
        hostname: 'localhost',
        port: '3000',
        pathname: '/',
        search: '',
        hash: '',
        href: 'http://localhost:3000/',
        origin: 'http://localhost:3000',
        ancestorOrigins: { length: 0 } as DOMStringList,
        assign: jest.fn(),
        reload: jest.fn(),
        replace: jest.fn()
    } as Location
};

// TODO: These tests need to be rewritten for the new animation system
// The movement system has been refactored to use AnimationService instead of
// direct movement events and onMovementEnd callbacks
describe.skip('Multiplayer Smooth Movement - NEEDS REWRITE', () => {
    let state: State;
    let movement: Movement;
    let multiplayerManager: MultiplayerManager;
    let networkService: NetworkService;
    let mockWebSocket: MockWebSocket;
    let moveCharacterEvents: Array<ICharacter> = [];
    let characterPathEvents: Array<{ characterName: string; path: ICoord[] }> = [];

    beforeEach(() => {
        // Reset singletons
        jest.clearAllMocks();
        moveCharacterEvents = [];
        characterPathEvents = [];

        // Mock WebSocket
        mockWebSocket = new MockWebSocket();
        global.WebSocket = jest.fn().mockImplementation(() => {
            // Set up message handler immediately after WebSocket creation
            setTimeout(() => {
                if (mockWebSocket.onopen) {
                    mockWebSocket.onopen(new Event('open'));
                }
            }, 0);
            return mockWebSocket;
        }) as unknown as typeof WebSocket;

        // Get singleton instances
        networkService = NetworkService.getInstance();
        multiplayerManager = MultiplayerManager.getInstance();

        // Create initial state with characters at specific positions
        const initialState = getBaseState();
        // Ensure we have at least 2 characters
        if (initialState.characters.length < 2) {
            throw new Error('Test requires at least 2 characters in base state');
        }

        // Update first character
        const char1 = initialState.characters[0]!;
        char1.name = 'player1-char';
        char1.player = 'player1';
        char1.position = { x: 5, y: 5 };
        char1.location = 'test-location';
        char1.direction = 'down';
        char1.path = [];
        char1.actions.pointsLeft = 100;

        // Update second character
        const char2 = initialState.characters[1]!;
        char2.name = 'player2-char';
        char2.player = 'player2';
        char2.position = { x: 10, y: 10 };
        char2.location = 'test-location';
        char2.direction = 'up';
        char2.path = [];
        char2.actions.pointsLeft = 100;

        initialState.game.turn = 'player1';

        // Create state and movement
        state = new State(initialState);
        movement = new Movement(state);

        // Set up multiplayer manager
        multiplayerManager.setGameState(state);

        // Listen for movement events
        const eventBus = new EventBus<any, any>();
        eventBus.listen(ControlsEvent.moveCharacter, (data) => {
            moveCharacterEvents.push(data);
        });

        eventBus.listen(StateChangeEvent.characterPath, (data) => {
            characterPathEvents.push(data);
        });
    });

    afterEach(() => {
        // Restore WebSocket
        global.WebSocket = originalWebSocket;

        // Clean up movement service
        movement.destroy();
    });

    test('should animate character movement smoothly along path for network updates', async () => {
        // Connect as player1
        await networkService.connect('Player1', 'ws://localhost:3000');

        // Wait for connection to be established
        await new Promise(resolve => setTimeout(resolve, 50));

        // Simulate connect response
        mockWebSocket.simulateMessage({
            type: 'connect',
            data: { playerId: 'player1' }
        });

        // Simulate room creation to set up multiplayer mode
        mockWebSocket.simulateMessage({
            type: 'createRoom',
            data: { roomId: 'test-room', playerId: 'player1' }
        });

        // Wait for multiplayer setup
        await new Promise(resolve => setTimeout(resolve, 50));

        // Create a path for player2's character (simulating network update)
        const path: ICoord[] = [
            { x: 10, y: 9 },  // Move up
            { x: 10, y: 8 },  // Move up again
            { x: 9, y: 8 },   // Move left
        ];

        // Log to verify the event type
        console.log('Sending characterPath event:', UpdateStateEvent.characterPath);

        // Simulate receiving a path update from player2
        mockWebSocket.simulateMessage({
            type: 'playerAction',
            data: {
                playerId: 'player2',
                action: {
                    type: UpdateStateEvent.characterPath,
                    data: {
                        name: 'player2-char',
                        player: 'player2',
                        position: { x: 10, y: 10 },
                        direction: 'up',
                        path: path,
                        fromNetwork: true
                    }
                }
            }
        });

        // Wait for event processing
        await new Promise(resolve => setTimeout(resolve, 100));

        // Verify the character received the path update
        const player2Char = state.findCharacter('player2-char');
        expect(player2Char).toBeDefined();
        console.log('Player2 character:', player2Char);
        console.log('Character path events:', characterPathEvents);
        expect(player2Char!.path.length).toBe(3);

        // Verify movement started (first cell in path)
        expect(moveCharacterEvents.length).toBeGreaterThan(0);
        const firstMove = moveCharacterEvents[0];
        expect(firstMove!.name).toBe('player2-char');
        expect(firstMove!.position).toEqual({ x: 10, y: 9 });
        expect(firstMove!.path.length).toBe(2); // Remaining path

        // TODO: Movement completion is now handled by AnimationService
        // movement['onMovementEnd']('player2-char');

        // Wait for event processing
        await new Promise(resolve => setTimeout(resolve, 50));

        // Verify character moved to first position and continues to next
        const updatedChar = state.findCharacter('player2-char');
        expect(updatedChar!.position).toEqual({ x: 10, y: 9 });

        // Check that next movement was triggered
        expect(moveCharacterEvents.length).toBeGreaterThan(1);
        const secondMove = moveCharacterEvents[1];
        expect(secondMove!.position).toEqual({ x: 10, y: 8 });
        expect(secondMove!.path.length).toBe(1); // One position left

        // TODO: Movement completion is now handled by AnimationService
        // movement['onMovementEnd']('player2-char');
        await new Promise(resolve => setTimeout(resolve, 50));

        // Verify third movement
        expect(moveCharacterEvents.length).toBeGreaterThan(2);
        const thirdMove = moveCharacterEvents[2];
        expect(thirdMove!.position).toEqual({ x: 9, y: 8 });
        expect(thirdMove!.path.length).toBe(0); // No more path

        // Final position check
        const finalChar = state.findCharacter('player2-char');
        expect(finalChar!.position).toEqual({ x: 9, y: 8 });
    });

    test('should not deduct action points for network movements', async () => {
        // Connect as player1  
        await networkService.connect('Player1', 'ws://localhost:3000');
        await new Promise(resolve => setTimeout(resolve, 50));
        mockWebSocket.simulateMessage({
            type: 'connect',
            data: { playerId: 'player1' }
        });

        // Track action point deductions
        const actionPointDeductions: Array<{ characterName: string; pointsLeft: number }> = [];
        const eventBus = new EventBus<any, any>();
        eventBus.listen(UpdateStateEvent.deductActionPoints, (data) => {
            actionPointDeductions.push(data);
        });

        // Simulate receiving movement from player2
        mockWebSocket.simulateMessage({
            type: 'playerAction',
            data: {
                playerId: 'player2',
                action: {
                    type: UpdateStateEvent.characterPath,
                    data: {
                        name: 'player2-char',
                        player: 'player2',
                        position: { x: 10, y: 10 },
                        direction: 'up',
                        path: [{ x: 10, y: 9 }],
                        fromNetwork: true
                    }
                }
            }
        });

        await new Promise(resolve => setTimeout(resolve, 50));

        // TODO: Movement completion is now handled by AnimationService
        // movement['onMovementEnd']('player2-char');

        await new Promise(resolve => setTimeout(resolve, 50));

        // Verify no action points were deducted (since it's not player1's turn)
        expect(actionPointDeductions.length).toBe(0);

        // Verify character still has full action points
        const player2Char = state.findCharacter('player2-char');
        expect(player2Char!.actions.pointsLeft).toBe(100);
    });

    test('should handle rapid path updates without jumping', async () => {
        // Connect as player1
        await networkService.connect('Player1', 'ws://localhost:3000');
        await new Promise(resolve => setTimeout(resolve, 50));
        mockWebSocket.simulateMessage({
            type: 'connect',
            data: { playerId: 'player1' }
        });

        // Send multiple rapid path updates
        const paths = [
            [{ x: 10, y: 9 }, { x: 10, y: 8 }],
            [{ x: 10, y: 8 }, { x: 9, y: 8 }],
            [{ x: 9, y: 8 }, { x: 8, y: 8 }]
        ];

        for (const path of paths) {
            mockWebSocket.simulateMessage({
                type: 'playerAction',
                data: {
                    playerId: 'player2',
                    action: {
                        type: UpdateStateEvent.characterPath,
                        data: {
                            name: 'player2-char',
                            player: 'player2',
                            position: { x: 10, y: 10 },
                            direction: 'up',
                            path: path,
                            fromNetwork: true
                        }
                    }
                }
            });

            await new Promise(resolve => setTimeout(resolve, 10));
        }

        // Verify that movements are processed sequentially, not jumped
        expect(moveCharacterEvents.length).toBeGreaterThan(0);

        // Each movement should be to an adjacent cell
        for (let i = 1; i < moveCharacterEvents.length; i++) {
            const prevPos = i === 1 ? { x: 10, y: 10 } : moveCharacterEvents[i - 1]?.position || { x: 10, y: 10 };
            const currPos = moveCharacterEvents[i]?.position || { x: 10, y: 10 };

            const dx = Math.abs(currPos.x - prevPos.x);
            const dy = Math.abs(currPos.y - prevPos.y);

            // Movement should be to adjacent cell only (distance of 1)
            expect(dx + dy).toBeLessThanOrEqual(1);
        }
    });
});