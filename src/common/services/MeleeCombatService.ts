import type { DeepReadonly } from "../helpers/types";
import type { ICharacter, ICoord, IWeapon } from "../interfaces";

export type MeleeAttackType = 'power-strike' | 'slash' | 'fast-attack' | 'feint' | 'break-guard' | 'special';

export interface MeleeAttackOption {
    type: MeleeAttackType;
    displayName: string;
    angle: number;
    apCost: number;
    description: string;
}

export interface VisibleMeleeTarget {
    character: DeepReadonly<ICharacter>;
    distance: number;
    canAttack: boolean;
}

const MELEE_CONSTANTS = {
    DEFAULT_UNARMED_DAMAGE: 5,
    DEFAULT_UNARMED_RANGE: 1,
    BLOCK_DAMAGE_MULTIPLIER: 0,
    OPPOSITE_DAMAGE_MULTIPLIER: 1.0,
    ADJACENT_DAMAGE_MULTIPLIER: 0.33,
    TWO_AWAY_DAMAGE_MULTIPLIER: 0.66,
    UNARMED_DEFENSE_PENALTY: 2.0,
    WEAPON_CLASS_MODIFIERS: {
        'sword': { 'sword': 1.0, 'polearm': 0.8, 'knife': 1.2 },
        'polearm': { 'sword': 1.2, 'polearm': 1.0, 'knife': 1.4 },
        'knife': { 'sword': 0.8, 'polearm': 0.6, 'knife': 1.0 },
    } as Record<string, Record<string, number>>,
} as const;

export const MELEE_ATTACKS: MeleeAttackOption[] = [
    { type: 'power-strike', displayName: 'Power Strike', angle: 0, apCost: 20, description: 'Heavy overhead strike' },
    { type: 'slash', displayName: 'Slash', angle: 60, apCost: 20, description: 'Horizontal slash' },
    { type: 'fast-attack', displayName: 'Fast Attack', angle: 120, apCost: 15, description: 'Quick jab' },
    { type: 'break-guard', displayName: 'Break Guard', angle: 180, apCost: 20, description: 'Guard-breaking thrust' },
    { type: 'feint', displayName: 'Feint', angle: 240, apCost: 15, description: 'Deceptive attack' },
    { type: 'special', displayName: 'Special', angle: 300, apCost: 25, description: 'Unique weapon technique' },
];

/**
 * Service containing all melee combat business logic.
 * All methods are static to ensure no state is stored and logic remains pure.
 */
export class MeleeCombatService {
    /**
     * Get the melee weapon equipped by a character
     */
    static getMeleeWeapon(character: DeepReadonly<ICharacter>): DeepReadonly<IWeapon> | null {
        const primaryWeapon = character.inventory.equippedWeapons.primary;
        const secondaryWeapon = character.inventory.equippedWeapons.secondary;

        if (primaryWeapon?.category === 'melee') return primaryWeapon;
        if (secondaryWeapon?.category === 'melee') return secondaryWeapon;
        return null;
    }

    /**
     * Get the melee range for a character based on their weapon
     */
    static getMeleeRange(character: DeepReadonly<ICharacter>): number {
        const weapon = this.getMeleeWeapon(character);
        return weapon?.range || MELEE_CONSTANTS.DEFAULT_UNARMED_RANGE;
    }

    /**
     * Get the base damage for a character's melee attack
     */
    static getBaseDamage(character: DeepReadonly<ICharacter>): number {
        const weapon = this.getMeleeWeapon(character);
        return weapon?.damage || MELEE_CONSTANTS.DEFAULT_UNARMED_DAMAGE;
    }

    /**
     * Calculate the distance between two positions (Chebyshev distance)
     */
    static calculateDistance(pos1: ICoord, pos2: ICoord): number {
        const dx = Math.abs(pos1.x - pos2.x);
        const dy = Math.abs(pos1.y - pos2.y);
        return Math.max(dx, dy);
    }

    /**
     * Find all valid melee targets for an attacker
     */
    static findMeleeTargets(
        attacker: DeepReadonly<ICharacter>,
        characters: DeepReadonly<ICharacter[]>
    ): VisibleMeleeTarget[] {
        const range = this.getMeleeRange(attacker);
        const targets: VisibleMeleeTarget[] = [];

        for (const character of characters) {
            if (character.name === attacker.name) continue;
            if (character.health <= 0) continue;
            if (character.controller === attacker.controller) continue;

            const distance = this.calculateDistance(attacker.position, character.position);
            
            if (distance <= range) {
                targets.push({
                    character,
                    distance,
                    canAttack: true
                });
            }
        }

        return targets;
    }

