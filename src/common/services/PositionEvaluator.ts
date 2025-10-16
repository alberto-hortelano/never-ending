import type { ICharacter, ICoord } from '../interfaces';
import type { DeepReadonly } from '../helpers/types';
import type { State } from '../State';
import type { ThreatAssessment } from './ThreatAnalyzer';
import { AISpatialUtils } from './AISpatialUtils';

export interface PositionEvaluation {
    position: ICoord;
    coverScore: number; // 0-100
    tacticalValue: number; // 0-100
    distanceToObjective: number;
    exposureRisk: number; // 0-100
}

/**
 * Evaluates tactical value of positions on the map
 */
export class PositionEvaluator {
    /**
     * Evaluate the tactical value of a position
     */
    public static evaluatePosition(
        position: ICoord,
        _character: DeepReadonly<ICharacter>,
        threats: ThreatAssessment[],
        state: State,
        objectivePosition?: ICoord
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
        if (objectivePosition) {
            const distanceToObjective = this.getDistance(position, objectivePosition);
            tacticalValue = Math.max(0, 100 - distanceToObjective * 2);
        }

        return {
            position,
            coverScore,
            tacticalValue,
            distanceToObjective: objectivePosition ?
                this.getDistance(position, objectivePosition) : 0,
            exposureRisk
        };
    }

    /**
     * Find the best cover position near a character
     */
    public static findBestCoverPosition(
        character: DeepReadonly<ICharacter>,
        threats: ThreatAssessment[],
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
                const evaluation = this.evaluatePosition(pos, character, threats, state);
                if (evaluation.coverScore > 60 && evaluation.exposureRisk < 40) {
                    return pos;
                }
            }
        }

        return null;
    }

    /**
     * Find a flanking position relative to a target
     */
    public static findFlankingPosition(
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

    /**
     * Find the best overwatch position with good sight lines
     */
    public static findBestOverwatchPosition(
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

    /**
     * Find a retreat position away from threats
     */
    public static findRetreatPosition(
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

    /**
     * Calculate Euclidean distance between two positions
     */
    private static getDistance(pos1: ICoord, pos2: ICoord): number {
        return AISpatialUtils.getDistance(pos1, pos2);
    }

    /**
     * Check if a position has cover (adjacent walls/obstacles)
     */
    private static isInCover(_position: ICoord, _state: State): boolean {
        // Check if position has adjacent walls/obstacles
        // Simplified for now
        return false;
    }
}
