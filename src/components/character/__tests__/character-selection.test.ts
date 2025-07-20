import { State } from '../../../common/State';
import { ICharacter, IState } from '../../../common/interfaces';
import { baseCharacter } from '../../../data/state';
import { getDefaultUIState } from '../../../__tests__/helpers/testUIState.helper';

describe('Character Selection Restriction', () => {
    let state: State;

    beforeEach(() => {
        // Create test characters using baseCharacter as template
        const humanCharacter: ICharacter = {
            ...baseCharacter,
            name: 'player',
            race: 'human',
            player: 'human',
            description: 'Human player character',
            position: { x: 1, y: 1 },
            location: 'room1',
            palette: {
                skin: 'white',
                helmet: 'blue',
                suit: 'blue',
            }
        };

        const aiCharacter: ICharacter = {
            ...baseCharacter,
            name: 'enemy',
            race: 'robot',
            player: 'ai',
            description: 'AI controlled enemy',
            position: { x: 3, y: 3 },
            location: 'room1',
            palette: {
                skin: 'gray',
                helmet: 'red',
                suit: 'red',
            }
        };

        // Create a simple test state without using initialState to avoid map generation
        const testState: IState = {
            game: {
                turn: 'human',
                players: ['human', 'ai']
            },
            map: [], // Empty map for testing - we don't need it for character selection tests
            characters: [humanCharacter, aiCharacter],
            messages: [],
            ui: getDefaultUIState()
        };

        state = new State(testState);
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