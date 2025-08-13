import { DeepReadonly } from '../helpers/types';
import { ICharacter } from '../interfaces';

export type StanceType = 'aggressive' | 'defensive' | 'flanking' | 'suppressive' | 'retreating' | 'patrol';

export interface StanceDefinition {
    name: StanceType;
    description: string;
    priorities: {
        attack: number;
        defense: number;
        movement: number;
        support: number;
    };
    preferredRange: 'close' | 'medium' | 'long';
    retreatThreshold: number; // Health percentage to consider retreat
    aggressionLevel: number; // 0-100, how likely to attack vs defend
    coordinationLevel: number; // 0-100, how much to consider ally positions
}

export interface StanceTransition {
    from: StanceType;
    to: StanceType;
    condition: (character: DeepReadonly<ICharacter>, situation: CombatSituation) => boolean;
    priority: number;
}

export interface CombatSituation {
    enemiesVisible: number;
    alliesNearby: number;
    healthPercent: number;
    ammoPercent: number;
    inCover: boolean;
    objectiveDistance: number;
    underFire: boolean;
    enemiesClosing: boolean;
}

export class CombatStances {
    private static stances: Map<StanceType, StanceDefinition> = new Map();
    private static transitions: StanceTransition[] = [];
    private static initialized = false;

    /**
     * Initialize combat stances with their definitions
     */
    public static initialize(): void {
        if (this.initialized) return;

        // Define stances
        this.defineStance({
            name: 'aggressive',
            description: 'Close distance and maximize damage output',
            priorities: {
                attack: 90,
                defense: 20,
                movement: 70,
                support: 10
            },
            preferredRange: 'close',
            retreatThreshold: 0.2,
            aggressionLevel: 90,
            coordinationLevel: 30
        });

        this.defineStance({
            name: 'defensive',
            description: 'Hold position, use cover, minimize exposure',
            priorities: {
                attack: 50,
                defense: 90,
                movement: 30,
                support: 40
            },
            preferredRange: 'medium',
            retreatThreshold: 0.4,
            aggressionLevel: 30,
            coordinationLevel: 50
        });

        this.defineStance({
            name: 'flanking',
            description: 'Maneuver to attack from unexpected angles',
            priorities: {
                attack: 70,
                defense: 40,
                movement: 90,
                support: 30
            },
            preferredRange: 'medium',
            retreatThreshold: 0.3,
            aggressionLevel: 60,
            coordinationLevel: 80
        });

        this.defineStance({
            name: 'suppressive',
            description: 'Pin enemies with overwatch and covering fire',
            priorities: {
                attack: 60,
                defense: 60,
                movement: 20,
                support: 80
            },
            preferredRange: 'long',
            retreatThreshold: 0.35,
            aggressionLevel: 50,
            coordinationLevel: 70
        });

        this.defineStance({
            name: 'retreating',
            description: 'Fall back to safety while defending',
            priorities: {
                attack: 20,
                defense: 70,
                movement: 90,
                support: 20
            },
            preferredRange: 'long',
            retreatThreshold: 0.6,
            aggressionLevel: 10,
            coordinationLevel: 40
        });

        this.defineStance({
            name: 'patrol',
            description: 'Search area, investigate, maintain awareness',
            priorities: {
                attack: 40,
                defense: 50,
                movement: 60,
                support: 50
            },
            preferredRange: 'medium',
            retreatThreshold: 0.5,
            aggressionLevel: 40,
            coordinationLevel: 60
        });

        // Define stance transitions
        this.defineTransitions();
        
        this.initialized = true;
    }

