import { ObjectValidator } from './ObjectValidator';
import type { IMission } from '../interfaces';

/**
 * Validator for IMission objects from AI responses
 */
export class MissionValidator extends ObjectValidator<IMission> {
    
    protected getObjectType(): string {
        return 'Mission';
    }

    protected getArrayFields(): string[] {
        return ['objectives', 'requiredObjects', 'npcs', 'narrativeHooks'];
    }

    protected getStringFields(): string[] {
        return ['id', 'actId', 'name', 'description', 'type'];
    }

    protected performValidation(obj: unknown): boolean {
        const mission = obj as Record<string, unknown>;
        let isValid = true;

        // Required string fields
        isValid = this.validateRequiredField(mission, 'id', 'string') && isValid;
        isValid = this.validateRequiredField(mission, 'actId', 'string') && isValid;
        isValid = this.validateRequiredField(mission, 'name', 'string') && isValid;
        isValid = this.validateRequiredField(mission, 'description', 'string') && isValid;
        isValid = this.validateRequiredField(mission, 'type', 'string') && isValid;

        // Validate type enum
        if (mission.type && typeof mission.type === 'string') {
            const validTypes = ['combat', 'exploration', 'infiltration', 'diplomacy', 'survival'];
            if (!validTypes.includes(mission.type)) {
                this.addError('type', 'enum', mission.type, 
                    `Mission type must be one of: ${validTypes.join(', ')}`);
                isValid = false;
            }
        }

        // Required array fields
        isValid = this.validateArrayField(mission, 'objectives', true) && isValid;
        isValid = this.validateArrayField(mission, 'requiredObjects', true) && isValid;
        isValid = this.validateArrayField(mission, 'npcs', true) && isValid;
        isValid = this.validateArrayField(mission, 'narrativeHooks', true) && isValid;

        // Validate objectives structure
        if (Array.isArray(mission.objectives)) {
            mission.objectives.forEach((obj: unknown, index: number) => {
                if (!this.validateObjective(obj as Record<string, unknown>, index)) {
                    isValid = false;
                }
            });
        }

        // Required object field
        if (!mission.mapContext || typeof mission.mapContext !== 'object') {
            this.addError('mapContext', 'object', typeof mission.mapContext, 
                'Mission must have a mapContext object');
            isValid = false;
        } else {
            isValid = this.validateMapContext(mission.mapContext as Record<string, unknown>) && isValid;
        }

        // Required number field
        isValid = this.validateRequiredField(mission, 'estimatedDuration', 'number') && isValid;

        // Required boolean fields
        isValid = this.validateRequiredField(mission, 'isCompleted', 'boolean') && isValid;
        isValid = this.validateRequiredField(mission, 'isCurrent', 'boolean') && isValid;

        return isValid;
    }

    private validateObjective(obj: Record<string, unknown>, index: number): boolean {
        let isValid = true;

        if (!obj.id || typeof obj.id !== 'string') {
            this.addError(`objectives[${index}].id`, 'string', typeof obj.id,
                `Objective ${index} must have an id`);
            isValid = false;
        }

        if (!obj.description || typeof obj.description !== 'string') {
            this.addError(`objectives[${index}].description`, 'string', typeof obj.description,
                `Objective ${index} must have a description`);
            isValid = false;
        }

        // Language-specific fields removed - AI responds in the configured language

        if (!obj.type || typeof obj.type !== 'string') {
            this.addError(`objectives[${index}].type`, 'string', typeof obj.type,
                `Objective ${index} must have a type`);
            isValid = false;
        } else {
            const validTypes = ['primary', 'secondary', 'hidden'];
            if (!validTypes.includes(obj.type as string)) {
                this.addError(`objectives[${index}].type`, 'enum', obj.type as string,
                    `Objective type must be one of: ${validTypes.join(', ')}`);
                isValid = false;
            }
        }

        if (typeof obj.completed !== 'boolean') {
            this.addError(`objectives[${index}].completed`, 'boolean', typeof obj.completed,
                `Objective ${index} must have a completed boolean`);
            isValid = false;
        }

        if (!Array.isArray(obj.conditions)) {
            this.addError(`objectives[${index}].conditions`, 'array', typeof obj.conditions,
                `Objective ${index} must have a conditions array`);
            isValid = false;
        } else {
            obj.conditions.forEach((cond: unknown, condIndex: number) => {
                if (!this.validateCondition(cond as Record<string, unknown>, index, condIndex)) {
                    isValid = false;
                }
            });
        }

        return isValid;
    }

    private validateCondition(cond: Record<string, unknown>, objIndex: number, condIndex: number): boolean {
        let isValid = true;

        if (!cond.type || typeof cond.type !== 'string') {
            this.addError(`objectives[${objIndex}].conditions[${condIndex}].type`, 'string', typeof cond.type,
                `Condition must have a type`);
            isValid = false;
        } else {
            const validTypes = ['kill', 'reach', 'collect', 'talk', 'survive', 'escort', 'destroy'];
            if (!validTypes.includes(cond.type as string)) {
                this.addError(`objectives[${objIndex}].conditions[${condIndex}].type`, 'enum', cond.type as string,
                    `Condition type must be one of: ${validTypes.join(', ')}`);
                isValid = false;
            }
        }

        return isValid;
    }

    private validateMapContext(context: Record<string, unknown>): boolean {
        let isValid = true;

        if (!context.environment || typeof context.environment !== 'string') {
            this.addError('mapContext.environment', 'string', typeof context.environment,
                'MapContext must have an environment');
            isValid = false;
        } else {
            const validEnvs = ['spaceship', 'station', 'planet', 'settlement', 'ruins', 'wilderness'];
            if (!validEnvs.includes(context.environment as string)) {
                this.addError('mapContext.environment', 'enum', context.environment as string,
                    `Environment must be one of: ${validEnvs.join(', ')}`);
                isValid = false;
            }
        }

        if (!context.atmosphere || typeof context.atmosphere !== 'string') {
            this.addError('mapContext.atmosphere', 'string', typeof context.atmosphere,
                'MapContext must have an atmosphere description');
            isValid = false;
        }

        if (!context.lightingCondition || typeof context.lightingCondition !== 'string') {
            this.addError('mapContext.lightingCondition', 'string', typeof context.lightingCondition,
                'MapContext must have a lightingCondition');
            isValid = false;
        } else {
            const validLighting = ['bright', 'normal', 'dim', 'dark'];
            if (!validLighting.includes(context.lightingCondition as string)) {
                this.addError('mapContext.lightingCondition', 'enum', context.lightingCondition as string,
                    `Lighting condition must be one of: ${validLighting.join(', ')}`);
                isValid = false;
            }
        }

        return isValid;
    }

    /**
     * Create a default mission structure with all required fields
     */
    public createDefaultMission(partial?: Partial<IMission>): IMission {
        return {
            id: partial?.id || `mission_${Date.now()}`,
            actId: partial?.actId || 'act1',
            name: partial?.name || 'Default Mission',
            description: partial?.description || 'A mission',
            type: partial?.type || 'exploration',
            objectives: partial?.objectives || [],
            requiredObjects: partial?.requiredObjects || [],
            npcs: partial?.npcs || [],
            mapContext: partial?.mapContext || {
                environment: 'station',
                atmosphere: 'mysterious',
                lightingCondition: 'normal',
                specialFeatures: []
            },
            narrativeHooks: partial?.narrativeHooks || [],
            estimatedDuration: partial?.estimatedDuration || 10,
            isCompleted: partial?.isCompleted || false,
            isCurrent: partial?.isCurrent || false
        };
    }
}