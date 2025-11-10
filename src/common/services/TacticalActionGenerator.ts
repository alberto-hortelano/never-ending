import type { ICharacter, ICoord } from '../interfaces';
import type { DeepReadonly } from '../helpers/types';
import type { State } from '../State';
import type { ThreatAssessment } from './ThreatAnalyzer';
import type { PositionEvaluation } from './PositionEvaluator';
import { AICommand } from './AICommandParser';
import { FactionService } from './FactionService';
import { PositionEvaluator } from './PositionEvaluator';
import { AISpatialUtils } from './AISpatialUtils';

export interface TacticalDirective {
    type: 'tactical_directive';
    objective: 'attack' | 'defend' | 'patrol' | 'pursue' | 'retreat' | 'support';
    priority_targets?: string[];
    tactics: {
        stance: 'aggressive' | 'defensive' | 'flanking' | 'suppressive' | 'retreating';
        engagement_range: 'close' | 'medium' | 'long';
        retreat_threshold: number; // Health percentage to retreat at
        coordination?: 'individual' | 'flanking' | 'concentrated' | 'dispersed';
    };
    position?: ICoord; // Optional position to defend or move to
}

export interface TacticalAction {
    type: 'movement' | 'attack' | 'overwatch' | 'speech' | 'reload' | 'heal';
    priority: number; // 0-100, higher is better
    command: AICommand;
    reasoning: string;
}

/**
 * Generates possible tactical actions based on situation and directive
 */
export class TacticalActionGenerator {
    /**
     * Generate possible actions based on current situation
     */
    public static generateActions(
        character: DeepReadonly<ICharacter>,
        threats: ThreatAssessment[],
        currentPositionValue: PositionEvaluation,
        directive: TacticalDirective,
        state: State,
        turnActions: Map<string, string[]>
    ): TacticalAction[] {
        const actions: TacticalAction[] = [];
        const stance = directive.tactics.stance;
        const primaryThreat = threats[0];

        // Check health for retreat threshold
        const healthPercent = character.health / character.maxHealth;
        const shouldRetreat = healthPercent <= directive.tactics.retreat_threshold;

        // Generate actions based on stance
        switch (stance) {
            case 'aggressive':
                actions.push(...this.generateAggressiveActions(character, threats, state, directive.position));
                break;
            case 'defensive':
                actions.push(...this.generateDefensiveActions(character, threats, currentPositionValue, state, turnActions));
                break;
            case 'flanking':
                actions.push(...this.generateFlankingActions(character, threats, state, directive.position));
                break;
            case 'suppressive':
                actions.push(...this.generateSuppressiveActions(character, threats, state));
                break;
            case 'retreating':
                actions.push(...this.generateRetreatActions(character, threats, state));
                break;
            default:
                // If no specific stance, generate basic actions based on threats
                if (threats.length > 0) {
                    actions.push(...this.generateDefensiveActions(character, threats, currentPositionValue, state, turnActions));
                }
                break;
        }

        // Always consider retreat if health is critical
        if (shouldRetreat && stance !== 'retreating') {
            actions.push(...this.generateRetreatActions(character, threats, state));
        }

        // Add speech action if no immediate threats and near allies
        if (threats.length === 0 || (primaryThreat && primaryThreat.distance > 10)) {
            const nearbyAlly = this.findNearbyAlly(character, state);
            if (nearbyAlly && AISpatialUtils.getDistance(character.position, nearbyAlly.position) <= 3) {
                actions.push(this.createSpeechAction(character, nearbyAlly));
            }
        }

        return actions;
    }

    /**
     * Generate aggressive stance actions
     */
    private static generateAggressiveActions(
        character: DeepReadonly<ICharacter>,
        threats: ThreatAssessment[],
        state: State,
        directivePosition?: ICoord
    ): TacticalAction[] {
        const actions: TacticalAction[] = [];
        const primaryThreat = threats[0];

        if (!primaryThreat) {
            // No threats, move toward objective or patrol
            return [this.createPatrolAction(character, state, directivePosition)];
        }

        const distance = primaryThreat.distance;

        // Close combat if very close
        if (distance <= 1.5) {
            actions.push({
                type: 'attack',
                priority: 90,
                command: {
                    type: 'attack',
                    characters: [{
                        name: character.name,
                        target: primaryThreat.character.name,
                    }]
                },
                reasoning: 'Enemy adjacent - melee attack'
            });
        }

        // Ranged attack if in range - always allow if we have line of sight
        if (primaryThreat.hasLineOfSight) {
            const weaponBonus = this.characterHasRangedWeapon(character) ? 20 : 0;
            const rangePenalty = distance > 10 ? -10 : 0;
            actions.push({
                type: 'attack',
                priority: 80 + weaponBonus + rangePenalty,
                command: {
                    type: 'attack',
                    characters: [{
                        name: character.name,
                        target: primaryThreat.character.name,
                    }]
                },
                reasoning: `Attacking ${primaryThreat.character.name} at distance ${distance.toFixed(1)}`
            });
        } else if (distance <= 15) {
            // Close enough but no line of sight - prioritize movement
            actions.push({
                type: 'movement',
                priority: 85,
                command: {
                    type: 'movement',
                    characters: [{
                        name: character.name,
                        location: primaryThreat.character.name
                    }]
                },
                reasoning: `Moving to get clear shot at ${primaryThreat.character.name}`
            });
        }

        // Always provide movement option
        actions.push({
            type: 'movement',
            priority: distance > 5 ? 75 : 60,
            command: {
                type: 'movement',
                characters: [{
                    name: character.name,
                    location: primaryThreat.character.name
                }]
            },
            reasoning: distance > 5 ? 'Closing distance to target' : 'Maneuvering for better position'
        });

        return actions;
    }

