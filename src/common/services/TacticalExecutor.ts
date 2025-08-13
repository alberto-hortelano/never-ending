import { DeepReadonly } from '../helpers/types';
import { ICharacter, ICoord } from '../interfaces';
import { State } from '../State';
import { TeamService } from './TeamService';
import { AICommand } from './AICommandParser';

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

interface ThreatAssessment {
    character: DeepReadonly<ICharacter>;
    threatLevel: number; // 0-100
    distance: number;
    hasLineOfSight: boolean;
    isInCover: boolean;
    weaponEffectiveness: number; // 0-100
}

interface PositionEvaluation {
    position: ICoord;
    coverScore: number; // 0-100
    tacticalValue: number; // 0-100
    distanceToObjective: number;
    exposureRisk: number; // 0-100
}

export class TacticalExecutor {
    private static instance: TacticalExecutor;
    private currentDirective?: TacticalDirective;
    private lastActions: Map<string, string> = new Map(); // Track last action per character
    private turnActions: Map<string, string[]> = new Map(); // Track all actions taken this turn

    private constructor() {}

    public static getInstance(): TacticalExecutor {
        if (!TacticalExecutor.instance) {
            TacticalExecutor.instance = new TacticalExecutor();
        }
        return TacticalExecutor.instance;
    }

    /**
     * Set the current tactical directive from high-level AI
     */
    public setDirective(directive: TacticalDirective): void {
        this.currentDirective = directive;
        console.log('[TacticalExecutor] New directive:', directive.objective, 'with stance:', directive.tactics.stance);
    }
    
    /**
     * Clear turn actions for a new turn
     */
    public clearTurnActions(): void {
        this.turnActions.clear();
        console.log('[TacticalExecutor] Cleared turn actions for new turn');
    }

    /**
     * Evaluate the situation and decide on the best action
     */
    public evaluateSituation(
        character: DeepReadonly<ICharacter>,
        state: State,
        visibleCharacters: DeepReadonly<ICharacter>[]
    ): TacticalAction {
        // If no directive, default to defensive behavior
        if (!this.currentDirective) {
            this.currentDirective = this.getDefaultDirective();
        }

        // Double-check to filter out any dead characters that might have slipped through
        const aliveVisibleCharacters = visibleCharacters.filter(c => c.health > 0);

        // Assess threats
        const threats = this.assessThreats(character, aliveVisibleCharacters, state);
        
        // Evaluate current position
        const currentPositionValue = this.evaluatePosition(character.position, character, threats, state);
        
        // Get possible actions based on directive and situation
        const possibleActions = this.generatePossibleActions(
            character,
            threats,
            currentPositionValue,
            state
        );


        // Score and sort actions
        const scoredActions = possibleActions
            .map(action => this.scoreAction(action, character, threats, state))
            .sort((a, b) => b.priority - a.priority);

        // Return the best action
        const bestAction = scoredActions[0] || this.getDefaultAction(character);
        
        // Track this action
        this.lastActions.set(character.name, bestAction.type);
        
        // Track all actions taken this turn
        const turnActions = this.turnActions.get(character.name) || [];
        turnActions.push(bestAction.type);
        this.turnActions.set(character.name, turnActions);
        
        console.log(`[TacticalExecutor] ${character.name} chose:`, bestAction.type, 
                    `(priority: ${bestAction.priority}) -`, bestAction.reasoning);
        
        return bestAction;
    }