    /**
     * Define automatic stance transitions based on conditions
     */
    private static defineTransitions(): void {
        // Aggressive -> Retreating when health is low
        this.addTransition({
            from: 'aggressive',
            to: 'retreating',
            condition: (_char, sit) => sit.healthPercent < 0.3,
            priority: 90
        });

        // Defensive -> Aggressive when enemies are very close
        this.addTransition({
            from: 'defensive',
            to: 'aggressive',
            condition: (_char, sit) => sit.enemiesVisible > 0 && sit.objectiveDistance < 3,
            priority: 70
        });

        // Defensive -> Retreating when overwhelmed
        this.addTransition({
            from: 'defensive',
            to: 'retreating',
            condition: (_char, sit) => sit.enemiesVisible > 2 && sit.healthPercent < 0.5,
            priority: 80
        });

        // Flanking -> Aggressive when in position
        this.addTransition({
            from: 'flanking',
            to: 'aggressive',
            condition: (_char, sit) => sit.objectiveDistance < 5 && !sit.underFire,
            priority: 60
        });

        // Patrol -> Defensive when enemies spotted
        this.addTransition({
            from: 'patrol',
            to: 'defensive',
            condition: (_char, sit) => sit.enemiesVisible > 0,
            priority: 75
        });

        // Patrol -> Aggressive when enemy is alone and close
        this.addTransition({
            from: 'patrol',
            to: 'aggressive',
            condition: (_char, sit) => sit.enemiesVisible === 1 && sit.objectiveDistance < 7,
            priority: 65
        });

        // Retreating -> Defensive when safe
        this.addTransition({
            from: 'retreating',
            to: 'defensive',
            condition: (_char, sit) => sit.healthPercent > 0.5 && sit.inCover && !sit.underFire,
            priority: 50
        });

        // Suppressive -> Flanking when allies are engaging
        this.addTransition({
            from: 'suppressive',
            to: 'flanking',
            condition: (_char, sit) => sit.alliesNearby > 1 && sit.enemiesVisible > 0,
            priority: 55
        });

        // Any -> Retreating when critically wounded
        for (const stance of ['aggressive', 'defensive', 'flanking', 'suppressive', 'patrol'] as StanceType[]) {
            this.addTransition({
                from: stance,
                to: 'retreating',
                condition: (_char, sit) => sit.healthPercent < 0.2,
                priority: 100
            });
        }
    }

    /**
     * Get stance definition
     */
    public static getStance(stance: StanceType): StanceDefinition | undefined {
        if (!this.initialized) this.initialize();
        return this.stances.get(stance);
    }

    /**
     * Evaluate if stance should change based on situation
     */
    public static evaluateStanceChange(
        currentStance: StanceType,
        character: DeepReadonly<ICharacter>,
        situation: CombatSituation
    ): StanceType {
        if (!this.initialized) this.initialize();

        // Find applicable transitions from current stance
        const applicableTransitions = this.transitions
            .filter(t => t.from === currentStance && t.condition(character, situation))
            .sort((a, b) => b.priority - a.priority);

        // Return highest priority transition or current stance
        return applicableTransitions[0]?.to || currentStance;
    }

    /**
     * Get recommended action priorities for a stance
     */
    public static getActionPriorities(stance: StanceType): StanceDefinition['priorities'] {
        const stanceData = this.getStance(stance);
        return stanceData?.priorities || {
            attack: 50,
            defense: 50,
            movement: 50,
            support: 50
        };
    }

    /**
     * Calculate stance effectiveness in current situation
     */
    public static calculateStanceEffectiveness(
        stance: StanceType,
        situation: CombatSituation
    ): number {
        const stanceData = this.getStance(stance);
        if (!stanceData) return 50;

        let effectiveness = 50;

        // Aggressive stance effectiveness
        if (stance === 'aggressive') {
            if (situation.enemiesVisible === 1) effectiveness += 20;
            if (situation.objectiveDistance < 5) effectiveness += 15;
            if (situation.healthPercent > 0.7) effectiveness += 10;
            if (situation.enemiesVisible > 2) effectiveness -= 20;
            if (situation.healthPercent < 0.4) effectiveness -= 30;
        }

        // Defensive stance effectiveness
        if (stance === 'defensive') {
            if (situation.inCover) effectiveness += 25;
            if (situation.enemiesVisible > 1) effectiveness += 15;
            if (situation.healthPercent < 0.5) effectiveness += 20;
            if (situation.enemiesVisible === 0) effectiveness -= 20;
        }

        // Flanking stance effectiveness
        if (stance === 'flanking') {
            if (situation.alliesNearby > 0) effectiveness += 25;
            if (situation.enemiesVisible === 1) effectiveness += 20;
            if (!situation.underFire) effectiveness += 15;
            if (situation.enemiesVisible > 2) effectiveness -= 15;
        }

        // Suppressive stance effectiveness
        if (stance === 'suppressive') {
            if (situation.inCover) effectiveness += 20;
            if (situation.alliesNearby > 0) effectiveness += 20;
            if (situation.ammoPercent > 0.5) effectiveness += 15;
            if (situation.enemiesClosing) effectiveness -= 20;
        }

        // Retreating stance effectiveness
        if (stance === 'retreating') {
            if (situation.healthPercent < 0.3) effectiveness += 40;
            if (situation.enemiesVisible > 2) effectiveness += 20;
            if (situation.underFire) effectiveness += 15;
            if (situation.enemiesVisible === 0) effectiveness -= 30;
        }

        // Patrol stance effectiveness
        if (stance === 'patrol') {
            if (situation.enemiesVisible === 0) effectiveness += 30;
            if (situation.healthPercent > 0.8) effectiveness += 15;
            if (situation.enemiesVisible > 0) effectiveness -= 40;
        }

        return Math.max(0, Math.min(100, effectiveness));
    }

