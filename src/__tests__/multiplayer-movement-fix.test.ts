 
import { NetworkService } from '../common/services/NetworkService';
import { EventBus } from '../common/events/EventBus';
import { UpdateStateEvent } from '../common/events';

describe('Multiplayer Movement Fix', () => {
    let networkService: NetworkService;
    let eventBus: EventBus<any, any>;

    beforeEach(() => {
        // Reset singletons
        EventBus.reset();
        (NetworkService as any).instance = null;

        networkService = NetworkService.getInstance();
        eventBus = new EventBus();
    });

    it('should filter out own player actions to prevent double movement', () => {
        // Mock the player ID
        (networkService as any).playerId = 'player1';

        // Set up a listener for the character position update
        const positionUpdateSpy = jest.fn();
        eventBus.listen(UpdateStateEvent.characterPosition, positionUpdateSpy);

        // Simulate receiving a playerAction from the network
        const ownPlayerAction = {
            type: 'playerAction' as const,
            data: {
                playerId: 'player1', // Same as current player
                action: {
                    type: UpdateStateEvent.characterPosition,
                    data: {
                        name: 'TestCharacter',
                        position: { x: 5, y: 5 }
                    }
                }
            }
        };

        // Process the message (this would normally come through WebSocket)
        (networkService as any).handleServerMessage(ownPlayerAction);

        // The position update should NOT be dispatched because it's from the same player
        expect(positionUpdateSpy).not.toHaveBeenCalled();
    });

    it('should process player actions from other players', () => {
        // Mock the player ID
        (networkService as any).playerId = 'player1';

        // Set up a listener for the character position update
        const positionUpdateSpy = jest.fn();
        networkService.listen(UpdateStateEvent.characterPosition, positionUpdateSpy);

        // Simulate receiving a playerAction from another player
        const otherPlayerAction = {
            type: 'playerAction' as const,
            data: {
                playerId: 'player2', // Different player
                action: {
                    type: UpdateStateEvent.characterPosition,
                    data: {
                        name: 'TestCharacter',
                        position: { x: 5, y: 5 }
                    }
                }
            }
        };

        // Process the message
        (networkService as any).handleServerMessage(otherPlayerAction);

        // The position update SHOULD be dispatched because it's from a different player
        expect(positionUpdateSpy).toHaveBeenCalledWith(expect.objectContaining({
            name: 'TestCharacter',
            position: { x: 5, y: 5 },
            fromNetwork: true,
            playerId: 'player2'
        }));
    });

    it('should filter out own player path updates to prevent double movement', () => {
        // Mock the player ID
        (networkService as any).playerId = 'player1';

        // Set up a listener for the character path update
        const pathUpdateSpy = jest.fn();
        eventBus.listen(UpdateStateEvent.characterPath, pathUpdateSpy);

        // Simulate receiving a path update from own player
        const ownPlayerPathAction = {
            type: 'playerAction' as const,
            data: {
                playerId: 'player1', // Same as current player
                action: {
                    type: UpdateStateEvent.characterPath,
                    data: {
                        name: 'TestCharacter',
                        position: { x: 0, y: 0 },
                        path: [{ x: 1, y: 0 }, { x: 2, y: 0 }]
                    }
                }
            }
        };

        // Process the message
        (networkService as any).handleServerMessage(ownPlayerPathAction);

        // The path update should NOT be dispatched because it's from the same player
        expect(pathUpdateSpy).not.toHaveBeenCalled();
    });

    it('should process path updates from other players for smooth movement', () => {
        // Mock the player ID
        (networkService as any).playerId = 'player1';

        // Set up a listener for the character path update
        const pathUpdateSpy = jest.fn();
        networkService.listen(UpdateStateEvent.characterPath, pathUpdateSpy);

        // Simulate receiving a path update from another player
        const otherPlayerPathAction = {
            type: 'playerAction' as const,
            data: {
                playerId: 'player2', // Different player
                action: {
                    type: UpdateStateEvent.characterPath,
                    data: {
                        name: 'TestCharacter',
                        position: { x: 0, y: 0 },
                        path: [{ x: 1, y: 0 }, { x: 2, y: 0 }]
                    }
                }
            }
        };

        // Process the message
        (networkService as any).handleServerMessage(otherPlayerPathAction);

        // The path update SHOULD be dispatched because it's from a different player
        expect(pathUpdateSpy).toHaveBeenCalledWith(expect.objectContaining({
            name: 'TestCharacter',
            position: { x: 0, y: 0 },
            path: [{ x: 1, y: 0 }, { x: 2, y: 0 }],
            fromNetwork: true,
            playerId: 'player2'
        }));
    });
});