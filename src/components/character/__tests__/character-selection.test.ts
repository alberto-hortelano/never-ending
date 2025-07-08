import { State } from '../../../common/State';
import { IState, ICharacter } from '../../../common/interfaces';

describe('Character Selection Restriction', () => {
    let state: State;

    beforeEach(() => {
        const humanCharacter: ICharacter = {
            name: 'player',
            race: 'human',
            player: 'human',
            description: 'Human player character',
            action: 'iddle',
            position: { x: 1, y: 1 },
            location: 'room1',
            blocker: true,
            speed: 'medium',
            direction: 'down',
            path: [],
            palette: {
                skin: 'white',
                helmet: 'blue',
                suit: 'blue',
            },
            inventory: {
                items: [],
                maxWeight: 50,
                equippedWeapons: {
                    primary: null,
                    secondary: null
                }
            }
        };

        const aiCharacter: ICharacter = {
            name: 'enemy',
            race: 'robot',
            player: 'ai',
            description: 'AI controlled enemy',
            action: 'iddle',
            position: { x: 3, y: 3 },
            location: 'room1',
            blocker: true,
            speed: 'medium',
            direction: 'down',
            path: [],
            palette: {
                skin: 'gray',
                helmet: 'red',
                suit: 'red',
            },
            inventory: {
                items: [],
                maxWeight: 50,
                equippedWeapons: {
                    primary: null,
                    secondary: null
                }
            }
        };

        const initialState: IState = {
            game: {
                turn: 'human',
                players: ['human', 'ai']
            },
            map: [],
            characters: [humanCharacter, aiCharacter],
            messages: []
        };

        state = new State(initialState);
    });

    test('should only allow selection of characters belonging to current turn', () => {
        // Check initial state
        expect(state.game.turn).toBe('human');
        
        // Find characters
        const humanChar = state.findCharacter('player');
        const aiChar = state.findCharacter('enemy');
        
        expect(humanChar).toBeDefined();
        expect(aiChar).toBeDefined();
        
        // Verify character ownership
        expect(humanChar?.player).toBe('human');
        expect(aiChar?.player).toBe('ai');
        
        // Human turn should be able to select their character
        const canSelectHuman = humanChar?.player === state.game.turn;
        expect(canSelectHuman).toBe(true);
        
        // Human turn should NOT be able to select AI character
        const canSelectAI = aiChar?.player === state.game.turn;
        expect(canSelectAI).toBe(false);
    });

    test('should update turn when turn changes', () => {
        // Initial state
        expect(state.game.turn).toBe('human');
        
        // Simulate turn change to AI
        state['onChangeTurn']({
            turn: 'ai',
            previousTurn: 'human'
        });
        
        expect(state.game.turn).toBe('ai');
        
        // Now AI should be able to select their character
        const aiChar = state.findCharacter('enemy');
        const canSelectAI = aiChar?.player === state.game.turn;
        expect(canSelectAI).toBe(true);
        
        // And human should NOT be able to select their character
        const humanChar = state.findCharacter('player');
        const canSelectHuman = humanChar?.player === state.game.turn;
        expect(canSelectHuman).toBe(false);
    });
});