    /**
     * Get stance behavior modifiers
     */
    public static getBehaviorModifiers(stance: StanceType): {
        moveSpeed: number;
        accuracy: number;
        awareness: number;
        riskTolerance: number;
    } {
        const modifiers = {
            aggressive: {
                moveSpeed: 1.2,
                accuracy: 0.9,
                awareness: 0.8,
                riskTolerance: 1.5
            },
            defensive: {
                moveSpeed: 0.7,
                accuracy: 1.1,
                awareness: 1.2,
                riskTolerance: 0.5
            },
            flanking: {
                moveSpeed: 1.1,
                accuracy: 1.0,
                awareness: 1.1,
                riskTolerance: 1.0
            },
            suppressive: {
                moveSpeed: 0.5,
                accuracy: 1.2,
                awareness: 1.3,
                riskTolerance: 0.7
            },
            retreating: {
                moveSpeed: 1.3,
                accuracy: 0.7,
                awareness: 0.9,
                riskTolerance: 0.3
            },
            patrol: {
                moveSpeed: 0.9,
                accuracy: 1.0,
                awareness: 1.4,
                riskTolerance: 0.8
            }
        };

        return modifiers[stance] || {
            moveSpeed: 1.0,
            accuracy: 1.0,
            awareness: 1.0,
            riskTolerance: 1.0
        };
    }

    /**
     * Helper method to define a stance
     */
    private static defineStance(stance: StanceDefinition): void {
        this.stances.set(stance.name, stance);
    }

    /**
     * Helper method to add a transition
     */
    private static addTransition(transition: StanceTransition): void {
        this.transitions.push(transition);
    }

    /**
     * Get description for a stance
     */
    public static getStanceDescription(stance: StanceType): string {
        const stanceData = this.getStance(stance);
        return stanceData?.description || 'Unknown stance';
    }

    /**
     * Analyze situation from character perspective
     */
    public static analyzeSituation(
        character: DeepReadonly<ICharacter>,
        visibleEnemies: DeepReadonly<ICharacter>[],
        visibleAllies: DeepReadonly<ICharacter>[],
        inCover: boolean,
        targetPosition?: { x: number; y: number }
    ): CombatSituation {
        const healthPercent = character.health / character.maxHealth;
        
        // Calculate ammo (simplified - check if has ranged weapon)
        const hasRangedWeapon = character.inventory?.equippedWeapons?.primary?.category === 'ranged' ||
                                character.inventory?.equippedWeapons?.secondary?.category === 'ranged';
        const ammoPercent = hasRangedWeapon ? 0.75 : 0; // Simplified ammo tracking
        
        // Check if under fire (enemies within attack range)
        const underFire = visibleEnemies.some(enemy => {
            const distance = Math.sqrt(
                Math.pow(enemy.position.x - character.position.x, 2) +
                Math.pow(enemy.position.y - character.position.y, 2)
            );
            return distance <= 10; // Typical weapon range
        });
        
        // Check if enemies are closing distance
        const enemiesClosing = visibleEnemies.filter(enemy => {
            const distance = Math.sqrt(
                Math.pow(enemy.position.x - character.position.x, 2) +
                Math.pow(enemy.position.y - character.position.y, 2)
            );
            return distance <= 5;
        }).length > 0;
        
        // Calculate objective distance
        let objectiveDistance = 999;
        if (targetPosition) {
            objectiveDistance = Math.sqrt(
                Math.pow(targetPosition.x - character.position.x, 2) +
                Math.pow(targetPosition.y - character.position.y, 2)
            );
        } else if (visibleEnemies.length > 0) {
            // Use closest enemy as objective
            objectiveDistance = Math.min(...visibleEnemies.map(enemy => 
                Math.sqrt(
                    Math.pow(enemy.position.x - character.position.x, 2) +
                    Math.pow(enemy.position.y - character.position.y, 2)
                )
            ));
        }
        
        return {
            enemiesVisible: visibleEnemies.length,
            alliesNearby: visibleAllies.filter(ally => {
                const distance = Math.sqrt(
                    Math.pow(ally.position.x - character.position.x, 2) +
                    Math.pow(ally.position.y - character.position.y, 2)
                );
                return distance <= 10;
            }).length,
            healthPercent,
            ammoPercent,
            inCover,
            objectiveDistance,
            underFire,
            enemiesClosing
        };
    }
}