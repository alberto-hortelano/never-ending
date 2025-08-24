import { ObjectValidator } from './ObjectValidator';
import { MissionValidator } from './MissionValidator';
import type { IStoryPlan } from '../interfaces';

/**
 * Validator for IStoryPlan objects from AI responses
 */
export class StoryPlanValidator extends ObjectValidator<IStoryPlan> {
    private missionValidator: MissionValidator;

    constructor() {
        super();
        this.missionValidator = new MissionValidator();
    }

    protected getObjectType(): string {
        return 'StoryPlan';
    }

    protected getArrayFields(): string[] {
        return ['acts'];
    }

    protected getStringFields(): string[] {
        return ['overallNarrative', 'theme'];
    }

    protected performValidation(obj: unknown): boolean {
        const plan = obj as Record<string, unknown>;
        let isValid = true;

        // Required string fields
        isValid = this.validateRequiredField(plan, 'overallNarrative', 'string') && isValid;
        isValid = this.validateRequiredField(plan, 'theme', 'string') && isValid;

        // Required array field
        isValid = this.validateArrayField(plan, 'acts', true) && isValid;

        // Validate acts structure
        if (Array.isArray(plan.acts)) {
            if (plan.acts.length === 0) {
                this.addError('acts', 'non-empty array', 'empty array', 
                    'Story plan must have at least one act');
                isValid = false;
            } else {
                plan.acts.forEach((act: unknown, index: number) => {
                    if (!this.validateAct(act as Record<string, unknown>, index)) {
                        isValid = false;
                    }
                });
            }
        }

        // Required number fields
        isValid = this.validateRequiredField(plan, 'currentAct', 'number') && isValid;
        isValid = this.validateRequiredField(plan, 'currentScene', 'number') && isValid;
        isValid = this.validateRequiredField(plan, 'totalEstimatedMissions', 'number') && isValid;

        // Validate currentAct is within bounds
        if (typeof plan.currentAct === 'number' && Array.isArray(plan.acts)) {
            if (plan.currentAct < 0 || plan.currentAct >= plan.acts.length) {
                this.addError('currentAct', 'valid index', String(plan.currentAct),
                    `currentAct must be between 0 and ${plan.acts.length - 1}`);
                isValid = false;
            }
        }

        return isValid;
    }

    private validateAct(act: Record<string, unknown>, index: number): boolean {
        let isValid = true;

        // Required string fields
        if (!act.id || typeof act.id !== 'string') {
            this.addError(`acts[${index}].id`, 'string', typeof act.id,
                `Act ${index} must have an id`);
            isValid = false;
        }

        if (!act.title || typeof act.title !== 'string') {
            this.addError(`acts[${index}].title`, 'string', typeof act.title,
                `Act ${index} must have a title`);
            isValid = false;
        }

        // Language-specific fields removed - AI responds in the configured language

        if (!act.description || typeof act.description !== 'string') {
            this.addError(`acts[${index}].description`, 'string', typeof act.description,
                `Act ${index} must have a description`);
            isValid = false;
        }

        // Language-specific fields removed - AI responds in the configured language

        if (typeof act.actNumber !== 'number') {
            this.addError(`acts[${index}].actNumber`, 'number', typeof act.actNumber,
                `Act ${index} must have an actNumber`);
            isValid = false;
        }

        if (!act.climaxDescription || typeof act.climaxDescription !== 'string') {
            this.addError(`acts[${index}].climaxDescription`, 'string', typeof act.climaxDescription,
                `Act ${index} must have a climaxDescription`);
            isValid = false;
        }

        // Required array fields
        if (!Array.isArray(act.missions)) {
            this.addError(`acts[${index}].missions`, 'array', typeof act.missions,
                `Act ${index} must have a missions array`);
            isValid = false;
        } else {
            // Validate each mission in the act
            act.missions.forEach((mission: unknown, missionIndex: number) => {
                const missionResult = this.missionValidator.validate(mission);
                if (!missionResult.isValid) {
                    missionResult.errors.forEach(error => {
                        this.errors.push({
                            field: `acts[${index}].missions[${missionIndex}]`,
                            expectedType: 'valid mission',
                            actualType: 'invalid mission',
                            message: error
                        });
                    });
                    isValid = false;
                }
            });
        }

        if (!Array.isArray(act.keyCharacters)) {
            this.addError(`acts[${index}].keyCharacters`, 'array', typeof act.keyCharacters,
                `Act ${index} must have a keyCharacters array`);
            isValid = false;
        }

        if (!Array.isArray(act.keyObjects)) {
            this.addError(`acts[${index}].keyObjects`, 'array', typeof act.keyObjects,
                `Act ${index} must have a keyObjects array`);
            isValid = false;
        }

        return isValid;
    }

    /**
     * Fix common issues in story plan
     */
    public override attemptAutoFix(obj: Record<string, unknown>): Record<string, unknown> {
        const fixed = super.attemptAutoFix(obj);

        // Ensure acts is an array
        if (!Array.isArray(fixed.acts)) {
            fixed.acts = [];
        }

        // Fix each act
        fixed.acts = (fixed.acts as Record<string, unknown>[]).map((act, index) => {
            const fixedAct = { ...act };

            // Ensure required arrays exist
            if (!Array.isArray(fixedAct.missions)) {
                fixedAct.missions = [];
            }
            if (!Array.isArray(fixedAct.keyCharacters)) {
                fixedAct.keyCharacters = [];
            }
            if (!Array.isArray(fixedAct.keyObjects)) {
                fixedAct.keyObjects = [];
            }

            // Fix missions in the act
            fixedAct.missions = (fixedAct.missions as unknown[]).map(mission => {
                if (mission && typeof mission === 'object') {
                    return this.missionValidator.attemptAutoFix(mission as Record<string, unknown>);
                }
                return mission;
            });

            // Ensure act has required fields
            if (!fixedAct.id) {
                fixedAct.id = `act${index + 1}`;
            }
            if (!fixedAct.actNumber) {
                fixedAct.actNumber = index + 1;
            }
            // Set default values for optional language fields if missing
            if (!fixedAct.title) {
                fixedAct.title = `Act ${index + 1}`;
            }
            if (!fixedAct.description) {
                fixedAct.description = 'Act description';
            }

            return fixedAct;
        });

        // Ensure numeric fields exist
        if (typeof fixed.currentAct !== 'number') {
            fixed.currentAct = 0;
        }
        if (typeof fixed.currentScene !== 'number') {
            fixed.currentScene = 0;
        }
        if (typeof fixed.totalEstimatedMissions !== 'number') {
            fixed.totalEstimatedMissions = 10;
        }

        return fixed;
    }

    /**
     * Create a default story plan structure
     */
    public createDefaultStoryPlan(partial?: Partial<IStoryPlan>): IStoryPlan {
        return {
            overallNarrative: partial?.overallNarrative || 'A story of survival and discovery',
            theme: partial?.theme || 'Survival',
            acts: partial?.acts || [{
                id: 'act1',
                actNumber: 1,
                title: 'Beginning',
                description: 'The story begins',
                missions: [],
                keyCharacters: [],
                keyObjects: [],
                climaxDescription: 'A revelation'
            }],
            currentAct: partial?.currentAct || 0,
            currentScene: partial?.currentScene || 0,
            totalEstimatedMissions: partial?.totalEstimatedMissions || 10
        };
    }
}