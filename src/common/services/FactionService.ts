import { ICharacter, IFactionConfiguration } from '../interfaces';
import { DeepReadonly } from '../helpers/types';

/**
 * Service for managing faction relationships and determining alliances/hostilities
 */
export class FactionService {
    /**
     * Check if two characters are allied (on the same faction or allied factions)
     */
    static areAllied(
        char1: DeepReadonly<ICharacter>,
        char2: DeepReadonly<ICharacter>,
        factions?: DeepReadonly<IFactionConfiguration>
    ): boolean {
        // If no faction system is defined, fall back to controller-based logic
        if (!factions || !char1.faction || !char2.faction) {
            return char1.controller === char2.controller;
        }

        // Same faction = always allied
        if (char1.faction === char2.faction) {
            return true;
        }

        // Check if factions are explicitly allied
        const faction1Config = factions[char1.faction];
        if (faction1Config?.allied?.includes(char2.faction)) {
            return true;
        }

        // Check reverse alliance (faction2 considers faction1 an ally)
        const faction2Config = factions[char2.faction];
        if (faction2Config?.allied?.includes(char1.faction)) {
            return true;
        }

        return false;
    }

    /**
     * Check if two characters are hostile to each other
     */
    static areHostile(
        char1: DeepReadonly<ICharacter>,
        char2: DeepReadonly<ICharacter>,
        factions?: DeepReadonly<IFactionConfiguration>
    ): boolean {
        // If no faction system is defined, fall back to controller-based logic
        if (!factions || !char1.faction || !char2.faction) {
            return char1.controller !== char2.controller;
        }

        // Same faction = never hostile
        if (char1.faction === char2.faction) {
            return false;
        }

        // Check if factions are explicitly hostile
        const faction1Config = factions[char1.faction];
        if (faction1Config?.hostile?.includes(char2.faction)) {
            return true;
        }

        // Check reverse hostility (faction2 considers faction1 hostile)
        const faction2Config = factions[char2.faction];
        if (faction2Config?.hostile?.includes(char1.faction)) {
            return true;
        }

        return false;
    }

    /**
     * Check if two characters are neutral (neither allied nor hostile)
     */
    static areNeutral(
        char1: DeepReadonly<ICharacter>,
        char2: DeepReadonly<ICharacter>,
        factions?: DeepReadonly<IFactionConfiguration>
    ): boolean {
        return !this.areAllied(char1, char2, factions) && !this.areHostile(char1, char2, factions);
    }

    /**
     * Get all characters that are allied with the given character
     */
    static getAlliedCharacters(
        character: DeepReadonly<ICharacter>,
        allCharacters: DeepReadonly<ICharacter>[],
        factions?: DeepReadonly<IFactionConfiguration>
    ): DeepReadonly<ICharacter>[] {
        return allCharacters.filter(char => 
            char.name !== character.name && this.areAllied(character, char, factions)
        );
    }

    /**
     * Get all characters that are hostile to the given character
     */
    static getHostileCharacters(
        character: DeepReadonly<ICharacter>,
        allCharacters: DeepReadonly<ICharacter>[],
        factions?: DeepReadonly<IFactionConfiguration>
    ): DeepReadonly<ICharacter>[] {
        return allCharacters.filter(char => 
            char.name !== character.name && this.areHostile(character, char, factions)
        );
    }

    /**
     * Get the faction configuration for a specific faction
     */
    static getFactionConfig(factionId: string, factions?: DeepReadonly<IFactionConfiguration>) {
        return factions?.[factionId];
    }

    /**
     * Create default faction configuration for single player mode
     */
    static createSinglePlayerFactions(): IFactionConfiguration {
        return {
            'player': {
                name: 'Player Faction',
                hostile: ['enemy'],
                allied: []
            },
            'enemy': {
                name: 'Enemy Forces',
                hostile: ['player'],
                allied: []
            },
            'neutral': {
                name: 'Neutral',
                hostile: [],
                allied: []
            }
        };
    }

    /**
     * Create faction configuration for multiplayer co-op mode
     */
    static createCoopFactions(): IFactionConfiguration {
        const factions: IFactionConfiguration = {
            'players': {
                name: 'Allied Forces',
                hostile: ['enemy'],
                allied: []
            },
            'enemy': {
                name: 'Enemy Forces',
                hostile: ['players'],
                allied: []
            }
        };

        return factions;
    }

    /**
     * Create faction configuration for multiplayer PvP mode
     */
    static createPvPFactions(playerIds: string[]): IFactionConfiguration {
        const factions: IFactionConfiguration = {};
        
        // Each player gets their own faction, hostile to all others
        playerIds.forEach(playerId => {
            factions[`faction_${playerId}`] = {
                name: `${playerId}'s Faction`,
                hostile: playerIds
                    .filter(id => id !== playerId)
                    .map(id => `faction_${id}`),
                allied: []
            };
        });

        return factions;
    }

    /**
     * Create faction configuration for faction-based multiplayer
     */
    static createFactionMultiplayerFactions(factionAssignments: { [playerId: string]: string }): IFactionConfiguration {
        const factions: IFactionConfiguration = {};
        const uniqueFactions = [...new Set(Object.values(factionAssignments))];

        uniqueFactions.forEach(factionId => {
            factions[factionId] = {
                name: `Faction ${factionId}`,
                hostile: uniqueFactions.filter(t => t !== factionId),
                allied: []
            };
        });

        return factions;
    }
}