    /**
     * Generate defensive stance actions
     */
    private static generateDefensiveActions(
        character: DeepReadonly<ICharacter>,
        threats: ThreatAssessment[],
        currentPositionValue: PositionEvaluation,
        state: State,
        turnActions: Map<string, string[]>
    ): TacticalAction[] {
        const actions: TacticalAction[] = [];
        const primaryThreat = threats[0];


        // Take cover if exposed
        if (currentPositionValue.exposureRisk > 60) {
            const coverPosition = PositionEvaluator.findBestCoverPosition(character, threats, state);
            if (coverPosition) {
                actions.push({
                    type: 'movement',
                    priority: 85,
                    command: {
                        type: 'movement',
                        characters: [{
                            name: character.name,
                            location: `${coverPosition.x},${coverPosition.y}`
                        }]
                    },
                    reasoning: 'Moving to cover'
                });
            }
        }

        // Always allow attacking if there's a threat
        if (primaryThreat) {
            // Shoot if enemy is in range and we have line of sight
            if (primaryThreat.hasLineOfSight) {
                const attackPriority = primaryThreat.distance <= 5 ? 80 : 70;
                actions.push({
                    type: 'attack',
                    priority: attackPriority,
                    command: {
                        type: 'attack',
                        characters: [{
                            name: character.name,
                            target: primaryThreat.character.name,
                            }]
                    },
                    reasoning: `Defending against ${primaryThreat.character.name} at distance ${primaryThreat.distance.toFixed(1)}`
                });
            } else {
                // No line of sight - need to move to get a clear shot
                actions.push({
                    type: 'movement',
                    priority: 75,
                    command: {
                        type: 'movement',
                        characters: [{
                            name: character.name,
                            location: primaryThreat.character.name
                        }]
                    },
                    reasoning: `Moving to get clear shot at ${primaryThreat.character.name}`
                });
            }

            // Move closer if too far to attack effectively
            if (primaryThreat.distance > 10 && !primaryThreat.hasLineOfSight) {
                actions.push({
                    type: 'movement',
                    priority: 60,
                    command: {
                        type: 'movement',
                        characters: [{
                            name: character.name,
                            location: primaryThreat.character.name
                        }]
                    },
                    reasoning: 'Moving to engagement range'
                });
            }
        }

        // Overwatch only if we haven't attacked this turn and have enough points
        const turnActionsList = turnActions.get(character.name) || [];
        const hasAttackedThisTurn = turnActionsList.includes('attack');
        const pointsLeft = character.actions?.pointsLeft || 0;

        if (!hasAttackedThisTurn && pointsLeft >= 40) {
            actions.push({
                type: 'overwatch',
                priority: 50,
                command: {
                    type: 'attack',
                    characters: [{
                        name: character.name,
                        target: primaryThreat?.character.name || 'area',
                    }]
                },
                reasoning: 'Setting defensive overwatch'
            });
        }

        return actions;
    }

    /**
     * Generate flanking actions
     */
    private static generateFlankingActions(
        character: DeepReadonly<ICharacter>,
        threats: ThreatAssessment[],
        state: State,
        directivePosition?: ICoord
    ): TacticalAction[] {
        const actions: TacticalAction[] = [];
        const primaryThreat = threats[0];

        if (!primaryThreat) {
            return [this.createPatrolAction(character, state, directivePosition)];
        }

        // Find flanking position
        const flankPosition = PositionEvaluator.findFlankingPosition(character, primaryThreat.character, state);

        if (flankPosition) {
            const distanceToFlank = AISpatialUtils.getDistance(character.position, flankPosition);

            // Move to flank if not already there
            if (distanceToFlank > 1) {
                actions.push({
                    type: 'movement',
                    priority: 80,
                    command: {
                        type: 'movement',
                        characters: [{
                            name: character.name,
                            location: `${flankPosition.x},${flankPosition.y}`
                        }]
                    },
                    reasoning: 'Moving to flanking position'
                });
            }

            // Attack from flank if in position
            if (distanceToFlank <= 1 && primaryThreat.hasLineOfSight) {
                actions.push({
                    type: 'attack',
                    priority: 85,
                    command: {
                        type: 'attack',
                        characters: [{
                            name: character.name,
                            target: primaryThreat.character.name,
                            }]
                    },
                    reasoning: 'Attacking from flanking position'
                });
            }
        }

        return actions;
    }

