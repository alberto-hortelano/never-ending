import { DeepReadonly } from '../helpers/types';
import { ICharacter } from '../interfaces';
import { State } from '../State';
import { ThreatAnalyzer } from './ThreatAnalyzer';
import { PositionEvaluator } from './PositionEvaluator';
import { TacticalActionGenerator, TacticalDirective, TacticalAction } from './TacticalActionGenerator';

export { TacticalDirective, TacticalAction } from './TacticalActionGenerator';

/**
 * Main tactical decision-making service for AI characters
 * Coordinates threat analysis, position evaluation, and action generation
 */
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
            this.currentDirective = TacticalActionGenerator.getDefaultDirective();
        }

        // Double-check to filter out any dead characters that might have slipped through
        const aliveVisibleCharacters = visibleCharacters.filter(c => c.health > 0);

        // Assess threats
        const threats = ThreatAnalyzer.assessThreats(character, aliveVisibleCharacters, state, this.currentDirective);

        // Evaluate current position
        const currentPositionValue = PositionEvaluator.evaluatePosition(
            character.position,
            character,
            threats,
            state,
            this.currentDirective.position
        );

        // Get possible actions based on directive and situation
        const possibleActions = TacticalActionGenerator.generateActions(
            character,
            threats,
            currentPositionValue,
            this.currentDirective,
            state,
            this.turnActions
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
     * Score an action based on current situation
     */
    private scoreAction(
        action: TacticalAction,
        character: DeepReadonly<ICharacter>,
        threats: { distance: number }[],
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

    /**
     * Estimate action point cost for an action type
     */
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

    /**
     * Get default action when no better options are available
     */
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
