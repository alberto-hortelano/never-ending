import { EventBus, GameEvent, StateChangeEvent } from '../common/events';
import { MultiplayerManager } from '../common/services/MultiplayerManager';
import { State } from '../common/State';
import { getDefaultUIState } from './helpers/testUIState.helper';

describe('Multiplayer Turn Change', () => {
    let eventBus: EventBus<any, any>;
    let multiplayerManager: MultiplayerManager;
    
    beforeEach(() => {
        // Reset singletons
        EventBus.reset();
        eventBus = new EventBus();
        multiplayerManager = MultiplayerManager.getInstance();
    });
    
    it('should broadcast turn changes to other players', (done) => {
        // Set up multiplayer mode
        (multiplayerManager as any).isMultiplayer = true;
        (multiplayerManager as any).state = new State({
            game: {
                players: ['player1', 'player2'],
                turn: 'player1',
                playerInfo: {
                    player1: { name: 'Player 1', isAI: false },
                    player2: { name: 'Player 2', isAI: false }
                }
            },
            map: [],
            characters: [],
            messages: [],
            ui: getDefaultUIState()
        });
        
        // Mock the broadcastAction method
        const broadcastSpy = jest.spyOn(multiplayerManager as any, 'broadcastAction');
        
        // Simulate turn change from player1 to player2
        eventBus.dispatch(GameEvent.changeTurn, {
            turn: 'player2',
            previousTurn: 'player1'
        });
        
        // Give it a moment to process
        setTimeout(() => {
            // Verify the turn change was broadcast
            expect(broadcastSpy).toHaveBeenCalledWith(GameEvent.changeTurn, {
                turn: 'player2',
                previousTurn: 'player1'
            });
            done();
        }, 10);
    });
    
    it('should not rebroadcast turn changes that came from network', (done) => {
        // Set up multiplayer mode
        (multiplayerManager as any).isMultiplayer = true;
        const state = new State({
            game: {
                players: ['player1', 'player2'],
                turn: 'player1',
                playerInfo: {
                    player1: { name: 'Player 1', isAI: false },
                    player2: { name: 'Player 2', isAI: false }
                }
            },
            map: [],
            characters: [],
            messages: [],
            ui: getDefaultUIState()
        });
        (multiplayerManager as any).state = state;
        
        // Mock the broadcastAction method after state is set
        const broadcastSpy = jest.spyOn(multiplayerManager as any, 'broadcastAction');
        broadcastSpy.mockClear(); // Clear any previous calls
        
        // Simulate turn change from network
        eventBus.dispatch(GameEvent.changeTurn, {
            turn: 'player2',
            previousTurn: 'player1',
            fromNetwork: true
        } as any);
        
        // Give it a moment to process
        setTimeout(() => {
            // Verify the turn change was NOT broadcast (to avoid loops)
            expect(broadcastSpy).not.toHaveBeenCalled();
            done();
        }, 50);
    });
    
    it('should update game state when turn changes', (done) => {
        const initialState = {
            game: {
                players: ['player1', 'player2'],
                turn: 'player1',
                playerInfo: {
                    player1: { name: 'Player 1', isAI: false },
                    player2: { name: 'Player 2', isAI: false }
                }
            },
            map: [],
            characters: [],
            messages: [],
            ui: getDefaultUIState()
        };
        
        new State(initialState); // This creates the state and sets up listeners
        
        // Listen for state change
        eventBus.listen(StateChangeEvent.game, (game) => {
            expect(game.turn).toBe('player2');
            done();
        });
        
        // Trigger turn change
        eventBus.dispatch(GameEvent.changeTurn, {
            turn: 'player2',
            previousTurn: 'player1'
        });
    });
});