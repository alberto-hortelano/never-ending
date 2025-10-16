import type { ICharacter, ICoord } from '../interfaces';
import type { DeepReadonly } from '../helpers/types';
import type { State } from '../State';
import { AISpatialUtils } from './AISpatialUtils';
import { FactionService } from './FactionService';

export interface ThreatAssessment {
    character: DeepReadonly<ICharacter>;
    threatLevel: number; // 0-100
    distance: number;
    hasLineOfSight: boolean;
    isInCover: boolean;
    weaponEffectiveness: number; // 0-100
}

/**
 * Analyzes threats from visible enemies and assesses danger levels
 */
export class ThreatAnalyzer {
    /**
     * Assess threats from visible enemies
     */
    public static assessThreats(
        character: DeepReadonly<ICharacter>,
        visibleCharacters: DeepReadonly<ICharacter>[],
        state: State,
        currentDirective?: { priority_targets?: string[] }
    ): ThreatAssessment[] {
        const threats: ThreatAssessment[] = [];

        for (const other of visibleCharacters) {
            // Skip allies and defeated characters
            const areAllied = FactionService.areAllied(character, other, state.game.factions);

            if (areAllied || other.health <= 0) {
                continue;
            }

            const distance = this.getDistance(character.position, other.position);
            const hasLineOfSight = this.checkLineOfSight(character.position, other.position, state);

            // Calculate threat level based on multiple factors
            let threatLevel = 50; // Base threat

            // Health factor
            const healthRatio = other.health / other.maxHealth;
            threatLevel += healthRatio * 20;

            // Distance factor (closer = more threatening)
            if (distance <= 2) threatLevel += 30;
            else if (distance <= 5) threatLevel += 20;
            else if (distance <= 10) threatLevel += 10;

            // Weapon factor (check if they have ranged weapons)
            const hasRangedWeapon = this.characterHasRangedWeapon(other);
            if (hasRangedWeapon) threatLevel += 20;

            // Line of sight factor
            if (!hasLineOfSight) threatLevel -= 20;

            // Priority target bonus
            if (currentDirective?.priority_targets?.includes(other.name)) {
                threatLevel += 30;
            }

            threats.push({
                character: other,
                threatLevel: Math.min(100, Math.max(0, threatLevel)),
                distance,
                hasLineOfSight,
                isInCover: this.isInCover(other.position, state),
                weaponEffectiveness: this.calculateWeaponEffectiveness(character, other, distance)
            });
        }

        return threats.sort((a, b) => b.threatLevel - a.threatLevel);
    }

    /**
     * Calculate Euclidean distance between two positions
     */
    private static getDistance(pos1: ICoord, pos2: ICoord): number {
        return AISpatialUtils.getDistance(pos1, pos2);
    }

    /**
     * Check if there's a clear line of sight between two positions
     */
    private static checkLineOfSight(from: ICoord, to: ICoord, state: State): boolean {
        return AISpatialUtils.checkLineOfSight(from, to, state.map, state.characters);
    }

    /**
     * Check if a character has a ranged weapon equipped
     */
    private static characterHasRangedWeapon(character: DeepReadonly<ICharacter>): boolean {
        const primary = character.inventory?.equippedWeapons?.primary;
        const secondary = character.inventory?.equippedWeapons?.secondary;
        return (primary?.category === 'ranged') || (secondary?.category === 'ranged');
    }

    /**
     * Check if a position has cover (adjacent walls/obstacles)
     */
    private static isInCover(_position: ICoord, _state: State): boolean {
        // Check if position has adjacent walls/obstacles
        // Simplified for now
        return false;
    }

    /**
     * Calculate weapon effectiveness against a target at a given distance
     */
    private static calculateWeaponEffectiveness(
        attacker: DeepReadonly<ICharacter>,
        _target: DeepReadonly<ICharacter>,
        distance: number
    ): number {
        const hasRanged = this.characterHasRangedWeapon(attacker);

        if (distance <= 1.5) {
            return 90; // Melee range, very effective
        } else if (hasRanged) {
            if (distance <= 5) return 80;
            if (distance <= 10) return 60;
            if (distance <= 15) return 40;
        }

        return 10; // Out of effective range
    }
}