    /**
     * Assess threats from visible enemies
     */
    private assessThreats(
        character: DeepReadonly<ICharacter>,
        visibleCharacters: DeepReadonly<ICharacter>[],
        state: State
    ): ThreatAssessment[] {
        const threats: ThreatAssessment[] = [];

        for (const other of visibleCharacters) {
            // Skip allies and defeated characters
            const areAllied = TeamService.areAllied(character, other, state.game.teams);
            
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
            if (this.currentDirective?.priority_targets?.includes(other.name)) {
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
     * Generate possible actions based on current situation
     */
    private generatePossibleActions(
        character: DeepReadonly<ICharacter>,
        threats: ThreatAssessment[],
        currentPositionValue: PositionEvaluation,
        state: State
    ): TacticalAction[] {
        const actions: TacticalAction[] = [];
        const stance = this.currentDirective?.tactics.stance || 'defensive';
        const primaryThreat = threats[0];

        // Check health for retreat threshold
        const healthPercent = character.health / character.maxHealth;
        const shouldRetreat = healthPercent <= (this.currentDirective?.tactics.retreat_threshold || 0.3);

        // Generate actions based on stance
        switch (stance) {
            case 'aggressive':
                actions.push(...this.generateAggressiveActions(character, threats, state));
                break;
            case 'defensive':
                actions.push(...this.generateDefensiveActions(character, threats, currentPositionValue, state));
                break;
            case 'flanking':
                actions.push(...this.generateFlankingActions(character, threats, state));
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
                    actions.push(...this.generateDefensiveActions(character, threats, currentPositionValue, state));
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
            if (nearbyAlly && this.getDistance(character.position, nearbyAlly.position) <= 3) {
                actions.push(this.createSpeechAction(character, nearbyAlly));
            }
        }

        return actions;
    }

    /**
     * Generate aggressive stance actions
     */
    private generateAggressiveActions(
        character: DeepReadonly<ICharacter>,
        threats: ThreatAssessment[],
        state: State
    ): TacticalAction[] {
        const actions: TacticalAction[] = [];
        const primaryThreat = threats[0];

        if (!primaryThreat) {
            // No threats, move toward objective or patrol
            return [this.createPatrolAction(character, state)];
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
                        attack: 'melee'
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
                        attack: 'kill'
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
    private generateDefensiveActions(
        character: DeepReadonly<ICharacter>,
        threats: ThreatAssessment[],
        currentPositionValue: PositionEvaluation,
        state: State
    ): TacticalAction[] {
        const actions: TacticalAction[] = [];
        const primaryThreat = threats[0];


        // Take cover if exposed
        if (currentPositionValue.exposureRisk > 60) {
            const coverPosition = this.findBestCoverPosition(character, threats, state);
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
                            attack: 'kill'
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
                    reasoning: `Moving to get line of sight on ${primaryThreat.character.name}`
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
        const turnActions = this.turnActions.get(character.name) || [];
        const hasAttackedThisTurn = turnActions.includes('attack');
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
                        attack: 'hold'
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
    private generateFlankingActions(
        character: DeepReadonly<ICharacter>,
        threats: ThreatAssessment[],
        state: State
    ): TacticalAction[] {
        const actions: TacticalAction[] = [];
        const primaryThreat = threats[0];

        if (!primaryThreat) {
            return [this.createPatrolAction(character, state)];
        }

        // Find flanking position
        const flankPosition = this.findFlankingPosition(character, primaryThreat.character, state);
        
        if (flankPosition) {
            const distanceToFlank = this.getDistance(character.position, flankPosition);
            
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
                            attack: 'kill'
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
    private generateSuppressiveActions(
        character: DeepReadonly<ICharacter>,
        threats: ThreatAssessment[],
        state: State
    ): TacticalAction[] {
        const actions: TacticalAction[] = [];

        // Find good overwatch position
        const overwatchPosition = this.findBestOverwatchPosition(character, threats, state);
        
        if (overwatchPosition && this.getDistance(character.position, overwatchPosition) > 1) {
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
    private generateRetreatActions(
        character: DeepReadonly<ICharacter>,
        threats: ThreatAssessment[],
        state: State
    ): TacticalAction[] {
        const actions: TacticalAction[] = [];
        
        // Find retreat position away from threats
        const retreatPosition = this.findRetreatPosition(character, threats, state);
        
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
                        attack: 'retreat'
                    }]
                },
                reasoning: 'Fighting retreat'
            });
        }

        return actions;
    }

    /**
     * Score an action based on current situation
     */
    private scoreAction(
        action: TacticalAction,
        character: DeepReadonly<ICharacter>,
        threats: ThreatAssessment[],
        _state: State
    ): TacticalAction {
        let score = action.priority;

        // Adjust based on action points available
        const actionCost = this.estimateActionCost(action.type, character);
        const pointsLeft = character.actions?.pointsLeft || 100;
        
        if (actionCost > pointsLeft) {
            score -= 50; // Heavily penalize actions we can't afford
        } else {
            // Bonus for actions that efficiently use remaining points
            if (pointsLeft < 40 && actionCost <= pointsLeft) {
                score += 10; // Encourage using last action points
            }
        }

        // Bonus for variety (don't repeat same action)
        const lastAction = this.lastActions.get(character.name);
        if (lastAction === action.type) {
            score -= 10;
        }

        // Adjust based on directive objective
        if (this.currentDirective) {
            if (this.currentDirective.objective === 'attack' && action.type === 'attack') {
                score += 15;
            } else if (this.currentDirective.objective === 'defend' && action.type === 'overwatch') {
                score += 15;
            } else if (this.currentDirective.objective === 'retreat' && action.type === 'movement') {
                score += 20;
            }
        }

        // Threat proximity adjustment
        const closestThreat = threats[0];
        if (closestThreat) {
            if (closestThreat.distance <= 3 && action.type === 'attack') {
                score += 10;
            } else if (closestThreat.distance > 10 && action.type === 'movement') {
                score += 5;
            }
        }
        

        return { ...action, priority: Math.max(0, Math.min(100, score)) };
    }

    // Helper methods
    
    private getDistance(from: ICoord, to: ICoord): number {
        return Math.sqrt(
            Math.pow(to.x - from.x, 2) +
            Math.pow(to.y - from.y, 2)
        );
    }

    private checkLineOfSight(from: ICoord, to: ICoord, state: State): boolean {
        // Use Bresenham's line algorithm to check for obstacles
        const map = state.map;
        const dx = Math.abs(to.x - from.x);
        const dy = Math.abs(to.y - from.y);
        const sx = from.x < to.x ? 1 : -1;
        const sy = from.y < to.y ? 1 : -1;
        let err = dx - dy;
        let x = Math.round(from.x);
        let y = Math.round(from.y);
        const targetX = Math.round(to.x);
        const targetY = Math.round(to.y);

        while (x !== targetX || y !== targetY) {
            // Skip the starting position
            if (x !== Math.round(from.x) || y !== Math.round(from.y)) {
                const cell = map[y]?.[x];
                if (cell?.content?.blocker) {
                    return false; // Obstacle blocks line of sight
                }

                // Check if a character is blocking line of sight (except at the target position)
                if (!(x === targetX && y === targetY)) {
                    const blockingChar = state.characters.find(c => 
                        Math.round(c.position.x) === x && 
                        Math.round(c.position.y) === y &&
                        c.health > 0
                    );
                    if (blockingChar) {
                        return false; // Character blocks line of sight
                    }
                }
            }

            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x += sx;
            }
            if (e2 < dx) {
                err += dx;
                y += sy;
            }
        }

        return true;
    }

    private characterHasRangedWeapon(character: DeepReadonly<ICharacter>): boolean {
        const primary = character.inventory?.equippedWeapons?.primary;
        const secondary = character.inventory?.equippedWeapons?.secondary;
        return (primary?.category === 'ranged') || (secondary?.category === 'ranged');
    }

    private isInCover(_position: ICoord, _state: State): boolean {
        // Check if position has adjacent walls/obstacles
        // Simplified for now
        return false;
    }

    private calculateWeaponEffectiveness(
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

    private evaluatePosition(
        position: ICoord,
        _character: DeepReadonly<ICharacter>,
        threats: ThreatAssessment[],
        state: State
    ): PositionEvaluation {
        let coverScore = 0;
        let tacticalValue = 50;
        let exposureRisk = 50;
        
        // Check for nearby cover (simplified)
        // In a real implementation, check for adjacent walls/obstacles
        coverScore = this.isInCover(position, state) ? 70 : 30;
        
        // Calculate exposure based on visible threats
        const visibleThreats = threats.filter(t => t.hasLineOfSight);
        exposureRisk = Math.min(100, visibleThreats.length * 25);
        
        // Tactical value based on position relative to objective
        if (this.currentDirective?.position) {
            const distanceToObjective = this.getDistance(position, this.currentDirective.position);
            tacticalValue = Math.max(0, 100 - distanceToObjective * 2);
        }
        
        return {
            position,
            coverScore,
            tacticalValue,
            distanceToObjective: this.currentDirective?.position ? 
                this.getDistance(position, this.currentDirective.position) : 0,
            exposureRisk
        };
    }

    private findBestCoverPosition(
        character: DeepReadonly<ICharacter>,
        _threats: ThreatAssessment[],
        state: State
    ): ICoord | null {
        // Find positions with good cover nearby
        // Simplified - in real implementation, analyze map for cover positions
        const currentPos = character.position;
        const searchRadius = 5;
        
        // Check positions around character
        for (let dx = -searchRadius; dx <= searchRadius; dx++) {
            for (let dy = -searchRadius; dy <= searchRadius; dy++) {
                const pos: ICoord = {
                    x: currentPos.x + dx,
                    y: currentPos.y + dy
                };
                
                // Skip if too far or same position
                if (this.getDistance(currentPos, pos) > searchRadius || 
                    (dx === 0 && dy === 0)) {
                    continue;
                }
                
                // Evaluate this position
                const evaluation = this.evaluatePosition(pos, character, _threats, state);
                if (evaluation.coverScore > 60 && evaluation.exposureRisk < 40) {
                    return pos;
                }
            }
        }
        
        return null;
    }

    private findFlankingPosition(
        character: DeepReadonly<ICharacter>,
        target: DeepReadonly<ICharacter>,
        _state: State
    ): ICoord | null {
        // Find position to the side of target
        const angle = Math.atan2(
            target.position.y - character.position.y,
            target.position.x - character.position.x
        );
        
        // Try 90 degrees to either side
        const flankAngles = [angle + Math.PI/2, angle - Math.PI/2];
        const flankDistance = 5;
        
        for (const flankAngle of flankAngles) {
            const pos: ICoord = {
                x: target.position.x + Math.cos(flankAngle) * flankDistance,
                y: target.position.y + Math.sin(flankAngle) * flankDistance
            };
            
            // Check if position is valid (simplified)
            if (pos.x >= 0 && pos.y >= 0 && pos.x <= 100 && pos.y <= 100) {
                return pos;
            }
        }
        
        return null;
    }

    private findBestOverwatchPosition(
        character: DeepReadonly<ICharacter>,
        threats: ThreatAssessment[],
        state: State
    ): ICoord | null {
        // Find elevated or defensive position with good sight lines
        // Simplified - return current position if it has cover
        if (this.isInCover(character.position, state)) {
            return character.position;
        }
        
        return this.findBestCoverPosition(character, threats, state);
    }

    private findRetreatPosition(
        character: DeepReadonly<ICharacter>,
        threats: ThreatAssessment[],
        _state: State
    ): ICoord | null {
        if (threats.length === 0) {
            return null;
        }
        
        // Calculate average threat direction
        let avgX = 0, avgY = 0;
        for (const threat of threats) {
            avgX += threat.character.position.x;
            avgY += threat.character.position.y;
        }
        avgX /= threats.length;
        avgY /= threats.length;
        
        // Move away from average threat position
        const retreatAngle = Math.atan2(
            character.position.y - avgY,
            character.position.x - avgX
        );
        
        const retreatDistance = 8;
        const retreatPos: ICoord = {
            x: Math.round(character.position.x + Math.cos(retreatAngle) * retreatDistance),
            y: Math.round(character.position.y + Math.sin(retreatAngle) * retreatDistance)
        };
        
        // Clamp to map bounds
        retreatPos.x = Math.max(0, Math.min(100, retreatPos.x));
        retreatPos.y = Math.max(0, Math.min(100, retreatPos.y));
        
        return retreatPos;
    }

    private findNearbyAlly(character: DeepReadonly<ICharacter>, state: State): DeepReadonly<ICharacter> | null {
        for (const other of state.characters) {
            if (other.name !== character.name && 
                TeamService.areAllied(character, other, state.game.teams) &&
                other.health > 0) {
                return other;
            }
        }
        return null;
    }

    private createSpeechAction(
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

    private createPatrolAction(character: DeepReadonly<ICharacter>, _state: State): TacticalAction {
        // Move to objective or patrol randomly
        if (this.currentDirective?.position) {
            return {
                type: 'movement',
                priority: 50,
                command: {
                    type: 'movement',
                    characters: [{
                        name: character.name,
                        location: `${this.currentDirective.position.x},${this.currentDirective.position.y}`
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

    private estimateActionCost(actionType: string, character: DeepReadonly<ICharacter>): number {
        // Estimate action point cost
        const costs = {
            movement: character.actions?.general?.move || 20,
            attack: character.actions?.rangedCombat?.shoot || 30,
            overwatch: character.actions?.rangedCombat?.overwatch || 40,
            speech: 0,
            reload: 20,
            heal: 30
        };
        
        return costs[actionType as keyof typeof costs] || 20;
    }

    private getDefaultDirective(): TacticalDirective {
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

    private getDefaultAction(character: DeepReadonly<ICharacter>): TacticalAction {
        // Default to patrol movement if no threats
        // Ensure we move at least 2 units away
        const angle = Math.random() * Math.PI * 2;
        const distance = 3 + Math.random() * 3; // Between 3 and 6 units
        const patrolX = character.position.x + Math.cos(angle) * distance;
        const patrolY = character.position.y + Math.sin(angle) * distance;
        
        // Clamp to reasonable bounds
        const clampedX = Math.max(0, Math.min(100, Math.round(patrolX)));
        const clampedY = Math.max(0, Math.min(100, Math.round(patrolY)));
        
        return {
            type: 'movement',
            priority: 10,
            command: {
                type: 'movement',
                characters: [{
                    name: character.name,
                    location: `${clampedX},${clampedY}`
                }]
            },
            reasoning: 'No threats detected - patrolling'
        };
    }
}