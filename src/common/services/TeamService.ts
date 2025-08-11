import { ICharacter, ITeamConfiguration } from '../interfaces';
import { DeepReadonly } from '../helpers/types';

/**
 * Service for managing team relationships and determining alliances/hostilities
 */
export class TeamService {
    /**
     * Check if two characters are allied (on the same team or allied teams)
     */
    static areAllied(
        char1: DeepReadonly<ICharacter>,
        char2: DeepReadonly<ICharacter>,
        teams?: DeepReadonly<ITeamConfiguration>
    ): boolean {
        // If no team system is defined, fall back to player-based logic
        if (!teams || !char1.team || !char2.team) {
            return char1.player === char2.player;
        }

        // Same team = always allied
        if (char1.team === char2.team) {
            return true;
        }

        // Check if teams are explicitly allied
        const team1Config = teams[char1.team];
        if (team1Config?.allied?.includes(char2.team)) {
            return true;
        }

        // Check reverse alliance (team2 considers team1 an ally)
        const team2Config = teams[char2.team];
        if (team2Config?.allied?.includes(char1.team)) {
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
        teams?: DeepReadonly<ITeamConfiguration>
    ): boolean {
        // If no team system is defined, fall back to player-based logic
        if (!teams || !char1.team || !char2.team) {
            return char1.player !== char2.player;
        }

        // Same team = never hostile
        if (char1.team === char2.team) {
            return false;
        }

        // Check if teams are explicitly hostile
        const team1Config = teams[char1.team];
        if (team1Config?.hostile?.includes(char2.team)) {
            return true;
        }

        // Check reverse hostility (team2 considers team1 hostile)
        const team2Config = teams[char2.team];
        if (team2Config?.hostile?.includes(char1.team)) {
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
        teams?: DeepReadonly<ITeamConfiguration>
    ): boolean {
        return !this.areAllied(char1, char2, teams) && !this.areHostile(char1, char2, teams);
    }

    /**
     * Get all characters that are allied with the given character
     */
    static getAlliedCharacters(
        character: DeepReadonly<ICharacter>,
        allCharacters: DeepReadonly<ICharacter>[],
        teams?: DeepReadonly<ITeamConfiguration>
    ): DeepReadonly<ICharacter>[] {
        return allCharacters.filter(char => 
            char.name !== character.name && this.areAllied(character, char, teams)
        );
    }

    /**
     * Get all characters that are hostile to the given character
     */
    static getHostileCharacters(
        character: DeepReadonly<ICharacter>,
        allCharacters: DeepReadonly<ICharacter>[],
        teams?: DeepReadonly<ITeamConfiguration>
    ): DeepReadonly<ICharacter>[] {
        return allCharacters.filter(char => 
            char.name !== character.name && this.areHostile(character, char, teams)
        );
    }

    /**
     * Get the team configuration for a specific team
     */
    static getTeamConfig(teamId: string, teams?: DeepReadonly<ITeamConfiguration>) {
        return teams?.[teamId];
    }

    /**
     * Create default team configuration for single player mode
     */
    static createSinglePlayerTeams(): ITeamConfiguration {
        return {
            'player': {
                name: 'Player Team',
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
     * Create team configuration for multiplayer co-op mode
     */
    static createCoopTeams(): ITeamConfiguration {
        const teams: ITeamConfiguration = {
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

        return teams;
    }

    /**
     * Create team configuration for multiplayer PvP mode
     */
    static createPvPTeams(playerIds: string[]): ITeamConfiguration {
        const teams: ITeamConfiguration = {};
        
        // Each player gets their own team, hostile to all others
        playerIds.forEach(playerId => {
            teams[`team_${playerId}`] = {
                name: `${playerId}'s Team`,
                hostile: playerIds
                    .filter(id => id !== playerId)
                    .map(id => `team_${id}`),
                allied: []
            };
        });

        return teams;
    }

    /**
     * Create team configuration for team-based multiplayer
     */
    static createTeamMultiplayerTeams(teamAssignments: { [playerId: string]: string }): ITeamConfiguration {
        const teams: ITeamConfiguration = {};
        const uniqueTeams = [...new Set(Object.values(teamAssignments))];

        uniqueTeams.forEach(teamId => {
            teams[teamId] = {
                name: `Team ${teamId}`,
                hostile: uniqueTeams.filter(t => t !== teamId),
                allied: []
            };
        });

        return teams;
    }
}