    /**
     * Calculate damage multiplier based on attack and defense angles
     */
    static calculateDamageMultiplier(attackAngle: number, defenseAngle: number): number {
        let angleDiff = Math.abs(attackAngle - defenseAngle);
        if (angleDiff > 180) {
            angleDiff = 360 - angleDiff;
        }

        if (angleDiff === 0) {
            return MELEE_CONSTANTS.BLOCK_DAMAGE_MULTIPLIER;
        } else if (angleDiff === 180) {
            return MELEE_CONSTANTS.OPPOSITE_DAMAGE_MULTIPLIER;
        } else if (angleDiff <= 60) {
            return MELEE_CONSTANTS.ADJACENT_DAMAGE_MULTIPLIER;
        } else if (angleDiff <= 120) {
            return MELEE_CONSTANTS.TWO_AWAY_DAMAGE_MULTIPLIER;
        } else {
            return MELEE_CONSTANTS.OPPOSITE_DAMAGE_MULTIPLIER;
        }
    }

    /**
     * Calculate weapon class advantage modifier
     */
    static calculateWeaponModifier(
        attackerWeapon: DeepReadonly<IWeapon> | null,
        defenderWeapon: DeepReadonly<IWeapon> | null
    ): number {
        if (!attackerWeapon || !defenderWeapon) {
            return 1.0;
        }

        const attackerClass = attackerWeapon.class;
        const defenderClass = defenderWeapon.class;

        const modifiers = MELEE_CONSTANTS.WEAPON_CLASS_MODIFIERS[attackerClass as keyof typeof MELEE_CONSTANTS.WEAPON_CLASS_MODIFIERS];
        if (modifiers && defenderClass in modifiers) {
            return modifiers[defenderClass as keyof typeof modifiers] || 1.0;
        }

        return 1.0;
    }

    /**
     * Calculate the final damage for a melee attack
     */
    static calculateMeleeDamage(
        attacker: DeepReadonly<ICharacter>,
        defender: DeepReadonly<ICharacter>,
        attackType: MeleeAttackType,
        defenseType: MeleeAttackType
    ): { damage: number; blocked: boolean } {
        const baseDamage = this.getBaseDamage(attacker);
        const attackerWeapon = this.getMeleeWeapon(attacker);
        const defenderWeapon = this.getMeleeWeapon(defender);

        const attackAngle = MELEE_ATTACKS.find(a => a.type === attackType)?.angle || 0;
        const defenseAngle = MELEE_ATTACKS.find(a => a.type === defenseType)?.angle || 0;

        let damageMultiplier = this.calculateDamageMultiplier(attackAngle, defenseAngle);
        const blocked = damageMultiplier === 0;

        if (!defenderWeapon && !blocked) {
            damageMultiplier = MELEE_CONSTANTS.UNARMED_DEFENSE_PENALTY;
        }

        const weaponModifier = this.calculateWeaponModifier(attackerWeapon, defenderWeapon);

        const finalDamage = Math.round(baseDamage * damageMultiplier * weaponModifier);

        return { damage: finalDamage, blocked };
    }

    /**
     * Get attack option by type
     */
    static getAttackOption(attackType: MeleeAttackType): MeleeAttackOption | undefined {
        return MELEE_ATTACKS.find(a => a.type === attackType);
    }

    /**
     * Check if character can perform melee attack
     */
    static canPerformAttack(character: DeepReadonly<ICharacter>, attackType: MeleeAttackType): boolean {
        const attack = this.getAttackOption(attackType);
        if (!attack) return false;
        return character.actions.pointsLeft >= attack.apCost;
    }

    /**
     * Check if character is valid target
     */
    static isValidTarget(
        attacker: DeepReadonly<ICharacter>, 
        target: DeepReadonly<ICharacter>
    ): boolean {
        if (target.name === attacker.name) return false;
        if (target.health <= 0) return false;
        if (target.controller === attacker.controller) return false;
        
        const distance = this.calculateDistance(attacker.position, target.position);
        const range = this.getMeleeRange(attacker);
        
        return distance <= range;
    }
}