    /**
     * Generate suppressive fire actions
     */
    private static generateSuppressiveActions(
        character: DeepReadonly<ICharacter>,
        threats: ThreatAssessment[],
        state: State
    ): TacticalAction[] {
        const actions: TacticalAction[] = [];

        // Find good overwatch position
        const overwatchPosition = PositionEvaluator.findBestOverwatchPosition(character, threats, state);

        if (overwatchPosition && AISpatialUtils.getDistance(character.position, overwatchPosition) > 1) {
            actions.push({
                type: 'movement',
                priority: 70,
                command: {
                    type: 'movement',
                    characters: [{
                        name: character.name,
                        location: `${overwatchPosition.x},${overwatchPosition.y}`
                    }]
                },
                reasoning: 'Moving to overwatch position'
            });
        }

        // Set overwatch
        actions.push({
            type: 'overwatch',
            priority: 80,
            command: {
                type: 'attack',
                characters: [{
                    name: character.name,
                    target: threats[0]?.character.name || 'area',
                    attack: 'hold'
                }]
            },
            reasoning: 'Providing suppressive overwatch'
        });

        return actions;
    }

    /**
     * Generate retreat actions
     */
    private static generateRetreatActions(
        character: DeepReadonly<ICharacter>,
        threats: ThreatAssessment[],
        state: State
    ): TacticalAction[] {
        const actions: TacticalAction[] = [];

        // Find retreat position away from threats
        const retreatPosition = PositionEvaluator.findRetreatPosition(character, threats, state);

        if (retreatPosition) {
            actions.push({
                type: 'movement',
                priority: 95, // High priority for retreat when needed
                command: {
                    type: 'movement',
                    characters: [{
                        name: character.name,
                        location: `${retreatPosition.x},${retreatPosition.y}`
                    }]
                },
                reasoning: `Retreating (health: ${Math.round(character.health/character.maxHealth * 100)}%)`
            });
        }

        // Defensive action while retreating
        if (threats[0] && threats[0].distance <= 5) {
            actions.push({
                type: 'attack',
                priority: 60,
                command: {
                    type: 'attack',
                    characters: [{
                        name: character.name,
                        target: threats[0].character.name,
                    }]
                },
                reasoning: 'Fighting retreat'
            });
        }

        return actions;
    }

    /**
     * Get default tactical directive
     */
    public static getDefaultDirective(): TacticalDirective {
        return {
            type: 'tactical_directive',
            objective: 'defend',
            tactics: {
                stance: 'defensive',
                engagement_range: 'medium',
                retreat_threshold: 0.3,
                coordination: 'individual'
            }
        };
    }

    // Helper methods

    /**
     * Check if a character has a ranged weapon equipped
     */
    private static characterHasRangedWeapon(character: DeepReadonly<ICharacter>): boolean {
        const primary = character.inventory?.equippedWeapons?.primary;
        const secondary = character.inventory?.equippedWeapons?.secondary;
        return (primary?.category === 'ranged') || (secondary?.category === 'ranged');
    }

    /**
     * Find a nearby ally for coordination
     */
    private static findNearbyAlly(character: DeepReadonly<ICharacter>, state: State): DeepReadonly<ICharacter> | null {
        for (const other of state.characters) {
            if (other.name !== character.name &&
                FactionService.areAllied(character, other, state.game.factions) &&
                other.health > 0) {
                return other;
            }
        }
        return null;
    }

    /**
     * Create a speech action for coordination
     */
    private static createSpeechAction(
        character: DeepReadonly<ICharacter>,
        _ally: DeepReadonly<ICharacter>
    ): TacticalAction {
        return {
            type: 'speech',
            priority: 30,
            command: {
                type: 'speech',
                source: character.name,
                content: 'Mantén la posición, estoy cubriendo tu flanco.',
                answers: ['Entendido', 'Necesito apoyo', 'Cambio de posición']
            },
            reasoning: 'Coordinating with ally'
        };
    }

    /**
     * Create a patrol action when there are no threats
     */
    private static createPatrolAction(character: DeepReadonly<ICharacter>, _state: State, directivePosition?: ICoord): TacticalAction {
        // Move to objective or patrol randomly
        if (directivePosition) {
            return {
                type: 'movement',
                priority: 50,
                command: {
                    type: 'movement',
                    characters: [{
                        name: character.name,
                        location: `${directivePosition.x},${directivePosition.y}`
                    }]
                },
                reasoning: 'Moving to objective'
            };
        }

        // Random patrol
        const patrolX = character.position.x + (Math.random() - 0.5) * 10;
        const patrolY = character.position.y + (Math.random() - 0.5) * 10;

        return {
            type: 'movement',
            priority: 40,
            command: {
                type: 'movement',
                characters: [{
                    name: character.name,
                    location: `${Math.round(patrolX)},${Math.round(patrolY)}`
                }]
            },
            reasoning: 'Patrolling area'
        };
    }
}
