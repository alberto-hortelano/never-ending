import type { IState, ICharacter, Action } from '../interfaces';
import { State } from '../State';
import type { DeepReadonly } from './types';

/**
 * Creates a minimal state instance for preview components
 * This state is isolated and won't dispatch events to the main game
 * @param character The character data to include in the state (can be DeepReadonly)
 * @returns A State instance suitable for preview components
 */
export function createPreviewState(character: Partial<ICharacter> | DeepReadonly<ICharacter>): State {
    // Create a minimal state structure
    const stateData: IState = {
        game: {
            turn: character.player || 'preview',
            players: [character.player || 'preview']
        },
        map: [], // Empty map for preview
        characters: [{
            // Provide defaults for required fields
            name: character.name || 'preview',
            race: character.race || 'human',
            description: character.description || '',
            action: (character.action as Action) || 'idle',
            player: character.player || 'preview',
            position: character.position ? { ...character.position } : { x: 0, y: 0 },
            location: character.location || 'preview',
            blocker: false,
            direction: character.direction || 'down',
            path: [],
            palette: character.palette ? { ...character.palette } : {
                skin: 'white',
                helmet: 'black',
                suit: 'red'
            },
            inventory: character.inventory ? {
                items: [...(character.inventory.items || [])],
                maxWeight: character.inventory.maxWeight || 100,
                equippedWeapons: {
                    primary: character.inventory.equippedWeapons?.primary || null,
                    secondary: character.inventory.equippedWeapons?.secondary || null
                }
            } : {
                items: [],
                maxWeight: 100,
                equippedWeapons: {
                    primary: null,
                    secondary: null
                }
            },
            actions: character.actions || {
                pointsLeft: 100,
                general: { move: 10, talk: 10, use: 10, inventory: 5 },
                rangedCombat: { shoot: 20, aim: 15, overwatch: 25, cover: 10, throw: 15 },
                closeCombat: { powerStrike: 25, slash: 20, fastAttack: 15, feint: 10, breakGuard: 20 }
            },
            health: character.health ?? 100,
            maxHealth: character.maxHealth ?? 100
        }],
        messages: [],
        ui: {
            animations: { characters: {} },
            visualStates: { 
                characters: {}, 
                cells: {},
                board: {
                    mapWidth: 0,
                    mapHeight: 0,
                    hasPopupActive: false
                }
            },
            transientUI: { 
                popups: {}, 
                projectiles: [],
                highlights: {
                    reachableCells: [],
                    pathCells: [],
                    targetableCells: []
                }
            },
            interactionMode: { type: 'normal' },
            selectedCharacter: undefined
        },
        overwatchData: {}
    };
    
    return new State(stateData, true); // true = isPreview
}